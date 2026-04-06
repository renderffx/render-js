import { unstable_defineServerEntry } from '@renderjs/core';

const serverEntry = unstable_defineServerEntry({
  basePath: '/',
  srcDir: 'src',
  getRoutes: async function* () {
    // Routes are discovered automatically from src/pages/
  },
  future: {},
});

export default serverEntry;
