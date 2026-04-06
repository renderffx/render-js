import { describe, it, expect } from 'vitest';
import {
  joinPath,
  parsePathWithSlug,
  parseExactPath,
  path2regexp,
  getPathMapping,
  pathSpecAsString,
  removeBase,
  addBase,
  extname,
  pathnameToRoutePath,
  encodeRoutePath,
  decodeRoutePath,
  encodeSliceId,
  decodeSliceId,
  stringToStream,
  streamToBase64,
  base64ToStream,
  encodeRscPath,
  decodeRscPath,
  encodeFuncId,
  decodeFuncId,
  createCustomError,
  getErrorInfo,
  unstable_constants,
} from '@renderjs/core';

describe('@render.js/core - Path Utilities', () => {
  describe('joinPath', () => {
    it('joins path segments', () => {
      expect(joinPath('/foo', 'bar')).toBe('/foo/bar');
      expect(joinPath('/foo/', '/bar')).toBe('/foo/bar');
    });

    it('handles empty segments', () => {
      expect(joinPath('/foo', '', 'bar')).toBe('/foo/bar');
      expect(joinPath('', '/foo', 'bar')).toBe('foo/bar');
    });

    it('handles single segment', () => {
      expect(joinPath('/foo')).toBe('/foo');
    });

    it('handles .. correctly', () => {
      expect(joinPath('/foo/bar', '..')).toBe('/foo');
      expect(joinPath('/foo', 'bar', '..')).toBe('/foo');
    });

    it('handles . correctly', () => {
      expect(joinPath('/foo', '.', 'bar')).toBe('/foo/bar');
    });

    it('handles relative paths', () => {
      expect(joinPath('./foo', 'bar')).toBe('./foo/bar');
    });

    it('handles multiple slashes', () => {
      expect(joinPath('/foo//', '//bar')).toBe('/foo/bar');
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

    it('parses wildcard paths', () => {
      const result = parsePathWithSlug('/docs/[...slug]');
      expect(result).toEqual([
        { type: 'literal', name: 'docs' },
        { type: 'group', name: '...slug' },
      ]);
    });

    it('handles root path', () => {
      expect(parsePathWithSlug('/')).toEqual([]);
    });

    it('handles empty param names', () => {
      const result = parsePathWithSlug('/[]');
      expect(result).toEqual([{ type: 'group', name: '' }]);
    });
  });

  describe('parseExactPath', () => {
    it('parses all as literals', () => {
      const result = parseExactPath('/users/[id]');
      expect(result).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'literal', name: '[id]' },
      ]);
    });
  });

  describe('path2regexp', () => {
    it('converts literal paths', () => {
      expect(path2regexp([{ type: 'literal', name: 'users' }])).toBe('^/users$');
    });

    it('converts slug paths', () => {
      expect(path2regexp([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ])).toBe('^/users/([^/]+)$');
    });

    it('converts wildcard paths', () => {
      expect(path2regexp([
        { type: 'literal', name: 'docs' },
        { type: 'group', name: '...slug' },
      ])).toBe('^/docs/(.+)$');
    });
  });

  describe('pathSpecAsString', () => {
    it('converts literal path spec to string', () => {
      const spec = [{ type: 'literal' as const, name: 'users' }];
      expect(pathSpecAsString(spec)).toBe('/users');
    });

    it('converts slug path spec to string', () => {
      const spec = [
        { type: 'literal' as const, name: 'users' },
        { type: 'group' as const, name: 'id' },
      ];
      expect(pathSpecAsString(spec)).toBe('/users/[id]');
    });

    it('converts wildcard path spec to string', () => {
      const spec = [
        { type: 'literal' as const, name: 'docs' },
        { type: 'group' as const, name: '...slug' },
      ];
      expect(pathSpecAsString(spec)).toBe('/docs/[...slug]');
    });
  });

  describe('getPathMapping', () => {
    it('maps simple params', () => {
      const spec = parsePathWithSlug('/users/[id]');
      expect(getPathMapping(spec, '/users/123')).toEqual({ id: '123' });
    });

    it('returns null for non-matching paths', () => {
      const spec = parsePathWithSlug('/users/[id]');
      expect(getPathMapping(spec, '/posts/123')).toBeNull();
    });

    it('handles wildcard params', () => {
      const spec = parsePathWithSlug('/docs/[...slug]');
      expect(getPathMapping(spec, '/docs/a/b/c')).toEqual({ '...slug': ['a', 'b', 'c'] });
    });

    it('handles extra segments', () => {
      const spec = parsePathWithSlug('/users/[id]');
      expect(getPathMapping(spec, '/users/123/extra')).toBeNull();
    });

    it('handles missing segments', () => {
      const spec = parsePathWithSlug('/users/[id]');
      expect(getPathMapping(spec, '/users')).toBeNull();
    });
  });

  describe('extname', () => {
    it('extracts file extension', () => {
      expect(extname('/foo/bar.txt')).toBe('.txt');
      expect(extname('/foo/bar.js')).toBe('.js');
    });

    it('returns empty for no extension', () => {
      expect(extname('/foo/bar')).toBe('');
      expect(extname('/foo/bar/')).toBe('');
    });

    it('handles multiple dots', () => {
      expect(extname('/foo/bar.baz.txt')).toBe('.txt');
    });

    it('handles hidden files', () => {
      expect(extname('/foo/.gitignore')).toBe('');
    });
  });

  describe('removeBase', () => {
    it('removes base path', () => {
      expect(removeBase('/foo/bar', '/foo')).toBe('/bar');
    });

    it('returns original if no match', () => {
      expect(removeBase('/other/bar', '/foo')).toBe('/other/bar');
    });

    it('handles root base', () => {
      expect(removeBase('/bar', '/')).toBe('/bar');
    });
  });

  describe('addBase', () => {
    it('adds base path', () => {
      expect(addBase('/bar', '/foo')).toBe('/foo/bar');
    });

    it('handles root base', () => {
      expect(addBase('/bar', '/')).toBe('/bar');
    });
  });
});

