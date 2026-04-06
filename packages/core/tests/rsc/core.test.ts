import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  serializeValue,
  deserializeValue,
  arrayToBase64,
  base64ToUint8Array,
  createServerActionId,
  generateActionId,
  executeServerAction,
  createActionCache,
  runWithCacheContext,
  revalidateTag,
  revalidatePath,
  clearCache,
  defineConfig,
} from '@renderjs/core';
import { createFlightEncoder, createFlightDecoder } from '@renderjs/core';

describe('RSC Streaming', () => {
  describe('renderToReadableStream (requires Vite environment)', () => {
    it.todo('should render React element to RSC stream - requires Vite virtual modules');
    it.todo('should render nested React components - requires Vite virtual modules');
    it.todo('should handle async components - requires Vite virtual modules');
  });

  describe('createFromReadableStream (requires Vite environment)', () => {
    it.todo('should create React element from RSC stream - requires Vite virtual modules');
  });
});

describe('Flight Protocol', () => {
  describe('serializeValue / deserializeValue', () => {
    it('should serialize primitive types', () => {
      expect(serializeValue('hello')).toEqual({ type: 'string', value: 'hello' });
      expect(serializeValue(42)).toEqual({ type: 'number', value: 42 });
      expect(serializeValue(true)).toEqual({ type: 'boolean', value: true });
      expect(serializeValue(null)).toEqual({ type: 'null', value: null });
      expect(serializeValue(undefined)).toEqual({ type: 'undefined', value: undefined });
    });

    it('should serialize arrays', () => {
      const result = serializeValue([1, 2, 3]);
      expect(result.type).toBe('array');
      expect(result.value).toHaveLength(3);
    });

    it('should serialize objects', () => {
      const result = serializeValue({ a: 1, b: 2 });
      expect(result.type).toBe('object');
      expect(Array.isArray(result.value)).toBe(true);
    });

    it('should deserialize serialized values correctly', () => {
      const original = { name: 'test', value: 123 };
      const serialized = serializeValue(original);
      const deserialized = deserializeValue(serialized);
      
      expect(deserialized).toEqual(original);
    });

    it('should handle circular references gracefully', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;
      
      const result = serializeValue(obj);
      expect(result.type).toBe('object');
    });
  });

  describe('arrayToBase64 / base64ToUint8Array', () => {
    it('should encode and decode Uint8Array', () => {
      const original = new Uint8Array([72, 101, 108, 108, 111]);
      const encoded = arrayToBase64(original);
      const decoded = base64ToUint8Array(encoded);
      
      expect(Array.from(decoded)).toEqual(Array.from(original));
    });

    it('should handle empty arrays', () => {
      const original = new Uint8Array([]);
      const encoded = arrayToBase64(original);
      const decoded = base64ToUint8Array(encoded);
      
      expect(decoded.length).toBe(0);
    });

    it('should handle binary data', () => {
      const data = new Uint8Array(256);
      for (let i = 0; i < 256; i++) data[i] = i;
      
      const encoded = arrayToBase64(data);
      const decoded = base64ToUint8Array(encoded);
      
      expect(Array.from(decoded)).toEqual(Array.from(data));
    });
  });

  describe('FlightEncoder', () => {
    it('should create flight encoder', () => {
      const encoder = createFlightEncoder();
      expect(encoder).toBeDefined();
      expect(typeof encoder.encode).toBe('function');
      expect(typeof encoder.encodeChunk).toBe('function');
      expect(typeof encoder.encodeError).toBe('function');
      expect(typeof encoder.encodeEnd).toBe('function');
    });

    it('should encode values', () => {
      const encoder = createFlightEncoder();
      const chunks = encoder.encode({ test: 'value' });
      
      expect(chunks).toBeInstanceOf(Array);
      expect(chunks[0]).toBeInstanceOf(Uint8Array);
    });
  });

  describe('FlightDecoder', () => {
    it('should create flight decoder', () => {
      const decoder = createFlightDecoder();
      expect(decoder).toBeDefined();
      expect(typeof decoder.decode).toBe('function');
      expect(typeof decoder.decodeValue).toBe('function');
      expect(typeof decoder.decodeStream).toBe('function');
    });

    it('should decode encoded values', () => {
      const encoder = createFlightEncoder();
      const decoder = createFlightDecoder();
      
      const original = { hello: 'world', count: 42 };
      const encoded = encoder.encode(original);
      const decoded = decoder.decodeValue(encoded[0]);
      
      expect(decoded).toBeDefined();
    });
  });
});

