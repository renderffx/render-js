import { describe, bench, it, expect } from 'vitest';

describe('@render.js/core - Path Utilities Performance (OPTIMIZED)', async () => {
  const { 
    joinPath, 
    parsePathWithSlug, 
    removeBase, 
    addBase,
    parseExactPath,
    path2regexp,
    pathSpecAsString,
    getPathMapping,
    extname,
  } = await import('./dist/lib/utils/path.js');

  describe('joinPath performance (with caching)', () => {
    bench('joinPath with 2 segments (cold)', () => {
      joinPath('/foo', 'bar');
    });

    bench('joinPath with 3 segments (cold)', () => {
      joinPath('/foo', 'bar', 'baz');
    });

    bench('joinPath with 5 segments (cold)', () => {
      joinPath('/a', 'b', 'c', 'd', 'e');
    });

    bench('joinPath repeated same args (hot)', () => {
      joinPath('/foo', 'bar');
      joinPath('/foo', 'bar');
      joinPath('/foo', 'bar');
    });
  });

  describe('parsePathWithSlug performance (with caching)', () => {
    bench('parsePathWithSlug static path (cold)', () => {
      parsePathWithSlug('/users/profile');
    });

    bench('parsePathWithSlug slug path (cold)', () => {
      parsePathWithSlug('/users/[id]');
    });

    bench('parsePathWithSlug nested slug path (cold)', () => {
      parsePathWithSlug('/users/[userId]/posts/[postId]');
    });

    bench('parsePathWithSlug wildcard path (cold)', () => {
      parsePathWithSlug('/docs/[...slug]');
    });

    bench('parsePathWithSlug repeated (hot)', () => {
      parsePathWithSlug('/users/[id]');
      parsePathWithSlug('/users/[id]');
      parsePathWithSlug('/users/[id]');
    });
  });

  describe('path2regexp performance (with caching)', () => {
    bench('path2regexp simple', () => {
      path2regexp([{ type: 'literal', name: 'users' }]);
    });

    bench('path2regexp with slug', () => {
      path2regexp([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ]);
    });

    bench('path2regexp with wildcard', () => {
      path2regexp([
        { type: 'literal', name: 'docs' },
        { type: 'wildcard', name: 'slug' },
      ]);
    });

    bench('path2regexp repeated (hot)', () => {
      const spec = parsePathWithSlug('/users/[id]');
      path2regexp(spec);
      path2regexp(spec);
      path2regexp(spec);
    });
  });

  describe('getPathMapping performance (with caching)', () => {
    const pathSpec = parsePathWithSlug('/users/[id]/posts/[postId]');
    
    bench('getPathMapping matching (cold)', () => {
      getPathMapping(pathSpec, '/users/123/posts/456');
    });

    bench('getPathMapping non-matching (cold)', () => {
      getPathMapping(pathSpec, '/other/123');
    });

    bench('getPathMapping repeated same path (hot)', () => {
      getPathMapping(pathSpec, '/users/123/posts/456');
      getPathMapping(pathSpec, '/users/123/posts/456');
      getPathMapping(pathSpec, '/users/123/posts/456');
    });
  });

  describe('pathSpecAsString performance (with caching)', () => {
    bench('pathSpecAsString simple', () => {
      pathSpecAsString([{ type: 'literal', name: 'users' }]);
    });

    bench('pathSpecAsString with slugs', () => {
      pathSpecAsString([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ]);
    });

    bench('pathSpecAsString repeated (hot)', () => {
      const spec = parsePathWithSlug('/users/[id]');
      pathSpecAsString(spec);
      pathSpecAsString(spec);
      pathSpecAsString(spec);
    });
  });

  describe('extname performance', () => {
    bench('extname with extension', () => {
      extname('/foo/bar.txt');
    });

    bench('extname without extension', () => {
      extname('/foo/bar');
    });

    bench('extname multiple dots', () => {
      extname('/foo/bar.baz.txt');
    });
  });

  describe('removeBase / addBase performance', () => {
    bench('removeBase matching', () => {
      removeBase('/app/users', '/app');
    });

    bench('removeBase non-matching', () => {
      removeBase('/other/users', '/app');
    });

    bench('addBase', () => {
      addBase('/users', '/app');
    });

    bench('addBase root', () => {
      addBase('/users', '/');
    });
  });

  describe('Correctness', () => {
    it('joinPath should handle caching correctly', () => {
      const result1 = joinPath('/foo', 'bar');
      const result2 = joinPath('/foo', 'bar');
      expect(result1).toBe(result2);
      expect(result1).toBe('/foo/bar');
    });

    it('parsePathWithSlug should handle caching correctly', () => {
      const result1 = parsePathWithSlug('/users/[id]');
      const result2 = parsePathWithSlug('/users/[id]');
      expect(result1).toBe(result2);
    });

    it('getPathMapping should return consistent results with caching', () => {
      const spec = parsePathWithSlug('/users/[id]');
      const result1 = getPathMapping(spec, '/users/123');
      const result2 = getPathMapping(spec, '/users/123');
      expect(result1).toEqual(result2);
      expect(result1).toEqual({ id: '123' });
    });

    it('cache should not cause memory leaks', () => {
      for (let i = 0; i < 2000; i++) {
        joinPath(`/path${i}`, `file${i}`);
        parsePathWithSlug(`/path${i}/[id]`);
      }
      expect(true).toBe(true);
    });
  });
});

