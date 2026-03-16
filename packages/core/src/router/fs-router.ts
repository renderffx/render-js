import type { FunctionComponent, ReactNode } from 'react';
import { isIgnoredPath } from '../lib/utils/fs-router.js';
import { METHODS, createPages } from './create-pages.js';
import type { Method } from './create-pages.js';

export function fsRouter(
  pages: { [file: string]: () => Promise<unknown> },
  options: {
    apiDir: string;
    slicesDir: string;
  } = {
    apiDir: '_api',
    slicesDir: '_slices',
  },
) {
  return createPages(
    async ({
      createPage,
      createLayout,
      createRoot,
      createApi,
      createSlice,
    }) => {
      for (let file in pages) {
        const mod = (await pages[file]()) as unknown as {
          default: FunctionComponent<{ children: ReactNode }>;
          getConfig?: () => Promise<{
            render?: 'static' | 'dynamic';
          }>;
          GET?: (req: Request) => Promise<Response>;
        };

        file = new URL(file, 'http://localhost:3000').pathname.slice(1);
        const config = await mod.getConfig?.();
        const pathItems = file
          .replace(/\.\w+$/, '')
          .split('/')
          .filter(Boolean);
        if (isIgnoredPath(pathItems)) {
          continue;
        }
        const path =
          '/' +
          (['_layout', 'index', '_root'].includes(pathItems[pathItems.length - 1]!) ||
          pathItems[pathItems.length - 1]?.startsWith('_part')
            ? pathItems.slice(0, -1)
            : pathItems
          ).join('/');
        if (pathItems[pathItems.length - 1] === '[path]') {
          throw new Error(
            'Page file cannot be named [path]. This will conflict with the path prop of the page component.',
          );
        } else if (pathItems[0] === options.apiDir) {
          const apiPath = '/' + pathItems.slice(1).join('/');
          if (config?.render === 'static') {
            if (Object.keys(mod).length !== 2 || !mod.GET) {
              console.warn(
                `API ${path} is invalid. For static API routes, only a single GET handler is supported.`,
              );
            }
            createApi({
              ...config,
              path: apiPath,
              render: 'static',
              method: 'GET',
              handler: mod.GET!,
            });
          } else {
            const validMethods = new Set(METHODS);
            const handlers = Object.fromEntries(
              Object.entries(mod).flatMap(([exportName, handler]) => {
                const isValidExport =
                  exportName === 'getConfig' ||
                  exportName === 'default' ||
                  validMethods.has(exportName as Method);
                if (!isValidExport) {
                  console.warn(
                    `API ${path} has an invalid export: ${exportName}. Valid exports are: ${METHODS.join(
                      ', ',
                    )}`,
                  );
                }
                return isValidExport && exportName !== 'getConfig'
                  ? exportName === 'default'
                    ? [['all', handler]]
                    : [[exportName, handler]]
                  : [];
              }),
            );
            createApi({
              path: apiPath,
              render: 'dynamic',
              handlers,
            });
          }
        } else if (pathItems[0] === options.slicesDir) {
          createSlice({
            component: mod.default,
            render: 'static',
            id: pathItems.slice(1).join('/'),
            ...config,
          });
        } else if (pathItems[pathItems.length - 1] === '_layout') {
          createLayout({
            path,
            component: mod.default,
            render: 'static',
            ...config,
          });
        } else if (pathItems[pathItems.length - 1] === '_root') {
          createRoot({
            component: mod.default,
            render: 'static',
            ...config,
          });
        } else {
          createPage({
            path,
            component: mod.default,
            render: 'static',
            ...config,
          } as never);
        }
      }
      return null as never;
    },
  );
}
