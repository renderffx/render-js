import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, existsSync, cpSync, readdirSync, statSync, readFileSync, rmSync } from 'node:fs';
import type { Plugin, RunnableDevEnvironment, UserConfig } from 'vite';
import { mergeConfig } from 'vite';
import type { Config } from '../../config.js';
import {
  DIST_PUBLIC,
  DIST_SERVER,
  SRC_CLIENT_ENTRY,
  SRC_PAGES,
  SRC_SERVER_ENTRY,
} from '../constants.js';

const PKG_NAME = '@render.js/core';
const __dirname = fileURLToPath(new URL('.', import.meta.url));

function getVercelOutputDirs(config: Required<Config>) {
  const vercelConfig = config.vercel || {};
  const outputDir = vercelConfig.outputDir || '.vercel/output';
  return {
    outputDir,
    staticDir: `${outputDir}/static`,
    functionsDir: `${outputDir}/functions`,
  };
}

function copyDirRecursive(src: string, dest: string) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

function generateVcConfig(runtime: string, handler: string, options: {
  memory?: number;
  maxDuration?: number;
  regions?: string[];
  launcherType?: string;
  shouldAddHelpers?: boolean;
  supportsResponseStreaming?: boolean;
  entrypoint?: string;
  envVarsInUse?: string[];
  architecture?: string;
  supportsWrapper?: boolean;
  environment?: { key: string; value?: string }[];
} = {}) {
  const config: Record<string, unknown> = {
    runtime,
  };
  
  if (runtime === 'edge') {
    if (handler) config.entrypoint = handler;
    if (options.envVarsInUse) config.envVarsInUse = options.envVarsInUse;
    if (options.regions) config.regions = options.regions;
    if (options.architecture) config.architecture = options.architecture;
  } else {
    config.handler = handler;
    if (options.memory) config.memory = options.memory;
    if (options.maxDuration) config.maxDuration = options.maxDuration;
    if (options.regions) config.regions = options.regions;
    if (options.launcherType) config.launcherType = options.launcherType;
    if (options.shouldAddHelpers !== undefined) config.shouldAddHelpers = options.shouldAddHelpers;
    if (options.supportsResponseStreaming !== undefined) config.supportsResponseStreaming = options.supportsResponseStreaming;
    if (options.architecture) config.architecture = options.architecture;
    if (options.supportsWrapper !== undefined) config.supportsWrapper = options.supportsWrapper;
    if (options.environment && options.environment.length > 0) config.environment = options.environment;
  }
  
  return config;
}

function generateNodeHandler(): string {
  return `
const server = require('./bundle.js');

module.exports = async function (req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const request = new Request(url.href, {
      method: req.method || 'GET',
      headers: req.headers || {},
      body: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) ? req.body : null,
    });
    
    const response = await server.fetch(request);
    
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    if (response.body) {
      for await (const chunk of response.body) {
        res.write(chunk);
      }
    }
    res.end();
  } catch (error) {
    console.error('Handler error:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
};

module.exports.fetch = async function (req) {
  const url = new URL(req.url, 'http://localhost');
  const request = new Request(url.href, {
    method: req.method || 'GET',
    headers: req.headers || {},
  });
  
  if (server.default) {
    return server.default.fetch(request);
  }
  if (server.fetch) {
    return server.fetch(request);
  }
  if (server.handleRequest) {
    let buildMetadata = {};
    try {
      const fs = require('fs');
      const metadataPath = require('path').join(__dirname, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        buildMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      }
    } catch (e) {}
    
    const renderRsc = async (elements) => {
      const { renderToReadableStream } = await import('virtual:rsc');
      return await renderToReadableStream(elements);
    };
    const parseRsc = async (stream) => {
      const { createFromReadableStream } = await import('virtual:rsc');
      return createFromReadableStream(stream, {});
    };
    const renderHtml = async (rscStream) => {
      return new Response(rscStream, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    };
    const loadBuildMetadata = async (key) => buildMetadata[key];
    return server.handleRequest(
      { req: request, pathname: url.pathname, type: 'html' },
      { renderRsc, parseRsc, renderHtml, loadBuildMetadata }
    );
  }
  return new Response('Not Found', { status: 404 });
};
`;
}

