import { AsyncLocalStorage } from 'node:async_hooks';

export const FLIGHT_CHUNK_SEPARATOR = '\n';
export const FLIGHT_ERROR_PREFIX = '[RSC_ERROR:';
export const FLIGHT_END = '[RSC_END]';
export const FLIGHT_BINARY_PREFIX = '[BINARY:';
export const FLIGHT_REFERENCE_PREFIX = '$';

export interface FlightReference {
  id: string;
  name?: string;
}

export interface FlightChunk {
  type: 'jsx' | 'binary' | 'error' | 'end' | 'reference';
  data: unknown;
  reference?: FlightReference;
}

export interface SerializedValue {
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'bigint' | 'symbol' | 'object' | 'array' | 'binary' | 'reference' | 'circular';
  value: unknown;
  refId?: string;
  path?: string[];
}

interface ReferenceContext {
  referenceMap: Map<unknown, number>;
  reverseReferenceMap: Map<number, string>;
  refCounter: number;
}

const referenceStorage = new AsyncLocalStorage<ReferenceContext>();

function createReferenceContext(): ReferenceContext {
  return {
    referenceMap: new Map(),
    reverseReferenceMap: new Map(),
    refCounter: 0,
  };
}

export function runWithReferenceContext<T>(fn: () => T): T {
  const context = createReferenceContext();
  return referenceStorage.run(context, fn);
}

function getReferenceContext(): ReferenceContext {
  const context = referenceStorage.getStore();
  if (!context) {
    return createReferenceContext();
  }
  return context;
}

function getReferenceId(obj: unknown): string | null {
  if (typeof obj !== 'object' || obj === null) {
    return null;
  }
  
  try {
    const ctx = getReferenceContext();
    const id = ctx.referenceMap.get(obj);
    if (id !== undefined) {
      return `$${id}`;
    }
    
    const newId = ctx.refCounter++;
    ctx.referenceMap.set(obj, newId);
    ctx.reverseReferenceMap.set(newId, '');
    
    return `$${newId}`;
  } catch {
    return null;
  }
}

export function serializeValue(value: unknown, path: string[] = []): SerializedValue {
  if (value === null) {
    return { type: 'null', value: null };
  }
  
  if (value === undefined) {
    return { type: 'undefined', value: undefined };
  }
  
  if (typeof value === 'string') {
    return { type: 'string', value };
  }
  
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return { type: 'string', value: String(value) };
    }
    return { type: 'number', value };
  }
  
  if (typeof value === 'boolean') {
    return { type: 'boolean', value };
  }
  
  if (typeof value === 'bigint') {
    return { type: 'bigint', value: value.toString() };
  }
  
  if (typeof value === 'symbol') {
    const symId = Symbol.keyFor(value as symbol) || (value as symbol).toString();
    return { type: 'symbol', value: symId };
  }
  
  if (value instanceof Uint8Array || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const binaryValue = value instanceof Uint8Array ? value : new Uint8Array(value as ArrayBuffer);
    const refId = getReferenceId(binaryValue);
    
    if (refId) {
      const ctx = getReferenceContext();
      ctx.reverseReferenceMap.set(parseInt(refId.slice(1)), 'binary');
      return { type: 'binary', value: arrayToBase64(binaryValue), refId, path };
    }
  }
  
  if (typeof value === 'object') {
    const refId = getReferenceId(value);
    
    if (refId) {
      const ctx = getReferenceContext();
      const existingRef = ctx.referenceMap.get(value);
      
      if (existingRef !== undefined && ctx.reverseReferenceMap.has(existingRef)) {
        return { type: 'reference', value: refId, refId, path };
      }
      
      const id = parseInt(refId.slice(1));
      const isArray = Array.isArray(value);
      
      ctx.reverseReferenceMap.set(id, isArray ? 'array' : 'object');
      
      if (isArray) {
        const items = (value as unknown[]).map((item, i) => 
          serializeValue(item, [...path, String(i)])
        );
        return { type: 'array', value: items, refId, path };
      }
      
      const entries: [string, SerializedValue][] = [];
      for (const key of Object.keys(value as Record<string, unknown>)) {
        entries.push([key, serializeValue((value as Record<string, unknown>)[key], [...path, key])]);
      }
      return { type: 'object', value: entries, refId, path };
    }
  }
  
  if (typeof value === 'function') {
    return { type: 'string', value: `[Function: ${(value as { name?: string }).name || 'anonymous'}]` };
  }
  
  return { type: 'string', value: String(value) };
}

