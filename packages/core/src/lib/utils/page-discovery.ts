import { readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parsePathWithSlug, extname } from './path.js';
import type { PathSpec, PathSpecItem } from './path.js';

export interface DiscoveredPage {
  filePath: string;
  routePath: string;
  pathSpec: PathSpec;
  isDynamic: boolean;
  isApi: boolean;
  isLayout: boolean;
  isRoot: boolean;
  isSlice: boolean;
  method?: string;
}

export interface PageDiscoveryOptions {
  pagesDir: string;
  apiDir?: string;
  slicesDir?: string;
  ignorePatterns?: string[];
  basePath?: string;
}

function isIgnored(patterns: string[], filePath: string): boolean {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    if (regex.test(filePath)) {
      return true;
    }
  }
  return false;
}

function pathToRouteSpec(filePath: string): PathSpec {
  const parts = filePath.split('/').filter(Boolean);
  const spec: PathSpecItem[] = [];

  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const name = part.slice(1, -1);
      if (name.startsWith('$')) {
        spec.push({ type: 'group', name: name.slice(1) });
      } else if (name === '*') {
        spec.push({ type: 'wildcard', name: 'wildcard' });
      } else if (name === '...') {
        spec.push({ type: 'wildcard', name: 'wildcard' });
      } else {
        spec.push({ type: 'group', name });
      }
    } else if (part.startsWith('$')) {
      spec.push({ type: 'group', name: part.slice(1) });
    } else {
      spec.push({ type: 'literal', name: part });
    }
  }

  return spec as PathSpec;
}

export function discoverPages(options: PageDiscoveryOptions): DiscoveredPage[] {
  const {
    pagesDir,
    apiDir = 'api',
    slicesDir = 'slices',
    ignorePatterns = [],
    basePath = '/',
  } = options;

  const pages: DiscoveredPage[] = [];

  if (!existsSync(pagesDir)) {
    return pages;
  }

  function scanDir(dir: string, baseRoute: string = '') {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);

      if (isIgnored(ignorePatterns, fullPath)) {
        continue;
      }

      if (stat.isDirectory()) {
        scanDir(fullPath, baseRoute + '/' + entry);
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (!['.ts', '.tsx', '.js', '.jsx', '.mjs'].includes(ext)) {
          continue;
        }

        const relativePath = path.relative(pagesDir, fullPath);
        const withoutExt = relativePath.replace(ext, '');
        const pathItems = withoutExt.split('/');

        const isApi = pathItems[0] === apiDir;
        const isSlices = pathItems[0] === slicesDir;
        const isLayout = pathItems[pathItems.length - 1] === '_layout';
        const isRoot = pathItems[pathItems.length - 1] === '_root';

        let routePath: string;
        let routeSpec: PathSpec;

        if (isApi) {
          routePath = '/' + pathItems.slice(1).join('/').replace(/\/index$/, '') || '/';
          routeSpec = pathToRouteSpec(pathItems.slice(1).join('/'));
        } else if (isSlices) {
          routePath = '/' + pathItems.slice(1).join('/');
          routeSpec = pathToRouteSpec(pathItems.slice(1).join('/'));
        } else {
          const lastItem = pathItems[pathItems.length - 1]!;
          if (['_layout', 'index', '_root'].includes(lastItem)) {
            routePath = '/' + pathItems.slice(0, -1).join('/').replace(/\/index$/, '') || '/';
          } else {
            routePath = '/' + pathItems.join('/').replace(/\/index$/, '');
          }
          routeSpec = pathToRouteSpec(pathItems.join('/'));
        }

        const isDynamic = routeSpec.some(
          (item): item is PathSpecItem & { type: 'group' | 'wildcard' } =>
            item.type === 'group' || item.type === 'wildcard',
        );

        const method = entry.match(/\.(GET|POST|PUT|DELETE|PATCH)\.(ts|tsx|js|jsx)$/)?.[1];

        pages.push({
          filePath: fullPath,
          routePath,
          pathSpec: routeSpec,
          isDynamic,
          isApi,
          isLayout,
          isRoot,
          isSlice: isSlices,
          method,
        });
      }
    }
  }

  scanDir(pagesDir);

  return pages;
}

export function normalizeRoutePath(routePath: string, basePath: string = '/'): string {
  if (basePath !== '/' && routePath.startsWith(basePath)) {
    routePath = routePath.slice(basePath.length);
  }
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath;
  }
  if (routePath.length > 1 && routePath.endsWith('/')) {
    routePath = routePath.slice(0, -1);
  }
  return routePath || '/';
}

export { parsePathWithSlug };
