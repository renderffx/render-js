/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly RENDER_CONFIG_BASE_PATH: string;
  readonly RENDER_CONFIG_RSC_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly hot?: {
    accept: () => void;
  };
}

interface GlobalThis {
  __RENDER_PREFETCHED__?: Record<string, unknown>;
  __RENDER_RSC_RELOAD_LISTENERS__?: Array<() => void>;
  __RENDER_REFETCH_RSC__?: () => void;
  [key: string]: unknown;
}

declare const globalThis: GlobalThis;

declare module 'virtual:@renderjs/server-entry' {
  const serverEntry: {
    defaultExport?: unknown;
    fetch?: (req: Request, ...args: unknown[]) => Promise<Response>;
    handleRequest?: (input: {
      req: Request;
      pathname: string;
      type: string;
    }, ctx: {
      renderRsc: (elements: Record<string, unknown>) => Promise<ReadableStream>;
      parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
      renderHtml: (rscStream: ReadableStream, html: unknown, opts?: object) => Promise<Response>;
      loadBuildMetadata: (key: string) => Promise<string | undefined>;
    }) => Promise<unknown>;
  };
  export default serverEntry;
}

declare module 'virtual:@renderjs/client-entry' {
  export {};
}

declare module 'virtual:@renderjs/page-discovery' {
  export function getDiscoveredPages(): Promise<unknown[]>;
  export default getDiscoveredPages;
}
