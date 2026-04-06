import { defineConfig } from '@renderjs/core';
import { combinedPlugins } from '@renderjs/core';
import { resolve } from 'path';

export default defineConfig({
  basePath: '/',
  srcDir: 'src',
  distDir: 'dist',
  rscBase: '_rsc',
  routes: {
    pagesDir: 'pages',
    apiDir: 'api',
    trailingSlash: false,
  },
  build: {
    minify: true,
    sourcemap: false,
  },
  server: {
    port: 3000,
    hostname: '0.0.0.0',
  },
  vercel: {
    outputDir: '.vercel/output',
    functionConfig: {
      runtime: 'nodejs22.x',
      maxDuration: 10,
      memory: 1024,
      regions: ['iad1'],
      architecture: 'arm64',
    },
    edgeFunctions: true,
    prerender: true,
  },
});