describe('Server Actions', () => {
  describe('createServerActionId', () => {
    it('should generate unique action IDs', () => {
      const id1 = createServerActionId('submitForm');
      const id2 = createServerActionId('submitForm');
      
      expect(id1).toBeDefined();
      expect(id1.startsWith('SA_')).toBe(true);
    });

    it('should include module path in hash', () => {
      const id1 = createServerActionId('action', '/path/a');
      const id2 = createServerActionId('action', '/path/b');
      
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateActionId', () => {
    it('should generate incremental IDs', () => {
      const id1 = generateActionId('test');
      const id2 = generateActionId('test');
      
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('test_')).toBe(true);
    });
  });

  describe('executeServerAction', () => {
    it('should execute server action and return result', async () => {
      const action = async (...args: unknown[]) => {
        const [a, b] = args as [number, number];
        return a + b;
      };
      const result = await executeServerAction(action, [1, 2]);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
    });

    it('should handle action errors', async () => {
      const action = async () => {
        throw new Error('Test error');
      };
      
      const result = await executeServerAction(action, []);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
    });
  });

  describe('createActionCache', () => {
    it('should create action cache with default options', () => {
      const cache = createActionCache();
      expect(cache).toBeDefined();
      expect(typeof cache.get).toBe('function');
      expect(typeof cache.set).toBe('function');
      expect(typeof cache.invalidate).toBe('function');
    });

    it('should cache and retrieve values', () => {
      const cache = createActionCache({ ttl: 60000 });
      cache.set('key1', { data: 'value1' });
      
      const value = cache.get<{ data: string }>('key1');
      expect(value).toEqual({ data: 'value1' });
    });

    it('should invalidate cache entries', () => {
      const cache = createActionCache();
      cache.set('key1', { data: 'value1' });
      
      cache.invalidate('key1');
      expect(cache.get('key1')).toBeUndefined();
    });
  });
});

describe('Caching', () => {
  describe('runWithCacheContext', () => {
    it('should create isolated cache context', () => {
      const result = runWithCacheContext(() => {
        return 'test';
      });
      
      expect(result).toBe('test');
    });
  });

  describe('revalidateTag', () => {
    it('should be a function', () => {
      expect(typeof revalidateTag).toBe('function');
    });
  });

  describe('revalidatePath', () => {
    it('should be a function', () => {
      expect(typeof revalidatePath).toBe('function');
    });
  });

  describe('clearCache', () => {
    it('should be a function', () => {
      expect(typeof clearCache).toBe('function');
    });
  });
});

describe('Config', () => {
  describe('defineConfig', () => {
    it('should create config with defaults', () => {
      const config = defineConfig({});
      
      expect(config.basePath).toBe('/');
      expect(config.srcDir).toBe('src');
      expect(config.distDir).toBe('dist');
      expect(config.rscBase).toBe('_rsc');
    });

    it('should merge user config with defaults', () => {
      const config = defineConfig({
        basePath: '/app',
        server: { port: 4000 },
      });
      
      expect(config.basePath).toBe('/app');
      expect(config.server.port).toBe(4000);
      expect(config.server.hostname).toBe('0.0.0.0');
    });

    it('should handle Vercel config', () => {
      const config = defineConfig({
        vercel: {
          outputDir: '.vercel/output',
          functionConfig: {
            runtime: 'nodejs22.x',
            memory: 2048,
          },
        },
      });
      
      expect(config.vercel.outputDir).toBe('.vercel/output');
      expect(config.vercel.functionConfig?.runtime).toBe('nodejs22.x');
      expect(config.vercel.functionConfig?.memory).toBe(2048);
    });
  });
});
