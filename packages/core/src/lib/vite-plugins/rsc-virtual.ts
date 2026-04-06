import type { Plugin } from 'vite';

const VIRTUAL_RSC_ID = 'virtual:rsc';
const RESOLVED_VIRTUAL_RSC_ID = '\0' + VIRTUAL_RSC_ID;

export function rscVirtualPlugin(): Plugin {
  return {
    name: 'render:rsc-virtual',
    enforce: 'pre',
    
    resolveId(id) {
      if (id === VIRTUAL_RSC_ID || id === '@vitejs/plugin-rsc/rsc' || id === '@vitejs/plugin-rsc') {
        return RESOLVED_VIRTUAL_RSC_ID;
      }
      return undefined;
    },
    
    load(id) {
      if (id === RESOLVED_VIRTUAL_RSC_ID) {
        return generateRSCVirtualModule();
      }
      return undefined;
    },
    
    transform(code, id) {
      if (id.includes('@vitejs/plugin-rsc')) {
        return generateRSCVirtualModule();
      }
      return undefined;
    },
  };
}

function generateRSCVirtualModule(): string {
  return `
import { 
  renderToReadableStream as _render, 
  createFromReadableStream as _fromStream,
  decodeReply as _decodeReply,
  decodeAction as _decodeAction,
  createTemporaryReferenceSet as _createTempRef,
  encodeReply as _encodeReply,
} from '@renderjs/core';

export const renderToReadableStream = _render;
export const createFromReadableStream = _fromStream;
export const decodeReply = _decodeReply;
export const decodeAction = _decodeAction;
export const createTemporaryReferenceSet = _createTempRef;
export const encodeReply = _encodeReply;

export function registerClientReference(id, name, deps) {
  return { id, name, deps };
}

export function registerServerReference(id, name, args) {
  return { id, name, args };
}

export function createClientManifest(clientRefs) {
  return {
    clientRefs,
    moduleMap: new Map(),
    async getModuleInfo(id) {
      return this.moduleMap.get(id);
    },
  };
}

export function createServerManifest(serverRefs) {
  return {
    serverRefs,
    clientModules: new Map(),
    async getModuleInfo(id) {
      return this.clientModules.get(id);
    },
  };
}

export function createClientTemporaryReferenceSet(options) {
  return _createTempRef({ ...options, readonly: true });
}

export function decodeFormState(body, context) {
  return _decodeReply(body, context);
}

export function encryptActionBoundArgs(args, actionId) {
  return JSON.stringify({ args, actionId });
}

export function decryptActionBoundArgs(encrypted, actionId) {
  try {
    const parsed = JSON.parse(encrypted);
    if (parsed.actionId === actionId) {
      return parsed.args;
    }
  } catch {}
  return null;
}

export function loadServerAction(actionId) {
  return async (...args) => {
    const formData = new FormData();
    formData.append('_action', JSON.stringify({ actionId, args }));
    
    const response = await fetch('/_action', {
      method: 'POST',
      body: formData,
    });
    
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Action failed');
    }
    return result.data;
  };
}

export function setRequireModule(resolver) {
  // Reserved for module resolution
}

export default {
  renderToReadableStream,
  createFromReadableStream,
  decodeReply,
  decodeAction,
  createTemporaryReferenceSet,
  encodeReply,
  registerClientReference,
  registerServerReference,
  createClientManifest,
  createServerManifest,
  createClientTemporaryReferenceSet,
  decodeFormState,
  encryptActionBoundArgs,
  decryptActionBoundArgs,
  loadServerAction,
  setRequireModule,
};
`;
}

export { VIRTUAL_RSC_ID, RESOLVED_VIRTUAL_RSC_ID };
