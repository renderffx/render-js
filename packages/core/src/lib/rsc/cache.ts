import { AsyncLocalStorage } from 'node:async_hooks';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: Set<string>;
  path?: string;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  path?: string;
  staleWhileRevalidate?: boolean;
}

export interface RevalidateOptions {
  tag?: string;
  path?: string;
  all?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
}

interface CacheContext {
  cache: Map<string, CacheEntry<unknown>>;
  tagIndex: Map<string, Set<string>>;
  pathIndex: Map<string, Set<string>>;
  revalidateCallbacks: Map<string, Set<() => void>>;
  stats: CacheStats;
}

const defaultCacheStorage = new AsyncLocalStorage<CacheContext>();

function createCacheContext(): CacheContext {
  return {
    cache: new Map(),
    tagIndex: new Map(),
    pathIndex: new Map(),
    revalidateCallbacks: new Map(),
    stats: { hits: 0, misses: 0, evictions: 0 },
  };
}

export function runWithCacheContext<T>(fn: () => T): T {
  const context = createCacheContext();
  return defaultCacheStorage.run(context, fn);
}

function getCacheContext(): CacheContext {
  const ctx = defaultCacheStorage.getStore();
  if (!ctx) {
    throw new Error(
      'Cache context not available. Ensure you are within runWithCacheContext.'
    );
  }
  return ctx;
}

function evictLRU(ctx: CacheContext): void {
  let oldestKey: string | undefined;
  let oldestTime = Infinity;

  for (const [key, entry] of ctx.cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    const entry = ctx.cache.get(oldestKey);
    if (entry) {
      for (const tag of entry.tags) {
        ctx.tagIndex.get(tag)?.delete(oldestKey);
      }
      if (entry.path) {
        ctx.pathIndex.get(entry.path)?.delete(oldestKey);
      }
    }
    ctx.cache.delete(oldestKey);
    ctx.stats.evictions++;
  }
}

export function cache<T>(
  key: string,
  fn: () => T | Promise<T>,
  options: CacheOptions = {}
): T | Promise<T> {
  const ctx = getCacheContext();
  const { ttl = 60000, tags = [], path } = options;

  const existingEntry = ctx.cache.get(key) as CacheEntry<T> | undefined;
  if (existingEntry) {
    if (Date.now() < existingEntry.timestamp + existingEntry.ttl) {
      ctx.stats.hits++;
      return existingEntry.data;
    }
  }

  ctx.stats.misses++;
  
  if (options.staleWhileRevalidate && existingEntry) {
    const result = fn();
    if (result instanceof Promise) {
      return result.then((data) => {
        ctx.cache.set(key, {
          data,
          timestamp: Date.now(),
          ttl,
          tags: new Set(tags),
          path,
        });
        
        for (const tag of tags) {
          if (!ctx.tagIndex.has(tag)) {
            ctx.tagIndex.set(tag, new Set());
          }
          ctx.tagIndex.get(tag)!.add(key);
        }
        
        if (path) {
          if (!ctx.pathIndex.has(path)) {
            ctx.pathIndex.set(path, new Set());
          }
          ctx.pathIndex.get(path)!.add(key);
        }
        
        return existingEntry.data;
      });
    }
    
    ctx.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      ttl,
      tags: new Set(tags),
      path,
    });
    
    return existingEntry.data;
  }

  const result = fn();
  
  if (result instanceof Promise) {
    return result.then((data) => {
      if (ctx.cache.size >= 1000) {
        evictLRU(ctx);
      }
      
      ctx.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
        tags: new Set(tags),
        path,
      });
      
      for (const tag of tags) {
        if (!ctx.tagIndex.has(tag)) {
          ctx.tagIndex.set(tag, new Set());
        }
        ctx.tagIndex.get(tag)!.add(key);
      }
      
      if (path) {
        if (!ctx.pathIndex.has(path)) {
          ctx.pathIndex.set(path, new Set());
        }
        ctx.pathIndex.get(path)!.add(key);
      }
      
      return data;
    }).catch((error) => {
      if (existingEntry) {
        console.warn('[RSC Cache] Cache fetch failed, returning stale data:', error);
        return existingEntry.data;
      }
      console.error('[RSC Cache] Cache fetch failed:', error);
      throw error;
    });
  }

  if (ctx.cache.size >= 1000) {
    evictLRU(ctx);
  }
  
  ctx.cache.set(key, {
    data: result,
    timestamp: Date.now(),
    ttl,
    tags: new Set(tags),
    path,
  });
  
  for (const tag of tags) {
    if (!ctx.tagIndex.has(tag)) {
      ctx.tagIndex.set(tag, new Set());
    }
    ctx.tagIndex.get(tag)!.add(key);
  }
  
  if (path) {
    if (!ctx.pathIndex.has(path)) {
      ctx.pathIndex.set(path, new Set());
    }
    ctx.pathIndex.get(path)!.add(key);
  }
  
  return result;
}

export async function unstable_cache<T>(
  key: string | (() => string),
  fn: () => T | Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const resolvedKey = typeof key === 'function' ? key() : key;
  const result = cache(resolvedKey, fn, options);
  
  if (result instanceof Promise) {
    return result;
  }
  
  return result as T;
}

