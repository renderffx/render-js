import { test, expect } from '@playwright/test';

const TEST_PORT = 3000;

async function waitForApp(port: number, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(`http://localhost:${port}`);
      if (response.ok) {
        return;
      }
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Timeout waiting for app on port ${port}`);
}

test.describe('@render.js/core - COMPREHENSIVE E2E TESTS', () => {

  test.describe('1. PATH UTILITIES', () => {
    test('joinPath - all scenarios', async () => {
      const { joinPath } = await import('../../dist/lib/utils/path.js');
      
      expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
      expect(joinPath('/foo/', '/bar')).toBe('/foo/bar');
      expect(joinPath('/foo', 'bar', 'baz')).toBe('/foo/bar/baz');
      expect(joinPath('/foo', '', 'bar')).toBe('/foo/bar');
      expect(joinPath('/foo/bar', '..')).toBe('/foo');
      expect(joinPath('/foo', '../bar')).toBe('/bar');
      expect(joinPath('/foo', '.', 'bar')).toBe('/foo/bar');
      expect(joinPath('foo', 'bar')).toBe('foo/bar');
      expect(joinPath('/foo//bar')).toBe('/foo/bar');
      expect(joinPath('/')).toBe('/');
    });

    test('parsePathWithSlug - all scenarios', async () => {
      const { parsePathWithSlug } = await import('../../dist/lib/utils/path.js');
      
      expect(parsePathWithSlug('/users')).toEqual([{ type: 'literal', name: 'users' }]);
      expect(parsePathWithSlug('/users/[id]')).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ]);
      expect(parsePathWithSlug('/users/[userId]/posts/[postId]')).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'userId' },
        { type: 'literal', name: 'posts' },
        { type: 'group', name: 'postId' },
      ]);
      expect(parsePathWithSlug('/docs/[...slug]')).toEqual([
        { type: 'literal', name: 'docs' },
        { type: 'wildcard', name: 'slug' },
      ]);
      expect(parsePathWithSlug('/')).toEqual([]);
      expect(parsePathWithSlug('/[]')).toEqual([{ type: 'group', name: '' }]);
    });

    test('parseExactPath', async () => {
      const { parseExactPath } = await import('../../dist/lib/utils/path.js');
      
      expect(parseExactPath('/users/[id]')).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'literal', name: '[id]' },
      ]);
    });

    test('path2regexp', async () => {
      const { path2regexp } = await import('../../dist/lib/utils/path.js');
      
      expect(path2regexp([{ type: 'literal', name: 'users' }])).toBe('^/users$');
      expect(path2regexp([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ])).toBe('^/users/([^/]+)$');
      expect(path2regexp([
        { type: 'literal', name: 'docs' },
        { type: 'wildcard', name: 'slug' },
      ])).toBe('^/docs/(.*)$');
    });

    test('pathSpecAsString', async () => {
      const { pathSpecAsString } = await import('../../dist/lib/utils/path.js');
      
      expect(pathSpecAsString([{ type: 'literal', name: 'users' }])).toBe('/users');
      expect(pathSpecAsString([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ])).toBe('/users/[id]');
      expect(pathSpecAsString([
        { type: 'literal', name: 'docs' },
        { type: 'wildcard', name: 'slug' },
      ])).toBe('/docs/[...slug]');
    });

    test('getPathMapping', async () => {
      const { getPathMapping, parsePathWithSlug } = await import('../../dist/lib/utils/path.js');
      
      const spec1 = parsePathWithSlug('/users/[id]');
      expect(getPathMapping(spec1, '/users/123')).toEqual({ id: '123' });
      expect(getPathMapping(spec1, '/posts/123')).toBeNull();
      
      const spec2 = parsePathWithSlug('/docs/[...slug]');
      expect(getPathMapping(spec2, '/docs/a/b/c')).toEqual({ slug: ['a', 'b', 'c'] });
      
      expect(getPathMapping(spec1, '/users/123/extra')).toBeNull();
      expect(getPathMapping(spec1, '/users')).toBeNull();
    });

    test('extname', async () => {
      const { extname } = await import('../../dist/lib/utils/path.js');
      
      expect(extname('/foo/bar.txt')).toBe('.txt');
      expect(extname('/foo/bar.js')).toBe('.js');
      expect(extname('/foo/bar')).toBe('');
      expect(extname('/foo/bar.baz.txt')).toBe('.txt');
      expect(extname('/foo/.gitignore')).toBe('');
    });

    test('removeBase / addBase', async () => {
      const { removeBase, addBase } = await import('../../dist/lib/utils/path.js');
      
      expect(removeBase('/foo/bar', '/foo')).toBe('/bar');
      expect(removeBase('/other/bar', '/foo')).toBe('/other/bar');
      expect(removeBase('/foo/bar', '/')).toBe('/foo/bar');
      
      expect(addBase('/bar', '/foo')).toBe('/foo/bar');
      expect(addBase('/bar', '/')).toBe('/bar');
    });

    test('file path utilities', async () => {
      const { 
        encodeFilePathToAbsolute, 
        filePathToFileURL,
      } = await import('../../dist/lib/utils/path.js');
      
      expect(encodeFilePathToAbsolute('foo/bar')).toBe('/foo/bar');
      expect(encodeFilePathToAbsolute('/foo/bar')).toBe('/foo/bar');
      expect(filePathToFileURL('foo/bar')).toContain('foo/bar');
    });
  });

  test.describe('2. STREAM UTILITIES', () => {
    test('stringToStream', async () => {
      const { stringToStream } = await import('../../dist/lib/utils/stream.js');
      
      const stream = stringToStream('Hello World');
      const reader = stream.getReader();
      const { value, done } = await reader.read();
      
      const decoder = new TextDecoder();
      expect(decoder.decode(value)).toBe('Hello World');
      expect(done).toBe(false);
      
      const { done: done2 } = await reader.read();
      expect(done2).toBe(true);
    });

    test('streamToBase64 / base64ToStream roundtrip', async () => {
      const { stringToStream, streamToBase64, base64ToStream } = await import('../../dist/lib/utils/stream.js');
      
      const testCases = [
        'Hello World',
        'Test content 123!@#',
        '',
        'Unicode: 你好世界 🎉',
        'Line1\nLine2\nLine3',
      ];
      
      for (const original of testCases) {
        const stream = stringToStream(original);
        const base64 = await streamToBase64(stream);
        const decodedStream = base64ToStream(base64);
        const reader = decodedStream.getReader();
        const { value } = await reader.read();
        
        const decoder = new TextDecoder();
        expect(decoder.decode(value)).toBe(original);
      }
    });

    test('batchReadableStream', async () => {
      const { batchReadableStream } = await import('../../dist/lib/utils/stream.js');
      
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('chunk1'));
          controller.enqueue(new TextEncoder().encode('chunk2'));
          controller.enqueue(new TextEncoder().encode('chunk3'));
          controller.close();
        },
      });
      
      const batched = batchReadableStream(stream);
      const reader = batched.getReader();
      const { value } = await reader.read();
      
      expect(value).toBeDefined();
      expect(new TextDecoder().decode(value)).toContain('chunk1');
    });

    test('produceMultiplexedStream / consumeMultiplexedStream', async () => {
      const { produceMultiplexedStream, consumeMultiplexedStream, stringToStream } = await import('../../dist/lib/utils/stream.js');
      
      const stream = produceMultiplexedStream(async (callback) => {
        await callback('channel1', stringToStream('data1'));
        await callback('channel2', stringToStream('data2'));
      });
      
      const results: Record<string, string> = {};
      
      await consumeMultiplexedStream(stream, async (key, s) => {
        const reader = s.getReader();
        const { value } = await reader.read();
        results[key] = new TextDecoder().decode(value);
      });
      
      expect(results['channel1']).toBe('data1');
      expect(results['channel2']).toBe('data2');
    });
  });

  test.describe('3. ROUTER COMMON', () => {
    test('pathnameToRoutePath', async () => {
      const { pathnameToRoutePath } = await import('../../dist/router/common.js');
      
      expect(pathnameToRoutePath('/_rsc/home')).toBe('/home');
      expect(pathnameToRoutePath('/_rsc')).toBe('/');
      expect(pathnameToRoutePath('/_rsc/')).toBe('/');
      expect(pathnameToRoutePath('/_rsc/users/profile')).toBe('/users/profile');
    });

    test('encodeRoutePath / decodeRoutePath', async () => {
      const { encodeRoutePath, decodeRoutePath } = await import('../../dist/router/common.js');
      
      const testCases = [
        '/',
        '/users',
        '/users/[id]',
        '/users/123/posts/456',
        '/_internal',
        '/api/v1/users',
      ];
      
      for (const path of testCases) {
        const encoded = encodeRoutePath(path);
        const decoded = decodeRoutePath(encoded);
        expect(decoded).toBe(path);
      }
    });

    test('encodeSliceId / decodeSliceId', async () => {
      const { encodeSliceId, decodeSliceId } = await import('../../dist/router/common.js');
      
      expect(encodeSliceId('header')).toBe('S/header');
      expect(decodeSliceId('S/header')).toBe('header');
      expect(decodeSliceId('invalid')).toBeNull();
    });

    test('getComponentIds', async () => {
      const { getComponentIds } = await import('../../dist/router/common.js');
      
      expect(getComponentIds('/')).toEqual(['root', 'page']);
      expect(getComponentIds('/users')).toContain('users/layout');
      expect(getComponentIds('/users/profile')).toContain('users/layout');
      expect(getComponentIds('/users/profile')).toContain('users/profile/page');
    });

    test('constants', async () => {
      const { ROUTE_ID, IS_STATIC_ID, HAS404_ID, SKIP_HEADER } = await import('../../dist/router/common.js');
      
      expect(ROUTE_ID).toBe('ROUTE');
      expect(IS_STATIC_ID).toBe('IS_STATIC');
      expect(HAS404_ID).toBe('HAS404');
      expect(SKIP_HEADER).toBe('X-Render-Router-Skip');
    });
  });

  test.describe('4. ROUTER SERVER', () => {
    test('createPages', async () => {
      const { createPages } = await import('../../dist/router/server.js');
      
      const pages = createPages({
        '/': { children: ['./src/pages/index.tsx'] },
        '/about': { children: ['./src/pages/about.tsx'] },
        '/users/[id]': { children: ['./src/pages/users/[id].tsx'] },
        '/posts/[postId]/comments/[commentId]': { children: ['./src/pages/posts/[postId]/comments/[commentId].tsx'] },
      });
      
      expect(pages['/']).toBeDefined();
      expect(pages['/about']).toBeDefined();
      expect(pages['/users/[id]']).toBeDefined();
    });

    test('unstable_notFound', async () => {
      const { unstable_notFound } = await import('../../dist/router/server.js');
      
      expect(() => unstable_notFound()).toThrow();
      expect(() => unstable_notFound()).toThrow('Not Found');
    });

    test('unstable_redirect', async () => {
      const { unstable_redirect } = await import('../../dist/router/server.js');
      
      expect(() => unstable_redirect('/new-location')).toThrow();
      expect(() => unstable_redirect('/new-location', 307)).toThrow();
      expect(() => unstable_redirect('/new-location', 308)).toThrow();
    });
  });

  test.describe('5. CONTEXT', () => {
    test('runWithContext / getContext', async () => {
      const { unstable_runWithContext, unstable_getContext } = await import('../../dist/lib/context.js');
      
      const result = await unstable_runWithContext(
        { userId: '123', token: 'abc' } as any,
        () => unstable_getContext()
      );
      
      expect(result.req).toEqual({ userId: '123', token: 'abc' });
    });

    test('getContext throws outside context', async () => {
      const { unstable_getContext } = await import('../../dist/lib/context.js');
      
      expect(() => unstable_getContext()).toThrow();
    });

    test('getContextData', async () => {
      const { unstable_runWithContext, unstable_getContextData } = await import('../../dist/lib/context.js');
      
      const result = await unstable_runWithContext(
        {} as any,
        () => unstable_getContextData('testKey')
      );
      expect(result).toBeUndefined();
      
      const result2 = await unstable_runWithContext(
        {} as any,
        () => unstable_getContextData()
      );
      expect(result2).toEqual({});
    });
  });

  test.describe('6. CUSTOM ERRORS', () => {
    test('createCustomError', async () => {
      const { createCustomError } = await import('../../dist/lib/utils/custom-errors.js');
      
      const error1 = createCustomError('Not Found', { status: 404 });
      expect(error1.message).toBe('Not Found');
      expect((error1 as any).status).toBe(404);
      
      const error2 = createCustomError('Redirect', { location: '/home', status: 307 });
      expect((error2 as any).location).toBe('/home');
      expect((error2 as any).status).toBe(307);
    });

    test('getErrorInfo', async () => {
      const { createCustomError, getErrorInfo } = await import('../../dist/lib/utils/custom-errors.js');
      
      const error = createCustomError('Test Error', { status: 500 });
      const info = getErrorInfo(error);
      
      expect(info).not.toBeNull();
      expect(info?.message).toBe('Test Error');
      expect(info?.status).toBe(500);
    });

    test('getErrorInfo handles invalid input', async () => {
      const { getErrorInfo } = await import('../../dist/lib/utils/custom-errors.js');
      
      expect(getErrorInfo(null)).toBeNull();
      expect(getErrorInfo(undefined)).toBeNull();
    });
  });

  test.describe('7. CONFIG', () => {
    test('defineConfig', async () => {
      const { defineConfig } = await import('../../dist/config.js');
      
      const config1 = defineConfig({
        basePath: '/app',
        srcDir: 'src',
        distDir: 'build',
        rscBase: '_rsc',
      });
      
      expect(config1.basePath).toBe('/app');
      expect(config1.srcDir).toBe('src');
      expect(config1.distDir).toBe('build');
      expect(config1.rscBase).toBe('_rsc');
      
      const config2 = defineConfig({});
      expect(config2.basePath).toBe('/');
      expect(config2.srcDir).toBe('src');
      expect(config2.distDir).toBe('dist');
      expect(config2.rscBase).toBe('_rsc');
    });
  });

  test.describe('8. CONSTANTS', () => {
    test('unstable_constants', async () => {
      const { unstable_constants } = await import('../../dist/lib/constants.js');
      
      expect(unstable_constants.DIST_PUBLIC).toBe('_rsc');
      expect(unstable_constants.ENTRY_JSON).toBe('entry.json');
      expect(unstable_constants.SERVER_BUNDLE).toBe('bundle.js');
      expect(unstable_constants.RSC_PATH).toBe('_rsc');
      expect(unstable_constants.HTML_PATH).toBe('index.html');
    });
  });

  test.describe('9. RSC PATH UTILITIES', () => {
    test('encodeRscPath / decodeRscPath', async () => {
      const { encodeRscPath, decodeRscPath } = await import('../../dist/lib/utils/rsc-path.js');
      
      const testCases = [
        '/',
        '/users',
        '/users/123',
        '/users/123/posts/456',
        '/a/b/c/d/e',
      ];
      
      for (const path of testCases) {
        const encoded = encodeRscPath(path);
        const decoded = decodeRscPath(encoded);
        expect(decoded).toBe(path);
      }
      
      expect(encodeRscPath('/users 123')).toBe('%2Fusers%20123');
    });

    test('encodeFuncId / decodeFuncId', async () => {
      const { encodeFuncId, decodeFuncId } = await import('../../dist/lib/utils/rsc-path.js');
      
      expect(decodeFuncId(encodeFuncId('myAction'))).toBe('myAction');
      expect(decodeFuncId(encodeFuncId('myFunction'))).toBe('myFunction');
      expect(decodeFuncId(encodeFuncId('test_123'))).toBe('test_123');
    });
  });

  test.describe('10. API ROUTES', () => {
    test('defineApiRoute', async () => {
      const { defineApiRoute, defineGetApi, definePostApi, definePutApi, defineDeleteApi, definePatchApi } = await import('../../dist/lib/api/routes.js');
      
      const route1 = defineGetApi('/api/users', async (req) => {
        return new Response(JSON.stringify({ users: [] }));
      });
      expect(route1.path).toBe('/api/users');
      expect(route1.method).toBe('GET');
      
      const route2 = definePostApi('/api/users', async (req) => {
        return new Response(JSON.stringify({ success: true }));
      });
      expect(route2.method).toBe('POST');
      
      const route3 = definePutApi('/api/users/[id]', async (req) => {
        return new Response(JSON.stringify({ updated: true }));
      });
      expect(route3.method).toBe('PUT');
      
      const route4 = defineDeleteApi('/api/users/[id]', async (req) => {
        return new Response(JSON.stringify({ deleted: true }));
      });
      expect(route4.method).toBe('DELETE');
      
      const route5 = definePatchApi('/api/users/[id]', async (req) => {
        return new Response(JSON.stringify({ patched: true }));
      });
      expect(route5.method).toBe('PATCH');
    });

    test('createApiHandler', async () => {
      const { defineGetApi, createApiHandler } = await import('../../dist/lib/api/routes.js');
      
      const routes = [
        defineGetApi('/api/test', async () => new Response('OK')),
      ];
      
      const handler = createApiHandler(routes);
      expect(typeof handler).toBe('function');
    });

    test('parseJsonBody / getQueryParams / getPathParams', async () => {
      const { parseJsonBody, getQueryParams, getPathParams } = await import('../../dist/lib/api/routes.js');
      
      const mockReq = new Request('http://localhost:3000/api/users?id=123&name=john');
      const query = getQueryParams(mockReq);
      expect(query.id).toBe('123');
      expect(query.name).toBe('john');
    });
  });

  test.describe('11. MIDDLEWARE', () => {
    test('withCors', async () => {
      const { withCors } = await import('../../dist/lib/middleware/middleware.js');
      
      const cors = withCors({ origin: '*', methods: ['GET', 'POST'] });
      expect(cors).toBeDefined();
      expect(typeof cors).toBe('function');
    });

    test('withLogger', async () => {
      const { withLogger } = await import('../../dist/lib/middleware/middleware.js');
      
      const logger = withLogger();
      expect(logger).toBeDefined();
      expect(typeof logger).toBe('function');
    });

    test('withTiming', async () => {
      const { withTiming } = await import('../../dist/lib/middleware/middleware.js');
      
      const timing = withTiming();
      expect(timing).toBeDefined();
      expect(typeof timing).toBe('function');
    });

    test('withCache', async () => {
      const { withCache } = await import('../../dist/lib/middleware/middleware.js');
      
      const cache = withCache({ maxAge: 3600 });
      expect(cache).toBeDefined();
      expect(typeof cache).toBe('function');
    });
  });

  test.describe('12. VITE PLUGINS', () => {
    test('mainPlugin', async () => {
      const { unstable_mainPlugin } = await import('../../dist/index.js');
      
      expect(unstable_mainPlugin).toBeDefined();
      expect(typeof unstable_mainPlugin).toBe('function');
    });

    test('userEntriesPlugin', async () => {
      const { unstable_userEntriesPlugin } = await import('../../dist/index.js');
      
      expect(unstable_userEntriesPlugin).toBeDefined();
      expect(typeof unstable_userEntriesPlugin).toBe('function');
    });

    test('allowServerPlugin', async () => {
      const { unstable_allowServerPlugin } = await import('../../dist/index.js');
      
      expect(unstable_allowServerPlugin).toBeDefined();
      expect(typeof unstable_allowServerPlugin).toBe('function');
    });

    test('combinedPlugins', async () => {
      const { unstable_combinedPlugins } = await import('../../dist/index.js');
      
      expect(unstable_combinedPlugins).toBeDefined();
      expect(typeof unstable_combinedPlugins).toBe('function');
    });

    test('devServerPlugin', async () => {
      const { unstable_devServerPlugin } = await import('../../dist/index.js');
      
      expect(unstable_devServerPlugin).toBeDefined();
      expect(typeof unstable_devServerPlugin).toBe('function');
    });
  });

  test.describe('13. INDEX EXPORTS', () => {
    test('all main exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.defineConfig).toBeDefined();
      expect(core.unstable_defineRouter).toBeDefined();
      expect(core.unstable_getRscPath).toBeDefined();
      expect(core.unstable_getRscParams).toBeDefined();
      expect(core.unstable_notFound).toBeDefined();
      expect(core.unstable_redirect).toBeDefined();
      expect(core.createPages).toBeDefined();
      expect(core.fsRouter).toBeDefined();
      expect(core.Link).toBeDefined();
      expect(core.ErrorBoundary).toBeDefined();
      expect(core.useRouter).toBeDefined();
      expect(core.usePathname).toBeDefined();
      expect(core.useSearchParams).toBeDefined();
    });

    test('all utility exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.joinPath).toBeDefined();
      expect(core.parsePathWithSlug).toBeDefined();
      expect(core.removeBase).toBeDefined();
      expect(core.addBase).toBeDefined();
      expect(core.encodeRscPath).toBeDefined();
      expect(core.decodeRscPath).toBeDefined();
      expect(core.encodeFuncId).toBeDefined();
      expect(core.decodeFuncId).toBeDefined();
      expect(core.stringToStream).toBeDefined();
      expect(core.streamToBase64).toBeDefined();
      expect(core.base64ToStream).toBeDefined();
      expect(core.createCustomError).toBeDefined();
      expect(core.getErrorInfo).toBeDefined();
    });

    test('all stream exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.createStreamingRenderer).toBeDefined();
      expect(core.createSuspenseFallback).toBeDefined();
      expect(core.createDeferred).toBeDefined();
      expect(core.useDeferredValue).toBeDefined();
      expect(core.createSuspenseBoundary).toBeDefined();
      expect(core.createStreamResponse).toBeDefined();
    });

    test('all data fetching exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.useData).toBeDefined();
      expect(core.useAction).toBeDefined();
      expect(core.useServer).toBeDefined();
      expect(core.setCacheData).toBeDefined();
      expect(core.getCacheData).toBeDefined();
      expect(core.clearCacheData).toBeDefined();
    });

    test('all prefetch exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.prefetch).toBeDefined();
      expect(core.preload).toBeDefined();
      expect(core.preloadFont).toBeDefined();
      expect(core.preloadImage).toBeDefined();
      expect(core.prefetchModule).toBeDefined();
      expect(core.eagerPreload).toBeDefined();
      expect(core.lazyLoadImage).toBeDefined();
      expect(core.createImagePreloader).toBeDefined();
    });

    test('all client action exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.ActionProvider).toBeDefined();
      expect(core.useActionState).toBeDefined();
      expect(core.Form).toBeDefined();
      expect(core.useSubmit).toBeDefined();
      expect(core.LoadingOverlay).toBeDefined();
      expect(core.PendingUI).toBeDefined();
    });

    test('all navigation exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.usePending).toBeDefined();
      expect(core.useNavigation).toBeDefined();
      expect(core.usePrefetch).toBeDefined();
    });

    test('all server cache exports exist', async () => {
      const core = await import('../../dist/index.js');
      
      expect(core.createServerCache).toBeDefined();
      expect(core.cacheAsync).toBeDefined();
      expect(core.getCached).toBeDefined();
      expect(core.setCached).toBeDefined();
      expect(core.invalidateCache).toBeDefined();
    });
  });

  test.describe('14. MINIMAL EXPORTS', () => {
    test('minimal/client exports', async () => {
      const { Root, Slot, Children, useRefetch, unstable_fetchRsc, unstable_prefetchRsc } = await import('../../dist/minimal/client.js');
      
      expect(Root).toBeDefined();
      expect(Slot).toBeDefined();
      expect(Children).toBeDefined();
      expect(useRefetch).toBeDefined();
      expect(unstable_fetchRsc).toBeDefined();
      expect(unstable_prefetchRsc).toBeDefined();
    });

    test('minimal/server exports', async () => {
      const { unstable_defineServerEntry, unstable_defineHandlers } = await import('../../dist/minimal/server.js');
      
      expect(unstable_defineServerEntry).toBeDefined();
      expect(unstable_defineHandlers).toBeDefined();
    });
  });

  test.describe('15. ADAPTER BUILDERS', () => {
    test('adapter exports', async () => {
      const { unstable_createServerEntryAdapter } = await import('../../dist/adapter-builders.js');
      
      expect(unstable_createServerEntryAdapter).toBeDefined();
    });
  });

  test.describe('16. INTERNALS', () => {
    test('internals exports', async () => {
      const { unstable_honoMiddleware } = await import('../../dist/internals.js');
      
      expect(unstable_honoMiddleware).toBeDefined();
    });
  });

  test.describe('17. EDGE CASES', () => {
    test('empty inputs', async () => {
      const { joinPath, parsePathWithSlug, getPathMapping } = await import('../../dist/lib/utils/path.js');
      
      expect(joinPath()).toBe('.');
      expect(parsePathWithSlug('')).toEqual([]);
      expect(parsePathWithSlug('//')).toEqual([]);
    });

    test('special characters in paths', async () => {
      const { encodeRscPath, decodeRscPath } = await import('../../dist/lib/utils/rsc-path.js');
      
      const specialPaths = [
        '/path with spaces',
        '/path/with/special/chars!@#$%',
        '/unicode/路径/パス',
        '/numbers/123/456',
      ];
      
      for (const path of specialPaths) {
        expect(decodeRscPath(encodeRscPath(path))).toBe(path);
      }
    });

    test('deeply nested routes', async () => {
      const { getComponentIds } = await import('../../dist/router/common.js');
      
      const deepPath = '/a/b/c/d/e/f/g/h';
      const ids = getComponentIds(deepPath);
      
      expect(ids.length).toBeGreaterThan(5);
      expect(ids).toContain('a/layout');
      expect(ids).toContain('a/b/layout');
    });

    test('cache behavior', async () => {
      const { joinPath, parsePathWithSlug } = await import('../../dist/lib/utils/path.js');
      
      const result1 = joinPath('/foo', 'bar');
      const result2 = joinPath('/foo', 'bar');
      const result3 = joinPath('/foo', 'bar');
      
      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
      
      const parsed1 = parsePathWithSlug('/users/[id]');
      const parsed2 = parsePathWithSlug('/users/[id]');
      
      expect(parsed1).toBe(parsed2);
    });
  });

  test.describe('18. ERROR HANDLING', () => {
    test('decodeRoutePath throws on invalid input', async () => {
      const { decodeRoutePath } = await import('../../dist/router/common.js');
      
      expect(() => decodeRoutePath('invalid')).toThrow();
    });

    test('getComponentIds handles various paths', async () => {
      const { getComponentIds } = await import('../../dist/router/common.js');
      
      const rootIds = getComponentIds('/');
      expect(rootIds).toContain('root');
      expect(rootIds).toContain('page');
      
      const simpleIds = getComponentIds('/users');
      expect(simpleIds).toContain('users/layout');
      expect(simpleIds).toContain('users/page');
    });
  });

  test.describe('19. DATA STRUCTURES', () => {
    test('PathSpec types', async () => {
      const { parsePathWithSlug, path2regexp, pathSpecAsString } = await import('../../dist/lib/utils/path.js');
      
      const spec = parsePathWithSlug('/api/[version]/users/[id]');
      expect(spec.length).toBe(4);
      
      const regex = path2regexp(spec);
      expect(regex).toContain('([^/]+)');
      
      const str = pathSpecAsString(spec);
      expect(str).toBe('/api/[version]/users/[id]');
    });

    test('RouteProps type', async () => {
      const { pathnameToRoutePath } = await import('../../dist/router/common.js');
      
      const routePath = pathnameToRoutePath('/_rsc/users');
      expect(routePath).toBe('/users');
    });
  });

  test.describe('20. PERFORMANCE REGRESSION CHECK', () => {
    test('cached functions return same reference', async () => {
      const { joinPath, parsePathWithSlug, path2regexp } = await import('../../dist/lib/utils/path.js');
      
      const result1 = joinPath('/a', 'b');
      const result2 = joinPath('/a', 'b');
      expect(result1).toBe(result2);
      
      const spec1 = parsePathWithSlug('/x/[y]');
      const spec2 = parsePathWithSlug('/x/[y]');
      expect(spec1).toBe(spec2);
      
      const regex1 = path2regexp(spec1);
      const regex2 = path2regexp(spec1);
      expect(regex1).toBe(regex2);
    });

    test('multiple operations complete without error', async () => {
      const { joinPath, parsePathWithSlug, path2regexp, getPathMapping } = await import('../../dist/lib/utils/path.js');
      
      for (let i = 0; i < 100; i++) {
        const path = `/users/${i}/posts/${i}`;
        const spec = parsePathWithSlug(path);
        const regex = path2regexp(spec);
        const mapping = getPathMapping(spec, path);
        
        expect(mapping).not.toBeNull();
      }
    });
  });
});

console.log('✅ COMPREHENSIVE E2E TESTS DEFINED');
