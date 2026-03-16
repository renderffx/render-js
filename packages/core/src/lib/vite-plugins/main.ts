import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin, RunnableDevEnvironment, UserConfig } from 'vite';
import { mergeConfig } from 'vite';
import type { Config } from '../../config.js';
import {
  DIST_PUBLIC,
  DIST_SERVER,
  SRC_CLIENT_ENTRY,
  SRC_PAGES,
  SRC_SERVER_ENTRY,
} from '../constants.js';

const PKG_NAME = '@render.js/core';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

export function mainPlugin(config: Required<Config>): Plugin {
  return {
    name: 'render:vite-plugins:main',
    async config(_config) {
      let viteRscConfig: UserConfig = {
        base: config.basePath,
        define: {
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
          'import.meta.env.RENDER_CONFIG_BASE_PATH': JSON.stringify(
            config.basePath,
          ),
          'import.meta.env.RENDER_CONFIG_RSC_BASE': JSON.stringify(
            config.rscBase,
          ),
          ...Object.fromEntries(
            Object.entries(process.env).flatMap(([k, v]) =>
              k.startsWith('RENDER_PUBLIC_')
                ? [
                    [`import.meta.env.${k}`, JSON.stringify(v)],
                    [`process.env.${k}`, JSON.stringify(v)],
                  ]
                : [],
            ),
          ),
        },
        environments: {
          client: {
            build: {
              rollupOptions: {
                input: {
                  index: path.join(
                    __dirname,
                    '../vite-entries/entry.browser.js',
                  ),
                },
              },
            },
            optimizeDeps: {
              entries: [
                `${config.srcDir}/${SRC_CLIENT_ENTRY}.*`,
                `${config.srcDir}/${SRC_SERVER_ENTRY}.*`,
                `${config.srcDir}/${SRC_PAGES}/**/*.*`,
              ],
            },
          },
          ssr: {
            build: {
              rollupOptions: {
                input: {
                  index: path.join(__dirname, '../vite-entries/entry.ssr.js'),
                },
              },
            },
          },
          rsc: {
            build: {
              rollupOptions: {
                input: {
                  index: path.join(
                    __dirname,
                    '../vite-entries/entry.server.js',
                  ),
                  build: path.join(__dirname, '../vite-entries/entry.build.js'),
                },
              },
            },
          },
        },
      };

      if (config.vite) {
        viteRscConfig = mergeConfig(viteRscConfig, {
          ...config.vite,
          plugins: undefined,
        });
      }

      return viteRscConfig;
    },
    configEnvironment(name, environmentConfig, env) {
      if (environmentConfig.optimizeDeps?.include) {
        environmentConfig.optimizeDeps.include = (
          environmentConfig.optimizeDeps.include as string[]
        ).map((name) => {
          if (name.startsWith('@vitejs/plugin-rsc')) {
            name = `${PKG_NAME} > ${name}`;
          }
          return name;
        });
      }

      environmentConfig.build ??= {};
      environmentConfig.build.outDir = `${config.distDir}/${name}`;
      if (name === 'rsc') {
        environmentConfig.build.outDir = `${config.distDir}/${DIST_SERVER}`;
      }
      if (name === 'ssr') {
        environmentConfig.build.outDir = `${config.distDir}/${DIST_SERVER}/ssr`;
      }
      if (name === 'client') {
        environmentConfig.build.outDir = `${config.distDir}/${DIST_PUBLIC}`;
      }

      return {
        resolve: {
          noExternal: env.command === 'build' ? true : [PKG_NAME],
        },
        optimizeDeps: {
          exclude: [PKG_NAME, '@render.js/minimal/client', '@render.js/router/client'],
        },
      };
    },
    async configureServer(server) {
      const { getRequestListener } = await import('@hono/node-server');
      const environment = server.environments.rsc! as RunnableDevEnvironment;
      const entryId = (environment.config.build.rollupOptions.input as any)
        .index;
      return () => {
        server.middlewares.use(async (req: any, res: any, next: any) => {
          try {
            req.url = req.originalUrl;
            const mod: typeof import('../vite-entries/entry.server.js') =
              await environment.runner.import(entryId);
            const listener = getRequestListener((innerReq: any, ...innerArgs: any[]) =>
              mod.INTERNAL_runFetch(process.env as any, innerReq, ...innerArgs),
            );
            listener(req, res);
          } catch (e) {
            next(e);
          }
        });
      };
    },
  };
}
