import type { Plugin, ViteDevServer } from 'vite';
import type { Config } from '../../config.js';

export interface DevServerOptions {
  port?: number;
  host?: string;
  cors?: boolean;
  enableHmr?: boolean;
}

export function devServerPlugin(config: Required<Config>, options: DevServerOptions = {}): Plugin {
  const {
    port = 3000,
    host = 'localhost',
    cors = true,
    enableHmr = true,
  } = options;

  let routeCache: Map<string, unknown> = new Map();

  return {
    name: 'render:dev-server',

    configureServer(devServer: ViteDevServer) {
      if (cors) {
        devServer.middlewares.use((req, res, next) => {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-RSC-Path, X-RSC-Params, X-Skip-Ids');
          res.setHeader('Access-Control-Expose-Headers', 'X-RSC-Path');
          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }
          next();
        });
      }

      if (enableHmr) {
        devServer.watcher.on('change', async (filePath: string) => {
          if (
            filePath.includes(config.srcDir) &&
            (filePath.endsWith('.tsx') || 
             filePath.endsWith('.ts') || 
             filePath.endsWith('.jsx') ||
             filePath.endsWith('.js'))
          ) {
            routeCache.clear();
            console.log(`[HMR] Route cache cleared due to change in ${filePath}`);
            
            const clients = (devServer as unknown as { clients?: Set<{ send: (msg: string) => void }> }).clients;
            if (clients) {
              for (const client of clients) {
                client.send(JSON.stringify({
                  type: 'full-reload',
                  path: '*',
                }));
              }
            }
          }
        });
      }
    },

    transform(code: string, id: string) {
      if (id.includes('hot') || id.includes('vite')) {
        return code;
      }
      return code;
    },

    handleHotUpdate({ server, file }) {
      if (
        file.includes(config.srcDir) &&
        (file.endsWith('.tsx') || file.endsWith('.ts'))
      ) {
        routeCache.clear();
        server.ws.send({
          type: 'full-reload',
          path: '*',
        });
      }
    },
  };
}

export { devServerPlugin as unstable_devServerPlugin };
