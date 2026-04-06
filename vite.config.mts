import { defineConfig } from 'vite';
import rsc from '@vitejs/plugin-rsc';
import { resolve } from 'path';

const root = process.cwd();

export default defineConfig({
  root,
  assetsInclude: ['**/*.html'],
  plugins: [
    rsc({
      entries: {
        client: resolve(root, 'demo/entry-client.tsx'),
        ssr: resolve(root, 'demo/entry-server.tsx'),
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'demo/index.html'),
      },
    },
  },
  server: {
    port: 3000,
  },
});
