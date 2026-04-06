import React, { createElement, type ReactNode, type ReactElement } from 'react';

export interface RenderOptions {
  readonly?: boolean;
  context?: Map<string, unknown>;
  signal?: AbortSignal;
  onError?: (error: Error) => string | void;
  onShellError?: (error: unknown) => void;
  onAllReady?: (callback: () => void) => void;
}

export interface RSCStreamChunk {
  type: 'jsx' | 'binary' | 'error' | 'end' | 'reference' | 'module';
  data: unknown;
  reference?: { id: string; name?: string; chunks?: string[] };
}

const FLIGHT_CHUNK_SEPARATOR = '\n';
const FLIGHT_END = '[RSC_END]';
const FLIGHT_ERROR_PREFIX = '[RSC_ERROR:';
const FLIGHT_REFERENCE_PREFIX = '$';

let moduleIdCounter = 0;

function generateModuleId(): string {
  return `m${++moduleIdCounter}`;
}

interface ComponentReference {
  id: string;
  name: string;
  props?: Record<string, unknown>;
}

interface FlightContext {
  references: Map<string, ComponentReference>;
  moduleRefs: Map<string, string>;
  asyncComponents: Map<string, Promise<unknown>>;
  __contextId: string;
}

const flightContextStorage = new Map<string, FlightContext>();

export function createFlightContext(): FlightContext {
  const id = generateModuleId();
  const ctx: FlightContext = {
    references: new Map(),
    moduleRefs: new Map(),
    asyncComponents: new Map(),
    __contextId: id,
  };
  flightContextStorage.set(id, ctx);
  return ctx;
}

export function getFlightContext(id: string): FlightContext | undefined {
  return flightContextStorage.get(id);
}

export function destroyFlightContext(id: string): void {
  flightContextStorage.delete(id);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === 'object' && value !== null && 'then' in value && typeof (value as PromiseLike<unknown>).then === 'function';
}

interface RenderedElement {
  type: string;
  props: Record<string, unknown> | null;
  text?: string;
  reference?: { id: string; name: string };
  children?: RenderedElement[];
}

async function resolveValue(value: unknown): Promise<unknown> {
  if (isPromiseLike(value)) {
    return value;
  }
  if (typeof value === 'function') {
    return value;
  }
  return value;
}

async function renderElement(
  element: unknown,
  ctx: FlightContext
): Promise<RenderedElement> {
  if (element === null || element === undefined) {
    return { type: 'null', props: null };
  }
  
  if (typeof element === 'string') {
    return { type: 'text', props: null, text: element };
  }
  
  if (typeof element === 'number') {
    return { type: 'text', props: null, text: String(element) };
  }
  
  if (typeof element === 'boolean') {
    return { type: 'null', props: null };
  }
  
  if (Array.isArray(element)) {
    const children = await Promise.all(
      element.map((item) => renderElement(item, ctx))
    );
    return { type: 'fragment', props: null, children };
  }
  
  if (typeof element === 'object') {
    const obj = element as Record<string, unknown>;
    
    if ('$$typeof' in obj && 'ref' in obj) {
      return await renderReactElement(obj as unknown as ReactElement, ctx);
    }
    
    if (isPromiseLike(element)) {
      const resolved = await element;
      return renderElement(resolved, ctx);
    }
    
    const renderedProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      renderedProps[key] = await resolveValue(value);
    }
    
    return { type: 'object', props: renderedProps };
  }
  
  if (typeof element === 'function') {
    const fn = element as (...args: unknown[]) => unknown;
    const name = fn.name || 'Anonymous';
    const refId = `${FLIGHT_REFERENCE_PREFIX}${name}`;
    ctx.references.set(refId, { id: refId, name });
    return { type: 'reference', props: null, reference: { id: refId, name } };
  }
  
  return { type: 'text', props: null, text: String(element) };
}

