

export type ApiHandler = (
  req: Request,
  params: Record<string, string>,
  query: URLSearchParams,
) => Response | Promise<Response>;

export type MiddlewareHandler = (
  req: Request,
  next: () => Promise<Response>,
) => Response | Promise<Response>;

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface ApiRoute {
  path: string;
  method: ApiMethod;
  handler: ApiHandler;
}

export interface ApiOptions {
  basePath?: string;
  prefix?: string;
}

// --------------------------------------------------------------------------
// Path Normalization
// --------------------------------------------------------------------------

function normalizePath(path: string): string {
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return path.replace(/\/+$/, '') || '/';
}

// --------------------------------------------------------------------------
// Route Definition
// --------------------------------------------------------------------------

export function defineApiRoute(
  method: ApiMethod,
  path: string,
  handler: ApiHandler,
): ApiRoute {
  return {
    path: normalizePath(path),
    method: method.toUpperCase() as ApiMethod,
    handler,
  };
}

export function defineGetApi(path: string, handler: ApiHandler): ApiRoute {
  return defineApiRoute('GET', path, handler);
}

export function definePostApi(path: string, handler: ApiHandler): ApiRoute {
  return defineApiRoute('POST', path, handler);
}

export function definePutApi(path: string, handler: ApiHandler): ApiRoute {
  return defineApiRoute('PUT', path, handler);
}

export function defineDeleteApi(path: string, handler: ApiHandler): ApiRoute {
  return defineApiRoute('DELETE', path, handler);
}

export function definePatchApi(path: string, handler: ApiHandler): ApiRoute {
  return defineApiRoute('PATCH', path, handler);
}

// --------------------------------------------------------------------------
// API Handler Factory
// --------------------------------------------------------------------------

export function createApiHandler(
  routes: ApiRoute[],
  options: ApiOptions = {},
) {
  const { basePath = '', prefix = '' } = options;
  const routeMap = new Map<string, Map<ApiMethod, ApiHandler>>();

  for (const route of routes) {
    const fullPath = normalizePath(prefix + basePath + route.path);
    
    if (!routeMap.has(fullPath)) {
      routeMap.set(fullPath, new Map());
    }
    
    routeMap.get(fullPath)!.set(route.method, route.handler);
  }

  return async function handleApiRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = normalizePath(url.pathname);
    const method = (req.method || 'GET').toUpperCase() as ApiMethod;
    
    const pathParams: Record<string, string> = {};
    
    // Try exact match first
    let matchedRoute = routeMap.get(path);
    
    // Then try pattern matching for dynamic routes
    if (!matchedRoute) {
      for (const [routePath, handlers] of routeMap) {
        const paramNames: string[] = [];
        const regexPath = routePath.replace(/\[([^\]]+)\]/g, (_, name) => {
          paramNames.push(name);
          return '([^/]+)';
        });
        
        const regex = new RegExp(`^${regexPath}$`);
        const match = path.match(regex);
        
        if (match) {
          paramNames.forEach((name, index) => {
            pathParams[name] = match[index + 1];
          });
          matchedRoute = handlers;
          break;
        }
      }
    }

    // Not found
    if (!matchedRoute) {
      return new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Method not allowed
    const handler = matchedRoute.get(method);
    if (!handler) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Execute handler
    try {
      return await handler(req, pathParams, url.searchParams);
    } catch (error) {
      return new Response(
        error instanceof Error ? error.message : 'Internal Server Error',
        { status: 500, headers: { 'Content-Type': 'text/plain' } },
      );
    }
  };
}

// --------------------------------------------------------------------------
// Middleware Composition
// --------------------------------------------------------------------------

export function composeMiddlewares(
  middlewares: MiddlewareHandler[],
): MiddlewareHandler {
  return async function composed(req: Request, next: () => Promise<Response>) {
    let index = 0;
    
    async function dispatch(currentIndex: number): Promise<Response> {
      if (currentIndex >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[currentIndex];
      return middleware(req, () => dispatch(currentIndex + 1));
    }
    
    return dispatch(index);
  };
}

// --------------------------------------------------------------------------
// Response Helpers
// --------------------------------------------------------------------------

export function createErrorResponse(message: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createJsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseJsonBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>;
}

export function getQueryParams(req: Request): Record<string, string> {
  const url = new URL(req.url);
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export function getPathParams(req: Request): Record<string, string> {
  return (req as any).params || {};
}
