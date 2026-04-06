// ============================================================================
// Path Utilities - Simple path manipulation helpers
// ============================================================================

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type PathSpecItem =
  | { type: 'literal'; name: string }
  | { type: 'group'; name?: string }
  | { type: 'wildcard'; name?: string };

export type PathSpec = readonly PathSpecItem[];

// --------------------------------------------------------------------------
// Simple File Path Utilities (no caching needed)
// --------------------------------------------------------------------------

export function extname(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  
  if (lastDot <= 0) {
    return '';
  }
  
  const charBefore = filePath[lastDot - 1]!;
  
  if (charBefore === '/' || charBefore === '.') {
    return '';
  }
  
  return filePath.slice(lastDot);
}

export function removeBase(url: string, base: string): string {
  if (base === '/') {
    return url;
  }
  
  if (!url.startsWith(base)) {
    return url;
  }
  
  const result = url.slice(base.length);
  return result || '/';
}

export function addBase(url: string, base: string): string {
  if (base === '/') {
    return url;
  }
  
  return base + url;
}

export function joinPath(...paths: string[]): string {
  const isAbsolute = paths[0]?.startsWith('/') ?? false;
  
  // Split all paths into segments
  const segments: string[] = [];
  
  for (const path of paths) {
    let last = 0;
    
    for (let i = 0; i < path.length; i++) {
      if (path[i] === '/') {
        if (last < i) {
          segments.push(path.slice(last, i));
        }
        last = i + 1;
      }
    }
    
    if (last < path.length) {
      segments.push(path.slice(last));
    }
  }
  
  // Process segments with simple stack
  const stack: string[] = [];
  
  for (const segment of segments) {
    if (segment === '..') {
      if (stack.length > 0 && stack[stack.length - 1]! !== '..') {
        stack.pop();
      } else if (!isAbsolute) {
        stack.push('..');
      }
    } else if (segment && segment !== '.') {
      stack.push(segment);
    }
  }
  
  const result = (isAbsolute ? '/' : '') + stack.join('/');
  
  return result || (isAbsolute ? '/' : '.');
}

// --------------------------------------------------------------------------
// Path Parsing for Routes
// --------------------------------------------------------------------------

export function parsePathWithSlug(path: string): PathSpec {
  const result: PathSpec = path
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith('...')) {
        return { type: 'wildcard' as const, name: segment.slice(3) };
      }
      
      if (segment.startsWith('[') && segment.endsWith(']')) {
        return { type: 'group' as const, name: segment.slice(1, -1) };
      }
      
      return { type: 'literal' as const, name: segment };
    });
  
  return result;
}

export function parseExactPath(path: string): PathSpec {
  return path
    .split('/')
    .filter(Boolean)
    .map((name) => ({ type: 'literal' as const, name }));
}

// --------------------------------------------------------------------------
// Path to Regex Conversion
// --------------------------------------------------------------------------

export function path2regexp(path: PathSpec): string {
  const parts: string[] = [];
  
  for (const { type, name } of path) {
    if (type === 'literal') {
      parts.push(name);
    } else if (type === 'group') {
      parts.push('([^/]+)');
    } else {
      parts.push('(.*)');
    }
  }
  
  return '^/' + parts.join('/') + '$';
}

// --------------------------------------------------------------------------
// Path Spec to String
// --------------------------------------------------------------------------

export function pathSpecAsString(path: PathSpec): string {
  const parts = path.map(({ type, name }) => {
    if (type === 'literal') {
      return name;
    }
    if (type === 'group') {
      return `[${name}]`;
    }
    return `[...${name}]`;
  });
  
  return '/' + parts.join('/');
}

// --------------------------------------------------------------------------
// Path Parameter Mapping
// --------------------------------------------------------------------------

export function getPathMapping(
  pathSpec: PathSpec,
  pathname: string,
): Record<string, string | string[]> | null {
  const segments = pathname.split('/').filter(Boolean);
  
  // Check length constraints early
  if (pathSpec.length > segments.length) {
    const hasWildcard = pathSpec.some((spec) => spec.type === 'wildcard');
    
    if (!hasWildcard || segments.length > 0) {
      return null;
    }
  }
  
  const mapping: Record<string, string | string[]> = {};
  let wildcardIndex = -1;
  
  // Parse non-wildcard segments
  for (let i = 0; i < pathSpec.length; i++) {
    const spec = pathSpec[i]!;
    
    if (spec.type === 'literal') {
      if (spec.name !== segments[i]) {
        return null;
      }
      continue;
    }
    
    if (spec.type === 'wildcard') {
      wildcardIndex = i;
      break;
    }
    
    // group type
    if (spec.name) {
      mapping[spec.name] = segments[i]!;
    }
  }
  
  // Handle wildcard
  if (wildcardIndex === -1) {
    if (pathSpec.length !== segments.length) {
      return null;
    }
    return mapping;
  }
  
  // Wildcard present - validate trailing literal
  if (wildcardIndex === 0 && segments.length === 0) {
    const wildcardName = pathSpec[0]!.name;
    if (wildcardName) {
      mapping[wildcardName] = [];
    }
    return mapping;
  }
  
  // Find wildcard end by matching from end
  let wildcardEnd = -1;
  
  for (let i = 0; i < pathSpec.length; i++) {
    const spec = pathSpec[pathSpec.length - i - 1]!;
    const segIndex = segments.length - i - 1;
    
    if (spec.type === 'literal') {
      if (spec.name !== segments[segIndex]) {
        return null;
      }
      continue;
    }
    
    if (spec.type === 'wildcard') {
      wildcardEnd = segIndex;
      break;
    }
    
    if (spec.name) {
      mapping[spec.name] = segments[segIndex]!;
    }
  }
  
  if (wildcardEnd === -1) {
    return null;
  }
  
  const wildcardName = pathSpec[wildcardIndex]!.name;
  if (wildcardName) {
    mapping[wildcardName] = segments.slice(wildcardIndex, wildcardEnd + 1);
  }
  
  return mapping;
}

// --------------------------------------------------------------------------
// File URL Conversions
// --------------------------------------------------------------------------

export function filePathToFileURL(filePath: string): string {
  return 'file://' + encodeURI(filePath);
}

export function fileURLToFilePath(fileURL: string): string {
  if (!fileURL.startsWith('file://')) {
    throw new Error('Not a file URL');
  }
  
  return decodeURI(fileURL.slice('file://'.length));
}

// Windows paths like /C:/Users/... need special handling
const WIN32_ABSOLUTE_REGEX = /^\/[a-zA-Z]:\//;

export function encodeFilePathToAbsolute(filePath: string): string {
  if (WIN32_ABSOLUTE_REGEX.test(filePath)) {
    throw new Error('Unsupported absolute file path: ' + filePath);
  }
  
  if (filePath.startsWith('/')) {
    return filePath;
  }
  
  return '/' + filePath;
}

export function decodeFilePathFromAbsolute(filePath: string): string {
  if (WIN32_ABSOLUTE_REGEX.test(filePath)) {
    return filePath.slice(1);
  }
  
  return filePath;
}
