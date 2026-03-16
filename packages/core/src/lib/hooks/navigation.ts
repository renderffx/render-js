'use client';

import { useTransition, useState, useCallback } from 'react';

export interface TransitionOptions {
  timeoutMs?: number;
}

export function usePending(options: TransitionOptions = {}) {
  const [isPending, startTransition] = useTransition();
  const [pendingCount, setPendingCount] = useState(0);

  const wrapTransition = useCallback(<T extends (...args: unknown[]) => unknown>(
    callback: T
  ): ((...args: Parameters<T>) => void) => {
    return (...args: Parameters<T>) => {
      startTransition(() => {
        setPendingCount(c => c + 1);
        try {
          callback(...args);
        } finally {
          setPendingCount(c => c - 1);
        }
      });
    };
  }, [startTransition]);

  return {
    isPending: isPending || pendingCount > 0,
    startTransition: wrapTransition,
    pendingCount,
  };
}

export function useNavigation() {
  const [isNavigating, setIsNavigating] = useState(false);

  const navigate = useCallback((href: string) => {
    setIsNavigating(true);
    window.history.pushState(null, '', href);
    setTimeout(() => setIsNavigating(false), 100);
  }, []);

  return { navigate, isNavigating };
}

export function usePrefetch() {
  const prefetchPage = useCallback((href: string) => {
    if (typeof window === 'undefined') return;
    
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  }, []);

  return { prefetchPage };
}
