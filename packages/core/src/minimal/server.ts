import type {
  Unstable_Handlers as Handlers,
  Unstable_ServerEntry as ServerEntry,
} from '../lib/types.js';
import { unstable_defineRouter } from '../router/define-router.js';
import type { RouteConfig, ApiConfig, SliceConfig } from '../router/define-router.js';
import { createRenderUtils } from '../lib/utils/render.js';
import { renderToReadableStream, createFromReadableStream } from '../lib/rsc/streaming.js';
import { runWithActionContext, executeServerAction } from '../lib/rsc/server-actions.js';
import { runWithCacheContext } from '../lib/rsc/cache.js';
import { runWithPathContext } from '../lib/rsc/rsc-path.js';
import { runWithContext, createRequestContext } from '../lib/context.js';
import { runWithDataCacheContext } from '../lib/hooks/use-data.js';
import { runWithCacheContext as runWithServerCacheContext } from '../lib/utils/server-cache.js';

export function unstable_defineHandlers(handlers: Handlers) {
  return handlers;
}

export interface ServerEntryOptions {
  basePath?: string;
  srcDir?: string;
  distDir?: string;
  future?: Record<string, unknown>;
  getRoutes?: () => Promise<Iterable<RouteConfig | ApiConfig | SliceConfig>>;
  temporaryReferences?: unknown;
  loadSsrEntryModule?: () => Promise<{
    INTERNAL_renderHtmlStream: (
      elementsStream: ReadableStream,
      htmlStream: ReadableStream,
      options: {
        rscPath?: string;
        formState?: unknown;
        nonce?: string;
        extraScriptContent?: string;
      }
    ) => Promise<{ stream: ReadableStream; status?: number }>;
  }>;
  onError?: (error: unknown) => string | void;
}

const buildMetadataCache = new Map<string, string>();
let metadataInitialized = false;

