import type { ReactNode, FunctionComponent } from 'react';
import { createElement } from 'react';
import { encodeRoutePath } from '../../router/common.js';
import { arrayToBase64 } from '../../lib/rsc/flight-protocol.js';
import { discoverPages, type DiscoveredPage } from '../../lib/utils/page-discovery.js';

interface PageModule {
  default?: FunctionComponent<{ children?: ReactNode }>;
  getConfig?: () => Promise<{ render?: 'static' | 'dynamic' }>;
  [key: string]: unknown;
}

interface BuildContext {
  renderRsc: (elements: Record<string, unknown>, options?: object) => Promise<ReadableStream>;
  parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
  renderHtml: (rscStream: ReadableStream, html: unknown, options?: object) => Promise<Response>;
  rscPath2pathname: (rscPath: string) => string;
  saveBuildMetadata: (key: string, value: string) => Promise<void>;
  loadBuildMetadata: (key: string) => Promise<string | undefined>;
  withRequest: (req: Request, fn: () => Promise<void>) => Promise<void>;
  generateFile: (pathname: string, body: string | ReadableStream) => Promise<void>;
  generateDefaultHtml: (pathname: string) => Promise<void>;
}

const buildMetadataStore = new Map<string, string>();

export async function INTERNAL_runBuild(input: BuildContext): Promise<void> {
  console.log('Build process initiated');
  
  try {
    const pagesDir = process.env.RENDER_PAGES_DIR || 'src/pages';
    const pages = discoverPages({
      pagesDir,
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
    
    const staticElements: Record<string, string> = {};
    const routes: string[] = [];
    const prerenderRoutes: string[] = [];
    
    for (const page of pages) {
      if (page.isApi || page.isSlice) continue;
      
      const routePath = page.routePath;
      const rscPath = encodeRoutePath(routePath);
      routes.push(rscPath);
      
      try {
        const mod = await import(/* @vite-ignore */ page.filePath) as PageModule;
        const pageConfig = await mod.getConfig?.();
        const isStatic = pageConfig?.render !== 'dynamic';
        
        if (isStatic && mod.default) {
          const element = createElement(mod.default);
          const rscStream = await input.renderRsc({ ['route:' + routePath]: element });
          const parsed = await input.parseRsc(rscStream);
          const base64 = arrayToBase64(new TextEncoder().encode(JSON.stringify(parsed)));
          staticElements['route:' + routePath] = base64;
          prerenderRoutes.push(routePath);
        }
      } catch (e) {
        console.warn(`Failed to build page ${routePath}:`, e);
      }
    }
    
    if (Object.keys(staticElements).length > 0) {
      const staticElementsJson = JSON.stringify(staticElements);
      buildMetadataStore.set('defineRouter:cachedElements', staticElementsJson);
      await input.saveBuildMetadata('defineRouter:cachedElements', staticElementsJson);
    }
    
    const routesJson = JSON.stringify(routes);
    buildMetadataStore.set('defineRouter:routes', routesJson);
    await input.saveBuildMetadata('defineRouter:routes', routesJson);
    
    const prerenderConfig = {
      version: 1,
      routes: prerenderRoutes,
      generated: new Date().toISOString(),
    };
    const prerenderJson = JSON.stringify(prerenderConfig);
    buildMetadataStore.set('prerender:config', prerenderJson);
    await input.saveBuildMetadata('prerender:config', prerenderJson);
    
    for (const route of prerenderRoutes) {
      try {
        await input.generateDefaultHtml(route);
      } catch (e) {
        console.warn(`Failed to generate HTML for ${route}:`, e);
      }
    }
    
    console.log(`Build complete: ${routes.length} routes discovered, ${prerenderRoutes.length} prerendered`);
  } catch (e) {
    console.error('Build failed:', e);
    throw e;
  }
}

export function getBuildMetadata(key: string): string | undefined {
  return buildMetadataStore.get(key);
}
