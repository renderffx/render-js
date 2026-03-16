const FUNC_PREFIX = 'F:';

export function encodeFuncId(funcId: string): string {
  return FUNC_PREFIX + funcId;
}

export function decodeFuncId(rscPath: string): string | null {
  if (!rscPath.startsWith(FUNC_PREFIX)) {
    return null;
  }
  return rscPath.slice(FUNC_PREFIX.length);
}

const rscPathCache = new Map<string, string>();
const rscDecodeCache = new Map<string, string>();

export function encodeRscPath(rscPath: string): string {
  const cached = rscPathCache.get(rscPath);
  if (cached) {
    return cached;
  }
  const encoded = encodeURIComponent(rscPath);
  rscPathCache.set(rscPath, encoded);
  return encoded;
}

export function decodeRscPath(encodedRscPath: string): string {
  const cached = rscDecodeCache.get(encodedRscPath);
  if (cached) {
    return cached;
  }
  const decoded = decodeURIComponent(encodedRscPath);
  rscDecodeCache.set(encodedRscPath, decoded);
  return decoded;
}
