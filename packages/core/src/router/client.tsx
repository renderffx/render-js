'use client';

import React, { createContext, useCallback, useEffect, useState, useContext, Component, type ReactNode, type FC, type MouseEvent } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary" role="alert" style={{
          padding: '1.5rem',
          margin: '1rem',
          border: '1px solid #dc2626',
          borderRadius: '8px',
          backgroundColor: '#fef2f2',
          color: '#991b1b',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>Something went wrong</h2>
          <pre style={{ 
            padding: '1rem', 
            background: '#fee2e2', 
            borderRadius: '4px',
            overflow: 'auto',
            maxWidth: '100%',
            fontSize: '0.875rem',
            marginBottom: '1rem',
          }}>
            {this.state.error?.message || 'An unknown error occurred'}
          </pre>
          {this.state.error?.stack && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 500 }}>Stack trace</summary>
              <pre style={{ 
                padding: '1rem', 
                background: '#fee2e2', 
                borderRadius: '4px',
                overflow: 'auto',
                maxWidth: '100%',
                fontSize: '0.75rem',
                marginTop: '0.5rem',
              }}>
                {this.state.error?.stack}
              </pre>
            </details>
          )}
          <button 
            onClick={this.reset}
            style={{
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 500,
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface NotFoundBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onNotFound?: () => void;
}

interface NotFoundBoundaryState {
  notFound: boolean;
}

export class NotFoundBoundary extends Component<NotFoundBoundaryProps, NotFoundBoundaryState> {
  constructor(props: NotFoundBoundaryProps) {
    super(props);
    this.state = { notFound: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    if (error.message === 'NOT_FOUND' || error.name === 'NotFoundError') {
      return { hasError: true, error };
    }
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    if (error.message === 'NOT_FOUND' || error.name === 'NotFoundError') {
      this.setState({ notFound: true });
      this.props.onNotFound?.();
    } else {
      console.error('Unexpected error in NotFoundBoundary:', error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.notFound) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="not-found" role="alert" style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>404 - Page Not Found</h1>
          <p style={{ color: '#666' }}>The page you are looking for does not exist.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
};

export const RouterContext = createContext<RouterContextType | null>(null);

export { useRouter, usePathname, useSearchParams, Link, RouterProvider, createClientRouter } from '../lib/rsc/client-router.js';
export type { RouterState, NavigateOptions, RSCPayloadCache, UseRouterReturn } from '../lib/rsc/client-router.js';