import { test, expect, type Page } from '@playwright/test';

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

test.describe('@render.js/core - E2E Tests', () => {
  test.describe('Core Functionality', () => {
    test('should export all required functions', async () => {
      const core = await import('../dist/index.js');
      
      expect(core.defineConfig).toBeDefined();
      expect(typeof core.defineConfig).toBe('function');
      
      expect(core.unstable_defineRouter).toBeDefined();
      expect(core.createPages).toBeDefined();
      expect(core.fsRouter).toBeDefined();
      
      expect(core.unstable_notFound).toBeDefined();
      expect(core.unstable_redirect).toBeDefined();
      
      expect(core.Link).toBeDefined();
      expect(core.useRouter).toBeDefined();
      expect(core.usePathname).toBeDefined();
      expect(core.useSearchParams).toBeDefined();
    });

    test('should export all utilities', async () => {
      const core = await import('../dist/index.js');
      
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

    test('should export vite plugins', async () => {
      const core = await import('../dist/index.js');
      
      expect(core.unstable_mainPlugin).toBeDefined();
      expect(core.unstable_userEntriesPlugin).toBeDefined();
      expect(core.unstable_allowServerPlugin).toBeDefined();
      expect(core.unstable_combinedPlugins).toBeDefined();
    });
  });

  test.describe('Path Utilities', () => {
    test('joinPath should work correctly', async () => {
      const { joinPath } = await import('../dist/lib/utils/path.js');
      
      expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
      expect(joinPath('/foo/', '/bar')).toBe('/foo/bar');
      expect(joinPath('/foo', 'bar', 'baz')).toBe('/foo/bar/baz');
    });

    test('parsePathWithSlug should parse routes correctly', async () => {
      const { parsePathWithSlug } = await import('../dist/lib/utils/path.js');
      
      const staticPath = parsePathWithSlug('/users');
      expect(staticPath).toEqual([{ type: 'literal', name: 'users' }]);
      
      const slugPath = parsePathWithSlug('/users/[id]');
      expect(slugPath).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ]);
      
      const wildcardPath = parsePathWithSlug('/docs/[...slug]');
      expect(wildcardPath).toEqual([
        { type: 'literal', name: 'docs' },
        { type: 'wildcard', name: 'slug' },
      ]);
    });

    test('removeBase and addBase should work correctly', async () => {
      const { removeBase, addBase } = await import('../dist/lib/utils/path.js');
      
      expect(removeBase('/app/users', '/app')).toBe('/users');
      expect(addBase('/users', '/app')).toBe('/app/users');
    });
  });

  test.describe('Router', () => {
    test('createPages should create pages object', async () => {
      const { createPages } = await import('../dist/router/server.js');
      
      const pages = createPages({
        '/': { children: ['./src/pages/index.tsx'] },
        '/about': { children: ['./src/pages/about.tsx'] },
        '/users/[id]': { children: ['./src/pages/users/[id].tsx'] },
      });
      
      expect(pages['/']).toBeDefined();
      expect(pages['/about']).toBeDefined();
      expect(pages['/users/[id]']).toBeDefined();
    });

    test('unstable_notFound should throw', async () => {
      const { unstable_notFound } = await import('../dist/router/server.js');
      
      expect(() => unstable_notFound()).toThrow();
    });

    test('unstable_redirect should throw with location', async () => {
      const { unstable_redirect } = await import('../dist/router/server.js');
      
      expect(() => unstable_redirect('/new-location')).toThrow();
      expect(() => unstable_redirect('/new-location', 307)).toThrow();
    });
  });

  test.describe('Context', () => {
    test('runWithContext should provide context', async () => {
      const { unstable_runWithContext, unstable_getContext } = await import('../dist/lib/context.js');
      
      const result = await unstable_runWithContext(
        { userId: '123', token: 'abc' },
        () => unstable_getContext()
      );
      
      expect(result.req).toEqual({ userId: '123', token: 'abc' });
    });

    test('getContext should throw outside context', async () => {
      const { unstable_getContext } = await import('../dist/lib/context.js');
      
      expect(() => unstable_getContext()).toThrow();
    });
  });

  test.describe('Error Handling', () => {
    test('createCustomError should create error with info', async () => {
      const { createCustomError } = await import('../dist/lib/utils/custom-errors.js');
      
      const error = createCustomError('Not Found', { status: 404 });
      expect(error.message).toBe('Not Found');
      expect((error as any).status).toBe(404);
      
      const redirectError = createCustomError('Redirect', { location: '/home', status: 307 });
      expect((redirectError as any).location).toBe('/home');
      expect((redirectError as any).status).toBe(307);
    });

    test('getErrorInfo should extract error info', async () => {
      const { createCustomError, getErrorInfo } = await import('../dist/lib/utils/custom-errors.js');
      
      const error = createCustomError('Test Error', { status: 500 });
      const info = getErrorInfo(error);
      
      expect(info).not.toBeNull();
      expect(info?.message).toBe('Test Error');
      expect(info?.status).toBe(500);
    });

    test('getErrorInfo should return null for non-custom errors', async () => {
      const { getErrorInfo } = await import('../dist/lib/utils/custom-errors.js');
      
      expect(getErrorInfo('string')).toBeNull();
      expect(getErrorInfo(null)).toBeNull();
      expect(getErrorInfo(undefined)).toBeNull();
      expect(getErrorInfo({})).toBeNull();
    });
  });

  test.describe('Stream Utilities', () => {
    test('stringToStream should convert string to stream', async () => {
      const { stringToStream } = await import('../dist/lib/utils/stream.js');
      
      const stream = stringToStream('Hello World');
      const reader = stream.getReader();
      const { value, done } = await reader.read();
      
      const decoder = new TextDecoder();
      expect(decoder.decode(value)).toBe('Hello World');
      expect(done).toBe(false);
    });

    test('streamToBase64 and base64ToStream should roundtrip', async () => {
      const { stringToStream, streamToBase64, base64ToStream } = await import('../dist/lib/utils/stream.js');
      
      const original = 'Test content 123!@#';
      const stream = stringToStream(original);
      const base64 = await streamToBase64(stream);
      
      const decodedStream = base64ToStream(base64);
      const reader = decodedStream.getReader();
      const { value } = await reader.read();
      
      const decoder = new TextDecoder();
      expect(decoder.decode(value)).toBe(original);
    });
  });

  test.describe('Config', () => {
    test('defineConfig should return config object', async () => {
      const { defineConfig } = await import('../dist/config.js');
      
      const config = defineConfig({
        basePath: '/app',
        srcDir: 'src',
        distDir: 'build',
        rscBase: '_rsc',
      });
      
      expect(config.basePath).toBe('/app');
      expect(config.srcDir).toBe('src');
      expect(config.distDir).toBe('build');
      expect(config.rscBase).toBe('_rsc');
    });

    test('defineConfig should have defaults', async () => {
      const { defineConfig } = await import('../dist/config.js');
      
      const config = defineConfig({});
      
      expect(config.basePath).toBe('/');
      expect(config.srcDir).toBe('src');
      expect(config.distDir).toBe('dist');
      expect(config.rscBase).toBe('_rsc');
    });
  });
});

console.log('✅ E2E TESTS DEFINED');
