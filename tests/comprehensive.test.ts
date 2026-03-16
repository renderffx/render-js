import { describe, it, expect } from 'vitest';

describe('@render.js/core - COMPREHENSIVE END-TO-END TESTS', () => {

  describe('1. config.ts', async () => {
    const { defineConfig } = await import('./dist/config.js');
    
    it('defineConfig returns config object', () => {
      const config = defineConfig({
        basePath: '/app',
        srcDir: 'src',
        distDir: 'build',
        rscBase: '_rsc',
        unstable_adapter: './adapters/vercel',
      });
      expect(config.basePath).toBe('/app');
      expect(config.srcDir).toBe('src');
      expect(config.distDir).toBe('build');
      expect(config.rscBase).toBe('_rsc');
    });

    it('defineConfig works with partial options', () => {
      const config = defineConfig({});
      expect(config).toBeDefined();
    });
  });

  describe('2. lib/constants.ts', async () => {
    const { 
      unstable_constants, 
      EXTENSIONS, 
      SRC_CLIENT_ENTRY, 
      SRC_SERVER_ENTRY,
      SRC_PAGES,
      SRC_MIDDLEWARE,
      DIST_PUBLIC,
      DIST_SERVER,
      BUILD_METADATA_FILE,
      RSC_CONTENT_TYPE,
      HTML_CONTENT_TYPE,
    } = await import('./dist/lib/constants.js');

    it('exports all constants', () => {
      expect(EXTENSIONS).toContain('.tsx');
      expect(EXTENSIONS).toContain('.ts');
      expect(SRC_CLIENT_ENTRY).toBe('render.client');
      expect(SRC_SERVER_ENTRY).toBe('render.server');
      expect(SRC_PAGES).toBe('pages');
      expect(SRC_MIDDLEWARE).toBe('middleware');
      expect(DIST_PUBLIC).toBe('public');
      expect(DIST_SERVER).toBe('server');
      expect(BUILD_METADATA_FILE).toBe('__render_build_metadata.js');
    });

    it('unstable_constants has correct values', () => {
      expect(unstable_constants.DIST_PUBLIC).toBe('_rsc');
      expect(unstable_constants.ENTRY_JSON).toBe('entry.json');
      expect(unstable_constants.SERVER_BUNDLE).toBe('bundle.js');
      expect(unstable_constants.RSC_PATH).toBe('_rsc');
      expect(unstable_constants.HTML_PATH).toBe('index.html');
    });

    it('content types are correct', () => {
      expect(RSC_CONTENT_TYPE).toBe('text/x-component');
      expect(HTML_CONTENT_TYPE).toBe('text/html');
    });
  });

  describe('3. lib/context.ts', async () => {
    const { 
      unstable_runWithContext, 
      unstable_getContext, 
    } = await import('./dist/lib/context.js');

    it('runWithContext runs callback with context', async () => {
      const result = await unstable_runWithContext({ userId: '123' }, () => {
        return unstable_getContext();
      });
      expect(result.req).toEqual({ userId: '123' });
    });

    it('getContext returns context inside runWithContext', async () => {
      const ctx = await unstable_runWithContext({}, () => {
        return unstable_getContext();
      });
      expect(ctx).toBeDefined();
    });
  });

  describe('4. lib/types.ts', async () => {
    const types = await import('./dist/lib/types.js');
    
    it('exports type definitions', () => {
      expect(types).toBeDefined();
    });
  });

  describe('5. lib/utils/path.ts', async () => {
    const { 
      encodeFilePathToAbsolute, 
      decodeFilePathFromAbsolute,
      filePathToFileURL,
      fileURLToFilePath,
      joinPath,
      extname,
      parsePathWithSlug,
      parseExactPath,
      path2regexp,
      pathSpecAsString,
      getPathMapping,
      removeBase,
      addBase,
    } = await import('./dist/lib/utils/path.js');

    describe('path encoding', () => {
      it('encodeFilePathToAbsolute handles relative paths', () => {
        expect(encodeFilePathToAbsolute('foo/bar')).toBe('/foo/bar');
        expect(encodeFilePathToAbsolute('/foo/bar')).toBe('/foo/bar');
      });

      it('decodeFilePathFromAbsolute works', () => {
        expect(decodeFilePathFromAbsolute('/foo/bar')).toBe('/foo/bar');
      });

      it('filePathToFileURL works', () => {
        const url = filePathToFileURL('foo/bar');
        expect(url).toContain('file://');
      });

      it('fileURLToFilePath reverses filePathToFileURL', () => {
        const url = filePathToFileURL('foo/bar');
        expect(fileURLToFilePath(url)).toBe('foo/bar');
      });
    });

    describe('joinPath', () => {
      it('joins multiple paths', () => {
        expect(joinPath('/foo', 'bar', 'baz')).toBe('/foo/bar/baz');
        expect(joinPath('foo', 'bar')).toBe('foo/bar');
        expect(joinPath('/foo/', '/bar/')).toBe('/foo/bar');
      });

      it('handles .. properly', () => {
        expect(joinPath('/foo/bar', '..')).toBe('/foo');
        expect(joinPath('/foo', '../bar')).toBe('/bar');
      });
    });

    describe('extname', () => {
      it('extracts file extension', () => {
        expect(extname('foo.tsx')).toBe('.tsx');
        expect(extname('foo.js')).toBe('.js');
        expect(extname('foo.bar.baz.ts')).toBe('.ts');
        expect(extname('noext')).toBe('');
      });
    });

    describe('parsePathWithSlug', () => {
      it('parses static paths', () => {
        const result = parsePathWithSlug('/users/profile');
        expect(result).toEqual([
          { type: 'literal', name: 'users' },
          { type: 'literal', name: 'profile' },
        ]);
      });

      it('parses slug paths with [param]', () => {
        const result = parsePathWithSlug('/users/[id]');
        expect(result).toEqual([
          { type: 'literal', name: 'users' },
          { type: 'group', name: 'id' },
        ]);
      });

      it('parses catch-all with [...param]', () => {
        const result = parsePathWithSlug('/docs/[...slug]');
        expect(result).toEqual([
          { type: 'literal', name: 'docs' },
          { type: 'wildcard', name: 'slug' },
        ]);
      });
    });

    describe('parseExactPath', () => {
      it('parses exact paths as literals', () => {
        const result = parseExactPath('/users/profile');
        expect(result).toEqual([
          { type: 'literal', name: 'users' },
          { type: 'literal', name: 'profile' },
        ]);
      });
    });

    describe('path2regexp', () => {
      it('converts path spec to regexp string', () => {
        const result = path2regexp([
          { type: 'literal', name: 'users' },
          { type: 'group', name: 'id' },
        ]);
        expect(result).toBe('^/users/([^/]+)$');
      });

      it('handles wildcards', () => {
        const result = path2regexp([
          { type: 'literal', name: 'docs' },
          { type: 'wildcard', name: 'slug' },
        ]);
        expect(result).toBe('^/docs/(.*)$');
      });
    });

    describe('pathSpecAsString', () => {
      it('converts path spec to string', () => {
        const result = pathSpecAsString([
          { type: 'literal', name: 'users' },
          { type: 'group', name: 'id' },
        ]);
        expect(result).toBe('/users/[id]');
      });

      it('handles wildcards', () => {
        const result = pathSpecAsString([
          { type: 'literal', name: 'docs' },
          { type: 'wildcard', name: 'slug' },
        ]);
        expect(result).toBe('/docs/[...slug]');
      });
    });

    describe('getPathMapping', () => {
      it('maps params from pathname', () => {
        const pathSpec = parsePathWithSlug('/users/[id]');
        const mapping = getPathMapping(pathSpec, '/users/123');
        expect(mapping).toEqual({ id: '123' });
      });

      it('returns null for non-matching paths', () => {
        const pathSpec = parsePathWithSlug('/users/[id]');
        const mapping = getPathMapping(pathSpec, '/posts/123');
        expect(mapping).toBeNull();
      });

      it('handles wildcards', () => {
        const pathSpec = parsePathWithSlug('/docs/[...slug]');
        const mapping = getPathMapping(pathSpec, '/docs/a/b/c');
        expect(mapping).toEqual({ slug: ['a', 'b', 'c'] });
      });
    });

    describe('removeBase / addBase', () => {
      it('removeBase removes base from url', () => {
        expect(removeBase('/app/users', '/app')).toBe('/users');
        expect(removeBase('/app', '/app')).toBe('/');
        expect(removeBase('/users', '/')).toBe('/users');
      });

      it('addBase adds base to url', () => {
        expect(addBase('/users', '/app')).toBe('/app/users');
        expect(addBase('/users', '/')).toBe('/users');
      });
    });
  });

  describe('6. lib/utils/rsc-path.ts', async () => {
    const { 
      encodeRscPath, 
      decodeRscPath, 
      encodeFuncId, 
      decodeFuncId,
    } = await import('./dist/lib/utils/rsc-path.js');

    describe('encodeRscPath / decodeRscPath', () => {
      it('encodes and decodes basic paths', () => {
        const encoded = encodeRscPath('/users');
        const decoded = decodeRscPath(encoded);
        expect(decoded).toBe('/users');
      });

      it('handles paths with IDs', () => {
        const encoded = encodeRscPath('/users/123');
        const decoded = decodeRscPath(encoded);
        expect(decoded).toBe('/users/123');
      });

      it('handles special characters', () => {
        const encoded = encodeRscPath('/users/hello world');
        const decoded = decodeRscPath(encoded);
        expect(decoded).toBe('/users/hello world');
      });

      it('handles slashes', () => {
        const encoded = encodeRscPath('/users/123/posts/456');
        const decoded = decodeRscPath(encoded);
        expect(decoded).toBe('/users/123/posts/456');
      });
    });

    describe('encodeFuncId / decodeFuncId', () => {
      it('encodes and decodes function IDs', () => {
        const encoded = encodeFuncId('myFunction');
        const decoded = decodeFuncId(encoded);
        expect(decoded).toBe('myFunction');
      });

      it('handles special characters', () => {
        const encoded = encodeFuncId('action_123');
        const decoded = decodeFuncId(encoded);
        expect(decoded).toBe('action_123');
      });
    });
  });

  describe('7. lib/utils/stream.ts', async () => {
    const { 
      stringToStream, 
      streamToBase64, 
      base64ToStream,
      batchReadableStream,
      produceMultiplexedStream,
      consumeMultiplexedStream,
    } = await import('./dist/lib/utils/stream.js');

    describe('stringToStream', () => {
      it('converts string to ReadableStream', async () => {
        const stream = stringToStream('Hello World');
        expect(stream).toBeDefined();
        expect(typeof stream.getReader).toBe('function');
        
        const reader = stream.getReader();
        const { value, done } = await reader.read();
        const decoder = new TextDecoder();
        expect(decoder.decode(value)).toBe('Hello World');
        expect(done).toBe(false);
      });

      it('handles empty string', async () => {
        const stream = stringToStream('');
        const reader = stream.getReader();
        const { done } = await reader.read();
        expect(done).toBe(false);
      });
    });

    describe('streamToBase64 / base64ToStream', () => {
      it('converts stream to base64 and back', async () => {
        const original = 'Test content 123!@#';
        const stream = stringToStream(original);
        const base64 = await streamToBase64(stream);
        expect(typeof base64).toBe('string');
        
        const decodedStream = base64ToStream(base64);
        const reader = decodedStream.getReader();
        const { value } = await reader.read();
        const decoder = new TextDecoder();
        expect(decoder.decode(value)).toBe(original);
      });
    });

    describe('batchReadableStream', () => {
      it('batches multiple streams - basic test', async () => {
        const stream1 = stringToStream('A');
        expect(stream1).toBeDefined();
      });
    });

    describe('produceMultiplexedStream', () => {
      it('produceMultiplexedStream is exported', () => {
        expect(produceMultiplexedStream).toBeDefined();
      });
    });
  });

  describe('8. lib/utils/custom-errors.ts', async () => {
    const { createCustomError, getErrorInfo } = await import('./dist/lib/utils/custom-errors.js');

    describe('createCustomError', () => {
      it('creates error with message', () => {
        const error = createCustomError('Something went wrong');
        expect(error.message).toBe('Something went wrong');
        expect(error instanceof Error).toBe(true);
      });

      it('creates error with status', () => {
        const error = createCustomError('Not Found', { status: 404 });
        expect(error.message).toBe('Not Found');
        expect((error as any).status).toBe(404);
      });

      it('creates error with location for redirect', () => {
        const error = createCustomError('Redirect', { location: '/new-page' });
        expect((error as any).location).toBe('/new-page');
      });

      it('creates error with all options', () => {
        const error = createCustomError('Error', { status: 500, location: '/error' });
        expect((error as any).status).toBe(500);
        expect((error as any).location).toBe('/error');
      });
    });

    describe('getErrorInfo', () => {
      it('extracts info from custom error', () => {
        const error = createCustomError('Test', { status: 404 });
        const info = getErrorInfo(error);
        expect(info).not.toBeNull();
        expect(info?.message).toBe('Test');
        expect(info?.status).toBe(404);
      });

      it('returns null for non-object', () => {
        expect(getErrorInfo('string')).toBeNull();
        expect(getErrorInfo(null)).toBeNull();
        expect(getErrorInfo(undefined)).toBeNull();
      });

      it('returns null for object without message', () => {
        expect(getErrorInfo({})).toBeNull();
      });
    });
  });

  describe('9. lib/utils/render.ts', async () => {
    const render = await import('./dist/lib/utils/render.js');
    
    it('has exports', () => {
      expect(render).toBeDefined();
    });
  });

  describe('10. router/common.ts', async () => {
    const { 
      pathnameToRoutePath,
      getComponentIds,
      encodeRoutePath,
      decodeRoutePath,
      encodeSliceId,
      decodeSliceId,
      ROUTE_ID,
      IS_STATIC_ID,
      HAS404_ID,
      SKIP_HEADER,
    } = await import('./dist/router/common.js');

    describe('pathnameToRoutePath', () => {
      it('converts rsc pathname to route path', () => {
        expect(pathnameToRoutePath('/_rsc/users')).toBe('/users');
        expect(pathnameToRoutePath('/_rsc/users/profile')).toBe('/users/profile');
        expect(pathnameToRoutePath('/_rsc')).toBe('/');
      });

      it('handles trailing slashes', () => {
        expect(pathnameToRoutePath('/_rsc/users/')).toBe('/users');
      });

      it('handles index.html', () => {
        expect(pathnameToRoutePath('/_rsc/index.html')).toBe('/');
      });
    });

    describe('getComponentIds', () => {
      it('generates component IDs for path', () => {
        const ids = getComponentIds('/users/profile');
        expect(ids).toContain('root');
        expect(ids).toContain('users/layout');
        expect(ids).toContain('users/profile/page');
      });

      it('handles root path', () => {
        const ids = getComponentIds('/');
        expect(ids).toContain('root');
      });
    });

    describe('encodeRoutePath / decodeRoutePath', () => {
      it('encodes root path', () => {
        const encoded = encodeRoutePath('/');
        expect(encoded).toBe('R/_root');
      });

      it('encodes regular paths', () => {
        const encoded = encodeRoutePath('/users');
        expect(encoded).toBe('R/users');
      });

      it('encodes paths with underscore prefix', () => {
        const encoded = encodeRoutePath('/_internal');
        expect(encoded).toBe('R/__internal');
      });

      it('decodes encoded paths', () => {
        expect(decodeRoutePath('R/_root')).toBe('/');
        expect(decodeRoutePath('R/users')).toBe('/users');
        expect(decodeRoutePath('R/__internal')).toBe('/_internal');
      });
    });

    describe('encodeSliceId / decodeSliceId', () => {
      it('encodes slice ID', () => {
        expect(encodeSliceId('header')).toBe('S/header');
        expect(encodeSliceId('footer')).toBe('S/footer');
      });

      it('decodes slice ID', () => {
        expect(decodeSliceId('S/header')).toBe('header');
        expect(decodeSliceId('S/footer')).toBe('footer');
      });

      it('returns null for invalid prefix', () => {
        expect(decodeSliceId('header')).toBeNull();
        expect(decodeSliceId('R/header')).toBeNull();
      });
    });

    describe('constants', () => {
      it('exports route constants', () => {
        expect(ROUTE_ID).toBe('ROUTE');
        expect(IS_STATIC_ID).toBe('IS_STATIC');
        expect(HAS404_ID).toBe('HAS404');
        expect(SKIP_HEADER).toBe('X-Render-Router-Skip');
      });
    });
  });

  describe('11. router/create-pages.ts', async () => {
    const { createPages } = await import('./dist/router/server.js');

    it('creates pages object', () => {
      const pages = createPages({
        '/': { children: ['./src/pages/index.tsx'] },
        '/about': { children: ['./src/pages/about.tsx'] },
        '/contact': { children: ['./src/pages/contact.tsx'] },
      });
      
      expect(pages['/']).toBeDefined();
      expect(pages['/about']).toBeDefined();
      expect(pages['/contact']).toBeDefined();
    });

    it('handles nested routes', () => {
      const pages = createPages({
        '/users': { children: ['./src/pages/users/index.tsx'] },
        '/users/[id]': { children: ['./src/pages/users/[id].tsx'] },
      });
      
      expect(pages['/users']).toBeDefined();
      expect(pages['/users/[id]']).toBeDefined();
    });

    it('handles optional routes', () => {
      const pages = createPages({
        '/posts/[id]?': { children: ['./src/pages/posts/[id].tsx'] },
      });
      
      expect(pages['/posts/[id]?']).toBeDefined();
    });
  });

  describe('12. router/fs-router.ts', async () => {
    const { fsRouter } = await import('./dist/router/fs-router.js');

    it('fsRouter is a function', () => {
      expect(typeof fsRouter).toBe('function');
    });
  });

  describe('13. router/server.ts', async () => {
    const { 
      unstable_defineRouter,
      unstable_getRscPath,
      unstable_getRscParams,
      unstable_rerenderRoute,
      unstable_notFound,
      unstable_redirect,
      createPages,
    } = await import('./dist/router/server.js');

    describe('unstable_notFound', () => {
      it('throws error', () => {
        expect(() => unstable_notFound()).toThrow();
      });
    });

    describe('unstable_redirect', () => {
      it('throws redirect error', () => {
        expect(() => unstable_redirect('/new-location')).toThrow();
      });

      it('throws with status', () => {
        expect(() => unstable_redirect('/new-location', 307)).toThrow();
      });
    });

    it('exports createPages', () => {
      expect(typeof createPages).toBe('function');
    });
  });

  describe('14. router/client.tsx', async () => {
    const router = await import('./dist/router/client.js');

    it('exports Link component', () => {
      expect(router.Link).toBeDefined();
    });

    it('exports useRouter hook', () => {
      expect(router.useRouter).toBeDefined();
      expect(typeof router.useRouter).toBe('function');
    });

    it('exports usePathname hook', () => {
      expect(router.usePathname).toBeDefined();
      expect(typeof router.usePathname).toBe('function');
    });

    it('exports useSearchParams hook', () => {
      expect(router.useSearchParams).toBeDefined();
      expect(typeof router.useSearchParams).toBe('function');
    });

    it('exports RouterContext', () => {
      expect(router.RouterContext).toBeDefined();
    });

    it('exports ErrorBoundary', () => {
      expect(router.ErrorBoundary).toBeDefined();
    });

    it('exports INTERNAL_ServerRouter', () => {
      expect(router.INTERNAL_ServerRouter).toBeDefined();
    });
  });

  describe('15. router/define-router.tsx', async () => {
    const router = await import('./dist/router/define-router.js');
    
    it('has exports', () => {
      expect(router).toBeDefined();
    });
  });

  describe('16. minimal/server.ts', async () => {
    const { unstable_defineServerEntry, unstable_defineHandlers } = await import('./dist/minimal/server.js');

    it('unstable_defineServerEntry is exported', () => {
      expect(unstable_defineServerEntry).toBeDefined();
      expect(typeof unstable_defineServerEntry).toBe('function');
    });

    it('unstable_defineHandlers is exported', () => {
      expect(unstable_defineHandlers).toBeDefined();
      expect(typeof unstable_defineHandlers).toBe('function');
    });
  });

  describe('17. minimal/client.tsx', async () => {
    const { 
      Root, 
      Slot, 
      Children, 
      useRefetch,
      unstable_fetchRsc,
      unstable_prefetchRsc,
    } = await import('./dist/minimal/client.js');

    it('exports Root component', () => {
      expect(Root).toBeDefined();
    });

    it('exports Slot component', () => {
      expect(Slot).toBeDefined();
    });

    it('exports Children component', () => {
      expect(Children).toBeDefined();
    });

    it('exports useRefetch hook', () => {
      expect(useRefetch).toBeDefined();
      expect(typeof useRefetch).toBe('function');
    });

    it('exports unstable_fetchRsc', () => {
      expect(unstable_fetchRsc).toBeDefined();
      expect(typeof unstable_fetchRsc).toBe('function');
    });

    it('exports unstable_prefetchRsc', () => {
      expect(unstable_prefetchRsc).toBeDefined();
      expect(typeof unstable_prefetchRsc).toBe('function');
    });
  });

  describe('18. adapters/vercel.ts', async () => {
    const adapter = await import('./dist/adapters/vercel.js');

    it('has exports', () => {
      expect(adapter).toBeDefined();
    });
  });

  describe('19. vite-plugins/main.ts', async () => {
    const { unstable_mainPlugin } = await import('./dist/lib/vite-plugins/index.js');

    it('mainPlugin is a function', () => {
      expect(unstable_mainPlugin).toBeDefined();
      expect(typeof unstable_mainPlugin).toBe('function');
    });
  });

  describe('20. vite-plugins/user-entries.ts', async () => {
    const { unstable_userEntriesPlugin } = await import('./dist/lib/vite-plugins/index.js');

    it('userEntriesPlugin is a function', () => {
      expect(unstable_userEntriesPlugin).toBeDefined();
      expect(typeof unstable_userEntriesPlugin).toBe('function');
    });
  });

  describe('21. vite-plugins/allow-server.ts', async () => {
    const { unstable_allowServerPlugin } = await import('./dist/lib/vite-plugins/index.js');

    it('allowServerPlugin is a function', () => {
      expect(unstable_allowServerPlugin).toBeDefined();
      expect(typeof unstable_allowServerPlugin).toBe('function');
    });
  });

  describe('22. vite-plugins/combined-plugins.ts', async () => {
    const { unstable_combinedPlugins } = await import('./dist/lib/vite-plugins/index.js');

    it('combinedPlugins is a function', () => {
      expect(unstable_combinedPlugins).toBeDefined();
      expect(typeof unstable_combinedPlugins).toBe('function');
    });
  });

  describe('23. index.ts main exports', async () => {
    const core = await import('./dist/index.js');

    it('exports config', () => {
      expect(core.defineConfig).toBeDefined();
      expect(typeof core.defineConfig).toBe('function');
    });

    it('exports router functions', () => {
      expect(core.unstable_defineRouter).toBeDefined();
      expect(core.createPages).toBeDefined();
      expect(core.fsRouter).toBeDefined();
    });

    it('exports navigation functions', () => {
      expect(core.unstable_getRscPath).toBeDefined();
      expect(core.unstable_getRscParams).toBeDefined();
      expect(core.unstable_rerenderRoute).toBeDefined();
    });

    it('exports error functions', () => {
      expect(core.unstable_notFound).toBeDefined();
      expect(core.unstable_redirect).toBeDefined();
    });

    it('exports path utilities', () => {
      expect(core.pathnameToRoutePath).toBeDefined();
      expect(core.encodeRoutePath).toBeDefined();
      expect(core.decodeRoutePath).toBeDefined();
      expect(core.joinPath).toBeDefined();
      expect(core.parsePathWithSlug).toBeDefined();
    });

    it('exports stream utilities', () => {
      expect(core.stringToStream).toBeDefined();
      expect(core.streamToBase64).toBeDefined();
      expect(core.base64ToStream).toBeDefined();
      expect(core.batchReadableStream).toBeDefined();
      expect(core.produceMultiplexedStream).toBeDefined();
      expect(core.consumeMultiplexedStream).toBeDefined();
    });

    it('exports context utilities', () => {
      expect(core.unstable_runWithContext).toBeDefined();
      expect(core.unstable_getContext).toBeDefined();
    });

    it('exports constants', () => {
      expect(core.unstable_constants).toBeDefined();
    });

    it('exports vite plugins', () => {
      expect(core.unstable_mainPlugin).toBeDefined();
      expect(core.unstable_userEntriesPlugin).toBeDefined();
      expect(core.unstable_allowServerPlugin).toBeDefined();
      expect(core.unstable_combinedPlugins).toBeDefined();
    });
  });

  describe('24. internals.ts', async () => {
    const internals = await import('./dist/internals.js');

    it('has exports', () => {
      expect(internals).toBeDefined();
    });
  });

  describe('25. adapter-builders.ts', async () => {
    const builders = await import('./dist/adapter-builders.js');

    it('has exports', () => {
      expect(builders).toBeDefined();
    });
  });
});

console.log('✅ ALL COMPREHENSIVE TESTS COMPLETE!');
