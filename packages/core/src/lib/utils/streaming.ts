import { createElement } from 'react';
import type { ReactNode } from 'react';

export interface SuspenseStreamingOptions {
  bootstrapScripts?: string[];
  bootstrapModules?: string[];
  identifierPrefix?: string;
  namespaceURI?: string;
}

export function createStreamingRenderer(options: SuspenseStreamingOptions = {}) {
  const {
    bootstrapScripts,
    bootstrapModules,
    identifierPrefix,
    namespaceURI,
  } = options;

  return {
    bootstrapScripts,
    bootstrapModules,
    identifierPrefix,
    namespaceURI,
  };
}

export function createSuspenseFallback(fallback: ReactNode): ReactNode {
  return createElement('div', { 
    'data-render-suspense': 'true',
    className: 'render-suspense-fallback'
  }, fallback);
}

export interface DeferredValue<T> {
  read: () => T | undefined;
  peek: () => T | undefined;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  promise: Promise<T>;
}

export function createDeferred<T>(): DeferredValue<T> {
  let _resolve!: (value: T) => void;
  let _reject!: (error: Error) => void;
  let _value: T | undefined;
  let _hasValue = false;

  const promise = new Promise<T>((resolve, reject) => {
    _resolve = (value: T) => {
      _hasValue = true;
      _value = value;
      resolve(value);
    };
    _reject = reject;
  });

  return {
    read(): T | undefined {
      if (_hasValue) {
        return _value;
      }
      throw promise;
    },

    peek(): T | undefined {
      return _value;
    },

    resolve(value: T) {
      _resolve(value);
    },

    reject(error: Error) {
      _reject(error);
    },

    get promise() {
      return promise;
    },
  };
}

export function useDeferredValue<T>(value: T, initialValue?: T): T {
  const deferred = createDeferred<T>();
  
  if (value !== undefined) {
    deferred.resolve(value);
  }
  
  try {
    return deferred.read() ?? initialValue ?? value;
  } catch {
    return initialValue ?? value as T;
  }
}

export interface SuspenseBoundaryOptions {
  fallback?: ReactNode;
  fallbackElement?: ReactNode;
  timeoutMs?: number;
}

export function createSuspenseBoundary(options: SuspenseBoundaryOptions = {}) {
  const { fallback, fallbackElement, timeoutMs = 3000 } = options;

  return {
    fallback: fallback || fallbackElement || createSuspenseFallback(null),
    timeoutMs,
  };
}

export function createStreamResponse(
  stream: ReadableStream<Uint8Array>,
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {},
): Response {
  const { status = 200, statusText = 'OK', headers = {} } = options;

  return new Response(stream, {
    status,
    statusText,
    headers: {
      'Content-Type': 'text/html',
      'Transfer-Encoding': 'chunked',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

export type {
  SuspenseStreamingOptions as Unstable_SuspenseStreamingOptions,
};
