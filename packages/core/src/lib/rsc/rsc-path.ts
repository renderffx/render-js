import { AsyncLocalStorage } from 'node:async_hooks';

const FUNC_PREFIX = 'F:';

interface PathCacheContext {
  encodeCache: Map<string, string>;
  decodeCache: Map<string, string>;
}

const pathStorage = new AsyncLocalStorage<PathCacheContext>();

function getPathContext(): PathCacheContext {
  const ctx = pathStorage.getStore();
  if (!ctx) {
    throw new Error(
      'Path context not available. Ensure you are within a request context.'
    );
  }
  return ctx;
}

export function runWithPathContext<T>(fn: () => T): T {
  return pathStorage.run(
    { encodeCache: new Map(), decodeCache: new Map() },
    fn
  );
}

export function encodeFuncId(funcId: string): string {
  return FUNC_PREFIX + funcId;
}

export function decodeFuncId(rscPath: string): string | null {
  if (!rscPath.startsWith(FUNC_PREFIX)) {
    return null;
  }
  return rscPath.slice(FUNC_PREFIX.length);
}

export function encodeRscPath(rscPath: string): string {
  const ctx = getPathContext();
  const cached = ctx.encodeCache.get(rscPath);
  if (cached) return cached;
  const encoded = encodeURIComponent(rscPath);
  ctx.encodeCache.set(rscPath, encoded);
  return encoded;
}

export function decodeRscPath(encodedRscPath: string): string {
  const ctx = getPathContext();
  const cached = ctx.decodeCache.get(encodedRscPath);
  if (cached) return cached;
  const decoded = decodeURIComponent(encodedRscPath);
  ctx.decodeCache.set(encodedRscPath, decoded);
  return decoded;
}

export function clearRscPathCache(): void {
  const ctx = pathStorage.getStore();
  if (ctx) {
    ctx.encodeCache.clear();
    ctx.decodeCache.clear();
  }
}
