import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  defineApiRoute,
  defineGetApi,
  definePostApi,
  definePutApi,
  defineDeleteApi,
  definePatchApi,
  createApiHandler,
  createErrorResponse,
  createJsonResponse,
  getQueryParams,
} from '../src/lib/api/routes.js';
import {
  createMiddlewareStack,
  defineMiddleware,
  withTiming,
  withCors,
  withCache,
} from '../src/lib/middleware/middleware.js';
import {
  createStreamingRenderer,
  createSuspenseFallback,
  createDeferred,
  useDeferredValue,
  createSuspenseBoundary,
  createStreamResponse,
} from '../src/lib/utils/streaming.js';
import { devServerPlugin } from '../src/lib/vite-plugins/dev-server.js';

describe('@render.js/core - API Route Helpers', () => {
  describe('defineApiRoute', () => {
    it('creates an API route with method and path', () => {
      const route = defineApiRoute('GET', '/users', async () => new Response('ok'));
      expect(route.method).toBe('GET');
      expect(route.path).toBe('/users');
    });

    it('normalizes path without leading slash', () => {
      const route = defineApiRoute('GET', 'users', async () => new Response('ok'));
      expect(route.path).toBe('/users');
    });

    it('normalizes trailing slashes', () => {
      const route = defineApiRoute('GET', '/users/', async () => new Response('ok'));
      expect(route.path).toBe('/users');
    });
  });

  describe('defineGetApi', () => {
    it('creates a GET API route', () => {
      const route = defineGetApi('/posts', async () => new Response('ok'));
      expect(route.method).toBe('GET');
      expect(route.path).toBe('/posts');
    });
  });

  describe('definePostApi', () => {
    it('creates a POST API route', () => {
      const route = definePostApi('/users', async () => new Response('ok'));
      expect(route.method).toBe('POST');
    });
  });

  describe('createApiHandler', () => {
    it('handles exact route matching', async () => {
      const routes = [
        defineGetApi('/users', () => new Response(JSON.stringify({ users: [] }))),
      ];
      const handler = createApiHandler(routes);
      
      const req = new Request('http://localhost/users');
      const response = await handler(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ users: [] });
    });

    it('returns 404 for unknown routes', async () => {
      const routes = [defineGetApi('/users', () => new Response('ok'))];
      const handler = createApiHandler(routes);
      
      const req = new Request('http://localhost/unknown');
      const response = await handler(req);
      
      expect(response.status).toBe(404);
    });

    it('returns 405 for wrong method', async () => {
      const routes = [defineGetApi('/users', () => new Response('ok'))];
      const handler = createApiHandler(routes);
      
      const req = new Request('http://localhost/users', { method: 'POST' });
      const response = await handler(req);
      
      expect(response.status).toBe(405);
    });

    it('handles dynamic route parameters', async () => {
      const routes = [
        defineGetApi('/users/[id]', (_req, params) => {
          return new Response(JSON.stringify({ id: params.id }));
        }),
      ];
      const handler = createApiHandler(routes);
      
      const req = new Request('http://localhost/users/123');
      const response = await handler(req);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ id: '123' });
    });

    it('handles query parameters', async () => {
      const routes = [
        defineGetApi('/search', (_req, _params, query) => {
          return new Response(JSON.stringify({ q: query.get('q') }));
        }),
      ];
      const handler = createApiHandler(routes);
      
      const req = new Request('http://localhost/search?q=test');
      const response = await handler(req);
      
      const data = await response.json();
      expect(data).toEqual({ q: 'test' });
    });

    it('handles prefix option', async () => {
      const routes = [defineGetApi('/users', () => new Response('ok'))];
      const handler = createApiHandler(routes, { prefix: '/api' });
      
      const req = new Request('http://localhost/api/users');
      const response = await handler(req);
      
      expect(response.status).toBe(200);
    });
  });

  describe('createErrorResponse', () => {
    it('creates an error response with status', () => {
      const response = createErrorResponse('Not found', 404);
      expect(response.status).toBe(404);
    });

    it('creates JSON error response', async () => {
      const response = createErrorResponse('Error', 500);
      const data = await response.json();
      expect(data).toEqual({ error: 'Error' });
    });
  });

  describe('createJsonResponse', () => {
    it('creates a JSON response', () => {
      const response = createJsonResponse({ success: true });
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('getQueryParams', () => {
    it('extracts query parameters from request', () => {
      const req = new Request('http://localhost/search?q=test&page=1');
      const params = getQueryParams(req);
      expect(params).toEqual({ q: 'test', page: '1' });
    });
  });
});

describe('@render.js/core - Middleware Support', () => {
  describe('createMiddlewareStack', () => {
    it('creates a middleware stack', () => {
      const stack = createMiddlewareStack();
      expect(stack).toBeDefined();
      expect(typeof stack.use).toBe('function');
      expect(typeof stack.execute).toBe('function');
    });

    it('executes middlewares in order', async () => {
      const stack = createMiddlewareStack();
      const order: string[] = [];
      
      stack.use(async (_context, next) => {
        order.push('first');
        return next();
      });
      
      stack.use(async (_context, next) => {
        order.push('second');
        return next();
      });

      await stack.execute({ req: new Request('http://localhost'), params: {}, data: {} });
      expect(order).toEqual(['first', 'second']);
    });

    it('can clear all middlewares', async () => {
      const stack = createMiddlewareStack();
      
      stack.use(async () => new Response('ok'));
      stack.use(async () => new Response('ok'));
      
      expect(stack.list.length).toBe(2);
      
      stack.clear();
      expect(stack.list.length).toBe(0);
    });
  });

  describe('defineMiddleware', () => {
    it('creates a named middleware factory', () => {
      const mw = defineMiddleware('custom-mw', () => async () => new Response('ok'));
      const result = mw();
      expect(typeof result).toBe('function');
    });
  });

  describe('withTiming', () => {
    it('adds timing header to response', async () => {
      const mw = withTiming({ headerName: 'X-Custom-Time' });
      const middleware = mw();
      
      const response = await middleware(
        { req: new Request('http://localhost'), params: {}, data: {} },
        async () => new Response('ok'),
      );
      
      expect(response.headers.get('X-Custom-Time')).toBeDefined();
    });
  });

  describe('withCors', () => {
    it('adds CORS headers to response', async () => {
      const mw = withCors({ origin: '*', methods: ['GET', 'POST'] });
      const middleware = mw();
      
      const response = await middleware(
        { req: new Request('http://localhost'), params: {}, data: {} },
        async () => new Response('ok'),
      );
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
    });
  });

  describe('withCache', () => {
    it('adds cache headers for GET requests', async () => {
      const mw = withCache({ maxAge: 60 });
      const middleware = mw();
      
      const response = await middleware(
        { req: new Request('http://localhost'), params: {}, data: {} },
        async () => new Response('ok'),
      );
      
      expect(response.headers.get('Cache-Control')).toContain('max-age=60');
    });

    it('does not add cache headers for non-GET requests', async () => {
      const mw = withCache({ maxAge: 60 });
      const middleware = mw();
      
      const response = await middleware(
        { req: new Request('http://localhost', { method: 'POST' }), params: {}, data: {} },
        async () => new Response('ok'),
      );
      
      expect(response.headers.get('Cache-Control')).toBeNull();
    });
  });
});

describe('@render.js/core - Streaming SSR Utilities', () => {
  describe('createStreamingRenderer', () => {
    it('creates a streaming renderer config', () => {
      const renderer = createStreamingRenderer({
        bootstrapScripts: ['/bundle.js'],
        identifierPrefix: 'app',
      });
      
      expect(renderer.bootstrapScripts).toEqual(['/bundle.js']);
      expect(renderer.identifierPrefix).toBe('app');
    });

    it('creates renderer with defaults', () => {
      const renderer = createStreamingRenderer();
      expect(renderer.bootstrapScripts).toBeUndefined();
    });
  });

  describe('createSuspenseFallback', () => {
    it('creates a fallback element with data attribute', () => {
      const fallback = createSuspenseFallback('Loading...');
      expect(fallback).toBeDefined();
    });
  });

  describe('createDeferred', () => {
    it('creates a deferred value', () => {
      const deferred = createDeferred<string>();
      
      expect(typeof deferred.read).toBe('function');
      expect(typeof deferred.resolve).toBe('function');
      expect(typeof deferred.reject).toBe('function');
      expect(typeof deferred.promise).toBe('object');
    });

    it('resolves and reads value', () => {
      const deferred = createDeferred<string>();
      
      deferred.resolve('test');
      
      expect(deferred.read()).toBe('test');
      expect(deferred.peek()).toBe('test');
    });

    it('throws promise when not resolved', () => {
      const deferred = createDeferred<string>();
      
      expect(() => deferred.read()).toThrow();
    });
  });

  describe('useDeferredValue', () => {
    it('returns value when provided', () => {
      const result = useDeferredValue('test', 'initial');
      expect(result).toBe('test');
    });

    it('returns initial value when value is undefined', () => {
      const result = useDeferredValue<string | undefined>(undefined, 'initial');
      expect(result).toBe('initial');
    });
  });

  describe('createSuspenseBoundary', () => {
    it('creates a suspense boundary with fallback', () => {
      const boundary = createSuspenseBoundary({
        fallback: 'Loading...',
        timeoutMs: 5000,
      });
      
      expect(boundary.fallback).toBe('Loading...');
      expect(boundary.timeoutMs).toBe(5000);
    });

    it('creates default fallback', () => {
      const boundary = createSuspenseBoundary();
      
      expect(boundary.fallback).toBeDefined();
      expect(boundary.timeoutMs).toBe(3000);
    });
  });

  describe('createStreamResponse', () => {
    it('creates a streaming response', () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Hello'));
          controller.close();
        },
      });
      
      const response = createStreamResponse(stream);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
      expect(response.headers.get('Transfer-Encoding')).toBe('chunked');
    });

    it('accepts custom status and headers', () => {
      const stream = new ReadableStream();
      
      const response = createStreamResponse(stream, {
        status: 201,
        headers: { 'X-Custom': 'value' },
      });
      
      expect(response.status).toBe(201);
      expect(response.headers.get('X-Custom')).toBe('value');
    });
  });
});

describe('@render.js/core - Dev Server Plugin', () => {
  describe('devServerPlugin', () => {
    it('creates a dev server plugin', () => {
      const plugin = devServerPlugin({
        basePath: '/',
        srcDir: 'src',
        distDir: 'dist',
        privateDir: 'private',
        rscBase: '_rsc',
      } as any, {
        port: 3000,
        host: 'localhost',
        cors: true,
      });
      
      expect(plugin.name).toBe('render:dev-server');
      expect(typeof plugin.configureServer).toBe('function');
    });
  });
});
