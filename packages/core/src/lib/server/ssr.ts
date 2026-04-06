import React, { createElement, type ReactNode, type ReactElement } from 'react';
import {
  renderToReadableStream as _renderToStream,
  createFromReadableStream,
  decodeReply,
  decodeAction,
  encodeReply,
  createFlightContext,
  destroyFlightContext,
} from '../rsc/streaming.js';
import type { RenderOptions } from '../rsc/streaming.js';

export interface RenderContext {
  request: Request;
  params: Record<string, string>;
  searchParams: URLSearchParams;
  headers: Headers;
  context: Map<string, unknown>;
}

let moduleIdCounter = 0;

function generateModuleId(): string {
  return `mod_${++moduleIdCounter}_${Date.now()}`;
}

export async function renderServerComponent<T extends ReactNode>(
  component: React.ComponentType<Record<string, unknown>> | ((props: Record<string, unknown>) => T),
  props: Record<string, unknown>,
  _context: RenderContext
): Promise<ReactElement> {
  const fn = component as (props: Record<string, unknown>) => Promise<ReactNode> | ReactNode;
  
  try {
    const fnString = String(fn);
    const isAsync = fnString.includes('async') || fnString.includes('AsyncFunction');
    
    let result: ReactNode;
    if (isAsync || fn.constructor.name === 'AsyncFunction') {
      result = await (fn as (props: Record<string, unknown>) => Promise<ReactNode>)(props);
    } else {
      const syncResult = fn(props);
      result = syncResult instanceof Promise ? await syncResult : syncResult;
    }
    
    if (result === null || result === undefined) {
      return createElement('noscript');
    }
    
    if (typeof result === 'string' || typeof result === 'number') {
      return createElement('span', null, String(result));
    }
    
    if (Array.isArray(result)) {
      return createElement(React.Fragment, null, ...result);
    }
    
    if (React.isValidElement(result)) {
      return result as ReactElement;
    }
    
    return createElement('span', null, JSON.stringify(result));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return createElement('div', { 'data-error': 'true' }, `Error: ${message}`);
  }
}

export async function renderToStream(
  element: ReactNode,
  options?: RenderOptions
): Promise<{
  stream: ReadableStream<Uint8Array>;
  waitUntil: Promise<void>;
}> {
  const contextId = generateModuleId();
  
  const waitUntilPromise = Promise.resolve();
  
  try {
    const stream = await _renderToStream(element, {
      ...options,
      contextId,
    });
    
    return {
      stream,
      waitUntil: waitUntilPromise,
    };
  } finally {
    destroyFlightContext(contextId);
  }
}

export async function renderHtmlPage(
  element: ReactNode,
  options?: {
    status?: number;
    headers?: Record<string, string>;
  }
): Promise<Response> {
  const status = options?.status || 200;
  const headers = options?.headers || {};
  
  const { stream } = await renderToStream(element);
  
  const responseHeaders = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  
  return new Response(stream, {
    status,
    headers: responseHeaders,
  });
}

export async function renderRscPayload(
  element: ReactNode
): Promise<Response> {
  const { stream } = await renderToStream(element);
  
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/x-component',
      'X-RSC-Version': '1',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function handleServerAction(
  body: string | FormData,
  _context: RenderContext
): Promise<{
  success: boolean;
  data?: unknown;
  error?: { message: string; stack?: string };
}> {
  try {
    const actionData = await decodeAction(body);
    
    if (!actionData) {
      return {
        success: false,
        error: { message: 'No action found in request' },
      };
    }
    
    const { action, args } = actionData;
    
    if (typeof action !== 'function') {
      return {
        success: false,
        error: { message: 'Invalid action' },
      };
    }
    
    const result = await action(...args);
    
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Action failed',
        stack: error instanceof Error ? error.stack : undefined,
      },
    };
  }
}

export function createServerContext(request: Request): RenderContext {
  const url = new URL(request.url);
  
  return {
    request,
    params: {},
    searchParams: url.searchParams,
    headers: request.headers,
    context: new Map(),
  };
}

export function setServerContextValue<T>(
  ctx: RenderContext,
  key: string,
  value: T
): void {
  ctx.context.set(key, value);
}

export function getServerContextValue<T>(
  ctx: RenderContext,
  key: string
): T | undefined {
  return ctx.context.get(key) as T | undefined;
}

export { 
  createFlightContext, 
  destroyFlightContext,
  _renderToStream as renderToReadableStream,
  createFromReadableStream,
  decodeReply,
  decodeAction,
  encodeReply,
};
