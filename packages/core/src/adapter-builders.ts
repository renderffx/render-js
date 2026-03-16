export type Unstable_CreateServerEntryAdapter = (
  fn: (
    input: {
      processRequest: (req: Request) => Promise<Response>;
      processBuild: (input: unknown) => Promise<void>;
      config: {
        distDir: string;
        rscBase: string;
        privateDir: string;
        basePath: string;
      };
      notFoundHtml?: string;
    },
    options?: {
      static?: boolean;
      assetsDir?: string;
      middlewareFns?: ((() => Promise<unknown>) | (() => unknown))[];
      middlewareModules?: Record<string, () => Promise<unknown>>;
    },
  ) => {
    fetch: (req: Request) => Promise<Response>;
    build: (input: unknown) => Promise<void>;
    buildOptions?: Record<string, unknown>;
    buildEnhancers?: string[];
  },
) => unknown;

export function unstable_createServerEntryAdapter(
  fn: Parameters<Unstable_CreateServerEntryAdapter>[0],
): ReturnType<Unstable_CreateServerEntryAdapter> {
  return fn as ReturnType<Unstable_CreateServerEntryAdapter>;
}

export type Unstable_StartPreviewServer = (options: {
  basePath: string;
  distDir: string;
  port: number;
}) => Promise<void>;

export function unstable_startPreviewServer(
  _options: Parameters<Unstable_StartPreviewServer>[0],
): Promise<void> {
  throw new Error('Preview server not implemented');
}
