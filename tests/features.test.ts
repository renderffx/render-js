import { describe, it, expect } from 'vitest';

describe('@render.js/core - fsRouter', async () => {
  const { createPages } = await import('./dist/router/server.js');

  describe('createPages', () => {
    it('creates pages from config', () => {
      const pages = createPages({
        '/': { children: ['./src/pages/index.tsx'] },
        '/about': { children: ['./src/pages/about.tsx'] },
      });
      expect(Object.keys(pages)).toContain('/');
      expect(Object.keys(pages)).toContain('/about');
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
        '/users/[id]?': { children: ['./src/pages/users/[id].tsx'] },
      });
      expect(pages['/users/[id]?']).toBeDefined();
    });
  });
});

describe('@render.js/core - Server Entry', async () => {
  const server = await import('./dist/minimal/server.js');

  describe('Server entry', () => {
    it('exports unstable_defineServerEntry', () => {
      expect(server.unstable_defineServerEntry).toBeDefined();
      expect(typeof server.unstable_defineServerEntry).toBe('function');
    });
  });
});

describe('@render.js/core - Vercel Adapter', async () => {
  const vercelAdapter = await import('./dist/adapters/vercel.js');

  describe('Vercel adapter', () => {
    it('has exports', () => {
      expect(vercelAdapter).toBeDefined();
    });
  });
});

describe('@render.js/core - Router Server', async () => {
  const {
    unstable_defineRouter,
    unstable_getRscPath,
    unstable_getRscParams,
    unstable_notFound,
    unstable_redirect,
  } = await import('./dist/router/server.js');

  describe('unstable_notFound', () => {
    it('throws not found error', () => {
      expect(() => unstable_notFound()).toThrow();
    });
  });

  describe('unstable_redirect', () => {
    it('throws redirect error', () => {
      expect(() => unstable_redirect('/new-location')).toThrow();
    });
  });
});

describe('@render.js/core - Render Utils', async () => {
  const render = await import('./dist/lib/utils/render.js');

  describe('Render utils', () => {
    it('has exports', () => {
      expect(render).toBeDefined();
    });
  });
});

describe('@render.js/core - Client Exports', async () => {
  const client = await import('./dist/minimal/client.js');

  describe('Client components', () => {
    it('exports Root component', () => {
      expect(client.Root).toBeDefined();
    });

    it('exports Slot component', () => {
      expect(client.Slot).toBeDefined();
    });

    it('exports Children component', () => {
      expect(client.Children).toBeDefined();
    });

    it('exports useRefetch hook', () => {
      expect(client.useRefetch).toBeDefined();
      expect(typeof client.useRefetch).toBe('function');
    });
  });
});

describe('@render.js/core - Vite Plugins', async () => {
  const {
    unstable_mainPlugin,
    unstable_userEntriesPlugin,
    unstable_allowServerPlugin,
    unstable_combinedPlugins,
  } = await import('./dist/lib/vite-plugins/index.js');

  describe('Vite plugins', () => {
    it('exports mainPlugin', () => {
      expect(unstable_mainPlugin).toBeDefined();
      expect(typeof unstable_mainPlugin).toBe('function');
    });

    it('exports userEntriesPlugin', () => {
      expect(unstable_userEntriesPlugin).toBeDefined();
      expect(typeof unstable_userEntriesPlugin).toBe('function');
    });

    it('exports allowServerPlugin', () => {
      expect(unstable_allowServerPlugin).toBeDefined();
      expect(typeof unstable_allowServerPlugin).toBe('function');
    });

    it('exports combinedPlugins', () => {
      expect(unstable_combinedPlugins).toBeDefined();
      expect(typeof unstable_combinedPlugins).toBe('function');
    });
  });
});

describe('@render.js/core - Config', async () => {
  const { defineConfig } = await import('./dist/config.js');

  describe('defineConfig', () => {
    it('returns config object', () => {
      const config = defineConfig({
        basePath: '/',
        srcDir: 'src',
        distDir: 'dist',
      });
      expect(config.basePath).toBe('/');
      expect(config.srcDir).toBe('src');
      expect(config.distDir).toBe('dist');
    });
  });
});
