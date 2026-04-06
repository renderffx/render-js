import { AsyncLocalStorage } from 'node:async_hooks';
import { serializeValue, deserializeValue, createFlightEncoder } from './flight-protocol.js';

export interface ServerActionOptions {
  id?: string;
  deduplicate?: boolean;
  cacheKey?: string;
  idempotencyKey?: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
}

interface ActionContext {
  pendingActions: Map<string, Promise<unknown>>;
  actionCache: Map<string, { data: unknown; timestamp: number; ttl: number }>;
  actionListeners: Map<string, Set<(result: ActionResult) => void>>;
  idCounter: number;
}

const actionStorage = new AsyncLocalStorage<ActionContext>();

function createActionContext(): ActionContext {
  return {
    pendingActions: new Map(),
    actionCache: new Map(),
    actionListeners: new Map(),
    idCounter: 0,
  };
}

export function runWithActionContext<T>(fn: () => T): T {
  const context = createActionContext();
  return actionStorage.run(context, fn);
}

function getActionContext(): ActionContext {
  const ctx = actionStorage.getStore();
  if (!ctx) {
    throw new Error(
      'Action context not available. Ensure you are within runWithActionContext.'
    );
  }
  return ctx;
}

export function generateActionId(prefix: string = 'action'): string {
  let ctx = actionStorage.getStore();
  if (!ctx) {
    ctx = createActionContext();
    actionStorage.run(ctx, () => {});
  }
  return `${prefix}_${Date.now()}_${++ctx.idCounter}`;
}

export function createServerActionId(actionName: string, modulePath?: string): string {
  const hash = createHash(actionName + (modulePath || ''));
  return `SA_${hash}`;
}

function createHash(str: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  let hash1 = 5381;
  let hash2 = 5274;
  
  for (let i = 0; i < data.length; i++) {
    hash1 = ((hash1 << 5) + hash1) ^ data[i];
    hash2 = ((hash2 << 5) + hash2) ^ data[i];
  }
  
  const combined = ((hash1 >>> 0) * 31 + (hash2 >>> 0)) >>> 0;
  return combined.toString(36);
}

export async function executeServerAction<T>(
  action: (...args: unknown[]) => Promise<T>,
  args: unknown[],
  options: ServerActionOptions = {}
): Promise<ActionResult<T>> {
  const ctx = getActionContext();
  const { deduplicate = true, cacheKey, id } = options;
  const actionId = id || generateActionId(action.name || 'anonymous');
  const dedupeKey = cacheKey || `${actionId}:${JSON.stringify(args)}`;
  
  if (deduplicate) {
    const existingPromise = ctx.pendingActions.get(dedupeKey);
    if (existingPromise) {
      try {
        const result = await existingPromise;
        return { success: true, data: result as T };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error 
            ? { message: error.message, stack: error.stack, name: error.name }
            : { message: String(error) }
        };
      }
    }
    
    const actionPromise = (async () => {
      try {
        const result = await action(...args);
        notifyListeners(ctx, actionId, { success: true, data: result });
        return result;
      } catch (error) {
        const errorResult: ActionResult = {
          success: false,
          error: error instanceof Error 
            ? { message: error.message, stack: error.stack, name: error.name }
            : { message: String(error) }
        };
        notifyListeners(ctx, actionId, errorResult);
        throw error;
      } finally {
        ctx.pendingActions.delete(dedupeKey);
      }
    })();
    
    ctx.pendingActions.set(dedupeKey, actionPromise);
    
    try {
      const result = await actionPromise;
      return { success: true, data: result as T };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error 
          ? { message: error.message, stack: error.stack, name: error.name }
          : { message: String(error) }
      };
    }
  }
  
  try {
    const result = await action(...args);
    notifyListeners(ctx, actionId, { success: true, data: result });
    return { success: true, data: result as T };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error 
        ? { message: error.message, stack: error.stack, name: error.name }
        : { message: String(error) }
    };
  }
}

export function addActionListener(actionId: string, listener: (result: ActionResult) => void): () => void {
  const ctx = getActionContext();
  
  if (!ctx.actionListeners.has(actionId)) {
    ctx.actionListeners.set(actionId, new Set());
  }
  ctx.actionListeners.get(actionId)!.add(listener);
  
  return () => {
    const listeners = ctx.actionListeners.get(actionId);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        ctx.actionListeners.delete(actionId);
      }
    }
  };
}

function notifyListeners(ctx: ActionContext, actionId: string, result: ActionResult): void {
  const listeners = ctx.actionListeners.get(actionId);
  if (listeners) {
    for (const listener of listeners) {
      try {
        listener(result);
      } catch (err) {
        console.error('[Server Actions] Listener error:', err);
      }
    }
  }
}

export function serializeActionArgs(args: unknown[]): string {
  const serialized = args.map(arg => serializeValue(arg));
  return JSON.stringify(serialized);
}

export function deserializeActionArgs(serialized: string): unknown[] {
  try {
    const parsed = JSON.parse(serialized);
    return parsed.map((val: unknown) => deserializeValue(val as Parameters<typeof deserializeValue>[0]));
  } catch {
    return [];
  }
}

