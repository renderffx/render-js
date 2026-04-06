import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export interface RSCPayload {
  id: string;
  chunks: Uint8Array[];
  cacheKey?: string;
}

export interface RSCPrefetchEntry {
  segments: string[];
  promise?: Promise<void>;
}

export interface RSCCacheOptions {
  maxSize?: number;
  ttl?: number;
}

const DEFAULT_CACHE_OPTIONS: RSCCacheOptions = {
  maxSize: 100,
  ttl: 5 * 60 * 1000,
};

class RSCPayloadCache {
  private cache: Map<string, { payload: RSCPayload; timestamp: number }>;
  private maxSize: number;
  private ttl: number;

  constructor(options: RSCCacheOptions = {}) {
    const { maxSize = 100, ttl = 5 * 60 * 1000 } = { ...DEFAULT_CACHE_OPTIONS, ...options };
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
  }

  set(path: string, payload: RSCPayload): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(path, { payload, timestamp: Date.now() });
  }

  get(path: string): RSCPayload | undefined {
    const entry = this.cache.get(path);
    if (!entry) return undefined;

    if (Date.now() > entry.timestamp + this.ttl) {
      this.cache.delete(path);
      return undefined;
    }

    return entry.payload;
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  invalidate(path?: string): void {
    if (path) {
      this.cache.delete(path);
    } else {
      this.cache.clear();
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const globalPayloadCache = new RSCPayloadCache();
const pendingPrefetches = new Map<string, Promise<void>>();

export function getRSCCache(): RSCPayloadCache {
  return globalPayloadCache;
}

export function prefetchRSC(path: string, options?: RequestInit): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (globalPayloadCache.has(path)) {
    return Promise.resolve();
  }

  if (pendingPrefetches.has(path)) {
    return pendingPrefetches.get(path)!;
  }

  const prefetchPromise = (async () => {
    try {
      const response = await fetch(path, {
        ...options,
        headers: {
          ...options?.headers,
          'X-RSC': '1',
          'Purpose': 'prefetch',
        },
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/rsc')) {
          const text = await response.text();
          const payload: RSCPayload = {
            id: path,
            chunks: [new TextEncoder().encode(text)],
          };
          globalPayloadCache.set(path, payload);
        }
      }
    } catch {
    } finally {
      pendingPrefetches.delete(path);
    }
  })();

  pendingPrefetches.set(path, prefetchPromise);
  return prefetchPromise;
}

export function invalidateRSCPath(path: string): void {
  globalPayloadCache.invalidate(path);
}

export function clearRSCCache(): void {
  globalPayloadCache.clear();
  pendingPrefetches.clear();
}

interface RouterState {
  pathname: string;
  search: string;
  hash: string;
}

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
}

export interface UseRouterReturn {
  push: (href: string, options?: NavigateOptions) => void;
  replace: (href: string, options?: NavigateOptions) => void;
  reload: () => void;
  back: () => void;
  forward: () => void;
  pathname: string;
  search: string;
  hash: string;
  isLoading: boolean;
}

const RouterContext = createContext<{
  state: RouterState;
  navigate: (href: string, options?: NavigateOptions) => void;
}>({
  state: { pathname: '/', search: '', hash: '' },
  navigate: () => {},
});

export function RouterProvider({ 
  children, 
  initialPathname = '/',
}: { 
  children: ReactNode; 
  initialPathname?: string;
}) {
  const [state, setState] = useState<RouterState>(() => ({
    pathname: initialPathname,
    search: typeof window !== 'undefined' ? window.location.search : '',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
  }));

  const navigate = useCallback((href: string, options: NavigateOptions = {}) => {
    const { replace = false, scroll = true, prefetch = true } = options;
    
    let pathname = href;
    let search = '';
    let hash = '';
    
    const hashIndex = href.indexOf('#');
    if (hashIndex !== -1) {
      hash = href.slice(hashIndex);
      href = href.slice(0, hashIndex);
    }
    
    const searchIndex = href.indexOf('?');
    if (searchIndex !== -1) {
      search = href.slice(searchIndex);
      pathname = href.slice(0, searchIndex);
    }
    
    if (prefetch && typeof window !== 'undefined') {
      prefetchRSC(pathname);
    }
    
    const newState: RouterState = { pathname, search, hash };
    
    if (replace) {
      window.history.replaceState(
        { ...window.history.state, ...newState },
        '',
        href
      );
    } else {
      window.history.pushState(
        { ...window.history.state, ...newState },
        '',
        href
      );
    }
    
    setState(newState);
    
    if (scroll) {
      if (hash) {
        const element = document.querySelector(hash);
        element?.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setState({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <RouterContext.Provider value={{ state, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): UseRouterReturn {
  const { state, navigate } = useContext(RouterContext);

  const push = useCallback((href: string, options?: NavigateOptions) => {
    navigate(href, { ...options, replace: false });
  }, [navigate]);

  const replace = useCallback((href: string, options?: NavigateOptions) => {
    navigate(href, { ...options, replace: true });
  }, [navigate]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const back = useCallback(() => {
    window.history.back();
  }, []);

  const forward = useCallback(() => {
    window.history.forward();
  }, []);

  return {
    push,
    replace,
    reload,
    back,
    forward,
    pathname: state.pathname,
    search: state.search,
    hash: state.hash,
    isLoading: false,
  };
}

export function usePathname(): string {
  const { state } = useContext(RouterContext);
  return state.pathname;
}

export function useSearchParams(): URLSearchParams {
  const { state } = useContext(RouterContext);
  return new URLSearchParams(state.search);
}

export function Link({
  href,
  children,
  replace,
  scroll,
  prefetch = true,
  onClick,
  ...props
}: {
  href: string;
  children: ReactNode;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  onClick?: (e: MouseEvent) => void;
  className?: string;
  style?: React.CSSProperties;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate } = useContext(RouterContext);

  const handleClick = useCallback((e: MouseEvent) => {
    if (onClick) {
      onClick(e);
      if (e.defaultPrevented) return;
    }

    if (
      e.button === 0 &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.shiftKey &&
      !e.altKey
    ) {
      e.preventDefault();
      navigate(href, { replace, scroll, prefetch });
    }
  }, [href, navigate, replace, scroll, prefetch, onClick]);

  return (
    <a
      href={href}
      onClick={handleClick as any}
      {...props}
    >
      {children}
    </a>
  );
}

export function createClientRouter(initialPathname: string = '/') {
  return {
    Provider: ({ children }: { children: ReactNode }) => (
      <RouterProvider initialPathname={initialPathname}>
        {children}
      </RouterProvider>
    ),
    useRouter,
    usePathname,
    useSearchParams,
    Link,
    prefetch: prefetchRSC,
    invalidate: invalidateRSCPath,
    clearCache: clearRSCCache,
  };
}

export type { RouterState, NavigateOptions, RSCPayloadCache };
