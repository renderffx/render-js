import type { UserConfig } from 'vite';

export type { Plugin as VitePlugin } from 'vite';

declare global {
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export interface RouteConfig {
  pagesDir?: string;
  apiDir?: string;
  slicesDir?: string;
  ignorePatterns?: string[];
  trailingSlash?: boolean;
  caseSensitive?: boolean;
}

export interface BuildConfig {
  minify?: boolean;
  sourcemap?: boolean;
  target?: string;
  chunkSizeWarningLimit?: number;
  rollupOptions?: {
    output?: {
      manualChunks?: Record<string, string[]>;
      chunkFileNames?: string;
      entryFileNames?: string;
    };
  };
}

export interface ServerConfig {
  port?: number;
  hostname?: string;
  cors?: {
    origin?: string | string[];
    methods?: string[];
    allowedHeaders?: string[];
  };
  cache?: {
    maxAge?: number;
    staleWhileRevalidate?: number;
  };
  bodyParser?: {
    sizeLimit?: string | number;
  };
}

export interface VercelFunctionConfig {
  memory?: number;
  maxDuration?: number;
  regions?: string[];
  runtime?: string;
  architecture?: 'x86_64' | 'arm64';
  supportsWrapper?: boolean;
  env?: string[];
}

export interface VercelConfig {
  outputDir?: string;
  functionConfig?: VercelFunctionConfig;
  edgeFunctions?: boolean;
  prerender?: boolean;
  framework?: string;
  headers?: { source: string; headers: { key: string; value: string }[] }[];
  redirects?: { source: string; destination: string; permanent?: boolean; statusCode?: number }[];
  rewrites?: { source: string; destination: string }[];
  env?: Record<string, string>;
  regions?: string[];
  images?: {
    sizes?: number[];
    minimumCacheTTL?: number;
    formats?: ('image/avif' | 'image/webp')[];
  };
  cron?: { path: string; schedule: string }[];
  webAnalytics?: boolean;
  speedInsights?: boolean;
  functionNamePrefix?: string;
  command?: string;
  quiet?: boolean;
}

export interface PrerenderConfig {
  expiration?: number | false;
  group?: number;
  bypassToken?: string;
  fallback?: string;
  allowQuery?: string[];
  passQuery?: boolean;
  initialHeaders?: Record<string, string>;
  initialStatus?: number;
  exposeErrBody?: boolean;
}

export interface Config {
  basePath?: string;
  srcDir?: string;
  distDir?: string;
  privateDir?: string;
  rscBase?: string;
  adapter?: string;
  vite?: UserConfig | undefined;
  
  routes?: RouteConfig;
  build?: BuildConfig;
  server?: ServerConfig;
  vercel?: VercelConfig;
}

const DEFAULT_BASE_PATH = '/';
const DEFAULT_SRC_DIR = 'src';
const DEFAULT_DIST_DIR = 'dist';
const DEFAULT_PRIVATE_DIR = 'private';
const DEFAULT_RSC_BASE = '_rsc';

export function defineConfig(config: Config): Config & Required<Pick<Config, 'routes' | 'build' | 'server' | 'vercel'>> {
  return {
    basePath: config.basePath ?? DEFAULT_BASE_PATH,
    srcDir: config.srcDir ?? DEFAULT_SRC_DIR,
    distDir: config.distDir ?? DEFAULT_DIST_DIR,
    privateDir: config.privateDir ?? DEFAULT_PRIVATE_DIR,
    rscBase: config.rscBase ?? DEFAULT_RSC_BASE,
    adapter: config.adapter,
    vite: config.vite,
    
    routes: {
      pagesDir: config.routes?.pagesDir ?? 'pages',
      apiDir: config.routes?.apiDir ?? 'api',
      slicesDir: config.routes?.slicesDir ?? 'slices',
      ignorePatterns: config.routes?.ignorePatterns ?? [
        '**/node_modules/**',
        '**/.*',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
      trailingSlash: config.routes?.trailingSlash ?? false,
      caseSensitive: config.routes?.caseSensitive ?? false,
    },
    
    build: {
      minify: config.build?.minify ?? true,
      sourcemap: config.build?.sourcemap ?? false,
      target: config.build?.target ?? 'esnext',
      chunkSizeWarningLimit: config.build?.chunkSizeWarningLimit ?? 500,
      rollupOptions: config.build?.rollupOptions,
    },
    
    server: {
      port: config.server?.port ?? 3000,
      hostname: config.server?.hostname ?? '0.0.0.0',
      cors: {
        origin: config.server?.cors?.origin ?? '*',
        methods: config.server?.cors?.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: config.server?.cors?.allowedHeaders ?? ['Content-Type', 'Authorization'],
      },
      cache: {
        maxAge: config.server?.cache?.maxAge ?? 60,
        staleWhileRevalidate: config.server?.cache?.staleWhileRevalidate ?? 60 * 60,
      },
      bodyParser: {
        sizeLimit: config.server?.bodyParser?.sizeLimit ?? '1mb',
      },
    },
    
    vercel: {
      outputDir: config.vercel?.outputDir ?? '.vercel/output',
      functionConfig: {
        memory: config.vercel?.functionConfig?.memory ?? 1024,
        maxDuration: config.vercel?.functionConfig?.maxDuration ?? 10,
        regions: config.vercel?.functionConfig?.regions ?? ['iad1'],
        runtime: config.vercel?.functionConfig?.runtime ?? 'nodejs22.x',
        architecture: config.vercel?.functionConfig?.architecture ?? 'x86_64',
      },
      edgeFunctions: config.vercel?.edgeFunctions ?? true,
      prerender: config.vercel?.prerender ?? true,
      framework: config.vercel?.framework ?? '@render.js',
      headers: config.vercel?.headers ?? [],
      redirects: config.vercel?.redirects ?? [],
      rewrites: config.vercel?.rewrites ?? [],
      env: config.vercel?.env ?? {},
      regions: config.vercel?.regions ?? ['iad1'],
      images: config.vercel?.images ?? {
        sizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        minimumCacheTTL: 60,
        formats: ['image/avif', 'image/webp'],
      },
      cron: config.vercel?.cron ?? [],
      webAnalytics: config.vercel?.webAnalytics ?? false,
      speedInsights: config.vercel?.speedInsights ?? true,
      functionNamePrefix: config.vercel?.functionNamePrefix ?? '',
      command: config.vercel?.command ?? '',
      quiet: config.vercel?.quiet ?? false,
    },
  };
}
