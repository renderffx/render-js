export function isIgnoredPath(pathItems: string[]): boolean {
  return pathItems[0]?.startsWith('_') && !['_layout', '_root'].includes(pathItems[0]!);
}