function generateEdgeHandler(): string {
  return `
export const config = {
  runtime: 'edge',
};

import server from './bundle.js';

export default async function handler(request) {
  if (server.default) {
    return server.default.fetch(request);
  }
  if (server.fetch) {
    return server.fetch(request);
  }
  if (server.handleRequest) {
    const pathname = new URL(request.url).pathname;
    const isRsc = pathname.startsWith('/_rsc');
    const isAction = pathname.includes('/_action');
    const type = isRsc ? 'rsc' : isAction ? 'action' : 'html';
    const routePathname = type === 'html' ? pathname : pathname.replace(/^\/_rsc/, '') || '/';
    
    const renderRsc = async (elements) => {
      const { renderToReadableStream } = await import('virtual:rsc');
      return await renderToReadableStream(elements);
    };
    const parseRsc = async (stream) => {
      const { createFromReadableStream } = await import('virtual:rsc');
      return createFromReadableStream(stream, {});
    };
    const renderHtml = async (rscStream) => {
      return new Response(rscStream, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    };
    const loadBuildMetadata = async (key) => undefined;
    return server.handleRequest(
      { req: request, pathname: routePathname, type },
      { renderRsc, parseRsc, renderHtml, loadBuildMetadata }
    );
  }
  return new Response('Not Found', { status: 404 });
}
`;
}

function generateApiFunctions(apiRoutesDir: string, functionsDir: string, config: Required<Config>, distDir: string) {
  function scanDir(dir: string, basePath: string = '') {
    if (!existsSync(dir)) return;
    
    for (const entry of readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDir(fullPath, `${basePath}/${entry}`);
      } else if (stat.isFile() && /\.(ts|js)$/.test(entry)) {
        const routePath = (basePath + '/' + entry.replace(/\.(ts|js)$/, '')).replace(/\/index$/, '') || '/';
        const funcDir = path.join(functionsDir, `api${routePath === '/' ? '' : routePath}.func`);
        
        mkdirSync(funcDir, { recursive: true });
        
        const relativePath = path.relative(distDir, fullPath);
        
        const edgeCode = `
import handler from '../${relativePath.replace(/\\/g, '/')}';

export default async function (request) {
  const url = new URL(request.url);
  const routePath = url.pathname;
  
  try {
    if (handler.default) {
      return await handler.default(request);
    }
    return await handler(request);
  } catch (error) {
    return new Response(error?.message || 'Internal Server Error', { status: 500 });
  }
}
`;
        writeFileSync(path.join(funcDir, 'index.js'), edgeCode);
        
        const vcConfig = generateVcConfig('edge', 'index.js', {
          regions: config.vercel?.functionConfig?.regions ?? ['iad1'],
          architecture: config.vercel?.functionConfig?.architecture ?? 'arm64',
          envVarsInUse: config.vercel?.functionConfig?.env,
        });
        writeFileSync(
          path.join(funcDir, '.vc-config.json'),
          JSON.stringify(vcConfig, null, 2)
        );
      }
    }
  }
  
  scanDir(apiRoutesDir);
}

