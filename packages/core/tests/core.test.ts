import { describe, it, expect } from 'vitest';

describe('@render.js/core - Path Utilities', async () => {
  const { 
    joinPath, 
    parsePathWithSlug, 
    removeBase, 
    addBase,
  } = await import('./dist/lib/utils/path.js');

  describe('joinPath', () => {
    it('joins path segments', () => {
      expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
      expect(joinPath('/foo/', '/bar')).toBe('/foo/bar');
    });
  });

  describe('parsePathWithSlug', () => {
    it('parses static paths', () => {
      const result = parsePathWithSlug('/users');
      expect(result).toEqual([{ type: 'literal', name: 'users' }]);
    });

    it('parses slug paths', () => {
      const result = parsePathWithSlug('/users/[id]');
      expect(result).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ]);
    });

    it('parses nested slug paths', () => {
      const result = parsePathWithSlug('/users/[userId]/posts/[postId]');
      expect(result).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'userId' },
        { type: 'literal', name: 'posts' },
        { type: 'group', name: 'postId' },
      ]);
    });
  });

  describe('removeBase', () => {
    it('removes base path', () => {
      expect(removeBase('/foo/bar', '/foo')).toBe('/bar');
    });
  });

  describe('addBase', () => {
    it('adds base path', () => {
      expect(addBase('/bar', '/foo')).toBe('/foo/bar');
    });
  });
});

describe('@render.js/core - Router Common', async () => {
  const {
    pathnameToRoutePath,
    encodeRoutePath,
    decodeRoutePath,
    encodeSliceId,
    decodeSliceId,
  } = await import('./dist/router/common.js');

  describe('pathnameToRoutePath', () => {
    it('converts pathname to route path', () => {
      expect(pathnameToRoutePath('/_rsc/home')).toBe('/home');
      expect(pathnameToRoutePath('/_rsc')).toBe('/');
    });
  });

  describe('encodeRoutePath / decodeRoutePath', () => {
    it('encodes and decodes route path', () => {
      const encoded = encodeRoutePath('/users/[id]');
      const decoded = decodeRoutePath(encoded);
      expect(decoded).toBe('/users/[id]');
    });
  });

  describe('encodeSliceId / decodeSliceId', () => {
    it('encodes and decodes slice id', () => {
      const encoded = encodeSliceId('main');
      const decoded = decodeSliceId(encoded);
      expect(decoded).toBe('main');
    });
  });
});

describe('@render.js/core - Stream Utilities', async () => {
  const {
    stringToStream,
    streamToBase64,
    base64ToStream,
  } = await import('./dist/lib/utils/stream.js');

  describe('stringToStream', () => {
    it('converts string to stream', async () => {
      const stream = stringToStream('Hello World');
      const reader = stream.getReader();
      const { value } = await reader.read();
      const decoder = new TextDecoder();
      expect(decoder.decode(value)).toBe('Hello World');
    });
  });

  describe('streamToBase64 / base64ToStream', () => {
    it('converts stream to base64 and back', async () => {
      const original = 'Test content';
      const stream = stringToStream(original);
      const base64 = await streamToBase64(stream);
      const decodedStream = base64ToStream(base64);
      const reader = decodedStream.getReader();
      const { value } = await reader.read();
      const decoder = new TextDecoder();
      expect(decoder.decode(value)).toBe(original);
    });
  });
});

describe('@render.js/core - RSC Path Utilities', async () => {
  const {
    encodeRscPath,
    decodeRscPath,
    encodeFuncId,
    decodeFuncId,
  } = await import('./dist/lib/utils/rsc-path.js');

  describe('encodeRscPath / decodeRscPath', () => {
    it('encodes and decodes RSC paths', () => {
      const encoded = encodeRscPath('/users/123');
      const decoded = decodeRscPath(encoded);
      expect(decoded).toBe('/users/123');
    });
  });

  describe('encodeFuncId / decodeFuncId', () => {
    it('encodes and decodes function IDs', () => {
      const encoded = encodeFuncId('myAction');
      const decoded = decodeFuncId(encoded);
      expect(decoded).toBe('myAction');
    });
  });
});

describe('@render.js/core - Custom Errors', async () => {
  const {
    createCustomError,
    getErrorInfo,
  } = await import('./dist/lib/utils/custom-errors.js');

  describe('createCustomError', () => {
    it('creates custom error with info', () => {
      const error = createCustomError('Test error', { status: 404 });
      expect(error.message).toBe('Test error');
      expect((error as any).status).toBe(404);
    });
  });

  describe('getErrorInfo', () => {
    it('extracts error info', () => {
      const error = createCustomError('Test', { status: 500 });
      const info = getErrorInfo(error);
      expect(info.message).toBe('Test');
      expect(info.status).toBe(500);
    });
  });
});

describe('@render.js/core - Constants', async () => {
  const { unstable_constants } = await import('./dist/lib/constants.js');

  describe('unstable_constants', () => {
    it('has all required constants', () => {
      expect(unstable_constants.DIST_PUBLIC).toBe('_rsc');
      expect(unstable_constants.ENTRY_JSON).toBe('entry.json');
      expect(unstable_constants.SERVER_BUNDLE).toBe('bundle.js');
      expect(unstable_constants.RSC_PATH).toBe('_rsc');
      expect(unstable_constants.HTML_PATH).toBe('index.html');
    });
  });
});
