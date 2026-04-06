import serverEntry from 'virtual:@renderjs/server-entry';
import { renderToReadableStream, createFromReadableStream } from '../rsc/streaming.js';

export { serverEntry as unstable_serverEntry };

interface ServerEntry {
  fetch?: (req: Request, ...args: unknown[]) => Promise<Response>;
  handleRequest?: (input: unknown, ctx: unknown) => Promise<unknown>;
}

const entry = serverEntry as ServerEntry;

const buildMetadataCache = new Map<string, string>();

export async function loadBuildMetadataFromDisk(distDir: string): Promise<void> {
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

export async function INTERNAL_runFetch(
  env: Readonly<Record<string, string>>,
  req: Request,
  ...args: unknown[]
) {
  await loadBuildMetadataFromDisk(env.RENDER_DIST_DIR || 'dist');
  
  if (typeof (entry as { fetch?: unknown }).fetch === 'function') {
    return (entry as { fetch: (req: Request, ...args: unknown[]) => Promise<Response> }).fetch(req, ...args);
  }
  
  if (typeof (entry as { handleRequest?: unknown }).handleRequest === 'function') {
    const renderRsc = async (elements: Record<string, unknown>) => {
      return await renderToReadableStream(elements);
    };
    
    const parseRsc = async (stream: ReadableStream) => {
      return createFromReadableStream(stream, {});
    };
    
    const renderHtml = async (rscStream: ReadableStream, html: unknown) => {
      if (!html) {
        return new Response(rscStream, { status: 200, headers: { 'content-type': 'text/html' } });
      }
      
      const htmlStream = await renderToReadableStream(html);
      const rscReader = rscStream.getReader();
      const htmlReader = htmlStream.getReader();
      
      const combinedStream = new ReadableStream({
        start(controller) {
          const pump = async () => {
            let rscDone = false;
            let htmlDone = false;
            
            while (!rscDone || !htmlDone) {
              if (!rscDone) {
                const rscResult = await rscReader.read();
                if (rscResult.done) {
                  rscDone = true;
                } else {
                  controller.enqueue(rscResult.value);
                }
              }
              
              if (!htmlDone) {
                const htmlResult = await htmlReader.read();
                if (htmlResult.done) {
                  htmlDone = true;
                } else {
                  controller.enqueue(htmlResult.value);
                }
              }
            }
            
            rscReader.cancel().catch(() => {});
            htmlReader.cancel().catch(() => {});
            controller.close();
          };
          
          pump().catch((err) => {
            console.error('Stream error:', err);
            controller.error(err);
          });
        },
      });
      
      return new Response(combinedStream, { 
        status: 200, 
        headers: { 'content-type': 'text/html' } 
      });
    };
    
    const loadBuildMetadata = async (key: string) => {
      if (buildMetadataCache.has(key)) {
        return buildMetadataCache.get(key);
      }
      return undefined;
    };
    
    const url = new URL(req.url);
    const pathname = url.pathname;
    const isRsc = pathname.startsWith('/_rsc');
    const isAction = pathname.includes('/_action');
    const type = isRsc ? 'rsc' : isAction ? 'action' : 'html';
    const routePathname = type === 'html' ? pathname : pathname.replace(/^\/_rsc/, '') || '/';
    
    return (entry as { handleRequest: (input: unknown, ctx: unknown) => Promise<unknown> }).handleRequest(
      { req, pathname: routePathname, type },
      { renderRsc, parseRsc, renderHtml, loadBuildMetadata }
    );
  }
  
  return new Response('Not Found', { status: 404 });
}

export default entry;
