export type Unstable_Handlers = {
  handleRequest: (
    input: {
      req: Request;
      pathname: string;
      type: 'html' | 'rsc' | 'action' | 'custom' | 'component' | 'function';
      rscPath?: string;
      rscParams?: unknown;
      fn?: (...args: unknown[]) => unknown;
      args?: unknown[];
    },
    context: {
      renderRsc: (elements: Record<string, unknown>, options?: object) => Promise<ReadableStream>;
      parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
      renderHtml: (rscStream: ReadableStream, html: unknown, options?: object) => Promise<Response>;
      loadBuildMetadata: (key: string) => Promise<string | undefined>;
    },
  ) => Promise<ReadableStream | Response | 'fallback' | null | undefined>;
  handleBuild?: (input: {
    renderRsc: (elements: Record<string, unknown>, options?: object) => Promise<ReadableStream>;
    parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
    renderHtml: (rscStream: ReadableStream, html: unknown, options?: object) => Promise<Response>;
    rscPath2pathname: (rscPath: string) => string;
    saveBuildMetadata: (key: string, value: string) => Promise<void>;
    loadBuildMetadata: (key: string) => Promise<string | undefined>;
    withRequest: (req: Request, fn: () => Promise<void>) => Promise<void>;
    generateFile: (pathname: string, body: string | ReadableStream) => Promise<void>;
    generateDefaultHtml: (pathname: string) => Promise<void>;
  }) => Promise<void>;
};

export type Unstable_ServerEntry = {
  handleRequest: Unstable_Handlers['handleRequest'];
  handleBuild?: Unstable_Handlers['handleBuild'];
};

export type Unstable_RenderRsc = (
  elements: Record<string, unknown>,
  options?: object,
) => Promise<ReadableStream>;

export type Unstable_ParseRsc = (
  stream: ReadableStream,
) => Promise<Record<string, unknown>>;

export type Unstable_RenderHtml = (
  elementsStream: ReadableStream,
  html: unknown,
  options?: object,
) => Promise<Response>;

export type Unstable_CreateFromReadableStream = (
  stream: ReadableStream,
) => Promise<Record<string, unknown>>;
