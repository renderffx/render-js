# render.js

A fast, modern React Server Components framework built on Vite.

## Features

- **React Server Components** - Full RSC support with streaming
- **File-based Routing** - Intuitive routing system
- **Vite-powered** - Fast HMR and builds
- **TypeScript** - First-class TypeScript support
- **Multiple Adapters** - Deploy anywhere (Vercel, Netlify, Cloudflare)

## Installation

```bash
pnpm create render@latest my-app
cd my-app
pnpm install
pnpm dev
```

## Quick Start

```tsx
// src/pages/index.tsx
export default function HomePage() {
  return (
    <div>
      <h1>Welcome to render.js</h1>
    </div>
  );
}
```

## API

### Core

```typescript
import { defineConfig } from '@renderjs/core';

export default defineConfig({
  basePath: '/',
  srcDir: 'src',
  distDir: 'dist',
});
```

### Data Fetching

```typescript
import { useData } from '@renderjs/core';

function MyComponent() {
  const { data, loading, error } = useData('key', () => fetch('/api/data').then(r => r.json()));
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return <div>{data}</div>;
}
```

### Middleware

```typescript
import { createMiddlewareStack, withCors, withLogger } from '@renderjs/core';

const stack = createMiddlewareStack();
stack.use(withCors({ origin: '*' }));
stack.use(withLogger());
```

### API Routes

```typescript
import { defineGetApi, createApiHandler } from '@renderjs/core';

const routes = [
  defineGetApi('/api/users', async (req) => {
    return new Response(JSON.stringify({ users: [] }));
  }),
];

const handler = createApiHandler(routes);
```

## Packages

| Package | Description |
|---------|-------------|
| `@renderjs/core` | Core framework |
| `@renderjs/cli` | CLI tools |

## License

MIT