describe('@render.js/core - Router Common', () => {
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

describe('@render.js/core - Stream Utilities', () => {
  describe('stringToStream', () => {
    it('converts string to stream', async () => {
      const stream = stringToStream('Hello World');
      const reader = stream.getReader();
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe('Hello World');
    });
  });

  describe('streamToBase64 / base64ToStream', () => {
    it('converts stream to base64 and back', async () => {
      const original = 'Hello World';
      const stream = stringToStream(original);
      const base64 = await streamToBase64(stream);
      expect(typeof base64).toBe('string');
      
      const decoded = await base64ToStream(base64);
      const reader = decoded.getReader();
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe(original);
    });
  });
});

describe('@render.js/core - RSC Path Utilities', () => {
  describe('encodeRscPath / decodeRscPath', () => {
    it('encodes and decodes RSC paths', () => {
      const encoded = encodeRscPath('/users/123');
      const decoded = decodeRscPath(encoded);
      expect(decoded).toBe('/users/123');
    });

    it('handles special characters', () => {
      const encoded = encodeRscPath('/users/with space');
      const decoded = decodeRscPath(encoded);
      expect(decoded).toBe('/users/with space');
    });
  });

  describe('encodeFuncId / decodeFuncId', () => {
    it('encodes and decodes function IDs', () => {
      const encoded = encodeFuncId('myFunction');
      expect(encoded.startsWith('F:')).toBe(true);
      
      const decoded = decodeFuncId(encoded);
      expect(decoded).toBe('myFunction');
    });

    it('returns null for invalid IDs', () => {
      expect(decodeFuncId('invalid')).toBeNull();
    });
  });
});

describe('@render.js/core - Custom Errors', () => {
  describe('createCustomError', () => {
    it('creates custom error with info', () => {
      const error = createCustomError('Test Error', { status: 404, location: '/not-found' });
      expect(error.message).toBe('Test Error');
      expect((error as any).status).toBe(404);
      expect((error as any).location).toBe('/not-found');
    });
  });

  describe('getErrorInfo', () => {
    it('extracts error info', () => {
      const error = new Error('Test error');
      const info = getErrorInfo(error);
      expect(info).toBeDefined();
    });
  });
});

describe('@render.js/core - Constants', () => {
  it('has all required constants', () => {
    expect(unstable_constants).toBeDefined();
    expect(typeof unstable_constants).toBe('object');
  });
});
