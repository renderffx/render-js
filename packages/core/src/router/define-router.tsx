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

const isStringArray = (x: unknown): x is string[] =>
  Array.isArray(x) && x.every((y) => typeof y === 'string');

const parseRscParams = (
  rscParams: unknown,
): {
  query: string;
} => {
  if (rscParams instanceof URLSearchParams) {
    return { query: rscParams.get('query') || '' };
  }
  if (
    typeof (rscParams as { query?: undefined } | undefined)?.query === 'string'
  ) {
    return { query: (rscParams as { query: string }).query };
  }
  return { query: '' };
};

const RSC_PATH_SYMBOL = Symbol('RSC_PATH');
const RSC_PARAMS_SYMBOL = Symbol('RSC_PARAMS');

const setRscPath = (rscPath: string) => {
  try {
    const context = getContext();
    (context as unknown as Record<typeof RSC_PATH_SYMBOL, unknown>)[
      RSC_PATH_SYMBOL
    ] = rscPath;
  } catch {
    // ignore
  }
};

const setRscParams = (rscParams: unknown) => {
  try {
    const context = getContext();
    (context as unknown as Record<typeof RSC_PARAMS_SYMBOL, unknown>)[
      RSC_PARAMS_SYMBOL
    ] = rscParams;
  } catch {
    // ignore
  }
};

export function unstable_getRscPath(): string | undefined {
  try {
    const context = getContext();
    return (context as unknown as Record<typeof RSC_PATH_SYMBOL, string>)[
      RSC_PATH_SYMBOL
    ];
  } catch {
    return undefined;
  }
}

export function unstable_getRscParams(): unknown {
  try {
    const context = getContext();
    return (context as unknown as Record<typeof RSC_PARAMS_SYMBOL, unknown>)[
      RSC_PARAMS_SYMBOL
    ];
  } catch {
    return undefined;
  }
}

const getNonce = () => {
  try {
    const context = getContext();
    return context.nonce;
  } catch {
    return undefined;
  }
};

const RERENDER_SYMBOL = Symbol('RERENDER');
type Rerender = (rscPath: string, rscParams?: unknown) => void;

const setRerender = (rerender: Rerender) => {
  try {
    const context = getContext();
    (context as unknown as Record<typeof RERENDER_SYMBOL, Rerender>)[
      RERENDER_SYMBOL
    ] = rerender;
  } catch {
    // ignore
  }
};

const getRerender = (): Rerender => {
  const context = getContext();
  return (context as unknown as Record<typeof RERENDER_SYMBOL, Rerender>)[
    RERENDER_SYMBOL
  ];
};

const is404 = (pathSpec: PathSpec) =>
  pathSpec.length === 1 &&
  pathSpec[0]!.type === 'literal' &&
  pathSpec[0]!.name === '404';

