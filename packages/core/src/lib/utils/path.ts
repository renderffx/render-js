const ABSOLUTE_WIN32_PATH_REGEXP = /^\/[a-zA-Z]:\//;

const pathSpecCache = new Map<string, PathSpec>();
const pathRegexpCache = new Map<string, string>();
const pathMappingCache = new Map<string, Record<string, string | string[]> | null>();
const joinPathCache = new Map<string, string>();
const pathSpecStringCache = new Map<string, string>();

const MAX_CACHE_SIZE = 1000;

const evictCache = <K, V>(cache: Map<K, V>) => {
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(cache.entries());
    cache.clear();
    const toKeep = entries.slice(-MAX_CACHE_SIZE / 2);
    toKeep.forEach(([k, v]) => cache.set(k, v));
  }
};

export const encodeFilePathToAbsolute = (filePath: string) => {
  if (ABSOLUTE_WIN32_PATH_REGEXP.test(filePath)) {
    throw new Error('Unsupported absolute file path: ' + filePath);
  }
  if (filePath.startsWith('/')) {
    return filePath;
  }
  return '/' + filePath;
};

export const decodeFilePathFromAbsolute = (filePath: string) => {
  if (ABSOLUTE_WIN32_PATH_REGEXP.test(filePath)) {
    return filePath.slice(1);
  }
  return filePath;
};

export const filePathToFileURL = (filePath: string) =>
  'file://' + encodeURI(filePath);

export const fileURLToFilePath = (fileURL: string) => {
  if (!fileURL.startsWith('file://')) {
    throw new Error('Not a file URL');
  }
  return decodeURI(fileURL.slice('file://'.length));
};

export const joinPath = (...paths: string[]): string => {
  const cacheKey = paths.join('|||');
  const cached = joinPathCache.get(cacheKey);
  if (cached) return cached;
  
  const isAbsolute = paths[0]?.startsWith('/');
  const items = ([] as string[]).concat(
    ...paths.map((path) => path.split('/')),
  );
  const stack: string[] = [];
  for (const item of items) {
    if (item === '..') {
      if (stack.length && stack[stack.length - 1] !== '..') {
        stack.pop();
      } else if (!isAbsolute) {
        stack.push('..');
      }
    } else if (item && item !== '.') {
      stack.push(item);
    }
  }
  const result = (isAbsolute ? '/' : '') + stack.join('/') || '.';
  
  evictCache(joinPathCache);
  joinPathCache.set(cacheKey, result);
  return result;
};

export const extname = (filePath: string): string => {
  const index = filePath.lastIndexOf('.');
  if (index <= 0) {
    return '';
  }
  if (['/', '.'].includes(filePath[index - 1]!)) {
    return '';
  }
  return filePath.slice(index);
};

export type PathSpecItem =
  | { type: 'literal'; name: string }
  | { type: 'group'; name?: string }
  | { type: 'wildcard'; name?: string };
export type PathSpec = readonly PathSpecItem[];

export const parsePathWithSlug = (path: string): PathSpec => {
  const cached = pathSpecCache.get(path);
  if (cached) return cached;
  
  const result: PathSpec = path
    .split('/')
    .filter(Boolean)
    .map((name) => {
      let type: 'literal' | 'group' | 'wildcard' = 'literal';
      const isSlug = name.startsWith('[') && name.endsWith(']');
      if (isSlug) {
        type = 'group';
        name = name.slice(1, -1);
      }
      const isWildcard = name.startsWith('...');
      if (isWildcard) {
        type = 'wildcard';
        name = name.slice(3);
      }
      return { type, name };
    });
    
  evictCache(pathSpecCache);
  pathSpecCache.set(path, result);
  return result;
};

export const parseExactPath = (path: string): PathSpec =>
  path
    .split('/')
    .filter(Boolean)
    .map((name) => ({ type: 'literal', name }));

