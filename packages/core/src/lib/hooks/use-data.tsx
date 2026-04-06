import { createContext, useCallback, useContext, useState, useTransition, useEffect } from 'react';
import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { AsyncLocalStorage } from 'node:async_hooks';

export type FetchOptions = RequestInit & {
  timeout?: number;
};

export type UseDataOptions<T> = {
  initialData?: T;
  timeout?: number;
  refetchInterval?: number;
};

type CacheEntry<T> = {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  timestamp: number;
};

interface DataCacheContext {
  cache: Map<string, CacheEntry<unknown>>;
}

const dataCacheStorage = new AsyncLocalStorage<DataCacheContext>();

function createDataCacheContext(): DataCacheContext {
  return { cache: new Map() };
}

function getDataCacheContext(): DataCacheContext {
  const ctx = dataCacheStorage.getStore();
  if (!ctx) {
    throw new Error(
      'Data cache context not available. Ensure you are within runWithDataCacheContext.'
    );
  }
  return ctx;
}

export function runWithDataCacheContext<T>(fn: () => T): T {
  const context = createDataCacheContext();
  return dataCacheStorage.run(context, fn);
}

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

export function setCacheData<T>(key: string, data: T): void {
  const ctx = dataCacheStorage.getStore();
  if (!ctx) {
    throw new Error(
      'setCacheData called outside of request context. ' +
      'Ensure you are within a renderWithContext or similar wrapper.'
    );
  }
  if (ctx.cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = findOldestEntry(ctx.cache);
    if (oldestKey) ctx.cache.delete(oldestKey);
  }
  ctx.cache.set(key, {
    data,
    loading: false,
    error: null,
    timestamp: Date.now(),
  });
}

export function getCacheData<T>(key: string): T | undefined {
  const ctx = dataCacheStorage.getStore();
  if (!ctx) {
    throw new Error(
      'getCacheData called outside of request context. ' +
      'Ensure you are within a renderWithContext or similar wrapper.'
    );
  }
  const entry = ctx.cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() - entry.timestamp > CACHE_TTL) {
    ctx.cache.delete(key);
    return undefined;
  }
  return entry?.data;
}

export function clearCacheData(key?: string): void {
  const ctx = dataCacheStorage.getStore();
  if (!ctx) {
    throw new Error(
      'clearCacheData called outside of request context. ' +
      'Ensure you are within a renderWithContext or similar wrapper.'
    );
  }
  if (key) {
    ctx.cache.delete(key);
  } else {
    ctx.cache.clear();
  }
}

function findOldestEntry(cache: Map<string, CacheEntry<unknown>>): string | undefined {
  let oldestKey: string | undefined;
  let oldestTime = Infinity;
  for (const [key, entry] of cache) {
    if (entry.timestamp < oldestTime) {
      oldestTime = entry.timestamp;
      oldestKey = key;
    }
  }
  return oldestKey;
}

interface UseDataReturn<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  setData: Dispatch<SetStateAction<T | undefined>>;
}

export function useData<T>(
  key: string | (() => string),
  fetcher: () => Promise<T>,
  options: UseDataOptions<T> = {},
): UseDataReturn<T> {
  const cacheKey = typeof key === 'function' ? key() : key;
  const { initialData, timeout, refetchInterval } = options;
  
  const [data, setData] = useState<T | undefined>(() => {
    const cached = getCacheData<T>(cacheKey);
    return cached ?? initialData;
  });
  
  const [loading, setLoading] = useState<boolean>(!data && !initialData);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    
    try {
      const controller = timeout ? new AbortController() : undefined;
      if (timeout && controller) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
      }
      
      const result = await fetcher();
      setCacheData(cacheKey, result);
      
      startTransition(() => {
        setData(result);
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [cacheKey, fetcher, timeout, startTransition]);

  useEffect(() => {
    if (!data || refetchInterval) {
      const intervalId = refetchInterval 
        ? setInterval(fetchData, refetchInterval)
        : undefined;
      
      if (!data) {
        fetchData();
      }
      
      return () => {
        if (intervalId) clearInterval(intervalId);
      };
    }
  }, [data, refetchInterval, fetchData]);

  const refetch = useCallback(() => {
    startTransition(() => {
      fetchData();
    });
  }, [fetchData, startTransition]);

  return {
    data,
    loading,
    error,
    refetch,
    setData: (value: SetStateAction<T | undefined>) => {
      startTransition(() => {
        setData(value);
        if (typeof value === 'function') {
          const newData = (value as (prev: T | undefined) => T | undefined)(data);
          setCacheData(cacheKey, newData);
        }
      });
    },
  };
}

export function useAction<TArgs, TResult>(
  action: (args: TArgs) => Promise<TResult>,
): {
  execute: (args: TArgs) => Promise<TResult>;
  loading: boolean;
  error: Error | null;
  result: TResult | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TResult | null>(null);

  const execute = useCallback(async (args: TArgs): Promise<TResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const actionResult = await action(args);
      setResult(actionResult);
      return actionResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [action]);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setLoading(false);
  }, []);

  return { execute, loading, error, result, reset };
}

interface ServerFunctionContext {
  req?: Request;
}

const serverFunctionContext = createContext<ServerFunctionContext>({});

export function ServerFunctionProvider({ 
  children, 
  req 
}: { 
  children: ReactNode; 
  req?: Request;
}) {
  return (
    <serverFunctionContext.Provider value={{ req }}>
      {children}
    </serverFunctionContext.Provider>
  );
}

export function useServer<TArgs, TResult>(
  action: (args: TArgs, ctx: ServerFunctionContext) => Promise<TResult>,
  options: { actionId?: string } = {},
): (args: TArgs) => Promise<TResult> {
  const ctx = useContext(serverFunctionContext);

  return useCallback(async (args: TArgs): Promise<TResult> => {
    const actionId = options.actionId || action.name;
    
    const response = await fetch('/__rsc/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Action-Id': actionId,
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Action failed: ${response.statusText}`);
    }

    return response.json();
  }, [action, ctx, options.actionId]);
}

export type { UseDataReturn as Unstable_UseDataReturn };
export type { UseDataOptions as Unstable_UseDataOptions };
