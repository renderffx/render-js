declare module 'virtual:@renderjs/server-entry' {
  const serverEntry: any;
  export default serverEntry;
  export const unstable_serverEntry: any;
  export function INTERNAL_runFetch(env: Readonly<Record<string, string>>, req: Request, ...args: any[]): Promise<Response>;
}

declare module 'virtual:@renderjs/client-entry' {
  import type { FC, ReactNode } from 'react';
  export const Root: FC<{ children?: ReactNode }>;
  export const Slot: FC;
  export const Children: FC<{ children?: ReactNode }>;
  export function useRefetch(): () => void;
}
