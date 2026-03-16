'use client';

import React, { createContext, useCallback, useEffect, useState, useContext } from 'react';
import type { ReactNode, FC, MouseEvent } from 'react';

export const ErrorBoundary = ({ children }: { children: ReactNode }) => {
  return React.createElement('div', { className: 'error-boundary' }, children);
};

type RouteProps = {
  route: { path: string; query: string; hash: string };
  httpstatus?: number;
};

export const INTERNAL_ServerRouter: FC<RouteProps> = ({ route, httpstatus }) => {
  return React.createElement('script', {
    dangerouslySetInnerHTML: {
      __html: `window.__RENDER_ROUTE__ = ${JSON.stringify({ route, httpstatus })}`,
    },
  });
};

type RouterContextType = {
  pathname: string;
  searchParams: URLSearchParams;
  setPathname: (path: string) => void;
  setSearchParams: (params: URLSearchParams) => void;
};

export const RouterContext = createContext<RouterContextType | null>(null);

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    return {
      push: (href: string) => window.history.pushState(null, '', href),
      replace: (href: string) => window.history.replaceState(null, '', href),
      reload: () => window.location.reload(),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      prefetch: (href: string) => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
      },
    };
  }
  const { pathname, searchParams, setPathname, setSearchParams } = context;
  
  return {
    pathname,
    searchParams,
    push: useCallback((href: string) => {
      window.history.pushState(null, '', href);
      const url = new URL(href, window.location.origin);
      setPathname(url.pathname);
      setSearchParams(url.searchParams);
    }, [setPathname, setSearchParams]),
    replace: useCallback((href: string) => {
      window.history.replaceState(null, '', href);
      const url = new URL(href, window.location.origin);
      setPathname(url.pathname);
      setSearchParams(url.searchParams);
    }, [setPathname, setSearchParams]),
    reload: () => window.location.reload(),
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    prefetch: (href: string) => {
      if (typeof window !== 'undefined') {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
      }
    },
  };
}

export function usePathname() {
  const context = useContext(RouterContext);
  return context?.pathname ?? '/';
}

export function useSearchParams() {
  const context = useContext(RouterContext);
  return context?.searchParams ?? new URLSearchParams();
}

type LinkProps = {
  href: string;
  replace?: boolean;
  prefetch?: boolean;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

export const Link: FC<LinkProps> = ({
  href,
  replace = false,
  prefetch = true,
  children,
  className,
  onClick,
}) => {
  const router = useRouter();
  
  const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick(e);
    }
    if (e.defaultPrevented) return;
    
    const url = new URL(href, window.location.origin);
    const currentUrl = new URL(window.location.href);
    
    if (url.origin === currentUrl.origin) {
      e.preventDefault();
      if (replace) {
        router.replace(href);
      } else {
        router.push(href);
      }
    }
  }, [href, replace, router, onClick]);
  
  useEffect(() => {
    if (prefetch && typeof window !== 'undefined') {
      const handleMouseEnter = () => {
        router.prefetch(href);
      };
      const link = document.querySelector(`a[href="${href}"]`);
      if (link) {
        link.addEventListener('mouseenter', handleMouseEnter, { once: true });
        return () => link.removeEventListener('mouseenter', handleMouseEnter);
      }
    }
  }, [href, prefetch, router]);

  return React.createElement('a', {
    href,
    onClick: handleClick,
    className,
  }, children);
};
