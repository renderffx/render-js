export interface EdgeRoute {
  path: string;
  pattern: RegExp;
  params: string[];
  isStatic: boolean;
  isDynamic: boolean;
  isPrerender: boolean;
  revalidate?: number;
  runtime: 'edge' | 'nodejs';
}

export interface EdgeRouterOptions {
  basePath?: string;
  trailingSlash?: boolean;
}

export function createEdgeRouter(routes: EdgeRoute[], options: EdgeRouterOptions = {}): {
  match: (pathname: string) => { route: EdgeRoute; params: Record<string, string> } | null;
  findPrerenderRoutes: () => EdgeRoute[];
  findDynamicRoutes: () => EdgeRoute[];
  findEdgeRoutes: () => EdgeRoute[];
  generateMatchers: () => string[];
} {
  const { basePath = '', trailingSlash = false } = options;
  
  function normalizePath(pathname: string): string {
    let normalized = pathname;
    
    if (basePath && normalized.startsWith(basePath)) {
      normalized = normalized.slice(basePath.length);
    }
    
    if (trailingSlash && !normalized.endsWith('/') && !normalized.includes('.')) {
      normalized = normalized + '/';
    }
    
    return normalized || '/';
  }
  
  function pathToRegex(routePath: string): { regex: RegExp; params: string[] } {
    const params: string[] = [];
    
    const pattern = routePath
      .replace(/\//g, '\\/')
      .replace(/\[([^\]]+)\]/g, (_, name) => {
        params.push(name);
        return '([^/]+)';
      })
      .replace(/\/\\/, '\\/?');
    
    return {
      regex: new RegExp(`^${pattern}$`),
      params,
    };
  }
  
  const compiledRoutes = routes.map(route => {
    const { regex, params } = pathToRegex(route.path);
    return {
      ...route,
      regex,
      params,
    };
  });
  
  return {
    match(pathname: string): { route: EdgeRoute; params: Record<string, string> } | null {
      const normalized = normalizePath(pathname);
      
      for (const route of compiledRoutes) {
        const match = normalized.match(route.regex);
        
        if (match) {
          const params: Record<string, string> = {};
          
          for (let i = 0; i < route.params.length; i++) {
            params[route.params[i]] = match[i + 1];
          }
          
          return { route, params };
        }
      }
      
      return null;
    },
    
    findPrerenderRoutes(): EdgeRoute[] {
      return routes.filter(r => r.isPrerender);
    },
    
    findDynamicRoutes(): EdgeRoute[] {
      return routes.filter(r => r.isDynamic);
    },
    
    findEdgeRoutes(): EdgeRoute[] {
      return routes.filter(r => r.runtime === 'edge');
    },
    
    generateMatchers(): string[] {
      const matchers: Set<string> = new Set();
      
      for (const route of routes) {
        const normalizedPath = normalizePath(route.path);
        matchers.add(normalizedPath);
        
        if (route.isDynamic) {
          const dynamicPattern = normalizedPath.replace(/\[[^\]]+\]/g, '(.*)');
          matchers.add(dynamicPattern);
        }
      }
      
      return Array.from(matchers);
    },
  };
}

export function generateEdgeMiddlewareRouter(
  routes: EdgeRoute[]
): string {
  const staticRoutes = routes.filter(r => r.isStatic && !r.isDynamic);
  const dynamicRoutes = routes.filter(r => r.isDynamic);
  
  const matchers = [
    ...staticRoutes.map(r => r.path),
    ...dynamicRoutes.map(r => r.path.replace(/\[[^\]]+\]/g, '(.*)')),
  ];
  
  const routeChecks = routes.map(route => {
    const isDynamic = route.path.includes('[');
    const pattern = route.path
      .replace(/\//g, '\\/')
      .replace(/\[([^\]]+)\]/g, '[^/]+');
    
    return {
      path: route.path,
      regex: new RegExp(`^${pattern}$`),
      isPrerender: route.isPrerender,
      runtime: route.runtime,
    };
  });
  
  return `
export const config = {
  runtime: 'edge',
  matcher: ${JSON.stringify(matchers, null, 2).replace(/"/g, "'")},
};

const routes = ${JSON.stringify(routeChecks.map(r => ({
  path: r.path,
  isPrerender: r.isPrerender,
  runtime: r.runtime,
})), null, 2).replace(/"/g, "'")};

export default function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  for (const route of routes) {
    const pattern = route.path
      .replace(/\\//g, '/')
      .replace(/\\[[^\\]+\\]/g, '[^/]+');
    
    if (new RegExp('^' + pattern + '$').test(pathname)) {
      return NextResponse.next();
    }
  }
  
  return NextResponse.next();
}
`;
}

export function detectStaticRoutes(
  pagesDir: string,
  routePath: string
): { isStatic: boolean; isDynamic: boolean } {
  const isDynamic = routePath.includes('[') && routePath.includes(']');
  
  const paramPattern = /\[[^\]]+\]/g;
  const matches = routePath.match(paramPattern);
  
  const hasComplexParams = matches && matches.some(
    param => param.includes(':') || param.includes('...')
  );
  
  return {
    isStatic: !isDynamic && !hasComplexParams,
    isDynamic: isDynamic || !!hasComplexParams,
  };
}

export interface CDNCachedRoute {
  path: string;
  cacheControl: string;
  isStatic: boolean;
  etag?: string;
}

export function generateCDNCacheHeaders(
  route: EdgeRoute,
  options?: {
    defaultMaxAge?: number;
    immutable?: boolean;
  }
): Record<string, string> {
  const maxAge = options?.defaultMaxAge ?? 60;
  const immutable = options?.immutable ?? false;
  
  if (route.isStatic || route.isPrerender) {
    return {
      'Cache-Control': immutable
        ? 'public, max-age=31536000, immutable'
        : `public, max-age=${route.revalidate ?? maxAge}, stale-while-revalidate=${(route.revalidate ?? maxAge) * 2}`,
    };
  }
  
  if (route.isDynamic) {
    return {
      'Cache-Control': 'private, no-cache, no-store, must-revalidate',
    };
  }
  
  return {
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`,
  };
}
