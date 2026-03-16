import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { unstable_createServerEntryAdapter as createServerEntryAdapter } from '../adapter-builders.js';
import { unstable_constants as constants, unstable_honoMiddleware as honoMiddleware } from '../internals.js';

interface ServerAdapterInput {
  processRequest: (req: Request) => Promise<Response>;
  processBuild: (input: unknown) => Promise<void>;
  config: {
    distDir: string;
    rscBase: string;
    privateDir: string;
    basePath: string;
  };
  notFoundHtml?: string;
}

interface BuildOptions {
  assetsDir: string;
  distDir: string;
  rscBase: string;
  privateDir: string;
  basePath: string;
  DIST_PUBLIC: string;
  serverless: boolean;
}

const { DIST_PUBLIC } = constants;
const { contextMiddleware, rscMiddleware, middlewareRunner } = honoMiddleware;

export default createServerEntryAdapter(
  (
    { processRequest, processBuild, config, notFoundHtml }: ServerAdapterInput,
    options?: any,
  ) => {
    const middlewareFns = options?.middlewareFns || [];
    const middlewareModules = options?.middlewareModules || {};
    const app = new Hono();
    app.notFound((c) => {
      if (notFoundHtml) {
        return c.html(notFoundHtml, 404);
      }
      return c.text('404 Not Found', 404);
    });
    app.use(contextMiddleware());
    for (const middlewareFn of middlewareFns) {
      app.use(middlewareFn());
    }
    app.use(middlewareRunner(middlewareModules));
    app.use(rscMiddleware({ processRequest }));
    const buildOptions: BuildOptions = {
      assetsDir: options?.assetsDir || 'assets',
      distDir: config.distDir,
      rscBase: config.rscBase,
      privateDir: config.privateDir,
      basePath: config.basePath,
      DIST_PUBLIC,
      serverless: !options?.static,
    };
    return {
      fetch: app.fetch as (req: Request) => Promise<Response>,
      build: processBuild,
      buildOptions: { ...buildOptions } as Record<string, unknown>,
      buildEnhancers: ['@render.js/adapters/vercel-build-enhancer'],
    } as any;
  },
);
