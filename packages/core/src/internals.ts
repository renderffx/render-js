import { unstable_runWithContext, unstable_getContext } from './lib/context.js';
import { unstable_constants } from './lib/constants.js';

export const unstable_honoMiddleware = {
  contextMiddleware: () => async (c: any, next: any) => {
    await unstable_runWithContext(c.req.raw, async () => {
      await next();
    });
  },
  rscMiddleware: ({ processRequest }: { processRequest: (req: Request) => Promise<Response> }) => async (c: any) => {
    const response = await processRequest(c.req.raw);
    return response;
  },
  middlewareRunner: (middlewareModules: Record<string, () => Promise<any>>) => async (c: any, next: any) => {
    for (const key in middlewareModules) {
      const mod = await middlewareModules[key]();
      if (mod.default) {
        await mod.default(c, next);
      }
    }
    await next();
  },
};

export { unstable_constants };
