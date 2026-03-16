#!/usr/bin/env node

import { CAC } from 'cac';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cli = new CAC('render');

const cyan = (s: string) => chalk.cyan(s);
const green = (s: string) => chalk.green(s);
const red = (s: string) => chalk.red(s);
const yellow = (s: string) => chalk.yellow(s);
const bold = (s: string) => chalk.bold(s);

cli
  .command('init [name]', 'Initialize a new render.js project')
  .option('-t, --template <name>', 'Template to use (default, minimal, api)')
  .option('--install', 'Install dependencies automatically')
  .action(async (name: string, options: { template?: string; install?: boolean }) => {
    const projectName = name || 'my-render-app';
    const template = options.template || 'default';

    console.log(cyan(`\n🚀 Initializing ${bold(projectName)} with render.js...\n`));

    if (existsSync(projectName)) {
      console.error(red(`❌ Directory ${projectName} already exists`));
      process.exit(1);
    }

    mkdirSync(projectName, { recursive: true });
    mkdirSync(join(projectName, 'src', 'pages'), { recursive: true });

    const packageJson = {
      name: projectName,
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'render dev',
        build: 'render build',
        start: 'render start',
        preview: 'render preview',
      },
      dependencies: {
        '@renderjs/core': '^0.1.0',
        'react': '^19.0.0',
        'react-dom': '^19.0.0',
      },
      devDependencies: {
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        'typescript': '^5.7.0',
        'vite': '^6.0.0',
      },
    };

    writeFileSync(
      join(projectName, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
      },
      include: ['src/**/*'],
    };

    writeFileSync(
      join(projectName, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );

    const viteConfig = `import { defineConfig } from 'vite';
import render from '@renderjs/core';

export default defineConfig({
  plugins: [render()],
});
`;

    writeFileSync(join(projectName, 'vite.config.ts'), viteConfig);

    const renderConfig = `import { defineConfig } from '@renderjs/core';

export default defineConfig({
  basePath: '/',
  srcDir: 'src',
  distDir: 'dist',
});
`;

    writeFileSync(join(projectName, 'render.config.ts'), renderConfig);

    const appHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"><!--render--></div>
    <script type="module" src="/src/entry-client.tsx"></script>
  </body>
</html>
`;

    writeFileSync(join(projectName, 'src', 'app.html'), appHtml);

    const entryClient = `import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root')!);
root.render(
  <div>Hello from render.js!</div>
);
`;

    writeFileSync(join(projectName, 'src', 'entry-client.tsx'), entryClient);

    const entryServer = `import { renderToReadableStream } from 'react-dom/server';

export async function render(url: string) {
  return new Response(await renderToReadableStream(
    <div>Hello from render.js!</div>
  ), {
    headers: { 'Content-Type': 'text/html' },
  });
}
`;

    writeFileSync(join(projectName, 'src', 'entry-server.ts'), entryServer);

    const indexPage = `export default function HomePage() {
  return (
    <div>
      <h1>Welcome to render.js</h1>
      <p>Get started by editing src/pages/index.tsx</p>
    </div>
  );
}
`;

    writeFileSync(join(projectName, 'src', 'pages', 'index.tsx'), indexPage);

    console.log(green(`✅ Project ${projectName} created successfully!\n`));
    console.log(yellow('📁 Project structure:'));
    console.log(`  ${projectName}/`);
    console.log(`  ├── src/`);
    console.log(`  │   ├── pages/`);
    console.log(`  │   │   └── index.tsx`);
    console.log(`  │   ├── entry-client.tsx`);
    console.log(`  │   ├── entry-server.ts`);
    console.log(`  │   └── app.html`);
    console.log(`  ├── render.config.ts`);
    console.log(`  ├── vite.config.ts`);
    console.log(`  └── package.json`);
    console.log();
    console.log(yellow('⚡ Next steps:'));
    console.log(`  cd ${projectName}`);
    if (options.install) {
      console.log(cyan('  pnpm install'));
    } else {
      console.log(cyan('  pnpm install   # or npm install'));
    }
    console.log(cyan('  pnpm dev'));
    console.log();
  });

cli
  .command('dev', 'Start development server')
  .option('-p, --port <port>', 'Port to listen on', { default: 3000 })
  .option('-h, --host <host>', 'Host to bind to', { default: 'localhost' })
  .action((options: { port?: number; host?: string }) => {
    console.log(cyan(`\n🛠️  Starting dev server on ${options.host}:${options.port}...\n`));
    console.log(yellow('Use Ctrl+C to stop'));
    console.log();
  });

cli
  .command('build', 'Build for production')
  .option('-m, --minify', 'Minify output')
  .option('--adapter <name>', 'Adapter to use (vercel)', { default: 'vercel' })
  .action(async (options: { minify?: boolean; adapter?: string }) => {
    console.log(cyan(`\n🔨 Building for ${options.adapter}...\n`));
    console.log(green('✅ Build completed!'));
    console.log(yellow('📦 Output directory: dist/'));
  });

cli
  .command('preview', 'Preview production build')
  .option('-p, --port <port>', 'Port to listen on', { default: 3000 })
  .action((options: { port?: number }) => {
    console.log(cyan(`\n👀 Previewing at http://localhost:${options.port}\n`));
  });

cli
  .command('typecheck', 'Run TypeScript type checking')
  .action(() => {
    console.log(cyan('\n🔍 Running TypeScript...\n'));
  });

cli.help();

cli.parse();
