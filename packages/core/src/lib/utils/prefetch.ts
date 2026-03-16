export interface PrefetchOptions {
  as?: string;
  crossOrigin?: string;
}

export function prefetch(url: string, options: PrefetchOptions = {}): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.setAttribute('as', options.as || 'script');
  
  if (options.crossOrigin) {
    link.setAttribute('crossOrigin', options.crossOrigin);
  }
  
  document.head.appendChild(link);
}

export function preload(url: string, options: PrefetchOptions = {}): void {
  if (typeof document === 'undefined') return;
  
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  link.setAttribute('as', options.as || 'script');
  
  if (options.crossOrigin) {
    link.setAttribute('crossOrigin', options.crossOrigin);
  }
  
  document.head.appendChild(link);
}

export function preloadFont(url: string, options: { crossOrigin?: string } = {}): void {
  preload(url, { as: 'font', ...options });
}

export function preloadImage(url: string, options: { crossOrigin?: string } = {}): void {
  preload(url, { as: 'image', ...options });
}

export function prefetchModule(url: string): void {
  prefetch(url, { as: 'script' });
}

export function eagerPreload(url: string): void {
  preload(url, { as: 'script' });
}

export interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function lazyLoadImage(
  img: HTMLImageElement,
  src: string,
  options: LazyLoadOptions = {}
): void {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          img.src = src;
          if (options.onLoad) img.addEventListener('load', options.onLoad);
          if (options.onError) img.addEventListener('error', options.onError);
          observer.disconnect();
        }
      });
    }, {
      threshold: options.threshold || 0,
      rootMargin: options.rootMargin || '100px',
    });
    
    observer.observe(img);
  } else {
    img.src = src;
  }
}

export interface ImagePreloaderOptions {
  onLoad?: () => void;
  onError?: () => void;
}

export function createImagePreloader(options: ImagePreloaderOptions = {}) {
  const loaded = new Set<string>();
  const loading = new Set<string>();

  return {
    preload(url: string): void {
      if (loaded.has(url) || loading.has(url)) return;
      
      loading.add(url);
      const img = new Image();
      img.onload = () => {
        loading.delete(url);
        loaded.add(url);
        options.onLoad?.();
      };
      img.onerror = () => {
        loading.delete(url);
        options.onError?.();
      };
      img.src = url;
    },
    
    isLoaded(url: string): boolean {
      return loaded.has(url);
    },
    
    reset(): void {
      loaded.clear();
      loading.clear();
    },
  };
}
