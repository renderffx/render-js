// ============================================================================
// FS Router - File-system based routing
// ============================================================================

import type { FunctionComponent, ReactNode } from 'react';
import { isIgnoredPath } from '../lib/utils/fs-router.js';
import { createPages } from './create-pages.js';
import type { Method } from './create-pages.js';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type PageConfig = { render?: 'static' | 'dynamic' };

type PageModule = {
  default: FunctionComponent<{ children: ReactNode }>;
  getConfig?: () => Promise<PageConfig>;
  GET?: (req: Request) => Promise<Response>;
};

type PageOptions = {
  apiDir: string;
  slicesDir: string;
};

// --------------------------------------------------------------------------
// Defaults
// --------------------------------------------------------------------------

const DEFAULT_OPTIONS: PageOptions = {
  apiDir: '_api',
  slicesDir: '_slices',
};

const HTTP_METHODS: readonly string[] = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'PATCH',
];

// --------------------------------------------------------------------------
// Main Router Function
// --------------------------------------------------------------------------

export function fsRouter(
  pages: { [file: string]: () => Promise<unknown> },
  options: PageOptions = DEFAULT_OPTIONS,
) {
  return createPages(
    async ({
      createPage,
      createLayout,
      createRoot,
      createApi,
      createSlice,
    }) => {
      for (const file of Object.keys(pages)) {
        const mod = (await pages[file]()) as unknown as PageModule;
        const config = await mod.getConfig?.();
        
        const normalizedPath = new URL(file, 'http://localhost:3000').pathname.slice(1);
        const pathItems = normalizedPath.replace(/\.\w+$/, '').split('/').filter(Boolean);
        
        // Skip ignored paths
        if (isIgnoredPath(pathItems)) {
          continue;
        }
        
        // Validate [path] is not used as filename
        if (pathItems[pathItems.length - 1] === '[path]') {
          throw new Error(
            `File "${file}" cannot be named [path]. ` +
            `This conflicts with the built-in "path" prop. ` +
            `Rename your file to something else.`,
          );
        }
        
        const routePath = buildRoutePath(pathItems);
        
        // API routes
        if (pathItems[0] === options.apiDir) {
          createApiRoute(routePath, pathItems, mod, config, createApi);
          continue;
        }
        
        // Slice components
        if (pathItems[0] === options.slicesDir) {
          const sliceId = pathItems.slice(1).join('/');
          createSlice({
            component: mod.default,
            render: 'static',
            id: sliceId,
            ...config,
          });
          continue;
        }
        
        // Layout files
        if (pathItems[pathItems.length - 1] === '_layout') {
          createLayout({
            path: routePath,
            component: mod.default,
            render: 'static',
            ...config,
          });
          continue;
        }
        
        // Root layout
        if (pathItems[pathItems.length - 1] === '_root') {
          createRoot({
            component: mod.default,
            render: 'static',
            ...config,
          });
          continue;
        }
        
        // Regular page
        createPage({
          path: routePath,
          component: mod.default,
          render: 'static',
          ...config,
        } as never);
      }
      
      return null as never;
    },
  );
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function buildRoutePath(pathItems: string[]): string {
  const lastItem = pathItems[pathItems.length - 1]!;
  const isSpecialName =
    ['_layout', 'index', '_root'].includes(lastItem) ||
    lastItem.startsWith('_part');
  
  if (isSpecialName) {
    return pathItems.slice(0, -1).join('/');
  }
  
  return pathItems.join('/');
}

// --------------------------------------------------------------------------
// API Route Creation
// --------------------------------------------------------------------------

type StaticApiConfig = {
  path: string;
  render: 'static';
  method: 'GET';
  handler: (req: Request) => Promise<Response>;
};

type DynamicApiConfig = {
  path: string;
  render: 'dynamic';
  handlers: Record<string, (req: Request) => Promise<Response>>;
};

type ApiCreator = (config: StaticApiConfig | DynamicApiConfig) => void;

function createApiRoute(
  path: string,
  pathItems: string[],
  mod: PageModule,
  config: PageConfig | undefined,
  createApi: ApiCreator,
): void {
  const apiPath = '/' + pathItems.slice(1).join('/');
  
  // Static API (single GET handler)
  if (config?.render === 'static') {
    if (Object.keys(mod).length !== 2 || !mod.GET) {
      console.warn(
        `API ${path} is invalid. ` +
        `Static API routes need only a single GET handler. ` +
        `Found: ${Object.keys(mod).join(', ')}`,
      );
    }
    
    createApi({
      path: apiPath,
      render: 'static',
      method: 'GET',
      handler: mod.GET!,
    });
    return;
  }
  
  // Dynamic API (multiple HTTP methods)
  const validMethods = new Set<string>(HTTP_METHODS);
  const handlers: Record<string, (req: Request) => Promise<Response>> = {};
  
  for (const [exportName, handler] of Object.entries(mod)) {
    if (exportName === 'getConfig' || exportName === 'default') {
      continue;
    }
    
    if (!validMethods.has(exportName)) {
      console.warn(
        `API ${path} has invalid export: "${exportName}". ` +
        `Valid HTTP methods: ${HTTP_METHODS.join(', ')}`,
      );
      continue;
    }
    
    handlers[exportName] = handler as (req: Request) => Promise<Response>;
  }
  
  createApi({
    path: apiPath,
    render: 'dynamic',
    handlers,
  });
}
