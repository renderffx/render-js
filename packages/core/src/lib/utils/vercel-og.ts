export interface ImageConfig {
  domains?: string[];
  remotePatterns?: Array<{
    protocol?: 'http' | 'https';
    hostname: string;
    port?: string;
    pathname?: string;
  }>;
  formats?: Array<'image/avif' | 'image/webp'>;
  sizes?: number[];
  deviceSizes?: number[];
  imageSizes?: number[];
  minimumCacheTTL?: number;
  dangerouslyAllowSVG?: boolean;
  contentDispositionType?: 'inline' | 'attachment';
  contentSecurityPolicy?: string;
  mode?: 'default' | 'dominant-color' | 'blur' | 'minimum-cache';
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface VercelImageOptions {
  src: string;
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif';
  blur?: number;
}

declare const ImageResponse: {
  new (options: {
    width?: number;
    height?: number;
    fonts?: Array<{ name: string; data: ArrayBuffer; style?: string }>;
  }): Response;
};

declare const fetchImage: ((url: string) => Promise<ArrayBuffer>) | undefined;
declare const getImageMetadata: ((data: ArrayBuffer) => Promise<{ width: number; height: number }>) | undefined;
declare const resizeImage: ((data: ArrayBuffer, width: number, height: number) => Promise<ArrayBuffer>) | undefined;

export function isVercelOgAvailable(): boolean {
  return typeof ImageResponse !== 'undefined';
}

export async function generateOgImage(
  element: React.ReactElement,
  options: {
    width?: number;
    height?: number;
    fonts?: Array<{ name: string; data: ArrayBuffer; style?: string }>;
  } = {}
): Promise<Response> {
  if (!isVercelOgAvailable()) {
    throw new Error('@vercel/og is not available. This function can only run in Vercel Edge Runtime.');
  }
  
  return new ImageResponse({
    props: {
      children: element,
      width: options.width ?? 1200,
      height: options.height ?? 630,
    },
    options: {
      fonts: options.fonts,
    },
  } as any);
}

export function generateImageResponse(
  imageData: ArrayBuffer,
  options: {
    width?: number;
    height?: number;
    format?: string;
  } = {}
): Response {
  const headers = new Headers({
    'Content-Type': options.format ?? 'image/png',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': String(imageData.byteLength),
  });
  
  if (options.width) {
    headers.set('X-Image-Width', String(options.width));
  }
  
  if (options.height) {
    headers.set('X-Image-Height', String(options.height));
  }
  
  return new Response(imageData, {
    status: 200,
    headers,
  });
}

export interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
  loader?: 'default' | 'vercel' | 'imgix' | 'cloudinary' | 'custom';
}

export function getImageLoader(): string {
  return 'vercel';
}

export function getVercelImageLoaderUrl(props: ImageLoaderProps): string {
  const { src, width, quality = 75 } = props;
  
  const baseUrl = '/_vercel/image';
  const params = new URLSearchParams({
    url: src,
    w: String(width),
    q: String(quality),
  });
  
  return `${baseUrl}?${params.toString()}`;
}

export function createVercelImageHandler(
  config: ImageConfig = {}
): {
  match: (url: URL) => boolean;
  handle: (request: Request) => Promise<Response>;
} {
  const {
    domains = [],
    remotePatterns = [],
    formats = ['image/avif', 'image/webp'],
    deviceSizes = [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes = [16, 32, 48, 64, 96, 128, 256, 384],
    quality = 75,
    minimumCacheTTL = 60,
    dangerouslyAllowSVG = false,
  } = config;
  
  const allowedHostnames = new Set([
    ...domains,
    'vercel.com',
    'vercelusercontent.com',
    'vercel-dev.com',
    ...remotePatterns.map(p => p.hostname),
  ]);
  
  function isAllowedHostname(hostname: string): boolean {
    if (allowedHostnames.has(hostname)) return true;
    
    for (const pattern of remotePatterns) {
      if (pattern.hostname === hostname) return true;
      const regex = new RegExp('^' + pattern.hostname.replace(/\*/g, '.*') + '$');
      if (regex.test(hostname)) return true;
    }
    
    return false;
  }
  
  function getOptimalWidth(requestedWidth: number): number {
    const allSizes = [...deviceSizes, ...imageSizes].sort((a, b) => a - b);
    
    for (const size of allSizes) {
      if (size >= requestedWidth) {
        return size;
      }
    }
    
    return allSizes[allSizes.length - 1];
  }
  
  function determineFormat(acceptHeader: string | null): string {
    if (!acceptHeader) return 'webp';
    
    const avifIndex = acceptHeader.indexOf('image/avif');
    const webpIndex = acceptHeader.indexOf('image/webp');
    
    for (const format of formats) {
      if (format === 'image/avif' && avifIndex !== -1) {
        return 'avif';
      }
      if (format === 'image/webp' && webpIndex !== -1) {
        return 'webp';
      }
    }
    
    return 'webp';
  }
  
  return {
    match(url: URL): boolean {
      return url.pathname.startsWith('/_vercel/image') || 
             url.pathname.includes('/__og-image');
    },
    
    async handle(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const imageUrl = url.searchParams.get('url');
      const width = parseInt(url.searchParams.get('w') ?? '0', 10) || 800;
      const qualityParam = parseInt(url.searchParams.get('q') ?? String(quality), 10);
      
      if (!imageUrl) {
        return new Response('Missing url parameter', { status: 400 });
      }
      
      const parsedUrl = new URL(imageUrl);
      
      if (!isAllowedHostname(parsedUrl.hostname)) {
        return new Response('Hostname not allowed', { status: 403 });
      }
      
      if (parsedUrl.pathname.endsWith('.svg') && !dangerouslyAllowSVG) {
        return new Response('SVG not allowed', { status: 403 });
      }
      
      const format = determineFormat(request.headers.get('accept'));
      const optimalWidth = getOptimalWidth(width);
      
      return new Response(JSON.stringify({
        url: imageUrl,
        width: optimalWidth,
        quality: qualityParam,
        format,
        cacheTTL: minimumCacheTTL,
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${minimumCacheTTL}, stale-while-revalidate=${minimumCacheTTL * 2}`,
        },
      });
    },
  };
}

export function generateImageEndpoint(): string {
  return `
import { Image } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const url = new URL(request.url);
  const src = url.searchParams.get('src');
  const width = parseInt(url.searchParams.get('w') ?? '1200', 10);
  const height = parseInt(url.searchParams.get('h') ?? '630', 10);
  
  if (!src) {
    return new Response('Missing src parameter', { status: 400 });
  }
  
  try {
    return new ImageResponse(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff',
          fontSize: 48,
          fontWeight: 'bold',
        }}
      >
        <img src={src} width={width} height={height} alt="" />
      </div>,
      {
        width,
        height,
      }
    );
  } catch (e) {
    return new Response('Failed to generate image', { status: 500 });
  }
}
`;
}