export function revalidateTag(tag: string): void {
  const ctx = getCacheContext();
  
  if (!ctx) {
    console.warn(
      '[RSC Cache] revalidateTag() called outside request context. ' +
      'Revalidation only works within the same request. ' +
      'For cross-request revalidation, use an external cache store (e.g., Redis).'
    );
    return;
  }
  
  const keysToDelete = ctx.tagIndex.get(tag);
  
  if (keysToDelete) {
    for (const key of keysToDelete) {
      ctx.cache.delete(key);
      
      const callbacks = ctx.revalidateCallbacks.get(key);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback();
          } catch (err) {
            console.error('[RSC Cache] Revalidation callback error:', err);
          }
        }
      }
    }
    ctx.tagIndex.delete(tag);
  }
}

export function revalidatePath(path: string): void {
  const ctx = getCacheContext();
  
  if (!ctx) {
    console.warn(
      '[RSC Cache] revalidatePath() called outside request context. ' +
      'Revalidation only works within the same request. ' +
      'For cross-request revalidation, use an external cache store (e.g., Redis).'
    );
    return;
  }
  
  const keysToDelete = ctx.pathIndex.get(path);
  
  if (keysToDelete) {
    for (const key of keysToDelete) {
      ctx.cache.delete(key);
      
      const callbacks = ctx.revalidateCallbacks.get(key);
      if (callbacks) {
        for (const callback of callbacks) {
          try {
            callback();
          } catch (err) {
            console.error('[RSC Cache] Revalidation callback error:', err);
          }
        }
      }
    }
    ctx.pathIndex.delete(path);
  }
}

export function revalidate(options: RevalidateOptions): void {
  const ctx = getCacheContext();
  
  if (!ctx) {
    console.warn(
      '[RSC Cache] revalidate() called outside request context. ' +
      'Revalidation only works within the same request. ' +
      'For cross-request revalidation, use an external cache store (e.g., Redis).'
    );
    return;
  }
  
  if (options.all) {
    ctx.cache.clear();
    ctx.tagIndex.clear();
    ctx.pathIndex.clear();
    return;
  }
  
  if (options.tag) {
    revalidateTag(options.tag);
  }
  
  if (options.path) {
    revalidatePath(options.path);
  }
}

export function onRevalidate(key: string, callback: () => void): () => void {
  const ctx = getCacheContext();
  
  if (!ctx.revalidateCallbacks.has(key)) {
    ctx.revalidateCallbacks.set(key, new Set());
  }
  ctx.revalidateCallbacks.get(key)!.add(callback);
  
  return () => {
    const callbacks = ctx.revalidateCallbacks.get(key);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        ctx.revalidateCallbacks.delete(key);
      }
    }
  };
}

export function getCached<T>(key: string): T | undefined {
  const ctx = getCacheContext();
  const entry = ctx.cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  
  if (Date.now() > entry.timestamp + entry.ttl) {
    ctx.cache.delete(key);
    return undefined;
  }
  
  return entry.data as T;
}

export function setCached<T>(key: string, data: T, options: CacheOptions = {}): void {
  const ctx = getCacheContext();
  const { ttl = 60000, tags = [], path } = options;
  
  ctx.cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
    tags: new Set(tags),
    path,
  });
  
  for (const tag of tags) {
    if (!ctx.tagIndex.has(tag)) {
      ctx.tagIndex.set(tag, new Set());
    }
    ctx.tagIndex.get(tag)!.add(key);
  }
  
  if (path) {
    if (!ctx.pathIndex.has(path)) {
      ctx.pathIndex.set(path, new Set());
    }
    ctx.pathIndex.get(path)!.add(key);
  }
}

export function invalidateCache(key?: string): void {
  const ctx = getCacheContext();
  
  if (key) {
    ctx.cache.delete(key);
  } else {
    ctx.cache.clear();
  }
}

export function clearCache(): void {
  const ctx = getCacheContext();
  
  ctx.cache.clear();
  ctx.tagIndex.clear();
  ctx.pathIndex.clear();
  ctx.revalidateCallbacks.clear();
}

export function getCacheSize(): number {
  const ctx = getCacheContext();
  return ctx.cache.size;
}

export function getCacheTags(): string[] {
  const ctx = getCacheContext();
  return Array.from(ctx.tagIndex.keys());
}

export function getCachePaths(): string[] {
  const ctx = getCacheContext();
  return Array.from(ctx.pathIndex.keys());
}

export function isCached(key: string): boolean {
  return getCached(key) !== undefined;
}

export function getCacheEntry<T>(key: string): CacheEntry<T> | undefined {
  const ctx = getCacheContext();
  const entry = ctx.cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  
  if (Date.now() > entry.timestamp + entry.ttl) {
    ctx.cache.delete(key);
    return undefined;
  }
  
  return entry;
}

export function getCacheAge(key: string): number | undefined {
  const ctx = getCacheContext();
  const entry = ctx.cache.get(key);
  if (!entry) return undefined;
  
  return Date.now() - entry.timestamp;
}

export function getCacheTTL(key: string): number | undefined {
  const ctx = getCacheContext();
  const entry = ctx.cache.get(key);
  if (!entry) return undefined;
  
  const age = Date.now() - entry.timestamp;
  const remaining = entry.ttl - age;
  
  return remaining > 0 ? remaining : undefined;
}

export function getCacheStats(): CacheStats {
  const ctx = getCacheContext();
  return { ...ctx.stats };
}

export function resetCacheStats(): void {
  const ctx = getCacheContext();
  ctx.stats = { hits: 0, misses: 0, evictions: 0 };
}
