export interface CacheOptions {
  ttl?: number;
  key?: string;
  tags?: string[];
  path?: string;
  revalidate?: number;
  persist?: boolean;
  staleWhileRevalidate?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
  path?: string;
}