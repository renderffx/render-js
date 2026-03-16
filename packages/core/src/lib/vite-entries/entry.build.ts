export async function INTERNAL_runBuild(_input: {
  renderRsc: (elements: Record<string, unknown>, options?: object) => Promise<ReadableStream>;
  parseRsc: (stream: ReadableStream) => Promise<Record<string, unknown>>;
  renderHtml: (rscStream: ReadableStream, html: unknown, options?: object) => Promise<Response>;
  rscPath2pathname: (rscPath: string) => string;
  saveBuildMetadata: (key: string, value: string) => Promise<void>;
  loadBuildMetadata: (key: string) => Promise<string | undefined>;
  withRequest: (req: Request, fn: () => Promise<void>) => Promise<void>;
  generateFile: (pathname: string, body: string | ReadableStream) => Promise<void>;
  generateDefaultHtml: (pathname: string) => Promise<void>;
}): Promise<void> {
  console.log('Build process initiated');
}
