// ============================================================================
// @render.js - React Server Components Framework
// ============================================================================
// This is the main entry point. Everything a user needs should be exported
// from here. Exports are grouped by feature for easy discovery.

// --------------------------------------------------------------------------
// Core Configuration
// --------------------------------------------------------------------------
export { defineConfig } from './config.js';
export type { 
  Config, 
  RouteConfig, 
  BuildConfig, 
  ServerConfig, 
  VercelConfig,
  PrerenderConfig,
} from './config.js';

// --------------------------------------------------------------------------
// Router - File-based routing for pages
// --------------------------------------------------------------------------
export { defineRouter } from './router/stable-api.js';
export { createPages } from './router/create-pages.js';
export { fsRouter } from './router/fs-router.js';

export { 
  notFound, 
  redirect,
  getRscParams,
} from './router/stable-api.js';

export type { ApiHandler } from './router/define-router.js';
export type { Method } from './router/create-pages.js';

// --------------------------------------------------------------------------
// Navigation - Client-side routing components
// --------------------------------------------------------------------------
export { 
  Link, 
  useRouter, 
  usePathname, 
  useSearchParams,
} from './router/client.js';

export { 
  ErrorBoundary, 
  NotFoundBoundary, 
  RouterContext,
} from './router/client.js';

// --------------------------------------------------------------------------
// Server Utilities
// --------------------------------------------------------------------------
export { 
  runWithContext, 
  getContext, 
  getContextData,
  setContextData,
} from './lib/context.js';

export { 
  unstable_runWithContext as unstable_runWithContext, 
  unstable_getContext as unstable_getContext, 
  unstable_getContextData as unstable_getContextData,
} from './lib/context.js';

// --------------------------------------------------------------------------
// Server Functions - Call server code from client
// --------------------------------------------------------------------------
export { 
  useServer, 
  useAction, 
  useData,
} from './lib/hooks/use-data.js';

export { 
  ActionProvider,
  useActionState,
  Form,
  useSubmit,
  LoadingOverlay,
  PendingUI,
} from './lib/hooks/client-actions.js';

export { setCacheData, getCacheData, clearCacheData } from './lib/hooks/use-data.js';
export type { ServerFunctionProvider } from './lib/hooks/use-data.js';

// --------------------------------------------------------------------------
// Navigation Hooks
// --------------------------------------------------------------------------
export { 
  usePending,
  useNavigation,
  usePrefetch,
} from './lib/hooks/navigation.js';

// --------------------------------------------------------------------------
// Streaming & Suspense
// --------------------------------------------------------------------------
export {
  createStreamingRenderer,
  createSuspenseFallback,
  createDeferred,
  useDeferredValue,
  createSuspenseBoundary,
  createStreamResponse,
} from './lib/utils/streaming.js';

// --------------------------------------------------------------------------
// Server-Side Caching
// --------------------------------------------------------------------------
export { 
  createServerCache,
  cacheAsync,
  getCached,
  setCached,
  invalidateCache,
} from './lib/utils/server-cache.js';

// --------------------------------------------------------------------------
// API Routes - REST endpoints
// --------------------------------------------------------------------------
export { 
  defineGetApi,
  definePostApi,
  definePutApi,
  defineDeleteApi,
  definePatchApi,
  defineApiRoute,
} from './lib/api/routes.js';

export { createApiHandler } from './lib/api/routes.js';

export type { ApiHandler as HttpApiHandler, ApiRoute } from './lib/api/routes.js';

// --------------------------------------------------------------------------
// Middleware
// --------------------------------------------------------------------------
export { 
  defineMiddleware,
  createMiddlewareStack,
  withTiming,
  withCors,
  withCache,
  withLogger,
  withBodyParser,
} from './lib/middleware/middleware.js';

export { composeMiddlewares } from './lib/api/routes.js';

// --------------------------------------------------------------------------
// Response Helpers
// --------------------------------------------------------------------------
export { 
  createErrorResponse, 
  createJsonResponse, 
  parseJsonBody,
  getQueryParams,
  getPathParams,
} from './lib/api/routes.js';

// --------------------------------------------------------------------------
// Path Utilities
// --------------------------------------------------------------------------
export {
  joinPath,
  parsePathWithSlug,
  parseExactPath,
  path2regexp,
  pathSpecAsString,
  getPathMapping,
  removeBase,
  addBase,
  extname,
} from './lib/utils/path.js';

export {
  discoverPages,
  normalizeRoutePath,
  type DiscoveredPage,
  type PageDiscoveryOptions,
} from './lib/utils/page-discovery.js';

export type { PathSpec, PathSpecItem } from './lib/utils/path.js';

// --------------------------------------------------------------------------
// Route Path Utilities
// --------------------------------------------------------------------------
export {
  pathnameToRoutePath,
  encodeRoutePath,
  decodeRoutePath,
  encodeSliceId,
  decodeSliceId,
  getComponentIds,
} from './router/common.js';

export {
  ROUTE_ID,
  IS_STATIC_ID,
  HAS404_ID,
  SKIP_HEADER,
} from './router/common.js';

export type { RouteProps } from './router/common.js';