function generatePrerenderFunctions(prerenderConfig: {
  routes: Record<string, { 
    expiration?: number | boolean | false; 
    fallback?: string; 
    initialStatus?: number; 
    initialHeaders?: Record<string, string>;
    allowQuery?: string[];
    passQuery?: boolean;
    group?: number;
    bypassToken?: string;
    exposeErrBody?: boolean;
  }>;
}, functionsDir: string) {
  for (const [route, config] of Object.entries(prerenderConfig.routes || {})) {
    const funcName = route.replace(/^\//, '').replace(/\//g, '_') || 'index';
    const prerenderConfigPath = path.join(functionsDir, `${funcName}.prerender-config.json`);
    
    const pc: Record<string, unknown> = {};
    
    if (config.expiration === false) {
      pc.expiration = false;
    } else if (typeof config.expiration === 'number') {
      pc.expiration = config.expiration;
    } else {
      pc.expiration = 0;
    }
    
    if (config.fallback) {
      pc.fallback = config.fallback;
    }
    if (config.initialStatus) {
      pc.initialStatus = config.initialStatus;
    }
    if (config.initialHeaders) {
      pc.initialHeaders = config.initialHeaders;
    }
    if (config.allowQuery) {
      pc.allowQuery = config.allowQuery;
    }
    if (config.passQuery !== undefined) {
      pc.passQuery = config.passQuery;
    }
    if (config.group) {
      pc.group = config.group;
    }
    if (config.bypassToken) {
      pc.bypassToken = config.bypassToken;
    }
    if (config.exposeErrBody !== undefined) {
      pc.exposeErrBody = config.exposeErrBody;
    }
    
    writeFileSync(prerenderConfigPath, JSON.stringify(pc, null, 2));
  }
}

function generateVercelJson(config: Required<Config>, outputDir: string) {
  const vercelConfig = config.vercel || {};
  
  const vercelJson: Record<string, unknown> = {
    version: 3,
  };

  if (vercelConfig.framework) {
    vercelJson.framework = vercelConfig.framework;
  }

  if (vercelConfig.regions && vercelConfig.regions.length > 0) {
    vercelJson.regions = vercelConfig.regions;
  }

  if (vercelConfig.headers && vercelConfig.headers.length > 0) {
    vercelJson.headers = vercelConfig.headers;
  }

  if (vercelConfig.redirects && vercelConfig.redirects.length > 0) {
    vercelJson.redirects = vercelConfig.redirects.map(r => ({
      source: r.source,
      destination: r.destination,
      permanent: r.permanent ?? true,
      ...(r.statusCode && { statusCode: r.statusCode }),
    }));
  }

  if (vercelConfig.rewrites && vercelConfig.rewrites.length > 0) {
    vercelJson.rewrites = vercelConfig.rewrites;
  }

  if (vercelConfig.images) {
    vercelJson.images = vercelConfig.images;
  }

  if (vercelConfig.cron && vercelConfig.cron.length > 0) {
    vercelJson.cron = vercelConfig.cron;
  }

  if (vercelConfig.webAnalytics) {
    vercelJson.webAnalytics = { enabled: vercelConfig.webAnalytics };
  }

  if (vercelConfig.speedInsights) {
    vercelJson.speedInsights = { enabled: vercelConfig.speedInsights };
  }

  if (vercelConfig.functionNamePrefix) {
    vercelJson.functionNamePrefix = vercelConfig.functionNamePrefix;
  }

  const vercelJsonPath = path.join(outputDir, '..', 'vercel.json');
  writeFileSync(vercelJsonPath, JSON.stringify(vercelJson, null, 2));
  
  return vercelJson;
}

function generateRoutesManifest(routes: Array<{
  path: string;
  isStatic?: boolean;
  isDynamic?: boolean;
  fallback?: string | null;
  revalidate?: number;
}>, outputDir: string) {
  const routesManifest = {
    version: 3,
    pages: {} as Record<string, { path: string; isStatic?: boolean; isDynamic?: boolean; fallback?: string | null; revalidate?: number }>,
    dynamicRoutes: [] as Array<{ path: string; page: string; routeRegex: string; namedRegex: string }>,
  };
  
  for (const route of routes) {
    routesManifest.pages[route.path] = {
      path: route.path,
      isStatic: route.isStatic ?? true,
      isDynamic: route.isDynamic ?? false,
      fallback: route.fallback ?? null,
      revalidate: route.revalidate,
    };
  }
  
  writeFileSync(
    path.join(outputDir, 'routes-manifest.json'),
    JSON.stringify(routesManifest, null, 2)
  );
  
  return routesManifest;
}

export function mainPlugin(config: Required<Config>): Plugin[] {
  const renderPlugin: Plugin = {
    name: 'render:vite-plugin',
    enforce: 'pre' as const,
    async config(_config) {
      let viteRscConfig: UserConfig = {
        base: config.basePath,
        define: {
          'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
          'import.meta.env.RENDER_CONFIG_BASE_PATH': JSON.stringify(
            config.basePath,
          ),
          'import.meta.env.RENDER_CONFIG_RSC_BASE': JSON.stringify(
            config.rscBase,
          ),
          ...Object.fromEntries(
            Object.entries(process.env).flatMap(([k, v]) =>
              k.startsWith('RENDER_PUBLIC_')
                ? [
                    [`import.meta.env.${k}`, JSON.stringify(v)],
                    [`process.env.${k}`, JSON.stringify(v)],
                  ]
                : [],
            ),
          ),
        },
            environments: {
          client: {
            build: {
              rollupOptions: {
                input: {
                  index: path.join(
                    __dirname,
                    '../vite-entries/entry.browser.tsx',
                  ),
                },
              },
            },
            optimizeDeps: {
              entries: [
                `${config.srcDir}/${SRC_CLIENT_ENTRY}.*`,
                `${config.srcDir}/${SRC_SERVER_ENTRY}.*`,
                `${config.srcDir}/${SRC_PAGES}/**/*.*`,
              ],
            },
          },
          ssr: {
            build: {
              rollupOptions: {
                input: {
                  index: path.join(__dirname, '../vite-entries/entry.server.js'),
                  build: path.join(__dirname, '../vite-entries/entry.build.js'),
                },
              },
            },
          },
        },
      };

      if (config.vite) {
        viteRscConfig = mergeConfig(viteRscConfig, {
          ...config.vite,
          plugins: undefined,
        });
      }

      return viteRscConfig;
    },
    configEnvironment(name, environmentConfig, env) {
      if (environmentConfig.optimizeDeps?.include) {
        environmentConfig.optimizeDeps.include = (
          environmentConfig.optimizeDeps.include as string[]
        ).map((item) => {
          if (item.startsWith('@vitejs/plugin-rsc')) {
            return `${PKG_NAME} > ${item}`;
          }
          return item;
        });
      }

      environmentConfig.build ??= {};
      environmentConfig.build.outDir = `${config.distDir}/${name}`;
      if (name === 'ssr') {
        environmentConfig.build.outDir = `${config.distDir}/${DIST_SERVER}`;
      }
      if (name === 'client') {
        environmentConfig.build.outDir = `${config.distDir}/${DIST_PUBLIC}`;
      }

      return {
        resolve: {
          noExternal: env.command === 'build' ? true : [PKG_NAME],
        },
        optimizeDeps: {
          exclude: [PKG_NAME, '@render.js/minimal/client', '@render.js/router/client'],
        },
      };
    },
    async closeBundle() {
      const distDir = config.distDir;
      const publicDir = path.join(distDir, DIST_PUBLIC);
      const serverDir = path.join(distDir, DIST_SERVER);
      const srcDir = config.srcDir;
      
      const { outputDir: VERCEL_OUTPUT_DIR, staticDir: VERCEL_STATIC_DIR, functionsDir: VERCEL_FUNCTIONS_DIR } = getVercelOutputDirs(config);
      
      if (existsSync(VERCEL_OUTPUT_DIR)) {
        rmSync(VERCEL_OUTPUT_DIR, { recursive: true, force: true });
      }
      
      mkdirSync(VERCEL_STATIC_DIR, { recursive: true });
      mkdirSync(VERCEL_FUNCTIONS_DIR, { recursive: true });
      
      generateVercelJson(config, VERCEL_OUTPUT_DIR);
      
      if (existsSync(publicDir)) {
        copyDirRecursive(publicDir, VERCEL_STATIC_DIR);
      }
      
      const publicDirSrc = path.join(distDir, 'public');
      if (existsSync(publicDirSrc)) {
        copyDirRecursive(publicDirSrc, VERCEL_STATIC_DIR);
      }
      
      const hasSsrBuild = existsSync(serverDir);
      
      if (hasSsrBuild) {
        const funcDir = path.join(VERCEL_FUNCTIONS_DIR, 'index.func');
        mkdirSync(funcDir, { recursive: true });
        
        const sourceDir = serverDir;
        
        function copyDirContents(src: string, dest: string) {
          if (!existsSync(src)) return;
          mkdirSync(dest, { recursive: true });
          for (const file of readdirSync(src)) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            const stat = statSync(srcPath);
            if (stat.isDirectory()) {
              copyDirContents(srcPath, destPath);
            } else {
              cpSync(srcPath, destPath);
            }
          }
        }
        
        copyDirContents(sourceDir, funcDir);
        
        const buildMetadataPath = path.join(distDir, 'build-metadata.json');
        if (existsSync(buildMetadataPath)) {
          cpSync(buildMetadataPath, path.join(funcDir, 'metadata.json'));
        } else {
          writeFileSync(path.join(funcDir, 'metadata.json'), JSON.stringify({}));
        }
        
        const runtime = config.vercel?.functionConfig?.runtime || 'nodejs22.x';
        const isEdge = runtime === 'edge' || runtime === 'experimental-edge';
        
        if (!isEdge) {
          const handlerCode = generateNodeHandler();
          writeFileSync(path.join(funcDir, 'index.js'), handlerCode);
        } else {
          const handlerCode = generateEdgeHandler();
          writeFileSync(path.join(funcDir, 'index.js'), handlerCode);
        }
        
        const vcConfig = generateVcConfig(
          runtime,
          'index.js',
          {
            maxDuration: config.vercel?.functionConfig?.maxDuration ?? 10,
            memory: config.vercel?.functionConfig?.memory ?? 1024,
            launcherType: isEdge ? undefined : 'Nodejs',
            shouldAddHelpers: isEdge ? undefined : true,
            supportsResponseStreaming: true,
            regions: config.vercel?.functionConfig?.regions ?? ['iad1'],
            architecture: config.vercel?.functionConfig?.architecture ?? 'x86_64',
            supportsWrapper: config.vercel?.functionConfig?.supportsWrapper,
            environment: config.vercel?.functionConfig?.env?.map(key => ({ key })) ?? [],
          }
        );
        writeFileSync(
          path.join(funcDir, '.vc-config.json'),
          JSON.stringify(vcConfig, null, 2)
        );
      }
      
      const apiRoutesDir = path.join(srcDir, config.routes?.apiDir || 'api');
      if (existsSync(apiRoutesDir) && config.vercel?.edgeFunctions) {
        generateApiFunctions(apiRoutesDir, VERCEL_FUNCTIONS_DIR, config, distDir);
      }
      
      const prerenderConfigPath = path.join(distDir, 'prerender.json');
      if (existsSync(prerenderConfigPath) && config.vercel?.prerender) {
        const prerenderConfig = JSON.parse(readFileSync(prerenderConfigPath, 'utf-8'));
        generatePrerenderFunctions(prerenderConfig, VERCEL_FUNCTIONS_DIR);
      }
      
      console.log(`\n✅ Vercel build output generated:`);
      console.log(`   Static: ${VERCEL_STATIC_DIR}/`);
      console.log(`   Functions: ${VERCEL_FUNCTIONS_DIR}/`);
      console.log(`   vercel.json: ${path.join(VERCEL_OUTPUT_DIR, '..', 'vercel.json')}`);
    },
    async configureServer(server) {
      const environment = server.environments.ssr as RunnableDevEnvironment;
      const entryId = (environment.config.build.rollupOptions.input as Record<string, string>)
        .index;
      return () => {
        server.middlewares.use(async (req, res, next) => {
          const httpReq = req as { originalUrl?: string; method?: string; readable?: boolean; headers?: Record<string, string | string[]> };
          const httpRes = res as { statusCode?: number; setHeader?: (key: string, value: string) => void; write?: (data: Buffer) => void; end?: () => void };
          
          try {
            const mod: typeof import('../vite-entries/entry.server.js') =
              await environment.runner.import(entryId);
            
            const headers: Record<string, string> = {};
            for (const [key, value] of Object.entries(httpReq.headers || {})) {
              if (typeof value === 'string') {
                headers[key] = value;
              } else if (Array.isArray(value)) {
                headers[key] = value.join(', ');
              }
            }

            const method = httpReq.method || 'GET';
            let body: BodyInit | null = null;
            if (method !== 'GET' && method !== 'HEAD' && httpReq.readable) {
              const chunks: Uint8Array[] = [];
              const reqStream = req as unknown as AsyncIterable<Uint8Array>;
              for await (const chunk of reqStream) {
                chunks.push(chunk);
              }
              if (chunks.length > 0) {
                body = Buffer.concat(chunks);
              }
            }

            const url = httpReq.originalUrl || '/';
            const reqObj = new Request(`http://localhost${url}`, {
              method,
              headers,
              body,
            });

            const resp = await mod.INTERNAL_runFetch(process.env as unknown as Record<string, string>, reqObj) as Response;

            httpRes.statusCode = resp.status;
            resp.headers.forEach((value: string, key: string) => {
              httpRes.setHeader?.(key, value);
            });

            if (resp.body) {
              const reader = resp.body.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                httpRes.write?.(Buffer.from(value));
              }
              httpRes.end?.();
            } else {
              httpRes.end?.();
            }
          } catch (e) {
            next(e);
          }
        });
      };
    },
  };

  return [renderPlugin];
}