export const path2regexp = (path: PathSpec): string => {
  const cacheKey = JSON.stringify(path);
  const cached = pathRegexpCache.get(cacheKey);
  if (cached) return cached;
  
  const parts = path.map(({ type, name }) => {
    if (type === 'literal') {
      return name;
    } else if (type === 'group') {
      return `([^/]+)`;
    } else {
      return `(.*)`;
    }
  });
  const result = `^/${parts.join('/')}$`;
  
  evictCache(pathRegexpCache);
  pathRegexpCache.set(cacheKey, result);
  return result;
};

export const pathSpecAsString = (path: PathSpec): string => {
  const cacheKey = JSON.stringify(path);
  const cached = pathSpecStringCache.get(cacheKey);
  if (cached) return cached;
  
  const result = (
    '/' +
    path
      .map(({ type, name }) => {
        if (type === 'literal') {
          return name;
        } else if (type === 'group') {
          return `[${name}]`;
        } else {
          return `[...${name}]`;
        }
      })
      .join('/')
  );
  
  evictCache(pathSpecStringCache);
  pathSpecStringCache.set(cacheKey, result);
  return result;
};

export const getPathMapping = (
  pathSpec: PathSpec,
  pathname: string,
): Record<string, string | string[]> | null => {
  const cacheKey = JSON.stringify(pathSpec) + '|||' + pathname;
  const cached = pathMappingCache.get(cacheKey);
  if (cached !== undefined) return cached;
  
  const actual = pathname.split('/').filter(Boolean);
  if (pathSpec.length > actual.length) {
    const hasWildcard = pathSpec.some((spec) => spec.type === 'wildcard');
    if (!hasWildcard || actual.length > 0) {
      pathMappingCache.set(cacheKey, null);
      return null;
    }
  }
  const mapping: Record<string, string | string[]> = {};
  let wildcardStartIndex = -1;
  for (let i = 0; i < pathSpec.length; i++) {
    const { type, name } = pathSpec[i]!;
    if (type === 'literal') {
      if (name !== actual[i]) {
        pathMappingCache.set(cacheKey, null);
        return null;
      }
    } else if (type === 'wildcard') {
      wildcardStartIndex = i;
      break;
    } else if (name) {
      mapping[name] = actual[i]!;
    }
  }
  if (wildcardStartIndex === -1) {
    if (pathSpec.length !== actual.length) {
      pathMappingCache.set(cacheKey, null);
      return null;
    }
    pathMappingCache.set(cacheKey, mapping);
    return mapping;
  }

  if (wildcardStartIndex === 0 && actual.length === 0) {
    const wildcardName = pathSpec[wildcardStartIndex]!.name;
    if (wildcardName) {
      mapping[wildcardName] = [];
    }
    pathMappingCache.set(cacheKey, mapping);
    return mapping;
  }

  let wildcardEndIndex = -1;
  for (let i = 0; i < pathSpec.length; i++) {
    const { type, name } = pathSpec[pathSpec.length - i - 1]!;
    if (type === 'literal') {
      if (name !== actual[actual.length - i - 1]) {
        pathMappingCache.set(cacheKey, null);
        return null;
      }
    } else if (type === 'wildcard') {
      wildcardEndIndex = actual.length - i - 1;
      break;
    } else if (name) {
      mapping[name] = actual[actual.length - i - 1]!;
    }
  }
  if (wildcardStartIndex === -1 || wildcardEndIndex === -1) {
    pathMappingCache.set(cacheKey, null);
    return null;
  }
  const wildcardName = pathSpec[wildcardStartIndex]!.name;
  if (wildcardName) {
    mapping[wildcardName] = actual.slice(
      wildcardStartIndex,
      wildcardEndIndex + 1,
    );
  }
  pathMappingCache.set(cacheKey, mapping);
  return mapping;
};

export function removeBase(url: string, base: string) {
  if (base !== '/') {
    if (!url.startsWith(base)) {
      return url;
    }
    return url.slice(base.length) || '/';
  }
  return url;
}

export function addBase(url: string, base: string) {
  if (base !== '/') {
    return base + url;
  }
  return url;
}
