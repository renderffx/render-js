import type { RequestContext } from '../context-edge.js';

export interface EdgeMiddlewareContext {
  readonly request: Request;
  readonly url: URL;
  readonly cookies: Record<string, string>;
  readonly geo: {
    city?: string;
    country?: string;
    region?: string;
  };
  readonly ip?: string;
  readonly nextConfig?: {
    request?: Request;
    headers?: HeadersInit;
  };
}

export type EdgeMiddlewareNext = () => Promise<Response>;

export type EdgeMiddleware = (
  context: EdgeMiddlewareContext,
  next: EdgeMiddlewareNext
) => Response | Promise<Response>;

export interface EdgeMiddlewareModule {
  default?: EdgeMiddleware;
  matcher?: string | string[];
  name?: string;
}

export interface EdgeRouteConfig {
  path: string;
  middleware?: EdgeMiddlewareModule;
  edge?: boolean;
  prerender?: number | boolean;
  revalidate?: number;
}

export function createEdgeMiddlewareStack(
  middlewares: EdgeMiddleware[]
): EdgeMiddleware {
  return async function edgeMiddlewareStack(
    context: EdgeMiddlewareContext,
    next: EdgeMiddlewareNext
  ): Promise<Response> {
    let index = 0;
    
    async function dispatch(): Promise<Response> {
      if (index >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[index++];
      return middleware(context, dispatch);
    }
    
    return dispatch();
  };
}

export function withAuth(
  redirectTo: string
): EdgeMiddleware {
  return async (context, next) => {
    const token = context.cookies['auth-token'] || 
                  context.cookies['session'] ||
                  context.request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      const loginUrl = new URL(redirectTo, context.request.url);
      loginUrl.searchParams.set('redirect', context.request.url);
      
      return Response.redirect(loginUrl.toString(), 302);
    }
    
    return next();
  };
}

export function withGeo(
  options?: {
    defaultCountry?: string;
    redirectUnknown?: boolean;
    countries?: Record<string, string>;
  }
): EdgeMiddleware {
  return async (context, next) => {
    const country = context.geo.country || options?.defaultCountry;
    
    if (options?.redirectUnknown && !country) {
      return new Response('Location not available', { status: 451 });
    }
    
    if (options?.countries && country) {
      const redirect = options.countries[country];
      if (redirect) {
        return Response.redirect(redirect, 302);
      }
    }
    
    return next();
  };
}

export function withLocale(
  locales: string[],
  defaultLocale: string
): EdgeMiddleware {
  return async (context, next) => {
    const pathname = context.url.pathname;
    const pathnameHasLocale = locales.some(
      locale => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );
    
    if (pathnameHasLocale) {
      return next();
    }
    
    const detectedLocale = context.request.headers.get('accept-language')
      ?.split(',')[0]
      ?.split('-')[0]
      ?.toLowerCase();
    
    const locale = detectedLocale && locales.includes(detectedLocale)
      ? detectedLocale
      : defaultLocale;
    
    const redirectUrl = new URL(`/${locale}${pathname}`, context.request.url);
    redirectUrl.search = context.url.search;
    
    return Response.redirect(redirectUrl.toString(), 302);
  };
}

export function withABTesting(
  experimentId: string,
  variants: Record<string, number>
): EdgeMiddleware {
  return async (context, next) => {
    const cookieName = `exp_${experimentId}`;
    let variant = context.cookies[cookieName];
    
    if (!variant) {
      const rand = Math.random();
      let cumulative = 0;
      
      for (const [v, weight] of Object.entries(variants)) {
        cumulative += weight;
        if (rand < cumulative) {
          variant = v;
          break;
        }
      }
      
      variant = variant || Object.keys(variants)[0];
    }
    
    const response = await next();
    
    const newHeaders = new Headers(response.headers);
    newHeaders.append('Set-Cookie', `${cookieName}=${variant}; Path=/; Max-Age=31536000`);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

export function withRateLimit(
  limit: number,
  window: number = 60
): EdgeMiddleware {
  const requests = new Map<string, { count: number; reset: number }>();
  
  function cleanup(): void {
    const now = Date.now();
    for (const [ip, record] of requests.entries()) {
      if (record.reset < now) {
        requests.delete(ip);
      }
    }
  }
  
  setInterval(cleanup, window * 1000);
  
  return async (context, next) => {
    cleanup();
    
    const ip = context.ip || 'unknown';
    const now = Date.now();
    
    let record = requests.get(ip);
    if (!record || record.reset < now) {
      record = { count: 0, reset: now + window * 1000 };
      requests.set(ip, record);
    }
    
    record.count++;
    
    if (record.count > limit) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(record.reset / 1000)),
          'Retry-After': String(Math.ceil((record.reset - now) / 1000)),
        },
      });
    }
    
    const response = await next();
    
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-RateLimit-Limit', String(limit));
    newHeaders.set('X-RateLimit-Remaining', String(Math.max(0, limit - record.count)));
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

export function generateEdgeMiddlewareManifest(
  middlewares: EdgeMiddlewareModule[],
  routes: EdgeRouteConfig[]
): {
  sortedMiddleware: EdgeMiddlewareModule[];
  middlewareToRouteMap: Map<string, string[]>;
} {
  const sortedMiddleware: EdgeMiddlewareModule[] = [];
  const middlewareToRouteMap = new Map<string, string[]>();
  
  for (const route of routes) {
    if (route.middleware) {
      const name = route.middleware.name || 'anonymous';
      
      if (!middlewareToRouteMap.has(name)) {
        middlewareToRouteMap.set(name, []);
        sortedMiddleware.push(route.middleware);
      }
      
      middlewareToRouteMap.get(name)!.push(route.path);
    }
  }
  
  return { sortedMiddleware, middlewareToRouteMap };
}

export function generateMiddlewareCode(
  middlewares: EdgeMiddleware[],
  matcher?: string | string[]
): string {
  const matcherStr = matcher 
    ? Array.isArray(matcher) ? matcher : [matcher]
    : ["/*"];
  
  const middlewareNames = middlewares.map((_, i) => `middleware${i}`).join(', ');
  
  return `
export const config = {
  runtime: 'edge',
  matcher: ${JSON.stringify(matcherStr, null, 2)},
};

${middlewares.map((m, i) => `
async function middleware${i}(request, ctx, next) {
  ${m.toString()}
}
`).join('\n')}

export default async function handler(request, ctx) {
  ${middlewares.map((_, i) => `
  {
    const response = await middleware${i}(request, ctx, async () => {
      return next(request);
    });
    if (response) return response;
  }
  `).join('\n')}
  
  return next(request);
}

async function next(request) {
  return fetch(request);
}
`;
}
