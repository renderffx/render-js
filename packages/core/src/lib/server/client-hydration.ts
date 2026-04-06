import React, { createElement, type ReactNode, useState, useEffect } from 'react';

export interface HydrationOptions {
  timeout?: number;
  onError?: (error: Error) => void;
  onHydrated?: () => void;
}

const hydrationContext = new Map<string, unknown>();

export function setHydrationData(key: string, value: unknown): void {
  hydrationContext.set(key, value);
}

export function getHydrationData<T>(key: string): T | undefined {
  return hydrationContext.get(key) as T | undefined;
}

export function clearHydrationData(): void {
  hydrationContext.clear();
}

export function createHydrationBoundary(
  children: ReactNode,
  options?: HydrationOptions
): ReactNode {
  return createElement(HydrationBoundaryWrapper, { children, ...options });
}

interface Props {
  children: ReactNode;
  timeout?: number;
  onError?: (error: Error) => void;
  onHydrated?: () => void;
}

function HydrationBoundaryWrapper({ children, timeout = 5000, onError, onHydrated }: Props): ReactNode {
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!hydrated) {
        const err = new Error('Hydration timeout');
        setError(err);
        onError?.(err);
      }
    }, timeout);
    
    try {
      setHydrated(true);
      onHydrated?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Hydration failed');
      setError(error);
      onError?.(error);
    }
    
    return () => clearTimeout(timeoutId);
  }, [timeout, onError, onHydrated, hydrated]);
  
  if (error) {
    return createElement('div', { 'data-hydration-error': 'true' }, error.message);
  }
  
  if (!hydrated) {
    return null;
  }
  
  return children;
}

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  
  useEffect(() => {
    setHydrated(true);
  }, []);
  
  return hydrated;
}

export function useHydrationData<T>(key: string): T | undefined {
  const [data, setData] = useState<T | undefined>(() => getHydrationData<T>(key));
  
  useEffect(() => {
    const interval = setInterval(() => {
      const newData = getHydrationData<T>(key);
      if (newData !== data) {
        setData(newData);
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [key, data]);
  
  return data;
}

export async function hydrateFromStream(
  stream: ReadableStream<Uint8Array>,
  options?: {
    onChunk?: (chunk: unknown) => void;
    onError?: (error: Error) => void;
    onComplete?: () => void;
  }
): Promise<unknown> {
  const decoder = new TextDecoder();
  const chunks: Uint8Array[] = [];
  
  try {
    const reader = stream.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      const text = decoder.decode(value, { stream: true });
      options?.onChunk?.(text);
    }
    
    const fullText = chunks.map(c => decoder.decode(c)).join('');
    const lines = fullText.split('\n').filter(line => line.trim());
    
    const elements: unknown[] = [];
    
    for (const line of lines) {
      if (line === '[RSC_END]') break;
      if (line.startsWith('[RSC_ERROR:')) continue;
      
      try {
        const parsed = JSON.parse(line);
        if (parsed?.type === 'jsx') {
          elements.push(parsed.data);
        }
      } catch {
        // Skip invalid chunks
      }
    }
    
    options?.onComplete?.();
    return elements.length === 1 ? elements[0] : elements;
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Hydration failed');
    options?.onError?.(err);
    throw err;
  }
}

export function createClientCache<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: { ttl?: number; maxSize?: number }
): T {
  const cache = new Map<string, { value: unknown; expires: number }>();
  const ttl = options?.ttl || 60000;
  const maxSize = options?.maxSize || 100;
  
  return ((...args: unknown[]) => {
    const key = JSON.stringify(args);
    const now = Date.now();
    
    const cached = cache.get(key);
    if (cached && cached.expires > now) {
      return cached.value as ReturnType<T>;
    }
    
    const result = fn(...args);
    
    if (result instanceof Promise) {
      return result.then((value: unknown) => {
        if (cache.size >= maxSize) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }
        cache.set(key, { value, expires: now + ttl });
        return value as ReturnType<T>;
      }) as ReturnType<T>;
    }
    
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) cache.delete(oldestKey);
    }
    cache.set(key, { value: result, expires: now + ttl });
    
    return result as ReturnType<T>;
  }) as T;
}

export { hydrationContext };
