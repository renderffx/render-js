import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/e2e/**', 
      '**/rsc/**',
      '**/vercel/**',
      '**/comprehensive.test.ts',
      'tests/core.test.ts',
      '**/vite-entries/**',
      '**/entry.*',
    ],
    benchmark: {
      include: ['tests/**/*.bench.ts'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/vite-entries/**'],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
