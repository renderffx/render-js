type RenderToReadableStreamFn = (
  element: React.ReactElement,
  options?: Record<string, unknown>
) => Promise<ReadableStream>;

let renderToReadableStream: RenderToReadableStreamFn | undefined;
let isEdgeEnvironment = false;
let loadError: Error | undefined;

async function loadEdgeRender(): Promise<RenderToReadableStreamFn> {
  if (renderToReadableStream) return renderToReadableStream;
  if (loadError) throw loadError;
  
  const modules = ['react-dom/edge', 'react-dom/server', '@vercel/edge'];
  
  for (const moduleName of modules) {
    try {
      const mod = await import(moduleName);
      if ('renderToReadableStream' in mod) {
        renderToReadableStream = (mod as { renderToReadableStream: RenderToReadableStreamFn }).renderToReadableStream;
        isEdgeEnvironment = moduleName === 'react-dom/edge' || moduleName === '@vercel/edge';
        return renderToReadableStream;
      }
      if ('render' in mod && typeof (mod as { render: unknown }).render === 'function') {
        renderToReadableStream = (mod as { render: RenderToReadableStreamFn }).render;
        isEdgeEnvironment = moduleName === 'react-dom/edge';
        return renderToReadableStream;
      }
    } catch (e) {
      continue;
    }
  }
  
  loadError = new Error('Failed to load RSC renderer. Tried: ' + modules.join(', '));
  throw loadError;
}

async function getRenderToReadableStreamAsync(): Promise<RenderToReadableStreamFn> {
  if (!renderToReadableStream) {
    await loadEdgeRender();
  }
  if (!renderToReadableStream) {
    throw new Error('renderToReadableStream is not available. Please ensure you are running in Vercel Edge Runtime or have react-dom available.');
  }
  return renderToReadableStream;
}

function getRenderToReadableStream(): RenderToReadableStreamFn {
  if (!renderToReadableStream) {
    throw new Error('renderToReadableStream is not available. Please ensure you are running in Vercel Edge Runtime or have react-dom available.');
  }
  return renderToReadableStream;
}

export function isEdgeRuntime(): boolean {
  return isEdgeEnvironment;
}

export function getRuntimeType(): 'edge' | 'node' | 'unknown' {
  if (isEdgeEnvironment) return 'edge';
  if (typeof process !== 'undefined' && process.versions?.node) return 'node';
  return 'unknown';
}

export interface VercelEdgeContext {
  request: Request;
  params: Record<string, string>;
  cookies: Record<string, string>;
  geo: {
    city?: string;
    country?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
  };
  ip?: string;
  url: URL;
  region: string;
  waitUntil: (promise: Promise<unknown>) => void;
  next: (input: RequestInfo, init?: ResponseInit) => Promise<Response>;
  env?: Record<string, string>;
}

export interface VercelEdgeConfig {
  runtime?: 'edge';
  regions?: string[];
  memory?: number;
  maxDuration?: number;
  unstable_allowDynamic?: string[];
}

export interface EdgeHandler {
  (context: VercelEdgeContext): Promise<Response> | Response;
}

export interface RouteConfig {
  path: string;
  prerender?: number | boolean;
  dynamic?: boolean;
  revalidate?: number;
  runtime?: 'edge' | 'nodejs';
}

const encoder = new TextEncoder();

export function createVercelEdgeHandler(
  handler: EdgeHandler,
  _config?: VercelEdgeConfig
): EdgeHandler {
  return async (context) => {
    try {
      return await handler(context);
    } catch (error) {
      console.error('Edge handler error:', error);
      return new Response(
        error instanceof Error ? error.message : 'Internal Server Error',
        { status: 500 }
      );
    }
  };
}

export async function renderRSCToEdgeStream(
  element: React.ReactElement,
  options: {
    serverReferenceManifest?: unknown;
    nonce?: string;
    identifierPrefix?: string;
    extraScripts?: string[];
  } = {}
): Promise<ReadableStream<Uint8Array>> {
  const fn = await getRenderToReadableStreamAsync();
  const { nonce, serverReferenceManifest, identifierPrefix, extraScripts = [], ...rest } = options;
  
  const bootstrapScripts: string[] = [];
  
  if (nonce) {
    bootstrapScripts.push(`(function(){window.__nonce='${nonce}'})()`);
  }
  
  if (serverReferenceManifest) {
    bootstrapScripts.push(`window.__serverReferenceManifest=${JSON.stringify(serverReferenceManifest)}`);
  }
  
  bootstrapScripts.push(...extraScripts);
  
  const bootstrapScriptContent = bootstrapScripts.length > 0 
    ? bootstrapScripts.join(';')
    : 'window.__render_ready=true';
  
  return fn(element, {
    ...rest,
    identifierPrefix,
    bootstrapScriptContent,
    progressiveChunkSize: undefined,
  });
}

