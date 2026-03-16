import type { Plugin, ViteDevServer } from 'vite';
import type { Config } from '../../config.js';

export interface DevServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
}

export function devServerPlugin(_config: Required<Config>, options: DevServerOptions = {}): Plugin {
  const {
    port = 3000,
    host = 'localhost',
    cors = true,
  } = options;

  return {
    name: 'render:dev-server',

    configureServer(devServer: ViteDevServer) {
      if (cors) {
        devServer.middlewares.use((req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }
          next();
        });
      }
    },

    transform(code: string) {
      return code;
    },
  };
}

export { devServerPlugin as unstable_devServerPlugin };
