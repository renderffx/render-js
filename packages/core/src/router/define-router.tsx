
import type { ReactNode } from 'react';
import { createCustomError, getErrorInfo } from '../lib/utils/custom-errors.js';
import { getPathMapping } from '../lib/utils/path.js';
import type { PathSpec } from '../lib/utils/path.js';
import { base64ToStream } from '../lib/utils/stream.js';
import { unstable_defineHandlers as defineHandlers } from '../minimal/server.js';
import { unstable_getContext as getContext } from '../lib/context.js';
import { INTERNAL_ServerRouter } from './client.js';
import {
  HAS404_ID,
  IS_STATIC_ID,
  ROUTE_ID,
  SKIP_HEADER,
  decodeRoutePath,
  decodeSliceId,
  encodeRoutePath,
  pathnameToRoutePath,
} from './common.js';


export type ApiHandler = (
  req: Request,
  apiContext: { params: Record<string, string | string[]> },
) => Promise<Response>;

type SlotId = string;

const ROOT_SLOT_ID = 'root';
const ROUTE_SLOT_ID_PREFIX = 'route:';
const SLICE_SLOT_ID_PREFIX = 'slice:';

export type RouteConfig = {
  type: 'route';
  path: PathSpec;
  isStatic: boolean;
  pathPattern?: PathSpec;
  rootElement: { isStatic: boolean; renderer: (opt: RendererOption) => ReactNode };
  routeElement: { isStatic: boolean; renderer: (opt: RendererOption) => ReactNode };
  elements: Record<SlotId, { isStatic: boolean; renderer: (opt: RendererOption) => ReactNode }>;
  noSsr?: boolean;
  slices?: string[];
};

export type ApiConfig = {
  type: 'api';
  path: PathSpec;
  isStatic: boolean;
  handler: ApiHandler;
};

export type SliceConfig = {
  type: 'slice';
  id: string;
  isStatic: boolean;
  renderer: () => Promise<ReactNode>;
};

type RendererOption = { routePath: string; query: string | undefined };

// ============================================================================
// Context Keys
// ============================================================================

const RSC_PATH_KEY = '__rsc_path__';
const RSC_PARAMS_KEY = '__rsc_params__';
const RERENDER_KEY = '__rerender__';

type ContextData = Record<string, unknown>;

function setContextValue(key: string, value: unknown): void {
  try {
    const ctx = getContext();
    (ctx.data as ContextData)[key] = value;
  } catch {
    // Context may not be available
  }
}

