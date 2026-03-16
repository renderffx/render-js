import type { Plugin } from 'vite';
import { SRC_CLIENT_ENTRY, SRC_SERVER_ENTRY } from '../constants.js';

export function userEntriesPlugin({ srcDir }: { srcDir: string }): Plugin {
  return {
    name: 'render:vite-plugins:user-entries',
    async resolveId(source, _importer, options) {
      if (source === 'virtual:vite-rsc-render/server-entry') {
        return '\0' + source;
      }
      if (source === 'virtual:vite-rsc-render/server-entry-inner') {
        const resolved = await this.resolve(
          `/${srcDir}/${SRC_SERVER_ENTRY}`,
          undefined,
          options,
        );
        return resolved ? resolved : '\0' + source;
      }
      if (source === 'virtual:vite-rsc-render/client-entry') {
        const resolved = await this.resolve(
          `/${srcDir}/${SRC_CLIENT_ENTRY}`,
          undefined,
          options,
        );
        return resolved ? resolved : '\0' + source;
      }
    },
    load(id) {
      if (id === '\0virtual:vite-rsc-render/server-entry') {
        return `\
export { default } from 'virtual:vite-rsc-render/server-entry-inner';
if (import.meta.hot) {
  import.meta.hot.accept()
}
`;
      }
      if (id === '\0virtual:vite-rsc-render/server-entry-inner') {
        return getManagedServerEntry(srcDir);
      }
      if (id === '\0virtual:vite-rsc-render/client-entry') {
        return getManagedClientEntry();
      }
    },
  };
}

function getManagedServerEntry(srcDir: string): string {
  return `
import { unstable_defineServerEntry } from '@render.js/core';

const { default: serverEntry, ...exports } = unstable_defineServerEntry({
  basePath: '/',
  srcDir: '${srcDir}',
  future: {},
});

export default serverEntry;
export const config = serverEntry.config;
export const fetch: typeof serverEntry.fetch = serverEntry.fetch;
${Object.keys(exports).map((k) => `export const ${k} = exports.${k};`).join('\n')}
`;
}

function getManagedClientEntry(): string {
  return `
import { Root, Slot, Children, useRefetch } from '@render.js/core';

export { Root, Slot, Children, useRefetch };
`;
}
