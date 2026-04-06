import { type CacheOptions, type CacheEntry } from './cache-types.js';

export { type CacheOptions, type CacheEntry };

export interface VercelKVStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ex?: number; px?: number }): Promise<void>;
  del(key: string): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}

export interface KVCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  invalidate(key: string): Promise<void>;
  invalidateTag(tag: string): Promise<void>;
  getTags(tag: string): Promise<string[]>;
}

declare const kv: VercelKVStore | undefined;

function isVercelKVAvailable(): boolean {
  return typeof kv !== 'undefined' && kv !== null;
}

function createMemoryKVCache(): VercelKVStore {
  const memory = new Map<string, { value: unknown; expiry?: number }>();
  
  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = memory.get(key);
      if (!entry) return null;
      if (entry.expiry && Date.now() > entry.expiry) {
        memory.delete(key);
        return null;
      }
      return entry.value as T;
    },
    
    async set<T>(
      key: string, 
      value: T, 
      options?: { ex?: number; px?: number }
    ): Promise<void> {
      const expiry = options?.ex 
        ? Date.now() + options.ex * 1000 
        : options?.px 
          ? Date.now() + options.px 
          : undefined;
      memory.set(key, { value, expiry });
    },
    
    async del(key: string): Promise<void> {
      memory.delete(key);
    },
    
    async keys(pattern?: string): Promise<string[]> {
      const allKeys = Array.from(memory.keys());
      if (!pattern) return allKeys;
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return allKeys.filter(k => regex.test(k));
    },
  };
}

function createTagIndex(): Map<string, Set<string>> {
  return new Map();
}

export function createKVCache(kvStore?: VercelKVStore): KVCache {
  const store = kvStore || createMemoryKVCache();
  const tagIndex = createTagIndex();
  const tagExpiry = new Map<string, number>();
  
  const TAG_TTL = 60 * 60 * 1000;
  
  return {
    async get<T>(key: string): Promise<T | null> {
      return store.get<T>(key);
    },
    
    async set<T>(
      key: string, 
      value: T, 
      options: CacheOptions = {}
    ): Promise<void> {
      const ttlSeconds = options.ttl ?? options.revalidate ?? 3600;
      await store.set(key, value, { ex: ttlSeconds });
      
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          let keys = tagIndex.get(tag);
          if (!keys) {
            keys = new Set();
            tagIndex.set(tag, keys);
          }
          keys.add(key);
          
          const existingExpiry = tagExpiry.get(tag);
          if (!existingExpiry || existingExpiry < Date.now()) {
            tagExpiry.set(tag, Date.now() + TAG_TTL);
          }
        }
      }
    },
    
    async invalidate(key: string): Promise<void> {
      await store.del(key);
    },
    
    async invalidateTag(tag: string): Promise<void> {
      const keys = tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          await store.del(key);
        }
        tagIndex.delete(tag);
        tagExpiry.delete(tag);
      }
    },
    
    async getTags(tag: string): Promise<string[]> {
      const keys = tagIndex.get(tag);
      if (!keys) return [];
      return Array.from(keys);
    },
  };
}

export function createVercelKVCache(): KVCache {
  if (!isVercelKVAvailable()) {
    console.warn('Vercel KV not available, falling back to memory cache');
    return createKVCache();
  }
  
  const tagKeysMap = new Map<string, string>();
  
  return {
    async get<T>(key: string): Promise<T | null> {
      return kv!.get<T>(key);
    },
    
    async set<T>(
      key: string, 
      value: T, 
      options: CacheOptions = {}
    ): Promise<void> {
      const ttlSeconds = options.ttl ?? options.revalidate ?? 3600;
      await kv!.set(key, value, { ex: ttlSeconds });
      
      if (options.tags && options.tags.length > 0) {
        for (const tag of options.tags) {
          let tagKey = tagKeysMap.get(tag);
          if (!tagKey) {
            tagKey = `render:tag:${tag}`;
            tagKeysMap.set(tag, tagKey);
          }
          
          const existingKeys = await kv!.get<string[]>(tagKey);
          const keys = existingKeys || [];
          if (!keys.includes(key)) {
            keys.push(key);
            await kv!.set(tagKey, keys, { ex: 86400 });
          }
        }
      }
    },
    
    async invalidate(key: string): Promise<void> {
      await kv!.del(key);
    },
    
    async invalidateTag(tag: string): Promise<void> {
      const tagKey = tagKeysMap.get(tag) || `render:tag:${tag}`;
      const keys = await kv!.get<string[]>(tagKey);
      
      if (keys) {
        for (const key of keys) {
          await kv!.del(key);
        }
        await kv!.del(tagKey);
      }
    },
    
    async getTags(tag: string): Promise<string[]> {
      const tagKey = tagKeysMap.get(tag) || `render:tag:${tag}`;
      return await kv!.get<string[]>(tagKey) || [];
    },
  };
}

export interface StableKVCache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, options?: CacheOptions): void;
  invalidate(key: string): void;
  invalidateTag(tag: string): void;
}

export function createStableKVCache(): StableKVCache {
  const memory = new Map<string, CacheEntry<unknown>>();
  const tagIndex = new Map<string, Set<string>>();
  
  function cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of memory.entries()) {
      if (now > entry.timestamp + entry.ttl * 1000) {
        memory.delete(key);
      }
    }
  }
  
  return {
    get<T>(key: string): T | null {
      cleanup();
      const entry = memory.get(key) as CacheEntry<T> | undefined;
      if (!entry) return null;
      return entry.data;
    },
    
    set<T>(key: string, value: T, options: CacheOptions = {}): void {
      const ttl = options.ttl ?? options.revalidate ?? 3600;
      memory.set(key, {
        data: value,
        timestamp: Date.now(),
        ttl,
        tags: options.tags,
      });
      
      if (options.tags) {
        for (const tag of options.tags) {
          let keys = tagIndex.get(tag);
          if (!keys) {
            keys = new Set();
            tagIndex.set(tag, keys);
          }
          keys.add(key);
        }
      }
    },
    
    invalidate(key: string): void {
      memory.delete(key);
    },
    
    invalidateTag(tag: string): void {
      const keys = tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          memory.delete(key);
        }
        tagIndex.delete(tag);
      }
    },
  };
}

const globalKVCache = createKVCache();

export async function revalidateTag(tag: string): Promise<void> {
  await globalKVCache.invalidateTag(tag);
}

export async function revalidatePath(path: string): Promise<void> {
  const keys = await globalKVCache.getTags(`path:${path}`);
  for (const key of keys) {
    await globalKVCache.invalidate(key);
  }
}
