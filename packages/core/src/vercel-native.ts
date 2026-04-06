export {
  createVercelEdgeHandler,
  renderRSCToEdgeStream,
  renderRSCToEdgeResponse,
  createEdgeContext,
  generateEdgeMiddlewareCode,
  generateEdgeFunctionCode,
  generatePrerenderConfig,
  isEdgeRuntime,
  getRuntimeType,
  type VercelEdgeContext,
  type VercelEdgeConfig,
  type EdgeHandler,
  type RouteConfig,
} from './lib/server/edge-server.js';

export {
  isEdgeRuntime as unstable_isEdgeRuntime,
  getRuntimeType as unstable_getRuntimeType,
  runWithContext,
  getContext,
  getContextData,
  setContextData,
  createEdgeContext as createRequestContext,
  createNonce,
  type RequestContext as EdgeRequestContext,
} from './lib/context-edge.js';

export {
  createKVCache,
  createVercelKVCache,
  createStableKVCache,
  revalidateTag,
  revalidatePath,
  type CacheOptions,
  type CacheEntry,
  type KVCache,
  type StableKVCache,
} from './lib/utils/vercel-kv.js';

export {
  withAuth,
  withGeo,
  withLocale,
  withABTesting,
  withRateLimit,
  createEdgeMiddlewareStack,
  generateMiddlewareCode,
  type EdgeMiddleware,
  type EdgeMiddlewareContext,
  type EdgeMiddlewareModule,
  type EdgeRouteConfig,
} from './lib/middleware/edge-middleware.js';

export {
  createEdgeRouter,
  generateEdgeMiddlewareRouter,
  detectStaticRoutes,
  generateCDNCacheHeaders,
  type EdgeRoute,
  type EdgeRouterOptions,
  type CDNCachedRoute,
} from './lib/utils/edge-router.js';

export {
  generateRouteFunctions,
  routeToFuncName,
  generatePrerenderManifest,
  generateRouteManifest,
  buildRouteTree,
  optimizeRoutesForVercel,
  type RouteFunctionConfig,
  type PrerenderConfig,
} from './lib/utils/vercel-routes.js';

export {
  generateOgImage,
  generateImageResponse,
  getImageLoader,
  getVercelImageLoaderUrl,
  createVercelImageHandler,
  generateImageEndpoint,
  type ImageConfig,
  type VercelImageOptions,
} from './lib/utils/vercel-og.js';

export {
  createServer,
  createEdgeServer,
  type ServerConfig,
} from './lib/server/native-server.js';

export const VERCEL_NATIVE = true;

export function isVercelNative(): boolean {
  return true;
}

export function getVercelRegion(): string {
  if (typeof globalThis !== 'undefined') {
    const region = (globalThis as any).__VERCEL_REGION__;
    if (region) return region;
  }
  return process.env.VERCEL_REGION || 'unknown';
}

export function getVercelDeploymentUrl(): string {
  return process.env.VERCEL_URL || 'localhost';
}

export function isVercelPreview(): boolean {
  return !!process.env.VERCEL_GIT_COMMIT_SHA;
}

export function getGitCommitSha(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_SHA;
}

export function getBranchName(): string | undefined {
  return process.env.VERCEL_GIT_COMMIT_REF;
}

export interface VercelEnv {
  region: string;
  url: string;
  isPreview: boolean;
  isProduction: boolean;
  isDev: boolean;
  commitSha?: string;
  branch?: string;
  regionObj?: {
    continent: string;
    country?: string;
    region?: string;
    city?: string;
  };
}

export function getVercelEnv(): VercelEnv {
  return {
    region: getVercelRegion(),
    url: getVercelDeploymentUrl(),
    isPreview: !!process.env.VERCEL_GIT_COMMIT_SHA,
    isProduction: process.env.NODE_ENV === 'production' && !process.env.VERCEL_GIT_COMMIT_SHA,
    isDev: process.env.NODE_ENV === 'development',
    commitSha: getGitCommitSha(),
    branch: getBranchName(),
  };
}

export const config = {
  runtime: 'edge',
};

export default {
  runtime: 'edge',
};