export function deserializeValue(serialized: SerializedValue): unknown {
  switch (serialized.type) {
    case 'null':
    case 'undefined':
      return serialized.value;
    
    case 'string':
    case 'number':
    case 'boolean':
      return serialized.value;
    
    case 'bigint':
      return BigInt(serialized.value as string);
    
    case 'symbol':
      return Symbol.for(serialized.value as string) || Symbol(serialized.value as string);
    
    case 'binary':
      return base64ToUint8Array(serialized.value as string);
    
    case 'reference':
      return serialized.refId;
    
    case 'array':
      return (serialized.value as SerializedValue[]).map(deserializeValue);
    
    case 'object': {
      const obj: Record<string, unknown> = {};
      for (const [key, val] of serialized.value as [string, SerializedValue][]) {
        obj[key] = deserializeValue(val);
      }
      return obj;
    }
    
    default:
      return serialized.value;
  }
}

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function arrayToBase64(array: Uint8Array): string {
  let result = '';
  const len = array.length;
  
  for (let i = 0; i < len; i += 3) {
    const a = array[i];
    const b = i + 1 < len ? array[i + 1] : 0;
    const c = i + 2 < len ? array[i + 2] : 0;
    
    result += base64Chars[a >> 2];
    result += base64Chars[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < len ? base64Chars[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < len ? base64Chars[c & 63] : '=';
  }
  
  return result;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.replace(/=/g, '');
  const len = cleanBase64.length;
  const bytes = new Uint8Array((len * 3) >> 2);
  
  for (let i = 0, j = 0; i < len; i += 4) {
    const a = base64Chars.indexOf(cleanBase64[i]);
    const b = base64Chars.indexOf(cleanBase64[i + 1]);
    const c = base64Chars.indexOf(cleanBase64[i + 2]);
    const d = base64Chars.indexOf(cleanBase64[i + 3]);
    
    const chunk = (a << 18) | (b << 12) | (c << 6) | d;
    
    bytes[j++] = (chunk >> 16) & 255;
    if (i + 2 < len) bytes[j++] = (chunk >> 8) & 255;
    if (i + 3 < len) bytes[j++] = chunk & 255;
  }
  
  return bytes.slice(0, Math.ceil(len * 0.75));
}

export interface FlightEncoderOptions {
  readonly?: boolean;
  context?: Map<string, unknown>;
}

const encoder = new TextEncoder();

export function createFlightEncoder(options: FlightEncoderOptions = {}) {
  const ctx = createReferenceContext();
  
  function encode(value: unknown): Uint8Array[] {
    return referenceStorage.run(ctx, () => {
      const serialized = serializeValue(value);
      return [encoder.encode(JSON.stringify(serialized))];
    });
  }
  
  function encodeChunk(chunk: FlightChunk): Uint8Array[] {
    return [encoder.encode(JSON.stringify(chunk) + FLIGHT_CHUNK_SEPARATOR)];
  }
  
  function encodeError(error: Error): Uint8Array[] {
    const flightChunk: FlightChunk = {
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    };
    return encodeChunk(flightChunk);
  }
  
  function encodeEnd(): Uint8Array[] {
    return [encoder.encode(FLIGHT_END)];
  }
  
  function encodeReference(id: string, name?: string): Uint8Array[] {
    const ref: FlightReference = { id, name };
    const flightChunk: FlightChunk = {
      type: 'reference',
      data: ref,
      reference: ref,
    };
    return encodeChunk(flightChunk);
  }
  
  function toUint8Array(chunks: Uint8Array[]): Uint8Array {
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    
    return result;
  }
  
  return {
    encode,
    encodeChunk,
    encodeError,
    encodeEnd,
    encodeReference,
    toUint8Array,
  };
}

export function createFlightDecoder() {
  const decoder = new TextDecoder();
  
  function decode(data: Uint8Array): FlightChunk | null {
    try {
      const json = decoder.decode(data);
      const trimmed = json.trim();
      if (trimmed === FLIGHT_END) {
        return { type: 'end', data: null };
      }
      if (trimmed.startsWith(FLIGHT_ERROR_PREFIX)) {
        const errorJson = trimmed.slice(FLIGHT_ERROR_PREFIX.length, -1);
        try {
          const error = JSON.parse(errorJson);
          return { type: 'error', data: error };
        } catch {
          return { type: 'error', data: { message: errorJson } };
        }
      }
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  
  function decodeValue(data: Uint8Array): unknown {
    try {
      const json = decoder.decode(data);
      const serialized = JSON.parse(json);
      return deserializeValue(serialized);
    } catch {
      return null;
    }
  }
  
  async function* decodeStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<FlightChunk> {
    const reader = stream.getReader();
    let buffer = '';
    const localEncoder = new TextEncoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          if (buffer.length > 0) {
            const chunk = decode(localEncoder.encode(buffer));
            if (chunk) yield chunk;
          }
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split(FLIGHT_CHUNK_SEPARATOR);
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.length > 0) {
            const chunk = decode(localEncoder.encode(line));
            if (chunk) {
              yield chunk;
              if (chunk.type === 'end') {
                return;
              }
            }
          }
        }
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }
  }
  
  return {
    decode,
    decodeValue,
    decodeStream,
  };
}

export { encoder };

export function createFlightStreamEncoder() {
  const ctx = createReferenceContext();
  
  return {
    *encode(value: unknown): Generator<Uint8Array> {
      const serialized = serializeValue(value);
      yield encoder.encode(JSON.stringify(serialized));
    },
    
    *encodeChunks(chunks: FlightChunk[]): Generator<Uint8Array> {
      for (const chunk of chunks) {
        yield encoder.encode(JSON.stringify(chunk) + FLIGHT_CHUNK_SEPARATOR);
      }
    },
    
    encodeError(error: Error): Uint8Array[] {
      return createFlightEncoder().encodeError(error);
    },
    
    reset() {
      ctx.referenceMap.clear();
      ctx.reverseReferenceMap.clear();
      ctx.refCounter = 0;
    },
  };
}

export function resetReferenceTracking(): void {
  // No-op for backwards compatibility - now request-scoped
}
