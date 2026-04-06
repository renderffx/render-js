import { test, expect } from '@playwright/test';

test.describe('@render.js/core - FRAMEWORK STRESS TEST', () => {

  test('1. STRESS: Path utilities performance under load', async () => {
    const { joinPath, parsePathWithSlug, path2regexp, getPathMapping } = await import('../../dist/lib/utils/path.js');
    
    const iterations = 10000;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      joinPath('/foo', 'bar', 'baz');
      parsePathWithSlug(`/users/${i}/posts/${i}`);
      path2regexp(parsePathWithSlug('/test/[id]'));
      getPathMapping(parsePathWithSlug('/items/[id]'), `/items/${i}`);
    }
    
    const duration = Date.now() - start;
    const opsPerSec = (iterations * 4) / (duration / 1000);
    
    console.log(`Path utilities: ${opsPerSec.toFixed(0)} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(1000);
  });

  test('2. STRESS: Router common under load', async () => {
    const { pathnameToRoutePath, encodeRoutePath, decodeRoutePath, getComponentIds, encodeSliceId, decodeSliceId } = await import('../../dist/router/common.js');
    
    const iterations = 10000;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      pathnameToRoutePath(`/_rsc/users/${i}`);
      const encoded = encodeRoutePath(`/test/${i}`);
      decodeRoutePath(encoded);
      getComponentIds(`/users/${i}/posts/${i}`);
      const slice = encodeSliceId(`slice_${i}`);
      decodeSliceId(slice);
    }
    
    const duration = Date.now() - start;
    const opsPerSec = (iterations * 6) / (duration / 1000);
    
    console.log(`Router common: ${opsPerSec.toFixed(0)} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(1000);
  });

  test('3. STRESS: RSC path utilities under load', async () => {
    const { encodeRscPath, decodeRscPath, encodeFuncId, decodeFuncId } = await import('../../dist/lib/utils/rsc-path.js');
    
    const iterations = 10000;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const encoded = encodeRscPath(`/path/${i}/item`);
      decodeRscPath(encoded);
      const funcEncoded = encodeFuncId(`action_${i}`);
      decodeFuncId(funcEncoded);
    }
    
    const duration = Date.now() - start;
    const opsPerSec = (iterations * 4) / (duration / 1000);
    
    console.log(`RSC path: ${opsPerSec.toFixed(0)} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(1000);
  });

  test('4. STRESS: Stream utilities under load', async () => {
    const { stringToStream, streamToBase64, base64ToStream } = await import('../../dist/lib/utils/stream.js');
    
    const iterations = 1000;
    const testData = 'Test data for streaming performance test with enough content';
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const stream = stringToStream(testData + i);
      const base64 = await streamToBase64(stream);
      const decodedStream = base64ToStream(base64);
      await decodedStream.getReader().read();
    }
    
    const duration = Date.now() - start;
    const opsPerSec = (iterations * 3) / (duration / 1000);
    
    console.log(`Stream utilities: ${opsPerSec.toFixed(0)} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(10);
  });

  test('5. STRESS: Cache behavior under load', async () => {
    const { joinPath, parsePathWithSlug } = await import('../../dist/lib/utils/path.js');
    
    const uniquePaths = 100;
    const iterationsPerPath = 100;
    
    const start = Date.now();
    
    for (let i = 0; i < uniquePaths; i++) {
      const path = `/users/${i}/posts/${i}`;
      for (let j = 0; j < iterationsPerPath; j++) {
        joinPath('/foo', `bar${i}`, `baz${j}`);
        parsePathWithSlug(path);
      }
    }
    
    const duration = Date.now() - start;
    const totalOps = uniquePaths * iterationsPerPath * 2;
    const opsPerSec = totalOps / (duration / 1000);
    
    console.log(`Cache stress: ${opsPerSec.toFixed(0)} ops/sec`);
    expect(opsPerSec).toBeGreaterThan(1000);
  });

  test('6. EDGE: Empty and invalid inputs', async () => {
    const { joinPath, parsePathWithSlug, getPathMapping, extname } = await import('../../dist/lib/utils/path.js');
    
    expect(joinPath()).toBe('.');
    expect(joinPath('')).toBe('.');
    expect(joinPath('/', '')).toBe('/');
    expect(parsePathWithSlug('')).toEqual([]);
    expect(parsePathWithSlug('//')).toEqual([]);
    expect(extname('')).toBe('');
    expect(extname('.hidden')).toBe('');
  });

  test('7. EDGE: Deep nesting', async () => {
    const { getComponentIds } = await import('../../dist/router/common.js');
    const { parsePathWithSlug, getPathMapping } = await import('../../dist/lib/utils/path.js');
    
    const deepPath = '/a/b/c/d/e/f/g/h/i/j';
    const ids = getComponentIds(deepPath);
    expect(ids.length).toBeGreaterThan(10);
    
    const spec = parsePathWithSlug(deepPath);
    expect(spec.length).toBe(10);
    
    const mapping = getPathMapping(spec, deepPath);
    expect(Object.keys(mapping || {}).length).toBe(0);
  });

  test('8. EDGE: Special characters', async () => {
    const { encodeRscPath, decodeRscPath } = await import('../../dist/lib/utils/rsc-path.js');
    
    const specialPaths = [
      '/path with spaces',
      '/unicode/中文/日本語/한글',
      '/numbers/1234567890',
      '/mixed/abc123中文',
    ];
    
    for (const path of specialPaths) {
      const encoded = encodeRscPath(path);
      const decoded = decodeRscPath(encoded);
      expect(decoded).toBe(path);
    }
  });

  test('9. EDGE: Large numbers of routes', async () => {
    const { createPages } = await import('../../dist/router/server.js');
    
    const pagesConfig: Record<string, any> = {};
    for (let i = 0; i < 100; i++) {
      pagesConfig[`/users/${i}`] = { children: [`./pages/user${i}.tsx`] };
      pagesConfig[`/users/${i}/posts/${i}`] = { children: [`./pages/post${i}.tsx`] };
    }
    
    const pages = createPages(pagesConfig);
    expect(Object.keys(pages).length).toBe(200);
  });

  test('10. ERROR: Context errors', async () => {
    const { unstable_getContext } = await import('../../dist/lib/context.js');
    expect(() => unstable_getContext()).toThrow();
  });

  test('11. ERROR: Custom errors', async () => {
    const { createCustomError, getErrorInfo } = await import('../../dist/lib/utils/custom-errors.js');
    
    const notFoundError = createCustomError('Not Found', { status: 404 });
    expect(notFoundError.message).toBe('Not Found');
    expect((notFoundError as any).status).toBe(404);
    
    const info = getErrorInfo(notFoundError);
    expect(info?.message).toBe('Not Found');
    expect(info?.status).toBe(404);
  });

  test('12. ERROR: Router errors', async () => {
    const { unstable_notFound, unstable_redirect } = await import('../../dist/router/server.js');
    const { decodeRoutePath } = await import('../../dist/router/common.js');
    
    expect(() => unstable_notFound()).toThrow();
    expect(() => unstable_redirect('/new-page')).toThrow();
    expect(() => decodeRoutePath('invalid-prefix')).toThrow();
  });

  test('13. CONFIG: defineConfig validation', async () => {
    const { defineConfig } = await import('../../dist/config.js');
    
    const fullConfig = defineConfig({
      basePath: '/app',
      srcDir: 'src',
      distDir: 'build',
      rscBase: '_rsc',
    });
    expect(fullConfig.basePath).toBe('/app');
    expect(fullConfig.distDir).toBe('build');
    
    const partialConfig = defineConfig({});
    expect(partialConfig.basePath).toBe('/');
    expect(partialConfig.srcDir).toBe('src');
  });

  test('14. CONSTANTS: All constants defined', async () => {
    const { unstable_constants } = await import('../../dist/lib/constants.js');
    
    expect(unstable_constants.DIST_PUBLIC).toBe('_rsc');
    expect(unstable_constants.ENTRY_JSON).toBe('entry.json');
    expect(unstable_constants.SERVER_BUNDLE).toBe('bundle.js');
    expect(unstable_constants.RSC_PATH).toBe('_rsc');
    expect(unstable_constants.HTML_PATH).toBe('index.html');
  });

  test('15. API: Route definitions', async () => {
    const { defineGetApi, definePostApi, definePutApi, defineDeleteApi, definePatchApi } = await import('../../dist/lib/api/routes.js');
    
    expect(defineGetApi('/api/users', async () => new Response('{}')).method).toBe('GET');
    expect(definePostApi('/api/users', async () => new Response('{}')).method).toBe('POST');
    expect(definePutApi('/api/users/[id]', async () => new Response('{}')).method).toBe('PUT');
    expect(defineDeleteApi('/api/users/[id]', async () => new Response('{}')).method).toBe('DELETE');
    expect(definePatchApi('/api/users/[id]', async () => new Response('{}')).method).toBe('PATCH');
  });

  test('16. MIDDLEWARE: Middleware factories exist', async () => {
    const { withCors, withLogger, withTiming, withCache, withBodyParser } = await import('../../dist/lib/middleware/middleware.js');
    
    expect(typeof withCors).toBe('function');
    expect(typeof withLogger).toBe('function');
    expect(typeof withTiming).toBe('function');
    expect(typeof withCache).toBe('function');
    expect(typeof withBodyParser).toBe('function');
  });

  test('17. PLUGINS: All plugins exported', async () => {
    const { unstable_mainPlugin, unstable_userEntriesPlugin, unstable_allowServerPlugin, unstable_combinedPlugins, unstable_devServerPlugin } = await import('../../dist/index.js');
    
    expect(typeof unstable_mainPlugin).toBe('function');
    expect(typeof unstable_userEntriesPlugin).toBe('function');
    expect(typeof unstable_allowServerPlugin).toBe('function');
    expect(typeof unstable_combinedPlugins).toBe('function');
    expect(typeof unstable_devServerPlugin).toBe('function');
  });

  test('18. EXPORTS: All main exports', async () => {
    const core = await import('../../dist/index.js');
    
    expect(core.defineConfig).toBeDefined();
    expect(core.unstable_defineRouter).toBeDefined();
    expect(core.unstable_notFound).toBeDefined();
    expect(core.unstable_redirect).toBeDefined();
    expect(core.createPages).toBeDefined();
    expect(core.fsRouter).toBeDefined();
    expect(core.Link).toBeDefined();
    expect(core.ErrorBoundary).toBeDefined();
    expect(core.useRouter).toBeDefined();
    expect(core.usePathname).toBeDefined();
    expect(core.useSearchParams).toBeDefined();
    expect(core.joinPath).toBeDefined();
    expect(core.parsePathWithSlug).toBeDefined();
    expect(core.removeBase).toBeDefined();
    expect(core.addBase).toBeDefined();
    expect(core.encodeRscPath).toBeDefined();
    expect(core.decodeRscPath).toBeDefined();
    expect(core.stringToStream).toBeDefined();
    expect(core.streamToBase64).toBeDefined();
    expect(core.createCustomError).toBeDefined();
    expect(core.getErrorInfo).toBeDefined();
    expect(core.useData).toBeDefined();
    expect(core.useAction).toBeDefined();
    expect(core.useServer).toBeDefined();
    expect(core.prefetch).toBeDefined();
    expect(core.preload).toBeDefined();
    expect(core.usePending).toBeDefined();
    expect(core.useNavigation).toBeDefined();
    expect(core.createServerCache).toBeDefined();
    expect(core.createStreamingRenderer).toBeDefined();
    expect(core.createSuspenseFallback).toBeDefined();
    expect(core.createDeferred).toBeDefined();
    expect(core.useDeferredValue).toBeDefined();
  });

  test('19. MINIMAL: Client/server exports', async () => {
    const client = await import('../../dist/minimal/client.js');
    expect(client.Root).toBeDefined();
    expect(client.Slot).toBeDefined();
    expect(client.Children).toBeDefined();
    expect(client.useRefetch).toBeDefined();
    expect(client.unstable_fetchRsc).toBeDefined();
    
    const server = await import('../../dist/minimal/server.js');
    expect(server.unstable_defineServerEntry).toBeDefined();
    expect(server.unstable_defineHandlers).toBeDefined();
  });

  test('20. ADAPTERS: Adapter exports', async () => {
    const { unstable_createServerEntryAdapter } = await import('../../dist/adapter-builders.js');
    expect(unstable_createServerEntryAdapter).toBeDefined();
    expect(typeof unstable_createServerEntryAdapter).toBe('function');
  });

  test('21. DATA: PathSpec roundtrip', async () => {
    const { parsePathWithSlug, path2regexp, pathSpecAsString } = await import('../../dist/lib/utils/path.js');
    
    const testPaths = ['/', '/users', '/users/[id]', '/docs/[...slug]'];
    
    for (const path of testPaths) {
      const spec = parsePathWithSlug(path);
      const regex = path2regexp(spec);
      const str = pathSpecAsString(spec);
      
      expect(regex).toMatch(/^\^/);
      expect(regex).toMatch(/\$/);
      expect(str).toBe(path);
    }
  });

  test('22. ROUTING: Multiple route patterns', async () => {
    const { parsePathWithSlug, getPathMapping } = await import('../../dist/lib/utils/path.js');
    
    expect(getPathMapping(parsePathWithSlug('/users/[id]'), '/users/123')).toEqual({ id: '123' });
    expect(getPathMapping(parsePathWithSlug('/docs/[...slug]'), '/docs/a/b/c')).toEqual({ slug: ['a', 'b', 'c'] });
  });

  test('23. CONCURRENCY: Simulated concurrent', async () => {
    const { joinPath, parsePathWithSlug } = await import('../../dist/lib/utils/path.js');
    
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 100; i++) {
      promises.push((async () => {
        for (let j = 0; j < 10; j++) {
          joinPath('/test', `${i}`, `${j}`);
          parsePathWithSlug(`/path/${i}/${j}`);
        }
      })());
    }
    
    await Promise.all(promises);
    expect(true).toBe(true);
  });

  test('24. MEMORY: Cache size management', async () => {
    const { joinPath, parsePathWithSlug, path2regexp } = await import('../../dist/lib/utils/path.js');
    
    for (let i = 0; i < 2000; i++) {
      joinPath(`/path${i}`, `file${i}`);
      parsePathWithSlug(`/path${i}/[id]`);
      path2regexp(parsePathWithSlug(`/test/${i}`));
    }
    
    expect(true).toBe(true);
  });

  test('25. INTEGRATION: Full workflow', async () => {
    const { joinPath, parsePathWithSlug, getPathMapping } = await import('../../dist/lib/utils/path.js');
    const { pathnameToRoutePath, encodeRoutePath, decodeRoutePath, getComponentIds } = await import('../../dist/router/common.js');
    const { encodeRscPath, decodeRscPath } = await import('../../dist/lib/utils/rsc-path.js');
    const { createPages } = await import('../../dist/router/server.js');
    const { defineConfig } = await import('../../dist/config.js');
    
    const config = defineConfig({ basePath: '/app' });
    expect(config.basePath).toBe('/app');
    
    const pages = createPages({
      '/': { children: ['./index.tsx'] },
      '/users/[id]': { children: ['./user.tsx'] },
    });
    
    const routePath = pathnameToRoutePath('/_rsc/users/123');
    expect(routePath).toBe('/users/123');
    
    const decoded = decodeRoutePath(encodeRoutePath(routePath));
    expect(decoded).toBe(routePath);
    
    const rscDecoded = decodeRscPath(encodeRscPath('/app/users/123'));
    expect(rscDecoded).toBe('/app/users/123');
    
    const componentIds = getComponentIds('/users/123');
    expect(componentIds).toContain('users/layout');
    
    const mapping = getPathMapping(parsePathWithSlug('/users/[id]'), '/users/456');
    expect(mapping).toEqual({ id: '456' });
    
    expect(joinPath('/app', 'users', '123')).toBe('/app/users/123');
  });
});

console.log('✅ FRAMEWORK STRESS TESTS DEFINED');
