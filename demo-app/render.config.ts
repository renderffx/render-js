import { defineConfig } from '@renderjs/core';
import react from '@vitejs/plugin-react';

export default defineConfig({
  basePath: '/',
  srcDir: 'src',
  distDir: 'dist',
  rscBase: '_rsc',
  server: {
    port: 3000,
    hostname: '0.0.0.0',
  },
  vite: {
    plugins: [react()],
  },
});