export function unstable_rerenderRoute(pathname: string, query?: string) {
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

type SlotId = string;

const ROOT_SLOT_ID = 'root';
const ROUTE_SLOT_ID_PREFIX = 'route:';
const SLICE_SLOT_ID_PREFIX = 'slice:';

const assertNonReservedSlotId = (slotId: SlotId) => {
  if (
    slotId === ROOT_SLOT_ID ||
    slotId.startsWith(ROUTE_SLOT_ID_PREFIX) ||
    slotId.startsWith(SLICE_SLOT_ID_PREFIX)
  ) {
    throw new Error('Element ID cannot be "root", "route:*" or "slice:*"');
  }
};

type RendererOption = { routePath: string; query: string | undefined };

type RouteConfig = {
  type: 'route';
  path: PathSpec;
  isStatic: boolean;
  pathPattern?: PathSpec;
  rootElement: {
    isStatic: boolean;
    renderer: (option: RendererOption) => ReactNode;
  };
  routeElement: {
    isStatic: boolean;
    renderer: (option: RendererOption) => ReactNode;
  };
  elements: Record<
    SlotId,
    {
      isStatic: boolean;
      renderer: (option: RendererOption) => ReactNode;
    }
  >;
  noSsr?: boolean;
  slices?: string[];
};

type ApiConfig = {
  type: 'api';
  path: PathSpec;
  isStatic: boolean;
  handler: ApiHandler;
};

type SliceConfig = {
  type: 'slice';
  id: string;
  isStatic: boolean;
  renderer: () => Promise<ReactNode>;
};

export function unstable_defineRouter(fns: {
  getConfigs: () => Promise<Iterable<RouteConfig | ApiConfig | SliceConfig>>;
}) {
  type MyConfig = {
    configs: (RouteConfig | ApiConfig | SliceConfig)[];
    has404: boolean;
  };

  let cachedMyConfig: MyConfig | undefined;
  const getMyConfig = async (): Promise<MyConfig> => {
    if (!cachedMyConfig) {
      const configs = Array.from(await fns.getConfigs());
      let has404 = false;
      configs.forEach((item) => {
        if (item.type === 'route') {
          Object.keys(item.elements).forEach(assertNonReservedSlotId);
          if (!has404 && is404(item.path)) {
            has404 = true;
          }
        }
      });
      cachedMyConfig = { configs, has404 };
    }
    return cachedMyConfig;
  };

  const getPathConfigItem = async (pathname: string) => {
    const routePath = pathnameToRoutePath(pathname);
    const myConfig = await getMyConfig();
    const found = myConfig.configs.find(
      (item): item is typeof item & { type: 'route' | 'api' } =>
        (item.type === 'route' || item.type === 'api') &&
        !!getPathMapping(item.path, routePath),
    );
    return found;
  };

  const getSliceElement = async (
    sliceConfig: {
      id: string;
      isStatic: boolean;
      renderer: () => Promise<ReactNode>;
    },
    getCachedElement: (id: SlotId) => Promise<ReactNode> | undefined,
    setCachedElement: (id: SlotId, element: ReactNode) => Promise<ReactNode>,
  ): Promise<ReactNode> => {
    const id = SLICE_SLOT_ID_PREFIX + sliceConfig.id;
    const cached = getCachedElement(id);
    if (cached) {
      return cached;
    }
    let element = await sliceConfig.renderer();
    if (sliceConfig.isStatic) {
      element = await setCachedElement(id, element);
    }
    return element;
  };

  const getEntriesForRoute = async (
    rscPath: string,
    rscParams: unknown,
    headers: Readonly<Record<string, string>>,
    getCachedElement: (id: SlotId) => Promise<ReactNode> | undefined,
    setCachedElement: (id: SlotId, element: ReactNode) => Promise<ReactNode>,
  ) => {
    setRscPath(rscPath);
    setRscParams(rscParams);
    const routePath = decodeRoutePath(rscPath);
    const pathConfigItem = await getPathConfigItem(routePath);
    if (pathConfigItem?.type !== 'route') {
      return null;
    }
    let skipParam: unknown;
    try {
      skipParam = JSON.parse(headers[SKIP_HEADER.toLowerCase()] || '');
    } catch {
      // ignore
    }
    const skipIdSet = new Set(isStringArray(skipParam) ? skipParam : []);
    const { query } = parseRscParams(rscParams);
    const routeId = ROUTE_SLOT_ID_PREFIX + routePath;
    const option: RendererOption = {
      routePath,
      query: pathConfigItem.isStatic ? undefined : query,
    };
    const myConfig = await getMyConfig();
    const slices = pathConfigItem.slices || [];
    const sliceConfigMap = new Map<
      string,
      { id: string; isStatic: boolean; renderer: () => Promise<ReactNode> }
    >();
    slices.forEach((sliceId) => {
      const sliceConfig = myConfig.configs.find(
        (item): item is typeof item & { type: 'slice' } =>
          item.type === 'slice' && item.id === sliceId,
      );
      if (sliceConfig) {
        sliceConfigMap.set(sliceId, sliceConfig);
      }
    });
    const entries: Record<SlotId, unknown> = {};
    await Promise.all([
      (async () => {
        if (!pathConfigItem.rootElement.isStatic) {
          entries[ROOT_SLOT_ID] = pathConfigItem.rootElement.renderer(option);
        } else if (!skipIdSet.has(ROOT_SLOT_ID)) {
          const cached = getCachedElement(ROOT_SLOT_ID);
          entries[ROOT_SLOT_ID] = cached
            ? await cached
            : await setCachedElement(
                ROOT_SLOT_ID,
                pathConfigItem.rootElement.renderer(option),
              );
        }
      })(),
      (async () => {
        if (!pathConfigItem.routeElement.isStatic) {
          entries[routeId] = pathConfigItem.routeElement.renderer(option);
        } else if (!skipIdSet.has(routeId)) {
          const cached = getCachedElement(routeId);
          entries[routeId] = cached
            ? await cached
            : await setCachedElement(
                routeId,
                pathConfigItem.routeElement.renderer(option),
              );
        }
      })(),
      ...Object.entries(pathConfigItem.elements).map(
        async ([elementId, { isStatic, renderer }]) => {
          if (!isStatic) {
            entries[elementId] = renderer?.(option);
          } else if (!skipIdSet.has(elementId)) {
            const cached = getCachedElement(elementId);
            entries[elementId] = cached
              ? await cached
              : await setCachedElement(elementId, renderer?.(option));
          }
        },
      ),
      ...slices.map(async (sliceId) => {
        const id = SLICE_SLOT_ID_PREFIX + sliceId;
        const sliceConfig = sliceConfigMap.get(sliceId);
        if (!sliceConfig) {
          throw new Error(`Slice not found: ${sliceId}`);
        }
        if (sliceConfig.isStatic && skipIdSet.has(id)) {
          return null;
        }
        const sliceElement = await getSliceElement(
          sliceConfig,
          getCachedElement,
          setCachedElement,
        );
        entries[id] = sliceElement;
      }),
    ]);
    entries[ROUTE_ID] = [routePath, query];
    entries[IS_STATIC_ID] = pathConfigItem.isStatic;
    sliceConfigMap.forEach((sliceConfig, sliceId) => {
      if (sliceConfig.isStatic) {
        entries[IS_STATIC_ID + ':' + SLICE_SLOT_ID_PREFIX + sliceId] = true;
      }
    });
    if (myConfig.has404) {
      entries[HAS404_ID] = true;
    }
    return entries;
  };

  type HandleRequest = Parameters<typeof defineHandlers>[0]['handleRequest'];

  const cachedElementsForRequest = new Map<SlotId, Promise<ReactNode>>();
  let cachedElementsForRequestInitialized = false;

  const handleRequest: HandleRequest = async (
    input,
    context,
  ): Promise<ReadableStream | Response | 'fallback' | null | undefined> => {
    const { renderRsc, parseRsc, renderHtml, loadBuildMetadata } = context ?? {};
    const getCachedElement = (id: SlotId) => cachedElementsForRequest.get(id);
    const setCachedElement = (id: SlotId, element: ReactNode) => {
      const cached = cachedElementsForRequest.get(id);
      if (cached) {
        return cached;
      }
      const p = renderRsc!({ [id]: element }).then((rscStream: any) =>
        parseRsc!(rscStream).then((parsed: any) => parsed[id]),
      ) as Promise<ReactNode>;
      cachedElementsForRequest.set(id, p);
      return p;
    };
    if (!cachedElementsForRequestInitialized) {
      cachedElementsForRequestInitialized = true;
      const cachedElementsMetadata = await loadBuildMetadata!(
        'defineRouter:cachedElements',
      );
      if (cachedElementsMetadata) {
        Object.entries(JSON.parse(cachedElementsMetadata)).forEach(
          ([id, str]) => {
            cachedElementsForRequest.set(
              id,
              parseRsc!(base64ToStream(str as string)).then(
                (parsed: any) => parsed[id],
              ) as Promise<ReactNode>,
            );
          },
        );
      }
    }

    const pathConfigItem = await getPathConfigItem(input.pathname);
    if (pathConfigItem?.type === 'api') {
      const url = new URL(input.req.url);
      url.pathname = input.pathname;
      const req = new Request(url, input.req);
      const params = getPathMapping(pathConfigItem.path, input.pathname) ?? {};
      return pathConfigItem.handler(req, { params });
    }

    const headers = Object.fromEntries(input.req.headers.entries());
    if (input.type === 'component') {
      const sliceId = decodeSliceId(input.rscPath ?? '');
      if (sliceId !== null) {
        const sliceConfig = await getMyConfig().then((myConfig) =>
          myConfig.configs.find(
            (item): item is typeof item & { type: 'slice' } =>
              item.type === 'slice' && item.id === sliceId,
          ),
        );
        if (!sliceConfig) {
          return null;
        }
        const sliceElement = await getSliceElement(
          sliceConfig,
          getCachedElement,
          setCachedElement,
        );
        return renderRsc({
          [SLICE_SLOT_ID_PREFIX + sliceId]: sliceElement,
          ...(sliceConfig.isStatic
            ? {
                [IS_STATIC_ID + ':' + SLICE_SLOT_ID_PREFIX + sliceId]: true,
              }
            : {}),
        });
      }
      const entries = await getEntriesForRoute(
        input.rscPath ?? '',
        input.rscParams,
        headers,
        getCachedElement,
        setCachedElement,
      );
      if (!entries) {
        return null;
      }
      return renderRsc(entries);
    }

    if (input.type === 'function') {
      let elementsPromise: Promise<Record<string, unknown>> = Promise.resolve({});
      let rendered = false;
      const rerender = (rscPath: string, rscParams?: unknown) => {
        if (rendered) {
          throw new Error('already rendered');
        }
        elementsPromise = Promise.all([
          elementsPromise,
          getEntriesForRoute(
            rscPath,
            rscParams,
            headers,
            getCachedElement,
            setCachedElement,
          ),
        ]).then(([oldElements, newElements]) => {
          if (newElements === null) {
            console.warn('getEntries returned null');
          }
          return {
            ...oldElements,
            ...newElements,
          };
        });
      };
      setRerender(rerender);
      try {
        const value = await (input.fn ?? (() => {}))(...(input.args ?? []));
        return renderRsc!({ ...(await elementsPromise), _value: value });
      } catch (e) {
        const info = getErrorInfo(e);
        if (info?.location) {
          const routePath = pathnameToRoutePath(info.location);
          const rscPath = encodeRoutePath(routePath);
          const entries = await getEntriesForRoute(
            rscPath,
            undefined,
            headers,
            getCachedElement,
            setCachedElement,
          );
          if (!entries) {
            unstable_notFound();
          }
          return renderRsc(entries);
        }
        throw e;
      } finally {
        rendered = true;
      }
    }

    if (input.type === 'action' || input.type === 'custom') {
      const renderIt = async (
        pathname: string,
        query: string,
        httpstatus = 200,
      ) => {
        const routePath = pathnameToRoutePath(pathname);
        const rscPath = encodeRoutePath(routePath);
        const rscParams = new URLSearchParams({ query });
        const entries = await getEntriesForRoute(
          rscPath,
          rscParams,
          headers,
          getCachedElement,
          setCachedElement,
        );
        if (!entries) {
          return null;
        }
        const html = (
          <INTERNAL_ServerRouter
            route={{ path: routePath, query, hash: '' }}
            httpstatus={httpstatus}
          />
        );
        const formState =
          input.type === 'action' ? await (input.fn ?? (() => {}))() : undefined;
        const nonce = getNonce();
        return renderHtml!(await renderRsc!(entries), html, {
          rscPath,
          formState,
          status: httpstatus,
          ...(nonce ? { nonce } : {}),
        });
      };

      const method = input.req.method;
      if (method === 'GET') {
        const url = new URL(input.req.url);
        return renderIt(url.pathname, url.search);
      }

      const contentType = input.req.headers.get('content-type') || '';
      if (contentType === 'application/x-www-form-urlencoded') {
        const formData = await input.req.formData();
        const url = new URL(input.req.url);
        return renderIt(url.pathname, url.search, 200);
      }

      const url = new URL(input.req.url);
      return renderIt(url.pathname, url.search, 200);
    }

    return undefined;
  };

  return defineHandlers({
    handleRequest,
  });
}