export async function renderRSCToEdgeResponse(
  element: React.ReactElement,
  options: {
    status?: number;
    statusText?: string;
    headers?: HeadersInit;
    serverReferenceManifest?: unknown;
    nonce?: string;
    identifierPrefix?: string;
    extraScripts?: string[];
  } = {}
): Promise<Response> {
  const stream = await renderRSCToEdgeStream(element, {
    serverReferenceManifest: options.serverReferenceManifest,
    nonce: options.nonce,
    identifierPrefix: options.identifierPrefix,
    extraScripts: options.extraScripts,
  });
  
  const headers = new Headers(options.headers as HeadersInit);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('X-Vercel-Edge', 'true');
  
  return new Response(stream, {
    status: options.status ?? 200,
    statusText: options.statusText,
    headers,
  });
}

export function createEdgeContext(request: Request): VercelEdgeContext {
  const url = new URL(request.url);
  
  const getHeader = (name: string): string | undefined => {
    return request.headers.get(name) ?? undefined;
  };

  const cookies: Record<string, string> = {};
  const cookieHeader = getHeader('cookie');
  if (cookieHeader) {
    for (const cookie of cookieHeader.split(';')) {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key) {
        cookies[key] = valueParts.join('=');
      }
    }
  }

  const vercelId = getHeader('x-vercel-id');
  const region = vercelId?.split(':')[1] ?? 'unknown';

  const pendingPromises: Promise<unknown>[] = [];
  const waitUntilImpl = (promise: Promise<unknown>) => {
    pendingPromises.push(promise);
    promise.catch(() => {});
  };
  
  return {
    request,
    params: {},
    cookies,
    geo: {
      city: getHeader('x-vercel-ip-city') ?? undefined,
      country: getHeader('x-vercel-ip-country') ?? undefined,
      region: getHeader('x-vercel-ip-country-region') ?? undefined,
      latitude: getHeader('x-vercel-ip-latitude') ?? undefined,
      longitude: getHeader('x-vercel-ip-longitude') ?? undefined,
    },
    ip: getHeader('x-real-ip') ?? undefined,
    url,
    region,
    waitUntil: waitUntilImpl,
    next: async (input: RequestInfo, init?: ResponseInit) => {
      const fetchUrl = typeof input === 'string' ? input : (input as Request).url;
      return fetch(fetchUrl, { 
        ...init, 
        headers: { 
          ...Object.fromEntries(request.headers.entries()), 
          ...init?.headers 
        } 
      });
    },
  };
}

export function generateEdgeMiddlewareCode(
  _middlewarePath: string,
  routes: RouteConfig[]
): string {
  const staticRoutes = routes.filter(r => !r.dynamic && !r.prerender);
  
  return `
export const config = {
  runtime: 'edge',
  matcher: [
    ${staticRoutes.map(r => `'${r.path}(.*)'`).join(',\n    ') || "'/*'"}
  ],
};

const routes = ${JSON.stringify(routes)};

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  for (const route of routes) {
    if (matchRoute(pathname, route.path)) {
      return Response.json({ matched: true }, { status: 200 });
    }
  }
  
  return Response.json({ matched: false }, { status: 404 });
}

function matchRoute(pathname, pattern) {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathnameParts = pathname.split('/').filter(Boolean);
  
  if (patternParts.length !== pathnameParts.length) return false;
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith('[') && patternParts[i].endsWith(']')) continue;
    if (patternParts[i] !== pathnameParts[i]) return false;
  }
  
  return true;
}
`;
}

export function generateEdgeFunctionCode(
  pagePath: string,
  isPrerender = false,
  revalidate?: number
): string {
  return `
import { renderRSCToEdgeResponse } from '@renderjs/core/edge';
import Page from '${pagePath}';
import { createElement } from 'react';

export const config = {
  runtime: 'edge',
  ${isPrerender ? `prerender: ${revalidate ?? true},` : ''}
  ${revalidate && !isPrerender ? `revalidate: ${revalidate},` : ''}
};

export default async function handler(request) {
  return renderRSCToEdgeResponse(createElement(Page.default || Page));
}
`;
}

export function generatePrerenderConfig(
  expiration: number | boolean,
  fallback?: string
): object {
  if (expiration === true) {
    return { expiration: false };
  }
  if (expiration === false) {
    return { expiration: false, bypassToken: 'prerender-bypass-token' };
  }
  return {
    expiration,
    ...(fallback && { fallback }),
  };
}

export class EdgeWaitUntil {
  private promises: Set<Promise<unknown>> = new Set();

  add(promise: Promise<unknown>): void {
    this.promises.add(promise);
    promise.then(() => {
      this.promises.delete(promise);
    }).catch(() => {
      this.promises.delete(promise);
    });
  }

  async waitAll(): Promise<void> {
    await Promise.all(this.promises);
  }
}
