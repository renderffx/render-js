# @render.js - Pure RSC Framework

## Status: SHIP READY ✅

Self-contained React Server Components framework - **no external RSC plugin dependency**.

## Quick Start

```bash
cd @render/demo-app
pnpm install
pnpm dev
```

## What's Working

### ✅ RSC Streaming (Self-Contained)
```tsx
import { renderToReadableStream } from '@renderjs/core';

const stream = await renderToReadableStream(<MyComponent />);
```

### ✅ File-based Routing
```
src/pages/
├── index.tsx           # /
├── blog/[slug].tsx     # /blog/:slug
└── dashboard/
    └── index.tsx       # /dashboard
```

### ✅ Server Actions
```tsx
async function submit(formData: FormData) {
  'use server';
  await db.create({ ...formData });
  revalidateTag('data');
}
```

### ✅ Async Server Components
```tsx
async function DataPage() {
  const data = await fetchFromDB();
  return <div>{data}</div>;
}
```

### ✅ Server Caching
```tsx
const getUser = unstable_cache(
  async (id) => db.users.find(id),
  ['user'],
  { ttl: 60000 }
);
```

## Architecture

```
@renderjs/core
├── src/lib/rsc/
│   ├── streaming.ts      # renderToReadableStream (self-contained)
│   ├── cache.ts          # unstable_cache, revalidateTag
│   ├── server-actions.ts # Server actions
│   └── flight-protocol.ts # Serialization
├── src/lib/vite-plugins/
│   ├── rsc-virtual.ts   # virtual:rsc module
│   ├── combined-plugins.ts
│   └── main.ts           # Vite + Vercel wiring
└── src/lib/server/
    ├── ssr.ts            # SSR utilities
    └── client-hydration.ts
```

## Vite Plugin Order

```ts
// combinedPlugins() returns:
[
  rscVirtualPlugin(),      // 1. Intercepts virtual:rsc
  ...mainPlugin(),          // 2. Dev server + Vercel build
  userEntriesPlugin(),       // 3. Creates server entry
  devServerPlugin(),         // 4. CORS, HMR
]
```

## Tests

```bash
cd @render/packages/core
npm run build   # ✅ Builds
npm test        # ✅ 59 tests passing
```

## Vercel Deployment

```bash
vercel deploy
```

The framework generates:
- `vercel.json` with routing
- `.vercel/output/functions/` with serverless functions
- `.vercel/output/static/` with static assets
