export interface CacheOptions {
  ttl?: number;
  key?: string;
  staleWhileRevalidate?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

export function createServerCache() {
  const cache = new Map<string, CacheEntry<unknown>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function get<T>(key: string): T | undefined {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    
    if (Date.now() > entry.timestamp + entry.ttl) {
      cache.delete(key);
      const timer = timers.get(key);
      if (timer) {
        clearTimeout(timer);
        timers.delete(key);
      }
      return undefined;
    }
    
    return entry.data;
  }

  function set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl ?? 60000;
    cache.set(key, { data, timestamp: Date.now(), ttl });
    
    const existingTimer = timers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    timers.set(key, setTimeout(() => {
      cache.delete(key);
      timers.delete(key);
    }, ttl));
  }

  function invalidate(key: string): void {
    cache.delete(key);
    const timer = timers.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.delete(key);
    }
  }

  function clear(): void {
    cache.clear();
    timers.forEach(t => clearTimeout(t));
    timers.clear();
  }

  function invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of cache.keys()) {
      if (pattern.test(key)) {
        invalidate(key);
        count++;
      }
    }
    return count;
  }

  return {
    get,
    set,
    invalidate,
    invalidatePattern,
    clear,
    size: () => cache.size,
  };
}

export async function cacheAsync<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const ttl = options.ttl ?? 60000;
  const cached = memoryCache.get(key) as CacheEntry<T> | undefined;
  
  if (cached && Date.now() < cached.timestamp + cached.ttl) {
    return cached.data;
  }

  if (options.staleWhileRevalidate && cached) {
    fn().then(data => {
      memoryCache.set(key, { data, timestamp: Date.now(), ttl });
    }).catch(console.error);
    return cached.data;
  }

  const data = await fn();
  memoryCache.set(key, { data, timestamp: Date.now(), ttl });
  return data;
}

export function getCached<T>(key: string): T | undefined {
  const entry = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  
  if (Date.now() > entry.timestamp + entry.ttl) {
    memoryCache.delete(key);
    return undefined;
  }
  
  return entry.data;
}

export function setCached<T>(key: string, data: T, ttl = 60000): void {
  memoryCache.set(key, { data, timestamp: Date.now(), ttl });
}

export function invalidateCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
  } else {
    memoryCache.clear();
  }
}
