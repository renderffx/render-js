import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync, readdirSync, statSync, readFileSync } from 'node:fs';

export interface RouteFunctionConfig {
  path: string;
  pagePath: string;
  isPrerender?: boolean;
  revalidate?: number;
  runtime: 'edge' | 'nodejs';
  regions?: string[];
  memory?: number;
  maxDuration?: number;
  env?: string[];
}

export interface PrerenderConfig {
  expiration: number | false;
  fallback?: string;
  initialStatus?: number;
  initialHeaders?: Record<string, string>;
  allowQuery?: string[];
  group?: number;
  bypassToken?: string;
}

const VERCEL_FUNCTIONS_DIR = '.vercel/output/functions';
const VERCEL_STATIC_DIR = '.vercel/output/static';

export function generateRouteFunctions(
  routes: RouteFunctionConfig[],
  outputDir: string = VERCEL_FUNCTIONS_DIR
): void {
  const functionsDir = path.join(outputDir, '..', 'functions');
  
  for (const route of routes) {
    const funcDir = path.join(functionsDir, routeToFuncName(route.path));
    mkdirSync(funcDir, { recursive: true });
    
    if (route.runtime === 'edge') {
      writeFileSync(
        path.join(funcDir, 'index.js'),
        generateEdgeRouteHandler(route)
      );
      
      writeFileSync(
        path.join(funcDir, '.vc-config.json'),
        JSON.stringify({
          runtime: 'edge',
          entrypoint: 'index.js',
          regions: route.regions,
        }, null, 2)
      );
      
      if (route.isPrerender) {
        writeFileSync(
          path.join(funcDir, '.prerender-config.json'),
          JSON.stringify({
            expiration: route.revalidate ?? false,
          }, null, 2)
        );
      }
    } else {
      writeFileSync(
        path.join(funcDir, 'index.js'),
        generateNodeRouteHandler(route)
      );
      
      writeFileSync(
        path.join(funcDir, '.vc-config.json'),
        JSON.stringify({
          runtime: 'nodejs22.x',
          handler: 'index.js',
          launcherType: 'Nodejs',
          memory: route.memory ?? 1024,
          maxDuration: route.maxDuration ?? 10,
          regions: route.regions,
          shouldAddHelpers: true,
          supportsResponseStreaming: true,
        }, null, 2)
      );
    }
  }
}

export function routeToFuncName(routePath: string): string {
  const normalized = routePath
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/\//g, '_');
  
  if (!normalized) {
    return 'index.func';
  }
  
  const sanitized = normalized
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^_|_$/g, '');
  
  return `${sanitized || 'index'}.func`;
}

function generateEdgeRouteHandler(route: RouteFunctionConfig): string {
  const importPath = route.pagePath.startsWith('@')
    ? route.pagePath
    : `./${route.pagePath.replace(/^\.\//, '')}`;
  
  return `
import { renderRSCToEdgeResponse } from '@renderjs/core/edge';
import Page from '${importPath}';
import { createElement } from 'react';

export const config = {
  runtime: 'edge',
  ${route.isPrerender ? `prerender: ${route.revalidate ?? true},` : ''}
  ${route.revalidate && !route.isPrerender ? `revalidate: ${route.revalidate},` : ''}
};

export default async function handler(request) {
  try {
    return await renderRSCToEdgeResponse(createElement(Page.default || Page), {
      headers: {
        'X-Route': '${route.path}',
        'X-Runtime': 'edge',
      },
    });
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 }
    );
  }
}
`;
}

function generateNodeRouteHandler(route: RouteFunctionConfig): string {
  return `
const { createServer } = require('@renderjs/core/server');

export const config = {
  runtime: 'nodejs22.x',
};

export default async function handler(request) {
  return new Response('Page not found', { status: 404 });
}
`;
}

export function generateStaticRoutes(
  staticPages: string[],
  outputDir: string = VERCEL_STATIC_DIR
): void {
  mkdirSync(outputDir, { recursive: true });
  
  for (const pagePath of staticPages) {
    const outputPath = path.join(outputDir, pagePath.replace(/^\//, ''));
    const dir = path.dirname(outputPath);
    
    if (dir !== outputDir) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

export function generatePrerenderManifest(
  routes: RouteFunctionConfig[]
): Record<string, PrerenderConfig> {
  const manifest: Record<string, PrerenderConfig> = {};
  
  for (const route of routes) {
    if (route.isPrerender) {
      manifest[route.path] = {
        expiration: route.revalidate ?? false,
      };
    }
  }
  
  return manifest;
}

export function generateRouteManifest(
  routes: RouteFunctionConfig[]
): {
  version: number;
  pages: Record<string, { name: string; runtime: string; revalidate?: number }>;
  dynamicRoutes: Record<string, { routeRegex: string; namedRegex: string }>;
} {
  const pages: Record<string, { name: string; runtime: string; revalidate?: number }> = {};
  const dynamicRoutes: Record<string, { routeRegex: string; namedRegex: string }> = {};
  
  for (const route of routes) {
    const isDynamic = route.path.includes('[') && route.path.includes(']');
    
    if (isDynamic) {
      dynamicRoutes[route.path] = {
        routeRegex: pathToRegex(route.path),
        namedRegex: pathToNamedRegex(route.path),
      };
    } else {
      pages[route.path] = {
        name: route.pagePath,
        runtime: route.runtime,
        revalidate: route.revalidate,
      };
    }
  }
  
  return { version: 3, pages, dynamicRoutes };
}

function pathToRegex(path: string): string {
  return path
    .replace(/\//g, '\\/')
    .replace(/\[([^\]]+)\]/g, '([^/]+)');
}

function pathToNamedRegex(path: string): string {
  const names: string[] = [];
  let regex = path
    .replace(/\//g, '\\/')
    .replace(/\[([^\]]+)\]/g, (_, name) => {
      names.push(name);
      return `(?<${name}>[^/]+)`;
    });
  
  return regex;
}

export interface RouteTreeNode {
  path: string;
  children?: Record<string, RouteTreeNode>;
  isDynamic?: boolean;
  isPrerender?: boolean;
  revalidate?: number;
  runtime: 'edge' | 'nodejs';
}

export function buildRouteTree(routes: RouteFunctionConfig[]): RouteTreeNode[] {
  const tree: Record<string, RouteTreeNode> = {};
  
  for (const route of routes) {
    const parts = route.path.split('/').filter(Boolean);
    let current = tree;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const isDynamic = part.startsWith('[') && part.endsWith(']');
      
      if (!current[part]) {
        current[part] = {
          path: isDynamic ? `[${part.slice(1, -1)}]` : part,
          children: {},
          isDynamic,
          isPrerender: isLast ? route.isPrerender : false,
          revalidate: isLast ? route.revalidate : undefined,
          runtime: isLast ? route.runtime : 'edge',
        };
      }
      
      current = current[part].children!;
    }
  }
  
  return Object.values(tree);
}

export function optimizeRoutesForVercel(
  routes: RouteFunctionConfig[]
): RouteFunctionConfig[] {
  const optimized: RouteFunctionConfig[] = [];
  const seenPaths = new Set<string>();
  
  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.isPrerender && !b.isPrerender) return -1;
    if (!a.isPrerender && b.isPrerender) return 1;
    if (a.runtime === 'edge' && b.runtime !== 'edge') return -1;
    if (a.runtime !== 'edge' && b.runtime === 'edge') return 1;
    return 0;
  });
  
  for (const route of sortedRoutes) {
    if (!seenPaths.has(route.path)) {
      seenPaths.add(route.path);
      optimized.push(route);
    }
  }
  
  return optimized;
}
