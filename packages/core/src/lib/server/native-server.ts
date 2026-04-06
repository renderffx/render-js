export interface ServerConfig {
  port?: number;
  hostname?: string;
  staticDir?: string;
}

type FetchHandler = (req: Request) => Promise<Response>;

const isBun = typeof (globalThis as any).Bun !== 'undefined';

export async function createServer(
  fetch: FetchHandler,
  config: ServerConfig = {}
): Promise<{ port: number; hostname: string; close: () => void }> {
  const { port = 3000, hostname = '0.0.0.0' } = config;

  if (isBun) {
    return createBunServer(fetch, config);
  }
  
  return createNodeServer(fetch, config);
}

async function createNodeServer(
  fetch: FetchHandler,
  config: ServerConfig
): Promise<{ port: number; hostname: string; close: () => void }> {
  const { port = 3000, hostname = '0.0.0.0' } = config;

  const http = await import('node:http');
  const { Readable } = await import('node:stream');
  
  const server = http.createServer(async (req, res) => {
    try {
      const url = `http://${hostname}${req.url}`;
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        } else if (Array.isArray(value)) {
          headers[key] = value.join(', ');
        }
      }

      const method = req.method || 'GET';
      let body: BodyInit | null = null;
      if (method !== 'GET' && method !== 'HEAD' && req.readable) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        if (chunks.length > 0) {
          body = Buffer.concat(chunks);
        }
      }

      const request = new Request(url, {
        method,
        headers,
        body,
      });

      const response = await fetch(request);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } else {
        res.end();
      }
    } catch (error) {
      console.error('Server error:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  return new Promise((resolve) => {
    server.listen(port, hostname, () => {
      console.log(`🚀 Server running at http://${hostname}:${port}`);
      resolve({
        port,
        hostname,
        close: () => server.close(),
      });
    });
  });
}

async function createBunServer(
  fetch: FetchHandler,
  config: ServerConfig
): Promise<{ port: number; hostname: string; close: () => void }> {
  const { port = 3000, hostname = '0.0.0.0' } = config;

  const server = (globalThis as typeof globalThis & { Bun: { serve: (opts: { port: number; hostname: string; fetch: FetchHandler }) => { port: number; hostname: string; stop: () => void } } }).Bun.serve({
    port,
    hostname,
    fetch: async (req) => {
      try {
        return await fetch(req);
      } catch (error) {
        console.error('Server error:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    },
  });

  console.log(`🚀 Server running at http://${hostname}:${server.port}`);

  return {
    port: server.port,
    hostname: server.hostname,
    close: () => server.stop(),
  };
}

export async function createEdgeServer(
  fetch: FetchHandler,
  config?: ServerConfig
): Promise<{ fetch: FetchHandler }> {
  return { fetch };
}