async function renderReactElement(
  element: ReactElement,
  ctx: FlightContext
): Promise<RenderedElement> {
  const { type, props } = element;
  
  const renderedType = typeof type === 'string' ? type : (type as { name?: string }).name || 'Component';
  const refId = typeof type === 'string' ? renderedType : `${FLIGHT_REFERENCE_PREFIX}${renderedType}`;
  
  if (typeof type !== 'string') {
    ctx.references.set(refId, { id: refId, name: renderedType });
  }
  
  let renderedOutput: unknown;
  
  if (typeof type === 'function') {
    try {
      const Component = type as (props: Record<string, unknown>) => ReactNode;
      const componentProps = (props || {}) as Record<string, unknown>;
      let result = Component(componentProps);
      
      if (isPromiseLike(result)) {
        result = await result;
      }
      
      renderedOutput = result;
    } catch (error) {
      renderedOutput = createElement('div', { 'data-error': 'true' }, 
        error instanceof Error ? error.message : 'Component error'
      );
    }
  } else {
    renderedOutput = element;
  }
  
  if (renderedOutput === null || renderedOutput === undefined) {
    return { type: 'null', props: null };
  }
  
  if (typeof renderedOutput === 'string') {
    return { type: 'text', props: null, text: renderedOutput };
  }
  
  if (typeof renderedOutput === 'number') {
    return { type: 'text', props: null, text: String(renderedOutput) };
  }
  
  if (Array.isArray(renderedOutput)) {
    const children = await Promise.all(
      renderedOutput.map((item) => renderElement(item, ctx))
    );
    return { type: 'fragment', props: null, children };
  }
  
  if (React.isValidElement(renderedOutput)) {
    return renderReactElement(renderedOutput as ReactElement, ctx);
  }
  
  return { type: 'text', props: null, text: String(renderedOutput) };
}

async function serializeToFlightChunks(
  rendered: RenderedElement,
  ctx: FlightContext
): Promise<RSCStreamChunk[]> {
  const chunks: RSCStreamChunk[] = [];
  
  function serialize(elem: RenderedElement): unknown {
    if (elem.type === 'null') {
      return null;
    }
    
    if (elem.type === 'text') {
      return elem.text;
    }
    
    if (elem.type === 'reference') {
      return { [FLIGHT_REFERENCE_PREFIX]: elem.reference?.id };
    }
    
    if (elem.type === 'fragment') {
      return elem.children?.map(serialize);
    }
    
    if (elem.type === 'object') {
      return elem.props;
    }
    
    const component: Record<string, unknown> = {
      type: elem.type,
    };
    
    if (elem.props) {
      for (const [key, value] of Object.entries(elem.props)) {
        component[key] = serializeValue(value);
      }
    }
    
    if (elem.children) {
      if (elem.children.length === 1) {
        component.children = serialize(elem.children[0]);
      } else {
        component.children = elem.children.map(serialize);
      }
    }
    
    return component;
  }
  
  function serializeValue(value: unknown): unknown {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    
    if (Array.isArray(value)) {
      return value.map(serializeValue);
    }
    
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      
      if (FLIGHT_REFERENCE_PREFIX in obj) {
        return obj;
      }
      
      if ('$$typeof' in obj) {
        return serializeValue(serialize({ type: 'element', props: obj } as unknown as RenderedElement));
      }
      
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(obj)) {
        result[key] = serializeValue(val);
      }
      return result;
    }
    
    return String(value);
  }
  
  const serialized = serialize(rendered);
  chunks.push({ type: 'jsx', data: serialized });
  
  for (const [, ref] of ctx.references) {
    chunks.push({
      type: 'reference',
      data: { id: ref.id, name: ref.name },
      reference: { id: ref.id, name: ref.name },
    });
  }
  
  return chunks;
}

