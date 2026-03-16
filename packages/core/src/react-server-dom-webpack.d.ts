declare module 'react-server-dom-webpack/client' {
  export function createFromFetch<T>(...args: unknown[]): Promise<T>;
  export function encodeReply(...args: unknown[]): Promise<ReadableStream | URLSearchParams>;
  export function createTemporaryReferenceSet(): unknown;
}
