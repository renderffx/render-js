import type { Unstable_ParseRsc, Unstable_RenderHtml, Unstable_RenderRsc } from '../types.js';

export function createRenderUtils(
  temporaryReferences: unknown,
  renderToReadableStream: (
    data: unknown,
    options?: object,
    extraOptions?: object,
  ) => Promise<ReadableStream> | ReadableStream,
  createFromReadableStream: (
    stream: ReadableStream,
    options?: object,
  ) => Promise<unknown>,
  loadSsrEntryModule: () => Promise<{
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
  }>,
): {
  renderRsc: Unstable_RenderRsc;
  parseRsc: Unstable_ParseRsc;
  renderHtml: Unstable_RenderHtml;
} {
  const onError = (e: unknown) => {
    console.error('Error during rendering:', e);
    if (
      e &&
      typeof e === 'object' &&
      'digest' in e &&
      typeof e.digest === 'string'
    ) {
      return e.digest;
    }
  };

  return {
    async renderRsc(elements, options) {
      const stream = await renderToReadableStream(
        elements,
        {
          temporaryReferences,
          onError,
        },
        {
          onClientReference(metadata: {
            id: string;
            name: string;
            deps: { js: string[]; css: string[] };
          }) {
            (options as any)?.unstable_clientModuleCallback?.(metadata.deps.js);
          },
        },
      );
      return stream;
    },
    async parseRsc(stream) {
      return createFromReadableStream(stream, {}) as Promise<
        Record<string, unknown>
      >;
    },
    async renderHtml(elementsStream, html, options) {
      const { INTERNAL_renderHtmlStream } =
        await loadSsrEntryModule();

      const rscHtmlStream = await renderToReadableStream(html, {
        onError,
      });
      const opts = options as any;
      const htmlResult = await INTERNAL_renderHtmlStream(elementsStream, rscHtmlStream, {
        rscPath: opts?.rscPath,
        formState: opts?.formState,
        nonce: opts?.nonce,
        extraScriptContent: opts?.unstable_extraScriptContent,
      });
      return new Response(htmlResult.stream, {
        status: htmlResult.status || opts?.status || 200,
        headers: { 'content-type': 'text/html' },
      });
    },
  };
}
