export const METHODS = [
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'PATCH',
] as const;
export type Method = (typeof METHODS)[number];

export function createPages<AllPages extends unknown[]>(
  fn: (fns: any) => Promise<AllPages>,
) {
  return fn as any;
}
