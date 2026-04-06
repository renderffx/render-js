import { unstable_createServerEntryAdapter as createServerEntryAdapter } from '../adapter-builders.js';
import { unstable_constants as constants, unstable_createNativeMiddleware as nativeMiddleware } from '../internals.js';

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
const { contextMiddleware, rscMiddleware, middlewareRunner } = nativeMiddleware;

export default createServerEntryAdapter(
  (
    { processRequest, processBuild, config, notFoundHtml }: ServerAdapterInput,
    options?: any,
  ) => {
    const middlewareFns = options?.middlewareFns || [];
    const middlewareModules = options?.middlewareModules || {};
    
    const chain = [
      contextMiddleware(),
      ...middlewareFns,
      middlewareRunner(middlewareModules),
      rscMiddleware({ processRequest }),
    ];

    async function fetch(req: Request): Promise<Response> {
      let index = 0;
      
      async function dispatch(): Promise<Response> {
        if (index >= chain.length) {
          return new Response(notFoundHtml || '404 Not Found', {
            status: 404,
            headers: { 'Content-Type': 'text/html' },
          });
        }
        
        const middleware = chain[index++];
        return middleware(req, dispatch);
      }
      
      try {
        return await dispatch();
      } catch (error) {
        console.error('Server error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }

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
      fetch,
      build: processBuild,
      buildOptions: { ...buildOptions } as Record<string, unknown>,
      buildEnhancers: [],
    } as any;
  },
);
