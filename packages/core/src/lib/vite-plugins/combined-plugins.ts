import type { PluginOption } from 'vite';
import type { Config } from '../../config.js';
import { allowServerPlugin } from './allow-server.js';
import { mainPlugin } from './main.js';
import { userEntriesPlugin } from './user-entries.js';
import { devServerPlugin } from './dev-server.js';

export function combinedPlugins(config: Required<Config>): PluginOption {
  return [
    allowServerPlugin(),
    mainPlugin(config),
    userEntriesPlugin(config),
  ];
}

export { allowServerPlugin } from './allow-server.js';
export { mainPlugin } from './main.js';
export { userEntriesPlugin } from './user-entries.js';
export { devServerPlugin } from './dev-server.js';
