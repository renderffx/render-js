import type { PluginOption } from 'vite';
import type { Config } from '../../config.js';
import { mainPlugin } from './main.js';
import { userEntriesPlugin } from './user-entries.js';
import { devServerPlugin } from './dev-server.js';
import { rscVirtualPlugin } from './rsc-virtual.js';
import { SRC_PAGES, SRC_CLIENT_ENTRY, SRC_SERVER_ENTRY } from '../constants.js';

export { mainPlugin, userEntriesPlugin, devServerPlugin, rscVirtualPlugin };

export function combinedPlugins(config: Required<Config>): PluginOption {
  const pagesDir = `${config.srcDir}/${config.routes.pagesDir || SRC_PAGES}`;
  const apiDir = `${config.srcDir}/${config.routes.apiDir || 'api'}`;
  const clientEntry = `${config.srcDir}/${SRC_CLIENT_ENTRY}`;
  const serverEntry = `${config.srcDir}/${SRC_SERVER_ENTRY}`;

  return [
    rscVirtualPlugin(),
    ...mainPlugin(config),
    userEntriesPlugin({ srcDir: config.srcDir, config }),
    devServerPlugin(config),
  ];
}

export default combinedPlugins;
