// ============================================================================
// Router Common - Shared utilities for both client and server routing
// ============================================================================

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type RouteProps<Path extends string = string> = {
  path: Path;
  query: string;
  hash: string;
};

// --------------------------------------------------------------------------
// Constants
// --------------------------------------------------------------------------

export const RSC_PREFIX = 'R';
export const SLICE_PREFIX = 'S/';

export const ROUTE_ID = 'ROUTE';
export const IS_STATIC_ID = 'IS_STATIC';
export const HAS404_ID = 'HAS404';
export const SKIP_HEADER = 'X-Render-Router-Skip';

// --------------------------------------------------------------------------
// Route Path Conversion
// --------------------------------------------------------------------------

export function pathnameToRoutePath(pathname: string, rscBase = '_rsc'): string {
  const rscPrefix = '/' + rscBase;
  
  // Strip _rsc prefix
  if (pathname.startsWith(rscPrefix + '/')) {
    pathname = pathname.slice(rscPrefix.length) || '/';
  } else if (pathname === rscPrefix) {
    pathname = '/';
  }
  
  // Strip _api prefix for API routes
  if (pathname.startsWith('/_api')) {
    pathname = pathname.slice(5) || '/';
  }
  
  // Validate starts with /
  if (!pathname.startsWith('/')) {
    throw new Error('Pathname must start with `/`: ' + pathname);
  }
  
  // Strip index.html suffix
  if (pathname.endsWith('/index.html')) {
    pathname = pathname.slice(0, -'/index.html'.length) || '/';
  }
  
  // Strip trailing slash (but keep root as /)
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  
  return pathname || '/';
}

// --------------------------------------------------------------------------
// RSC Path Encoding
// --------------------------------------------------------------------------

export function encodeRoutePath(routePath: string): string {
  // Validate
  if (!routePath.startsWith('/')) {
    throw new Error('Route path must start with `/`: ' + routePath);
  }
  
  if (routePath.length > 1 && routePath.endsWith('/')) {
    throw new Error('Route path must not end with `/`: ' + routePath);
  }
  
  if (routePath.endsWith('/index.html')) {
    throw new Error('Route path must not end with `/index.html`: ' + routePath);
  }
  
  // Special cases
  if (routePath === '/') {
    return RSC_PREFIX + '/_root';
  }
  
  // Hidden routes (starting with _)
  if (routePath.startsWith('/_')) {
    return RSC_PREFIX + '/__' + routePath.slice(2);
  }
  
  // Normal route
  return RSC_PREFIX + routePath;
}

export function decodeRoutePath(rscPath: string): string {
  // Validate prefix
  if (!rscPath.startsWith(RSC_PREFIX)) {
    throw new Error('rscPath should start with: ' + RSC_PREFIX);
  }
  
  // Root
  if (rscPath === RSC_PREFIX + '/_root') {
    return '/';
  }
  
  // Hidden routes
  if (rscPath.startsWith(RSC_PREFIX + '/__')) {
    return '/_' + rscPath.slice(RSC_PREFIX.length + 3);
  }
  
  // Normal route
  return rscPath.slice(RSC_PREFIX.length);
}

// --------------------------------------------------------------------------
// Slice ID Encoding
// --------------------------------------------------------------------------

export function encodeSliceId(sliceId: string): string {
  if (sliceId.startsWith('/')) {
    throw new Error('Slice id must not start with `/`: ' + sliceId);
  }
  
  return SLICE_PREFIX + sliceId;
}

export function decodeSliceId(rscPath: string): string | null {
  if (!rscPath.startsWith(SLICE_PREFIX)) {
    return null;
  }
  
  return rscPath.slice(SLICE_PREFIX.length);
}

// --------------------------------------------------------------------------
// Component ID Generation
// --------------------------------------------------------------------------

export function getComponentIds(routePath: string): readonly string[] {
  if (routePath === '/') {
    return ['root', 'page'];
  }
  
  const pathItems = routePath.split('/').filter(Boolean);
  const idSet = new Set<string>();
  let currentPath = '';
  
  for (let i = 0; i < pathItems.length; i++) {
    if (i > 0) {
      currentPath += '/';
    }
    currentPath += pathItems[i]!;
    idSet.add(currentPath + '/layout');
  }
  
  idSet.add(routePath.slice(1) + '/page');
  
  return ['root', ...idSet];
}
