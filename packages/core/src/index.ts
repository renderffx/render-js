export { unstable_defineHandlers, unstable_defineServerEntry } from './minimal/server.js';
export * from './minimal/client.js';
export { unstable_runWithContext, unstable_getContext, unstable_getContextData } from './lib/context.js';
export { unstable_constants } from './lib/constants.js';
export { defineConfig } from './config.js';
export type { Config } from './config.js';
export { unstable_honoMiddleware } from './internals.js';
export { unstable_createServerEntryAdapter } from './adapter-builders.js';

export {
  unstable_defineRouter,
  unstable_getRscPath,
  unstable_getRscParams,
  unstable_rerenderRoute,
  unstable_notFound,
  unstable_redirect,
  createPages,
  fsRouter,
} from './router/server.js';

export type { ApiHandler } from './router/define-router.js';
export type { Method } from './router/create-pages.js';

export {
  Link,
  ErrorBoundary,
  useRouter,
  usePathname,
  useSearchParams,
  RouterContext,
  INTERNAL_ServerRouter,
} from './router/client.js';

export {
  pathnameToRoutePath,
  encodeRoutePath,
  decodeRoutePath,
  encodeSliceId,
  decodeSliceId,
  getComponentIds,
  ROUTE_ID,
  IS_STATIC_ID,
  HAS404_ID,
  SKIP_HEADER,
} from './router/common.js';

export type { RouteProps } from './router/common.js';

export {
  stringToStream,
  streamToBase64,
  base64ToStream,
  batchReadableStream,
  produceMultiplexedStream,
  consumeMultiplexedStream,
} from './lib/utils/stream.js';

export { createRenderUtils } from './lib/utils/render.js';

export {
  createCustomError,
  getErrorInfo,
} from './lib/utils/custom-errors.js';

export {
  joinPath,
  parsePathWithSlug,
  parseExactPath,
  path2regexp,
  pathSpecAsString,
  getPathMapping,
  removeBase,
  addBase,
  encodeFilePathToAbsolute,
  decodeFilePathFromAbsolute,
  filePathToFileURL,
  fileURLToFilePath,
  extname,
} from './lib/utils/path.js';

export type { PathSpec, PathSpecItem } from './lib/utils/path.js';

export {
  encodeRscPath,
  decodeRscPath,
  encodeFuncId,
  decodeFuncId,
} from './lib/utils/rsc-path.js';

export type {
  Unstable_Handlers,
  Unstable_ServerEntry,
  Unstable_RenderRsc,
  Unstable_ParseRsc,
  Unstable_RenderHtml,
} from './lib/types.js';

export {
  unstable_combinedPlugins,
  unstable_mainPlugin,
  unstable_userEntriesPlugin,
  unstable_allowServerPlugin,
  unstable_devServerPlugin,
} from './lib/vite-plugins/index.js';

export {
  defineApiRoute,
  defineGetApi,
  definePostApi,
  definePutApi,
  defineDeleteApi,
  definePatchApi,
  createApiHandler,
  composeMiddlewares,
  createErrorResponse,
  createJsonResponse,
  parseJsonBody,
  getQueryParams,
  getPathParams,
} from './lib/api/routes.js';

export {
  createMiddlewareStack,
  defineMiddleware,
  withTiming,
  withCors,
  withCache,
  withLogger,
  withBodyParser,
} from './lib/middleware/middleware.js';

export {
  createStreamingRenderer,
  createSuspenseFallback,
  createDeferred,
  useDeferredValue,
  createSuspenseBoundary,
  createStreamResponse,
} from './lib/utils/streaming.js';

export {
  useData,
  useAction,
  useServer,
  setCacheData,
  getCacheData,
  clearCacheData,
  ServerFunctionProvider,
} from './lib/hooks/use-data.js';

export {
  createServerCache,
  cacheAsync,
  getCached,
  setCached,
  invalidateCache,
} from './lib/utils/server-cache.js';

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
