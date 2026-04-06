import type { Plugin } from 'vite';
import path from 'node:path';
import { SRC_CLIENT_ENTRY, SRC_SERVER_ENTRY, SRC_PAGES } from '../constants.js';
import type { Config } from '../../config.js';

export interface UserEntriesOptions {
  srcDir: string;
  config?: Required<Config>;
}

export function userEntriesPlugin(options: UserEntriesOptions): Plugin {
  const { srcDir, config } = options;
  const pagesDir = config ? `${srcDir}/${config.routes.pagesDir || SRC_PAGES}` : `${srcDir}/${SRC_PAGES}`;

  return {
    name: 'render:vite-plugins:user-entries',
    async resolveId(source, _importer, options) {
      if (source === 'virtual:@renderjs/server-entry') {
        return '\0' + source;
      }
      if (source === 'virtual:@renderjs/server-entry-inner') {
        const resolved = await this.resolve(
          `/${srcDir}/${SRC_SERVER_ENTRY}`,
          undefined,
          options,
        );
        return resolved ? resolved : '\0' + source;
      }
      if (source === 'virtual:@renderjs/client-entry') {
        const resolved = await this.resolve(
          `/${srcDir}/${SRC_CLIENT_ENTRY}`,
          undefined,
          options,
        );
        return resolved ? resolved : '\0' + source;
      }
      if (source === 'virtual:@renderjs/page-discovery') {
        return '\0' + source;
      }
    },
    load(id) {
      if (id === '\0virtual:@renderjs/server-entry') {
        return `\
export { default } from 'virtual:@renderjs/server-entry-inner';
if (import.meta.hot) {
  import.meta.hot.accept()
}
`;
      }
      if (id === '\0virtual:@renderjs/server-entry-inner') {
        return getManagedServerEntry(srcDir, pagesDir);
      }
      if (id === '\0virtual:@renderjs/client-entry') {
        return getManagedClientEntry();
      }
      if (id === '\0virtual:@renderjs/page-discovery') {
        return getPageDiscoveryCode(srcDir, pagesDir);
      }
    },
    transform(code, id) {
      if (id.includes('/' + SRC_SERVER_ENTRY)) {
        return injectPageDiscovery(code, srcDir, pagesDir);
      }
      return code;
    },
  };
}

function getManagedServerEntry(srcDir: string, pagesDir: string): string {
  return `
import { unstable_defineServerEntry } from '@render.js/core';
import { discoverPages } from '@render.js/core/lib/utils/page-discovery.js';
import { parsePathWithSlug } from '@render.js/core/lib/utils/path.js';
import { createElement } from 'react';

const discoveredPages = [];

async function loadPages() {
  if (discoveredPages.length > 0) return discoveredPages;
  
  try {
    const pages = discoverPages({
      pagesDir: '${pagesDir}',
      apiDir: 'api',
      slicesDir: 'slices',
      ignorePatterns: [
        '**/node_modules/**',
        '**/.*',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
    });
    
    discoveredPages.push(...pages);
    return pages;
  } catch (e) {
    console.warn('Failed to load pages:', e);
    return [];
  }
}

async function getRouteConfigs() {
  const pages = await loadPages();
  const configs = [];
  
  for (const page of pages) {
    if (page.isSlice) {
      const sliceId = page.routePath.slice(1);
      configs.push({
        type: 'slice',
        id: sliceId,
        isStatic: true,
        renderer: async () => {
          const mod = await import(/* @vite-ignore */ page.filePath);
          return createElement(mod.default || (() => null));
        },
      });
      continue;
    }
    
    if (page.isApi) {
      const apiModule = await import(/* @vite-ignore */ page.filePath);
      configs.push({
        type: 'api',
        path: page.pathSpec,
        isStatic: false,
        handler: typeof apiModule.default === 'function' ? apiModule.default : async () => new Response('Not Implemented', { status: 501 }),
      });
      continue;
    }
    
    const pageModule = await import(/* @vite-ignore */ page.filePath);
    const pageConfig = await pageModule.getConfig?.();
    const isStatic = pageConfig?.render !== 'dynamic';
    
    configs.push({
      type: 'route',
      path: page.pathSpec,
      isStatic,
      rootElement: {
        isStatic: true,
        renderer: () => null,
      },
      routeElement: {
        isStatic,
        renderer: (opts) => {
          const params = {};
          if (opts.query) {
            for (const [key, value] of opts.query.entries()) {
              params[key] = value;
            }
          }
          const routeParts = opts.routePath.split('/').filter(Boolean);
          const slugMatch = opts.routePath.match(/\\[([^\\]]+)\\]/);
          if (slugMatch) {
            params.slug = slugMatch[1];
          }
          return createElement(pageModule.default || (() => null), params);
        },
      },
      elements: {},
    });
  }
  
  return configs;
}

const serverEntry = unstable_defineServerEntry({
  basePath: '/',
  srcDir: '${srcDir}',
  getRoutes: getRouteConfigs,
  future: {},
});

export default serverEntry;
export const config = serverEntry.config;
export const fetch = serverEntry.fetch;
`;
}

function getPageDiscoveryCode(srcDir: string, pagesDir: string): string {
  return `
import { discoverPages } from '@render.js/core/lib/utils/page-discovery.js';

export async function getDiscoveredPages() {
  return discoverPages({
    pagesDir: '${pagesDir}',
    apiDir: 'api',
    slicesDir: 'slices',
  });
}

export default getDiscoveredPages;
`;
}

function injectPageDiscovery(code: string, srcDir: string, pagesDir: string): string {
  if (code.includes('unstable_defineServerEntry')) {
    return code;
  }
  return code;
}

function getManagedClientEntry(): string {
  return `
import { Root, Slot, Children, useRefetch } from '@render.js/core';

export { Root, Slot, Children, useRefetch };
`;
}