export function createActionCache(options: { ttl?: number; maxSize?: number } = {}) {
  const { ttl = 60000, maxSize = 1000 } = options;
  
  return {
    get<T>(key: string): T | undefined {
      const ctx = getActionContext();
      const entry = ctx.actionCache.get(key);
      if (!entry) return undefined;
      
      if (Date.now() > entry.timestamp + ttl) {
        ctx.actionCache.delete(key);
        return undefined;
      }
      
      return entry.data as T;
    },
    
    set<T>(key: string, data: T): void {
      const ctx = getActionContext();
      
      if (ctx.actionCache.size >= maxSize) {
        const oldestKey = ctx.actionCache.keys().next().value;
        if (oldestKey !== undefined) {
          ctx.actionCache.delete(oldestKey);
        }
      }
      ctx.actionCache.set(key, { data, timestamp: Date.now(), ttl });
    },
    
    invalidate(key?: string): void {
      const ctx = getActionContext();
      
      if (key) {
        ctx.actionCache.delete(key);
      } else {
        ctx.actionCache.clear();
      }
    },
    
    invalidatePattern(pattern: RegExp): number {
      const ctx = getActionContext();
      let count = 0;
      for (const key of ctx.actionCache.keys()) {
        if (pattern.test(key)) {
          ctx.actionCache.delete(key);
          count++;
        }
      }
      return count;
    },
    
    clear(): void {
      const ctx = getActionContext();
      ctx.actionCache.clear();
    },
    
    size(): number {
      const ctx = getActionContext();
      return ctx.actionCache.size;
    },
  };
}

export interface ActionDispatcherOptions {
  maxConcurrent?: number;
  deduplicate?: boolean;
  cacheTTL?: number;
  useContext?: boolean;
}

export function createActionDispatcher(options: ActionDispatcherOptions = {}) {
  const {
    maxConcurrent = 100,
    deduplicate = true,
    cacheTTL = 60000,
    useContext = true,
  } = options;
  
  const ctx = useContext ? getActionContext() : null;
  const pendingCount = new Map<string, number>();
  const queue: Array<() => void> = [];
  
  const cache = createActionCache({ ttl: cacheTTL });
  
  function canExecute(): boolean {
    const total = Array.from(pendingCount.values()).reduce((a, b) => a + b, 0);
    return total < maxConcurrent;
  }
  
  function executeNext(): void {
    if (queue.length > 0 && canExecute()) {
      const next = queue.shift();
      if (next) next();
    }
  }
  
  async function dispatch<T>(
    actionId: string,
    action: (...args: unknown[]) => Promise<T>,
    args: unknown[],
    actionOptions: ServerActionOptions = {}
  ): Promise<ActionResult<T>> {
    if (!canExecute()) {
      return new Promise((resolve) => {
        queue.push(async () => {
          const result = await executeServerAction(action, args, {
            ...actionOptions,
            deduplicate,
            id: actionId,
          });
          resolve(result as ActionResult<T>);
          executeNext();
        });
      });
    }
    
    const currentCount = pendingCount.get(actionId) || 0;
    pendingCount.set(actionId, currentCount + 1);
    
    try {
      const result = await executeServerAction(action, args, {
        ...actionOptions,
        deduplicate,
        id: actionId,
      });
      return result as ActionResult<T>;
    } finally {
      const newCount = (pendingCount.get(actionId) || 1) - 1;
      if (newCount <= 0) {
        pendingCount.delete(actionId);
      } else {
        pendingCount.set(actionId, newCount);
      }
      executeNext();
    }
  }
  
  function getPendingCount(actionId?: string): number {
    if (actionId) {
      return pendingCount.get(actionId) || 0;
    }
    return Array.from(pendingCount.values()).reduce((a, b) => a + b, 0);
  }
  
  function isPending(actionId: string): boolean {
    return (pendingCount.get(actionId) || 0) > 0;
  }
  
  function clearPending(): void {
    const actionCtx = getActionContext();
    actionCtx.pendingActions.clear();
    pendingCount.clear();
    queue.length = 0;
  }
  
  return {
    dispatch,
    cache,
    getPendingCount,
    isPending,
    clearPending,
    addActionListener,
    options,
  };
}

let _defaultActionDispatcher: ReturnType<typeof createActionDispatcher> | null = null;

function getDefaultActionDispatcher() {
  if (!_defaultActionDispatcher) {
    _defaultActionDispatcher = createActionDispatcher({ useContext: false });
  }
  return _defaultActionDispatcher;
}

export function defaultActionDispatcher() {
  return getDefaultActionDispatcher();
}

export function invalidateActionCache(key?: string): void {
  getDefaultActionDispatcher().cache.invalidate(key);
}

export function revalidateActionTag(tag: string): void {
  invalidateActionCache();
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`:${escapedTag}(:|$)`);
  getDefaultActionDispatcher().cache.invalidatePattern(pattern);
}

export function clearAllActions(): void {
  const ctx = getActionContext();
  ctx.pendingActions.clear();
  ctx.actionCache.clear();
  getDefaultActionDispatcher().clearPending();
  resetActionState();
}

export function resetActionState(): void {
  const ctx = getActionContext();
  ctx.pendingActions.clear();
  ctx.actionListeners.clear();
  ctx.idCounter = 0;
}
