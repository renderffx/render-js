import type { UserConfig } from 'vite';

export type { Plugin as VitePlugin } from 'vite';

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export interface Config {
  basePath?: string;
  srcDir?: string;
  distDir?: string;
  privateDir?: string;
  rscBase?: string;
  unstable_adapter?: string;
  vite?: UserConfig | undefined;
}

const DEFAULT_BASE_PATH = '/';
const DEFAULT_SRC_DIR = 'src';
const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_PRIVATE_DIR = 'private';
const DEFAULT_RSC_BASE = '_rsc';

export function defineConfig(config: Config): Config {
  return {
    basePath: config.basePath ?? DEFAULT_BASE_PATH,
    srcDir: config.srcDir ?? DEFAULT_SRC_DIR,
    distDir: config.distDir ?? DEFAULT_DIST_DIR,
    privateDir: config.privateDir ?? DEFAULT_PRIVATE_DIR,
    rscBase: config.rscBase ?? DEFAULT_RSC_BASE,
    unstable_adapter: config.unstable_adapter,
    vite: config.vite,
  };
}
