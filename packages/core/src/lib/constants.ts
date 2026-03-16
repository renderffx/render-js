export const EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs'];
export const SRC_CLIENT_ENTRY = 'render.client';
export const SRC_SERVER_ENTRY = 'render.server';
export const SRC_PAGES = 'pages';
export const SRC_MIDDLEWARE = 'middleware';

export const DIST_PUBLIC = 'public';
export const DIST_SERVER = 'server';
export const BUILD_METADATA_FILE = '__render_build_metadata.js';

export const unstable_constants = {
  DIST_PUBLIC: '_rsc',
  ENTRY_JSON: 'entry.json',
  SERVER_BUNDLE: 'bundle.js',
  RSC_PATH: '_rsc',
  HTML_PATH: 'index.html',
} as const;

export const RSC_CONTENT_TYPE = 'text/x-component';
export const HTML_CONTENT_TYPE = 'text/html';