export async function renderToReadableStream<T>(
  element: T,
  options?: RenderOptions & { contextId?: string }
): Promise<ReadableStream<Uint8Array>> {
  const contextId = options?.contextId || generateModuleId();
  const ctx = createFlightContext();
  
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  
  try {
    if (options?.signal) {
      const abortHandler = () => {
        throw new Error('Render aborted');
      };
      options.signal.addEventListener('abort', abortHandler);
    }
    
    const rendered = await renderElement(element, ctx);
    const flightChunks = await serializeToFlightChunks(rendered, ctx);
    
    for (const chunk of flightChunks) {
      chunks.push(encoder.encode(JSON.stringify(chunk)));
      chunks.push(encoder.encode(FLIGHT_CHUNK_SEPARATOR));
    }
    
    chunks.push(encoder.encode(FLIGHT_END));
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    
    const errorChunk: RSCStreamChunk = {
      type: 'error',
      data: { message, stack, name: error instanceof Error ? error.name : 'Error' },
    };
    chunks.push(encoder.encode(FLIGHT_ERROR_PREFIX));
    chunks.push(encoder.encode(JSON.stringify(errorChunk)));
    chunks.push(encoder.encode(']'));
    chunks.push(encoder.encode(FLIGHT_CHUNK_SEPARATOR));
    chunks.push(encoder.encode(FLIGHT_END));
  }
  
  destroyFlightContext(contextId);
  
  let sent = false;
  
  return new ReadableStream({
    start() {
      if (options?.onShellError) {
        try {
          void 0;
        } catch (e) {
          options.onShellError(e);
        }
      }
    },
    pull(controller) {
      if (!sent) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        sent = true;
      }
      controller.close();
    },
    cancel() {
      destroyFlightContext(contextId);
    },
  });
}

export interface FromReadableStreamOptions {
  readonly?: boolean;
  context?: Map<string, unknown>;
  contextId?: string;
}

export function createFromReadableStream(
  stream: ReadableStream<Uint8Array>,
  options?: FromReadableStreamOptions
): { 
  stream: ReadableStream<Uint8Array>;
  contextId: string;
  close: () => void;
} {
  const contextId = options?.contextId || generateModuleId();
  
  return {
    stream,
    contextId,
    close: () => {
      destroyFlightContext(contextId);
    },
  };
}

export async function decodeReply<T>(
  body: string | FormData
): Promise<T> {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as T;
    } catch {
      return body as unknown as T;
    }
  }
  
  const formData = body as FormData;
  const entry = formData.get('0');
  if (typeof entry === 'string') {
    try {
      return JSON.parse(entry) as T;
    } catch {
      return entry as unknown as T;
    }
  }
  
  const rscData = formData.get('_rsc');
  if (typeof rscData === 'string') {
    try {
      return JSON.parse(rscData) as T;
    } catch {
      return rscData as unknown as T;
    }
  }
  
  return {} as T;
}

export async function decodeAction<T = unknown>(
  body: string | FormData
): Promise<{ action: T; args: unknown[] } | null> {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === 'object' && 'action' in parsed) {
        return parsed as { action: T; args: unknown[] };
      }
      if (parsed && typeof parsed === 'object' && 'args' in parsed) {
        return { action: parsed as T, args: parsed.args || [] };
      }
    } catch {
      return null;
    }
    return null;
  }
  
  const formData = body as FormData;
  const actionData = formData.get('_action');
  if (typeof actionData === 'string') {
    try {
      const parsed = JSON.parse(actionData);
      return {
        action: parsed.action || parsed,
        args: parsed.args || [],
      };
    } catch {
      return null;
    }
  }
  
  return null;
}

export function createTemporaryReferenceSet(options?: { readonly?: boolean }): {
  readonly: boolean;
  refs: Map<string, unknown>;
  add: (id: string, value: unknown) => void;
  get: (id: string) => unknown | undefined;
  has: (id: string) => boolean;
  clear: () => void;
} {
  return {
    readonly: options?.readonly ?? false,
    refs: new Map(),
    add(id: string, value: unknown) { this.refs.set(id, value); },
    get(id: string) { return this.refs.get(id); },
    has(id: string) { return this.refs.has(id); },
    clear() { this.refs.clear(); },
  };
}

export async function encodeReply(args: unknown[]): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const data = JSON.stringify({ args });
  
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(data));
      controller.close();
    },
  });
}
