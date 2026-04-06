import { describe, it, expect } from 'vitest';
import { defineConfig } from '../src/config.js';
import { createPages } from '../src/router/create-pages.js';
import { joinPath, parsePathWithSlug } from '../src/lib/utils/path.js';
import { encodeRoutePath, decodeRoutePath } from '../src/router/common.js';

describe('@render.js/core - Core Exports', () => {
  describe('Config', () => {
    it('defineConfig is a function', () => {
      expect(typeof defineConfig).toBe('function');
    });

    it('defineConfig returns config object', () => {
      const config = defineConfig({
        basePath: '/',
        srcDir: 'src',
        distDir: 'dist',
      });
      expect(config.basePath).toBe('/');
      expect(config.srcDir).toBe('src');
      expect(config.distDir).toBe('dist');
    });
  });

  describe('Router Exports', () => {
    it('createPages is a function', () => {
      expect(typeof createPages).toBe('function');
    });
  });

  describe('Route Path Encoding', () => {
    it('encodeRoutePath encodes root path', () => {
      expect(encodeRoutePath('/')).toBe('R/_root');
    });

    it('encodeRoutePath encodes normal paths', () => {
      expect(encodeRoutePath('/about')).toBe('R/about');
      expect(encodeRoutePath('/users/123')).toBe('R/users/123');
    });

    it('decodeRoutePath decodes root path', () => {
      expect(decodeRoutePath('R/_root')).toBe('/');
    });

    it('decodeRoutePath decodes normal paths', () => {
      expect(decodeRoutePath('R/about')).toBe('/about');
      expect(decodeRoutePath('R/users/123')).toBe('/users/123');
    });
  });

  describe('Path Utilities', () => {
    it('joinPath is a function', () => {
      expect(typeof joinPath).toBe('function');
    });

    it('parsePathWithSlug is a function', () => {
      expect(typeof parsePathWithSlug).toBe('function');
    });

    it('parsePathWithSlug parses routes correctly', () => {
      expect(parsePathWithSlug('/users/[id]')).toEqual([
        { type: 'literal', name: 'users' },
        { type: 'group', name: 'id' },
      ]);
    });
  });
});
