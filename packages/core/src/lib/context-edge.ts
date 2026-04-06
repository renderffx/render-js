/* eslint-disable @typescript-eslint/no-explicit-any */

import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestContext } from './context.js';

interface RenderContextStorage {
  __RENDER_CONTEXT__?: RequestContext;
  __RENDER_DATA__?: Map<string, unknown>;
  Bun?: unknown;
  waitUntil?: (promise: Promise<unknown>) => void;
}

declare const EdgeRuntime: string | undefined;

declare global {
  interface Window extends RenderContextStorage {}
  interface globalThis extends RenderContextStorage {}
}

export { RequestContext };

type ContextData = Map<string, unknown>;

const contextStorage = new AsyncLocalStorage<RequestContext>();

const getGlobal = (): RenderContextStorage => globalThis as any;

export function isEdgeRuntime(): boolean {
  if (typeof EdgeRuntime !== 'undefined') {
    return true;
  }
  return false;
}

export function getRuntimeType(): 'edge' | 'node' | 'bun' | 'unknown' {
  if (typeof EdgeRuntime !== 'undefined') {
    return 'edge';
  }
  
  const g = getGlobal();
  const isBun = g.Bun !== undefined;
  if (isBun) {
    return 'bun';
  }
  
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    return 'node';
  }
  
  return 'unknown';
}

export function runWithContext<T>(
  context: RequestContext,
  next: () => T | Promise<T>
): T | Promise<T> {
  if (isEdgeRuntime()) {
    const g = getGlobal();
    const previousContext = g.__RENDER_CONTEXT__;
    const previousData = g.__RENDER_DATA__;
    g.__RENDER_CONTEXT__ = context;
    g.__RENDER_DATA__ = new Map();
    
    const cleanup = () => {
      g.__RENDER_CONTEXT__ = previousContext;
      g.__RENDER_DATA__ = previousData;
    };
    
    try {
      const result = next();
      if (result instanceof Promise) {
        return result.finally(cleanup);
      }
      cleanup();
      return result;
    } catch (e) {
      cleanup();
      throw e;
    }
  }
  
  return contextStorage.run(context, next);
}

export function getContext(): RequestContext {
  if (isEdgeRuntime()) {
    const g = getGlobal();
    const ctx = g.__RENDER_CONTEXT__;
    if (!ctx) {
      throw new Error(
        'Context is not available. Make sure you are within a request handler.'
      );
    }
    return ctx;
  }
  
  const ctx = contextStorage.getStore();
  if (!ctx) {
    throw new Error(
      'Context is not available. Make sure to use the context middleware.'
    );
  }
  return ctx;
}

export function getContextData(key?: string): unknown {
  if (isEdgeRuntime()) {
    const g = getGlobal();
    const data = g.__RENDER_DATA__;
    if (!data) return undefined;
    if (key) return data.get(key);
    return Object.fromEntries(data.entries());
  }
  
  const context = contextStorage.getStore();
  if (!context) return undefined;
  if (key) return context.data[key];
  return context.data;
}

export function setContextData(key: string, value: unknown): void {
  if (isEdgeRuntime()) {
    const g = getGlobal();
    const data = g.__RENDER_DATA__;
    if (data) {
      data.set(key, value);
    }
    return;
  }
  
  const context = contextStorage.getStore();
  if (context) {
    context.data[key] = value;
  }
}

export function createEdgeContext(request: Request): RequestContext {
  const url = new URL(request.url);
  
  const cookies: Record<string, string> = {};
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    for (const cookie of cookieHeader.split(';')) {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key) {
        cookies[key] = valueParts.join('=');
      }
    }
  }

  const vercelId = request.headers.get('x-vercel-id');
  const region = vercelId?.split(':')[1] ?? 'unknown';

  return {
    request,
    url,
    cookies,
    headers: request.headers,
    geo: {
      city: request.headers.get('x-vercel-ip-city') ?? undefined,
      country: request.headers.get('x-vercel-ip-country') ?? undefined,
      region: request.headers.get('x-vercel-ip-country-region') ?? undefined,
      latitude: request.headers.get('x-vercel-ip-latitude') ?? undefined,
      longitude: request.headers.get('x-vercel-ip-longitude') ?? undefined,
    },
    ip: request.headers.get('x-real-ip') ?? undefined,
    region,
    nonce: undefined,
    data: {},
  };
}

export function createNonce(): string {
  const array = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 16; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export type {
  RequestContext as EdgeRequestContext,
};