// --------------------------------------------------------------------------
// RSC Utilities
// --------------------------------------------------------------------------
export {
  encodeRscPath,
  decodeRscPath,
  encodeFuncId,
  decodeFuncId,
} from './lib/utils/rsc-path.js';

// --------------------------------------------------------------------------
// RSC Core - Self-contained implementation
// --------------------------------------------------------------------------
export {
  renderToReadableStream,
  createFromReadableStream,
  decodeReply,
  decodeAction,
  createTemporaryReferenceSet,
  encodeReply,
  createFlightContext,
  getFlightContext,
  destroyFlightContext,
  type RenderOptions,
} from './lib/rsc/streaming.js';

export {
  createFlightEncoder,
  createFlightDecoder,
  serializeValue,
  deserializeValue,
  arrayToBase64,
  base64ToUint8Array,
  resetReferenceTracking,
  runWithReferenceContext,
  type FlightChunk,
  type FlightReference,
  type SerializedValue,
} from './lib/rsc/flight-protocol.js';

export {
  createServerActionId,
  generateActionId,
  executeServerAction,
  serializeActionArgs,
  deserializeActionArgs,
  createActionCache,
  createActionDispatcher,
  defaultActionDispatcher,
  invalidateActionCache,
  revalidateActionTag,
  clearAllActions,
  resetActionState,
  addActionListener,
  runWithActionContext,
  type ServerActionOptions,
  type ActionResult,
} from './lib/rsc/server-actions.js';

export {
  unstable_cache,
  revalidateTag,
  revalidatePath,
  revalidate,
  onRevalidate,
  getCached as getCachedValue,
  setCached as setCachedValue,
  invalidateCache as invalidateCacheEntry,
  clearCache,
  getCacheSize,
  getCacheTags,
  getCachePaths,
  isCached,
  getCacheEntry,
  getCacheAge,
  getCacheTTL,
  getCacheStats,
  resetCacheStats,
  runWithCacheContext,
  type CacheEntry,
  type CacheOptions,
  type RevalidateOptions,
} from './lib/rsc/cache.js';

export {
  createClientRouter,
  RouterProvider,
  prefetchRSC,
  invalidateRSCPath,
  clearRSCCache,
  getRSCCache,
  type RouterState,
  type NavigateOptions,
  type RSCPayload as RSCRoutePayload,
  type RSCPayloadCache,
} from './lib/rsc/client-router-index.js';

export {
  useRouter as useClientRouter,
  usePathname as useClientPathname,
  useSearchParams as useClientSearchParams,
  Link as ClientLink,
} from './lib/rsc/client-router-index.js';

// --------------------------------------------------------------------------
// Stream Utilities
// --------------------------------------------------------------------------
export {
  stringToStream,
  streamToBase64,
  base64ToStream,
  batchReadableStream,
  produceMultiplexedStream,
  consumeMultiplexedStream,
} from './lib/utils/stream.js';

// --------------------------------------------------------------------------
// Prefetching & Performance
// --------------------------------------------------------------------------
export {
  prefetch,
  preload,
  preloadFont,
  preloadImage,
  prefetchModule,
  eagerPreload,
  lazyLoadImage,
  createImagePreloader,
} from './lib/utils/prefetch.js';

// --------------------------------------------------------------------------
// Error Handling
// --------------------------------------------------------------------------
export { 
  createCustomError, 
  getErrorInfo,
} from './lib/utils/custom-errors.js';

export { createRenderUtils } from './lib/utils/render.js';

// --------------------------------------------------------------------------
// Vite Plugins
// --------------------------------------------------------------------------
export { mainPlugin as vitePlugin, combinedPlugins } from './lib/vite-plugins/combined-plugins.js';
export { mainPlugin } from './lib/vite-plugins/main.js';
export { userEntriesPlugin } from './lib/vite-plugins/user-entries.js';
export { devServerPlugin } from './lib/vite-plugins/dev-server.js';

// --------------------------------------------------------------------------
// Vercel Native - Vercel deployment utilities
// --------------------------------------------------------------------------
export {
  VERCEL_NATIVE,
  isVercelNative,
  getVercelRegion,
  getVercelDeploymentUrl,
  isVercelPreview,
  getGitCommitSha,
  getBranchName,
  getVercelEnv,
  isEdgeRuntime,
  getRuntimeType,
  type VercelEnv,
} from './vercel-native.js';

// --------------------------------------------------------------------------
// Internal / Unstable - Use with caution
// --------------------------------------------------------------------------
export { unstable_constants } from './lib/constants.js';
export { unstable_defineHandlers, unstable_defineServerEntry } from './minimal/server.js';
export { unstable_defineRouter, unstable_getRscPath, unstable_rerenderRoute, unstable_notFound, unstable_redirect } from './router/server.js';
export { unstable_createNativeMiddleware } from './internals.js';
export { unstable_createServerEntryAdapter } from './adapter-builders.js';

export type { 
  Unstable_Handlers,
  Unstable_ServerEntry,
  Unstable_RenderRsc,
  Unstable_ParseRsc,
  Unstable_RenderHtml,
} from './lib/types.js';