function getContextValue<T>(key: string): T | undefined {
  try {
    const ctx = getContext();
    return (ctx.data as ContextData)[key] as T | undefined;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Public Context API
// ============================================================================

export function unstable_getRscPath(): string | undefined {
  return getContextValue(RSC_PATH_KEY);
}

export function unstable_getRscParams(): unknown {
  return getContextValue(RSC_PARAMS_KEY);
}

type RerenderFn = (rscPath: string, rscParams?: unknown) => void;

function getRerender(): RerenderFn {
  return getContextValue(RERENDER_KEY) as RerenderFn;
}

function getNonce(): string | undefined {
  try {
    return getContext().nonce;
  } catch {
    return undefined;
  }
}

// ============================================================================
// Navigation Helpers
// ============================================================================

export function unstable_rerenderRoute(pathname: string, query?: string): void {
  const routePath = pathnameToRoutePath(pathname);
  const rscPath = encodeRoutePath(routePath);
  getRerender()(rscPath, query && new URLSearchParams({ query }));
}

export function unstable_notFound(): never {
  throw createCustomError('Not Found', { status: 404 });
}

export function unstable_redirect(
  location: string,
  status: 303 | 307 | 308 = 307,
): never {
  throw createCustomError('Redirect', { status, location });
}

// ============================================================================
// Private Helpers
// ============================================================================

const isStringArray = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((y) => typeof y === 'string');

function parseRscParams(rscParams: unknown): { query: string } {
  if (rscParams instanceof URLSearchParams) {
    return { query: rscParams.get('query') || '' };
  }
  
  if (typeof (rscParams as { query?: undefined } | undefined)?.query === 'string') {
    return { query: (rscParams as { query: string }).query };
  }
  
  return { query: '' };
}

function is404(pathSpec: PathSpec): boolean {
  return (
    pathSpec.length === 1 &&
    pathSpec[0]!.type === 'literal' &&
    pathSpec[0]!.name === '404'
  );
}

function assertNonReservedSlotId(slotId: SlotId): void {
  if (
    slotId === ROOT_SLOT_ID ||
    slotId.startsWith(ROUTE_SLOT_ID_PREFIX) ||
    slotId.startsWith(SLICE_SLOT_ID_PREFIX)
  ) {
    throw new Error('Element ID cannot be "root", "route:*" or "slice:*"');
  }
}

// ============================================================================
// Main Router
// ============================================================================

export function unstable_defineRouter(fns: {
  getConfigs: () => Promise<Iterable<RouteConfig | ApiConfig | SliceConfig>>;
}) {
  // --------------------------------------------------------------------------
  // Config Caching
  // --------------------------------------------------------------------------
  
  let cachedConfig: { configs: (RouteConfig | ApiConfig | SliceConfig)[]; has404: boolean } | undefined;

  const getMyConfig = async () => {
    if (cachedConfig) {
      return cachedConfig;
    }

    const configs = Array.from(await fns.getConfigs());
    let has404 = false;

    for (const item of configs) {
      if (item.type === 'route') {
        Object.keys(item.elements).forEach(assertNonReservedSlotId);
        if (!has404 && is404(item.path)) {
          has404 = true;
        }
      }
    }

    cachedConfig = { configs, has404 };
    return cachedConfig;
  };

  const findPathConfig = async (pathname: string) => {
    const routePath = pathnameToRoutePath(pathname);
    const { configs } = await getMyConfig();

    return configs.find(
      (item): item is RouteConfig | ApiConfig =>
        (item.type === 'route' || item.type === 'api') &&
        !!getPathMapping(item.path, routePath),
    );
  };

  // --------------------------------------------------------------------------
  // Slice Handling
  // --------------------------------------------------------------------------

  const getSliceElement = async (
    sliceConfig: SliceConfig,
    getCached: (id: SlotId) => Promise<ReactNode> | undefined,
    setCached: (id: SlotId, element: ReactNode) => Promise<ReactNode>,
  ): Promise<ReactNode> => {
    const id = SLICE_SLOT_ID_PREFIX + sliceConfig.id;
    const cached = getCached(id);
    if (cached) {
      return cached;
    }

    let element = await sliceConfig.renderer();
    
    if (sliceConfig.isStatic) {
      element = await setCached(id, element);
    }
    
    return element;
  };

  // --------------------------------------------------------------------------
  // Element Caching
  // --------------------------------------------------------------------------

  const cachedElements = new Map<SlotId, Promise<ReactNode>>();
  let metadataLoaded = false;

  const getCachedElement = (id: SlotId) => cachedElements.get(id);

  const setCachedElement = (id: SlotId, element: ReactNode): Promise<ReactNode> => {
    const existing = cachedElements.get(id);
    if (existing) {
      return existing;
    }
    
    const promise = (context.renderRsc!({ [id]: element }) as Promise<unknown>)
      .then((rscStream: unknown) =>
        (context.parseRsc!)(rscStream as ReadableStream).then((parsed: unknown) =>
          (parsed as Record<string, unknown>)[id],
        ),
      ) as Promise<ReactNode>;
    
    cachedElements.set(id, promise);
    return promise;
  };

  // --------------------------------------------------------------------------
  // Build Metadata Loading
  // --------------------------------------------------------------------------

  const context: {
    renderRsc: ((entries: Record<string, unknown>) => Promise<ReadableStream>) | undefined;
    parseRsc: ((stream: ReadableStream) => Promise<Record<string, unknown>>) | undefined;
    renderHtml: ((
      elementsStream: ReadableStream,
      html: unknown,
      opts?: object,
    ) => Promise<Response>) | undefined;
    loadBuildMetadata: ((key: string) => Promise<string | undefined>) | undefined;
  } = {
    renderRsc: undefined,
    parseRsc: undefined,
    renderHtml: undefined,
    loadBuildMetadata: undefined,
  };

  const loadMetadata = async () => {
    if (metadataLoaded) {
      return;
    }
    metadataLoaded = true;

    if (!context.loadBuildMetadata) {
      return;
    }

    const metadata = await context.loadBuildMetadata('defineRouter:cachedElements');
    if (!metadata) {
      return;
    }

    const parsed = JSON.parse(metadata);
    for (const [id, str] of Object.entries(parsed)) {
      const promise = context.parseRsc!(base64ToStream(str as string)).then(
        (parsed: unknown) => (parsed as Record<string, unknown>)[id],
      ) as Promise<ReactNode>;
      cachedElements.set(id, promise);
    }
  };

  // --------------------------------------------------------------------------
  // Route Entry Building
  // --------------------------------------------------------------------------

  async function getEntriesForRoute(
    rscPath: string,
    rscParams: unknown,
    headers: Readonly<Record<string, string>>,
  ): Promise<Record<SlotId, unknown> | null> {
    setContextValue(RSC_PATH_KEY, rscPath);
    setContextValue(RSC_PARAMS_KEY, rscParams);

    const routePath = decodeRoutePath(rscPath);
    const pathConfig = await findPathConfig(routePath);

    if (pathConfig?.type !== 'route') {
      return null;
    }

    // Parse skip header for partial hydration
    let skipParam: unknown;
    try {
      skipParam = JSON.parse(headers[SKIP_HEADER.toLowerCase()] || '');
    } catch {
      // ignore
    }
    const skipIdSet = new Set(isStringArray(skipParam) ? skipParam : []);

    const { query } = parseRscParams(rscParams);
    const routeId = ROUTE_SLOT_ID_PREFIX + routePath;
    const rendererOption: RendererOption = {
      routePath,
      query: pathConfig.isStatic ? undefined : query,
    };

    const { configs, has404 } = await getMyConfig();
    const slices = pathConfig.slices || [];

    // Map slice IDs to configs
    const sliceConfigMap = new Map<string, SliceConfig>();
    for (const sliceId of slices) {
      const sliceConfig = configs.find(
        (item): item is SliceConfig =>
          item.type === 'slice' && item.id === sliceId,
      );
      if (sliceConfig) {
        sliceConfigMap.set(sliceId, sliceConfig);
      }
    }

    const entries: Record<SlotId, unknown> = {};
    const promises: Promise<void>[] = [];

    // Root element
    if (!pathConfig.rootElement.isStatic) {
      entries[ROOT_SLOT_ID] = pathConfig.rootElement.renderer(rendererOption);
    } else if (!skipIdSet.has(ROOT_SLOT_ID)) {
      const cached = getCachedElement(ROOT_SLOT_ID);
      promises.push(
        (async () => {
          entries[ROOT_SLOT_ID] = cached
            ? await cached
            : await setCachedElement(ROOT_SLOT_ID, pathConfig.rootElement.renderer(rendererOption));
        })(),
      );
    }

    // Route element (the page itself)
    if (!pathConfig.routeElement.isStatic) {
      entries[routeId] = pathConfig.routeElement.renderer(rendererOption);
    } else if (!skipIdSet.has(routeId)) {
      const cached = getCachedElement(routeId);
      promises.push(
        (async () => {
          entries[routeId] = cached
            ? await cached
            : await setCachedElement(routeId, pathConfig.routeElement.renderer(rendererOption));
        })(),
      );
    }

    // Additional elements (nested components)
    for (const [elementId, { isStatic, renderer }] of Object.entries(pathConfig.elements)) {
      if (!isStatic) {
        entries[elementId] = renderer?.(rendererOption);
      } else if (!skipIdSet.has(elementId)) {
        const cached = getCachedElement(elementId);
        promises.push(
          (async () => {
            entries[elementId] = cached
              ? await cached
              : await setCachedElement(elementId, renderer?.(rendererOption));
          })(),
        );
      }
    }

    // Slices
    for (const sliceId of slices) {
      const id = SLICE_SLOT_ID_PREFIX + sliceId;
      const sliceConfig = sliceConfigMap.get(sliceId);
      
      if (!sliceConfig) {
        throw new Error(`Slice not found: ${sliceId}`);
      }
      
      if (sliceConfig.isStatic && skipIdSet.has(id)) {
        continue;
      }
      
      promises.push(
        (async () => {
          entries[id] = await getSliceElement(sliceConfig, getCachedElement, setCachedElement);
        })(),
      );
    }

    // Wait for all async elements
    await Promise.all(promises);

    // Add special entries
    entries[ROUTE_ID] = [routePath, query];
    entries[IS_STATIC_ID] = pathConfig.isStatic;

    // Mark static slices
    for (const [sliceId, sliceConfig] of sliceConfigMap) {
      if (sliceConfig.isStatic) {
        entries[IS_STATIC_ID + ':' + SLICE_SLOT_ID_PREFIX + sliceId] = true;
      }
    }

    // Mark 404 presence
    if (has404) {
      entries[HAS404_ID] = true;
    }

    return entries;
  }

  // --------------------------------------------------------------------------
  // Request Handling
  // --------------------------------------------------------------------------

  const handleRequest = async (
    input: {
      req: Request;
      pathname: string;
      type: 'html' | 'rsc' | 'component' | 'function' | 'action' | 'custom';
      rscPath?: string;
      rscParams?: unknown;
      fn?: (...args: unknown[]) => unknown;
      args?: unknown[];
    },
    ctx: {
      renderRsc: (entries: Record<string, unknown>) => Promise<ReadableStream>;
      parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
      renderHtml: (
        elementsStream: ReadableStream,
        html: unknown,
        opts?: object,
      ) => Promise<Response>;
      loadBuildMetadata: (key: string) => Promise<string | undefined>;
    },
  ): Promise<ReadableStream | Response | 'fallback' | null | undefined> => {
    context.renderRsc = ctx?.renderRsc;
    context.parseRsc = ctx?.parseRsc;
    context.renderHtml = ctx?.renderHtml;
    context.loadBuildMetadata = ctx?.loadBuildMetadata;

    await loadMetadata();

    const pathConfig = await findPathConfig(input.pathname);

    // --------------------------------------------------------------------------
    // API Routes
    // --------------------------------------------------------------------------
    
    if (pathConfig?.type === 'api') {
      const url = new URL(input.req.url);
      url.pathname = input.pathname;
      const req = new Request(url, input.req);
      const params = getPathMapping(pathConfig.path, input.pathname) ?? {};
      return pathConfig.handler(req, { params });
    }

    const headers = Object.fromEntries(input.req.headers.entries());

    // --------------------------------------------------------------------------
    // Component Requests (for slices and partial hydration)
    // --------------------------------------------------------------------------
    
    if (input.type === 'component') {
      const sliceId = decodeSliceId(input.rscPath ?? '');
      
      if (sliceId !== null) {
        const { configs } = await getMyConfig();
        const sliceConfig = configs.find(
          (item): item is SliceConfig =>
            item.type === 'slice' && item.id === sliceId,
        );

        if (!sliceConfig) {
          return null;
        }

        const sliceElement = await getSliceElement(
          sliceConfig,
          getCachedElement,
          setCachedElement,
        );

        return context.renderRsc!({
          [SLICE_SLOT_ID_PREFIX + sliceId]: sliceElement,
          ...(sliceConfig.isStatic
            ? { [IS_STATIC_ID + ':' + SLICE_SLOT_ID_PREFIX + sliceId]: true }
            : {}),
        });
      }

      const entries = await getEntriesForRoute(input.rscPath ?? '', input.rscParams, headers);
      if (!entries) {
        return null;
      }
      return context.renderRsc!(entries);
    }

    // --------------------------------------------------------------------------
    // Function Calls (server actions)
    // --------------------------------------------------------------------------
    
    if (input.type === 'function') {
      let elementsPromise = Promise.resolve({});
      let rendered = false;

      const rerender = (rscPath: string, rscParams?: unknown) => {
        if (rendered) {
          throw new Error('already rendered');
        }
        elementsPromise = Promise.all([
          elementsPromise,
          getEntriesForRoute(rscPath, rscParams, headers),
        ]).then(([oldElements, newElements]) => {
          if (newElements === null) {
            console.warn('getEntries returned null');
          }
          return { ...oldElements, ...newElements };
        });
      };

      setContextValue(RERENDER_KEY, rerender);

      try {
        const value = await (input.fn ?? (() => {}))(...(input.args ?? []));
        return context.renderRsc!({ ...(await elementsPromise), _value: value });
      } catch (e) {
        const info = getErrorInfo(e);
        
        if (info?.location) {
          const routePath = pathnameToRoutePath(info.location);
          const rscPath = encodeRoutePath(routePath);
          const entries = await getEntriesForRoute(rscPath, undefined, headers);
          if (!entries) {
            unstable_notFound();
          }
          return context.renderRsc!(entries);
        }
        throw e;
      } finally {
        rendered = true;
      }
    }

    // --------------------------------------------------------------------------
    // Action/Custom Requests (form submissions, etc.)
    // --------------------------------------------------------------------------
    
    if (input.type === 'action' || input.type === 'custom') {
      const renderPage = async (
        pathname: string,
        query: string,
        status = 200,
      ): Promise<Response | null> => {
        const routePath = pathnameToRoutePath(pathname);
        const rscPath = encodeRoutePath(routePath);
        const rscParams = new URLSearchParams({ query });

        const entries = await getEntriesForRoute(rscPath, rscParams, headers);
        if (!entries) {
          return null;
        }

        const html = (
          <INTERNAL_ServerRouter
            route={{ path: routePath, query, hash: '' }}
            httpstatus={status}
          />
        );

        const formState =
          input.type === 'action' ? await (input.fn ?? (() => {}))() : undefined;
        const nonce = getNonce();

        return context.renderHtml!(
          await context.renderRsc!(entries),
          html,
          { rscPath, formState, status, ...(nonce ? { nonce } : {}) },
        );
      };

      const method = input.req.method;
      if (method === 'GET') {
        const url = new URL(input.req.url);
        return renderPage(url.pathname, url.search);
      }

      const contentType = input.req.headers.get('content-type') || '';
      
      if (contentType === 'application/x-www-form-urlencoded') {
        await input.req.formData();
        const url = new URL(input.req.url);
        return renderPage(url.pathname, url.search);
      }

      const url = new URL(input.req.url);
      return renderPage(url.pathname, url.search);
    }

    // --------------------------------------------------------------------------
    // HTML Navigation - Main page render
    // --------------------------------------------------------------------------
    
    // If no route found, try 404
    if (!pathConfig && input.type === 'html') {
      const { configs, has404 } = await getMyConfig();
      
      // Try to find a 404 page
      if (has404) {
        const notFoundConfig = configs.find(
          (item): item is RouteConfig =>
            item.type === 'route' &&
            item.path.length === 1 &&
            item.path[0]!.type === 'literal' &&
            item.path[0]!.name === '404',
        );
        
        if (notFoundConfig) {
          const rscPath = encodeRoutePath('/404');
          const entries = await getEntriesForRoute(rscPath, new URLSearchParams(), headers);
          if (entries) {
            const html = (
              <INTERNAL_ServerRouter
                route={{ path: '/404', query: '', hash: '' }}
                httpstatus={404}
              />
            );
            return context.renderHtml!(
              await context.renderRsc!(entries),
              html,
              { rscPath, status: 404 },
            );
          }
        }
      }
      
      // Return plain 404 if no 404 page configured
      return new Response('Not Found', { status: 404 });
    }
    
    // RSC requests without matching route
    if (!pathConfig && input.type !== 'html') {
      return null;
    }

    return undefined;
  };

  return defineHandlers({ handleRequest });
}