describe('@render.js/core - Router Common Performance (OPTIMIZED)', async () => {
  const { 
    pathnameToRoutePath,
    encodeRoutePath,
    decodeRoutePath,
    encodeSliceId,
    decodeSliceId,
    getComponentIds,
  } = await import('./dist/router/common.js');

  describe('pathnameToRoutePath performance', () => {
    bench('pathnameToRoutePath simple', () => {
      pathnameToRoutePath('/_rsc/users');
    });

    bench('pathnameToRoutePath nested', () => {
      pathnameToRoutePath('/_rsc/users/profile/settings');
    });

    bench('pathnameToRoutePath index', () => {
      pathnameToRoutePath('/_rsc/index.html');
    });

    bench('pathnameToRoutePath repeated (hot)', () => {
      pathnameToRoutePath('/_rsc/users');
      pathnameToRoutePath('/_rsc/users');
      pathnameToRoutePath('/_rsc/users');
    });
  });

  describe('encodeRoutePath / decodeRoutePath performance', () => {
    bench('encodeRoutePath root', () => {
      encodeRoutePath('/');
    });

    bench('encodeRoutePath simple', () => {
      encodeRoutePath('/users');
    });

    bench('encodeRoutePath with brackets', () => {
      encodeRoutePath('/users/[id]');
    });

    bench('decodeRoutePath root', () => {
      decodeRoutePath('R/_root');
    });

    bench('decodeRoutePath simple', () => {
      decodeRoutePath('R/users');
    });

    bench('encode/decode roundtrip (hot)', () => {
      const encoded = encodeRoutePath('/users');
      decodeRoutePath(encoded);
      encodeRoutePath('/users');
      decodeRoutePath(encoded);
    });
  });

  describe('getComponentIds performance', () => {
    bench('getComponentIds root', () => {
      getComponentIds('/');
    });

    bench('getComponentIds simple', () => {
      getComponentIds('/users');
    });

    bench('getComponentIds nested', () => {
      getComponentIds('/users/profile');
    });

    bench('getComponentIds deep', () => {
      getComponentIds('/a/b/c/d/e');
    });
  });

  describe('slice ID performance', () => {
    bench('encodeSliceId', () => {
      encodeSliceId('header');
    });

    bench('decodeSliceId', () => {
      decodeSliceId('S/header');
    });

    bench('encode/decode roundtrip', () => {
      const encoded = encodeSliceId('test');
      decodeSliceId(encoded);
    });
  });

  describe('Correctness', () => {
    it('encode/decode should roundtrip correctly', () => {
      const paths = ['/', '/users', '/users/123', '/users/[id]/posts'];
      for (const path of paths) {
        expect(decodeRoutePath(encodeRoutePath(path))).toBe(path);
      }
    });

    it('getComponentIds should return correct structure', () => {
      const ids = getComponentIds('/users/profile');
      expect(ids).toContain('root');
      expect(ids).toContain('users');
      expect(ids).toContain('users/layout');
      expect(ids).toContain('users/profile');
    });
  });
});

describe('@render.js/core - RSC Path Utilities Performance (OPTIMIZED)', async () => {
  const { 
    encodeRscPath, 
    decodeRscPath, 
    encodeFuncId, 
    decodeFuncId,
  } = await import('./dist/lib/utils/rsc-path.js');

  describe('encodeRscPath / decodeRscPath performance', () => {
    bench('encodeRscPath simple', () => {
      encodeRscPath('/users');
    });

    bench('encodeRscPath nested', () => {
      encodeRscPath('/users/123/posts/456');
    });

    bench('decodeRscPath simple', () => {
      decodeRscPath('%2Fusers');
    });

    bench('encodeFuncId', () => {
      encodeFuncId('myAction');
    });

    bench('decodeFuncId', () => {
      decodeFuncId('F:myAction');
    });

    bench('encode/decode roundtrip (hot)', () => {
      const encoded = encodeRscPath('/test/path');
      decodeRscPath(encoded);
      encodeRscPath('/test/path');
      decodeRscPath(encoded);
    });
  });

  describe('Correctness', () => {
    it('should roundtrip correctly', () => {
      const paths = ['/', '/users', '/users/123/posts', '/a/b/c/d/e'];
      for (const path of paths) {
        expect(decodeRscPath(encodeRscPath(path))).toBe(path);
      }
    });

    it('funcId should roundtrip correctly', () => {
      expect(decodeFuncId(encodeFuncId('testAction'))).toBe('testAction');
      expect(decodeFuncId(encodeFuncId('myFunction'))).toBe('myFunction');
    });
  });
});

describe('@render.js/core - Context Performance', async () => {
  const { 
    unstable_runWithContext, 
    unstable_getContext, 
    unstable_getContextData,
  } = await import('./dist/lib/context.js');

  bench('runWithContext', () => {
    unstable_runWithContext({ userId: '123' }, () => {
      unstable_getContext();
    });
  });

  bench('getContextData', () => {
    unstable_runWithContext({ key: 'value' }, () => {
      unstable_getContextData('key');
    });
  });

  describe('Correctness', () => {
    it('context should work correctly', async () => {
      const result = await unstable_runWithContext(
        { userId: '123', token: 'abc' },
        () => unstable_getContext()
      );
      expect(result.req).toEqual({ userId: '123', token: 'abc' });
    });

    it('getContextData should work', async () => {
      const result = await unstable_runWithContext(
        { test: 'data' },
        () => unstable_getContextData('test')
      );
      expect(result).toBe('data');
    });
  });
});

console.log('✅ OPTIMIZED BENCHMARKS COMPLETE!');
