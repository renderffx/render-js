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
