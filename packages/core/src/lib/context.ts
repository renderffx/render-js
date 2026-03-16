import { AsyncLocalStorage } from 'node:async_hooks';

type Context = {
  readonly req: Request;
  nonce: string | undefined;
  readonly data: Record<string, unknown>;
};

const contextStorage = new AsyncLocalStorage<Context>();

export function unstable_runWithContext<T>(req: Request, next: () => T): T {
  const context: Context = {
    req,
    nonce: undefined,
    data: {},
  };
  return contextStorage.run(context, next);
}

export function unstable_getContext(): Context {
  const context = contextStorage.getStore();
  if (!context) {
    throw new Error(
      'Context is not available. Make sure to use the context middleware.',
    );
  }
  return context;
}

export function unstable_getContextData(key?: string): unknown {
  const context = contextStorage.getStore();
  if (!context) {
    return undefined;
  }
  if (key) {
    return context.data[key];
  }
  return context.data;
}
