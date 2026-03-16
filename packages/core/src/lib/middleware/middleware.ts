export type MiddlewareContext = {
  req: Request;
  res?: Response;
  params: Record<string, string>;
  data: Record<string, unknown>;
};

export type MiddlewareNext = () => Promise<Response>;

export type Middleware = (
  context: MiddlewareContext,
  next: MiddlewareNext,
) => Response | Promise<Response>;

export type MiddlewareFactory = (options?: Record<string, unknown>) => Middleware;

export interface MiddlewareStack {
  use: (middleware: Middleware | MiddlewareFactory) => void;
  useAt: (index: number, middleware: Middleware | MiddlewareFactory) => void;
  remove: (name: string) => void;
  clear: () => void;
  list: MiddlewareDescriptor[];
  execute: (context: MiddlewareContext) => Promise<Response>;
}

export interface MiddlewareDescriptor {
  name?: string;
  middleware: Middleware;
  options?: Record<string, unknown>;
}

export function createMiddlewareStack(): MiddlewareStack {
  const stack: MiddlewareDescriptor[] = [];

  function isMiddlewareFactory(fn: unknown): fn is MiddlewareFactory {
    return typeof fn === 'function' && fn.length === 0;
  }

  function use(middleware: Middleware | MiddlewareFactory): void {
    const descriptor: MiddlewareDescriptor = {
      middleware: isMiddlewareFactory(middleware) ? middleware() : middleware,
    };
    stack.push(descriptor);
  }

  function useAt(index: number, middleware: Middleware | MiddlewareFactory): void {
    const desc = {
      middleware: isMiddlewareFactory(middleware) ? middleware() : middleware,
    };
    stack.splice(index, 0, desc);
  }

  function remove(name: string): void {
    const index = stack.findIndex((m) => m.name === name);
    if (index !== -1) {
      stack.splice(index, 1);
    }
  }

  function clear(): void {
    stack.length = 0;
  }

  async function execute(context: MiddlewareContext): Promise<Response> {
    let index = 0;

    async function dispatch(currentIndex: number): Promise<Response> {
      if (currentIndex >= stack.length) {
        return new Response('Not Found', { status: 404 });
      }

      const { middleware } = stack[currentIndex];

      try {
        const response = await middleware(context, () => dispatch(currentIndex + 1));
        return response;
      } catch (error) {
        return new Response(
          error instanceof Error ? error.message : 'Middleware Error',
          { status: 500 },
        );
      }
    }

    return dispatch(index);
  }

  return {
    use,
    useAt,
    remove,
    clear,
    get list() {
      return stack.slice();
    },
    execute,
  };
}

export function defineMiddleware(
  name: string,
  factory: MiddlewareFactory,
): MiddlewareFactory {
  const middlewareFn = function(options?: Record<string, unknown>) {
    return factory(options);
  } as MiddlewareFactory;
  Object.defineProperty(middlewareFn, 'name', { value: name, writable: false });
  return middlewareFn;
}

export function withTiming(options?: { headerName?: string }): MiddlewareFactory {
  return () => {
    return async (context, next) => {
      const start = Date.now();
      const response = await next();
      const duration = Date.now() - start;
      
      response.headers.set(options?.headerName || 'X-Response-Time', `${duration}ms`);
      return response;
    };
  };
}

export function withCors(options?: {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
}): MiddlewareFactory {
  return () => {
    return async (context, next) => {
      const response = await next();
      
      const origins = options?.origin || '*';
      const methods = options?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];
      const headers = options?.headers || ['Content-Type', 'Authorization'];
      
      if (Array.isArray(origins)) {
        const origin = context.req.headers.get('Origin');
        if (origin && origins.includes(origin)) {
          response.headers.set('Access-Control-Allow-Origin', origin);
        }
      } else {
        response.headers.set('Access-Control-Allow-Origin', origins);
      }
      
      response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
      response.headers.set('Access-Control-Allow-Headers', headers.join(', '));
      
      return response;
    };
  };
}

export function withCache(options?: {
  maxAge?: number;
  staleWhileRevalidate?: number;
}): MiddlewareFactory {
  return () => {
    return async (context, next) => {
      const response = await next();
      
      if (context.req.method === 'GET') {
        const maxAge = options?.maxAge || 60;
        const staleWhileRevalidate = options?.staleWhileRevalidate || 60;
        
        response.headers.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
      }
      
      return response;
    };
  };
}

export function withLogger(options?: {
  logRequest?: boolean;
  logResponse?: boolean;
}): MiddlewareFactory {
  return () => {
    return async (context, next) => {
      if (options?.logRequest !== false) {
        console.log(`[${context.req.method}] ${context.req.url}`);
      }
      
      const response = await next();
      
      if (options?.logResponse !== false) {
        console.log(`[${context.req.method}] ${context.req.url} -> ${response.status}`);
      }
      
      return response;
    };
  };
}

export function withBodyParser(): MiddlewareFactory {
  return () => {
    return async (context, next) => {
      if (['POST', 'PUT', 'PATCH'].includes(context.req.method)) {
        try {
          const contentType = context.req.headers.get('Content-Type') || '';
          
          if (contentType.includes('application/json')) {
            const body = await context.req.text();
            context.data.body = JSON.parse(body);
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const body = await context.req.text();
            const params = new URLSearchParams(body);
            context.data.body = Object.fromEntries(params);
          } else if (contentType.includes('text/')) {
            context.data.body = await context.req.text();
          }
        } catch {
          context.data.body = null;
        }
      }
      
      return next();
    };
  };
}

export type {
  MiddlewareContext as Unstable_MiddlewareContext,
  MiddlewareNext as Unstable_MiddlewareNext,
  Middleware as Unstable_Middleware,
  MiddlewareStack as Unstable_MiddlewareStack,
};