async function loadBuildMetadata(distDir: string): Promise<void> {
  if (metadataInitialized) return;
  metadataInitialized = true;
  
  if (typeof process === 'undefined' || !process.env) return;
  try {
    const { readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const metadataPath = join(distDir, 'build-metadata.json');
    if (existsSync(metadataPath)) {
      const content = readFileSync(metadataPath, 'utf-8');
      const metadata = JSON.parse(content);
      for (const [key, value] of Object.entries(metadata)) {
        buildMetadataCache.set(key, value as string);
      }
    }
  } catch {
    // Ignore - metadata file may not exist yet
  }
}

export function unstable_defineServerEntry(options: ServerEntryOptions = {}) {
  const {
    basePath = '/',
    srcDir = 'src',
    distDir = 'dist',
    getRoutes,
    temporaryReferences,
    loadSsrEntryModule,
    onError,
  } = options;

  let handlers: Handlers | undefined;

  const handleRequest = async (
    input: {
      req: Request;
      pathname: string;
      type: 'html' | 'rsc' | 'component' | 'function' | 'action' | 'custom';
      rscPath?: string;
      rscParams?: unknown;
      fn?: (...args: unknown[]) => unknown;
      args?: unknown[];
    },
    ctx: {
      renderRsc: (entries: Record<string, unknown>) => Promise<ReadableStream>;
      parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
      renderHtml: (
        elementsStream: ReadableStream,
        html: unknown,
        opts?: object,
      ) => Promise<Response>;
      loadBuildMetadata: (key: string) => Promise<string | undefined>;
    },
  ) => {
    if (!handlers) {
      if (!getRoutes) {
        throw new Error('Server entry requires getRoutes function or handleRequest implementation');
      }
      handlers = unstable_defineRouter({ getConfigs: getRoutes });
    }
    return handlers.handleRequest(input, ctx);
  };

  const renderUtils = temporaryReferences && loadSsrEntryModule
    ? createRenderUtils(
        temporaryReferences,
        async (data, opts) => renderToReadableStream(data, opts),
        async (stream, _opts) => createFromReadableStream(stream, _opts),
        loadSsrEntryModule,
      )
    : null;

  const serverEntry: ServerEntry & {
    basePath: string;
    srcDir: string;
    distDir: string;
    config: {
      basePath: string;
      srcDir: string;
      distDir: string;
      runtime?: string;
    };
    fetch: (req: Request, init?: RequestInit) => Promise<Response>;
  } = {
    handleRequest: async (input, ctx) => {
      await loadBuildMetadata(distDir);
      
      if (renderUtils) {
        ctx = {
          ...ctx,
          renderRsc: renderUtils.renderRsc,
          parseRsc: renderUtils.parseRsc,
          renderHtml: renderUtils.renderHtml,
        };
      }
      return handleRequest(input, ctx);
    },
    get basePath() { return basePath; },
    get srcDir() { return srcDir; },
    get distDir() { return distDir; },
    get config() {
      return { basePath, srcDir, distDir };
    },
    async fetch(req: Request) {
      await loadBuildMetadata(distDir);
      
      const url = new URL(req.url);
      const pathname = url.pathname;

      const renderRsc = async (elements: Record<string, unknown>) => {
        if (renderUtils) {
          return renderUtils.renderRsc(elements);
        }
        return renderToReadableStream(elements, { onError });
      };

      const parseRsc = async (stream: ReadableStream) => {
        if (renderUtils) {
          return renderUtils.parseRsc(stream);
        }
        return await createFromReadableStream(stream, {});
      };

      const renderHtml = async (
        elementsStream: ReadableStream,
        html: unknown,
        opts?: object,
      ) => {
        if (renderUtils) {
          return renderUtils.renderHtml(elementsStream, html, opts);
        }
        const htmlStream = await renderToReadableStream(html, { onError });
        const rscReader = elementsStream.getReader();
        const htmlReader = htmlStream.getReader();
        
        let rscDone = false;
        let htmlDone = false;
        
        const pullRsc = async (): Promise<Uint8Array | null> => {
          if (rscDone) return null;
          const { done, value } = await rscReader.read();
          if (done) {
            rscDone = true;
            return null;
          }
          return value;
        };
        
        const pullHtml = async (): Promise<Uint8Array | null> => {
          if (htmlDone) return null;
          const { done, value } = await htmlReader.read();
          if (done) {
            htmlDone = true;
            return null;
          }
          return value;
        };
        
        return new Response(
          new ReadableStream({
            async pull(controller) {
              const [rscChunk, htmlChunk] = await Promise.all([pullRsc(), pullHtml()]);
              
              if (rscChunk) controller.enqueue(rscChunk);
              if (htmlChunk) controller.enqueue(htmlChunk);
              
              if (rscDone && htmlDone) {
                rscReader.cancel().catch(() => {});
                htmlReader.cancel().catch(() => {});
                controller.close();
              }
            },
            cancel() {
              rscReader.cancel();
              htmlReader.cancel();
            },
          }),
          { status: 200, headers: { 'content-type': 'text/html' } },
        );
      };

      const loadBuildMeta = async (key: string) => {
        if (buildMetadataCache.has(key)) {
          return buildMetadataCache.get(key);
        }
        return undefined;
      };

      const type: 'html' | 'rsc' | 'component' | 'function' | 'action' | 'custom' =
        pathname.startsWith('/_rsc') ? 'rsc' :
        pathname === '/__rsc/action' ? 'action' :
        pathname.startsWith('/_component') ? 'component' :
        pathname.startsWith('/_function') ? 'function' :
        'html';

      if (type === 'action') {
        return runWithContext(req, () =>
          runWithCacheContext(() =>
            runWithServerCacheContext(() =>
              runWithPathContext(() =>
                runWithDataCacheContext(() =>
                  runWithActionContext(async () => {
                    const actionId = req.headers.get('x-action-id') || '';
                    const args = await req.json();
                    
                    try {
                      const actionModule = await import(actionId);
                      const actionFn = actionModule.default || Object.values(actionModule)[0];
                      
                      if (typeof actionFn !== 'function') {
                        return new Response(
                          JSON.stringify({ success: false, error: { message: 'Action not found' } }),
                          { status: 404, headers: { 'content-type': 'application/json' } }
                        );
                      }
                      
                      const result = await executeServerAction(actionFn, args);
                      return new Response(JSON.stringify(result), {
                        status: result.success ? 200 : 500,
                        headers: { 'content-type': 'application/json' },
                      });
                    } catch (error) {
                      return new Response(
                        JSON.stringify({
                          success: false,
                          error: { message: error instanceof Error ? error.message : String(error) },
                        }),
                        { status: 500, headers: { 'content-type': 'application/json' } }
                      );
                    }
                  })
                )
              )
            )
          )
        );
      }

      const result = await handleRequest(
        {
          req,
          pathname: pathname.replace(/^\/_rsc/, '').replace(/^\/_component/, '').replace(/^\/_function/, '') || '/',
          type,
        },
        { renderRsc, parseRsc, renderHtml, loadBuildMetadata: loadBuildMeta },
      );

      if (result instanceof Response) {
        return result;
      }

      if (result instanceof ReadableStream) {
        return new Response(result, {
          status: 200,
          headers: { 'content-type': 'text/x-component' },
        });
      }

      return new Response('Not Found', { status: 404 });
    },
  };

  return serverEntry;
}
