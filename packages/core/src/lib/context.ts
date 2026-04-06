import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  readonly request: Request;
  readonly url: URL;
  readonly cookies: Record<string, string>;
  readonly headers: Headers;
  readonly geo: {
    city?: string;
    country?: string;
    region?: string;
    latitude?: string;
    longitude?: string;
  };
  readonly ip?: string;
  readonly region: string;
  nonce: string | undefined;
  readonly data: Record<string, unknown>;
}

const contextStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(request: Request): RequestContext {
  const url = new URL(request.url);
  
  const cookies: Record<string, string> = {};
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    for (const cookie of cookieHeader.split(';')) {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key) {
        cookies[key] = valueParts.join('=');
      }
    }
  }

  const vercelId = request.headers.get('x-vercel-id');
  const region = vercelId?.split(':')[1] ?? 'unknown';

  return {
    request,
    url,
    cookies,
    headers: request.headers,
    geo: {
      city: request.headers.get('x-vercel-ip-city') ?? undefined,
      country: request.headers.get('x-vercel-ip-country') ?? undefined,
      region: request.headers.get('x-vercel-ip-country-region') ?? undefined,
      latitude: request.headers.get('x-vercel-ip-latitude') ?? undefined,
      longitude: request.headers.get('x-vercel-ip-longitude') ?? undefined,
    },
    ip: request.headers.get('x-real-ip') ?? undefined,
    region,
    nonce: undefined,
    data: {},
  };
}

export function runWithContext<T>(req: Request, next: () => T): T {
  const context = createRequestContext(req);
  return contextStorage.run(context, next);
}

export function getContext(): RequestContext {
  const context = contextStorage.getStore();
  if (!context) {
    throw new Error(
      'Context is not available. Make sure to use the context middleware.',
    );
  }
  return context;
}

export function getContextData(key?: string): unknown {
  const context = contextStorage.getStore();
  if (!context) {
    return undefined;
  }
  if (key) {
    return context.data[key];
  }
  return context.data;
}

export function setContextData(key: string, value: unknown): void {
  const context = contextStorage.getStore();
  if (context) {
    context.data[key] = value;
  }
}

export { runWithContext as unstable_runWithContext, getContext as unstable_getContext, getContextData as unstable_getContextData };
