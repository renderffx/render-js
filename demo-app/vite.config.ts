import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { combinedPlugins } from '@renderjs/core';

export default defineConfig({
  plugins: [
    react(),
    combinedPlugins({
      basePath: '/',
      srcDir: 'src',
      distDir: 'dist',
      rscBase: '_rsc',
      srcDirPath: './src',
      distDirPath: './dist',
      routes: {
        pagesDir: 'pages',
        apiDir: 'api',
        slicesDir: 'slices',
      },
      server: {
        hostname: '0.0.0.0',
        port: 3000,
      },
      build: {
        outDir: 'dist/client',
        target: 'esnext',
      },
      vercel: {},
      future: {},
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
