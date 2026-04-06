# Framework Issues & Missing Implementations

This document tracks issues and missing pieces in @render.js.

## Critical Issues

### 1. RSC Streaming Implementation

**Problem**: The `renderToReadableStream` function is a polyfill that doesn't actually render React elements to RSC format.

**Current** (polyfill):
```tsx
// Simply serializes data to JSON
const serialized = serializeRSCPayload(element);
chunks.push(encoder.encode(JSON.stringify(serialized)));
```

**Needed**: Integration with `@vitejs/plugin-rsc` transforms to properly render:
- React elements to flight format
- Server components
- Client component boundaries
- Async components

**Fix Required**: 
1. The Vite plugin transforms server components
2. The transformed code uses `@vitejs/plugin-rsc/dist/rsc.js` functions
3. We need to provide virtual module `virtual:rsc` for these transforms

### 2. Missing Virtual Module

**Problem**: `@vitejs/plugin-rsc` expects `virtual:rsc` module which isn't provided.

**Required**: Create Vite plugin that provides:
```
virtual:rsc
  ├── renderToReadableStream
  ├── createFromReadableStream
  ├── decodeReply
  ├── decodeAction
  └── ...
```

## Missing Features

### 1. Async Server Components

**Status**: Not supported

```tsx
// ❌ This doesn't work yet
async function Page() {
  const data = await fetch('/api/data');
  return <div>{data}</div>;
}
```

### 2. Parallel Data Fetching

**Status**: Not supported

```tsx
// ❌ Sequential only
const user = await getUser(id);
const posts = await getPosts(id);

// ❌ Parallel not supported
const [user, posts] = await Promise.all([
  getUser(id),
  getPosts(id),
]);
```

### 3. Suspense Streaming

**Status**: Basic implementation

```tsx
// ❌ Complex Suspense boundaries not working
<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

### 4. Cache by Default

**Status**: Not implemented

React 19 automatically deduplicates identical fetch calls - this isn't implemented.

## Incomplete Implementations

### Flight Protocol

**Working**:
- `serializeValue()` / `deserializeValue()`
- `arrayToBase64()` / `base64ToUint8Array()`
- `createFlightEncoder()` / `createFlightDecoder()`

**Not Working**:
- Proper RSC element serialization (React elements → flight format)
- Client reference tracking
- Server component boundaries

### Server Actions

**Working**:
- `createServerActionId()`
- `executeServerAction()`
- `generateActionId()`
- `createActionCache()`
- `runWithActionContext()`

**Not Working**:
- Client-side action dispatch
- Form state hydration
- Optimistic updates

### Caching

**Working**:
- `unstable_cache()`
- `revalidateTag()`
- `revalidatePath()`
- `getCached()`, `setCached()`

**Not Working**:
- Cross-request caching (needs persistent store like Redis)
- Cache dedup across components
- `router.cache()`

## What Works End-to-End

### ✅ File-based Routing

```tsx
// Works perfectly
src/pages/
├── index.tsx           // /
├── about.tsx           // /about
├── blog/
│   └── [slug].tsx      // /blog/:slug
└── _layout.tsx         // Shared layout
```

### ✅ Server-Side Data Fetching

```tsx
// Works with unstable_cache
const getData = unstable_cache(
  async () => db.find(),
  ['key'],
  { ttl: 60000 }
);
```

### ✅ API Routes

```tsx
// Works
export const GET = defineGetApi('/api/users', async ({ query }) => {
  return createJsonResponse({ users: [] });
});
```

### ✅ Middleware

```tsx
// Works
export default defineMiddleware([
  withCors({ origin: '*' }),
  withLogger(),
]);
```

### ✅ Client Navigation

```tsx
// Works
import { Link, useRouter, usePathname } from '@renderjs/core';

<Link href="/about">About</Link>
```

## Required for Full RSC Support

1. **Vite Plugin Enhancement**
   - Transform server components with RSC directives
   - Provide `virtual:rsc` module
   - Inject client/server manifests

2. **Runtime Implementation**
   - Proper `renderToReadableStream` using React's flight format
   - `createFromReadableStream` for client hydration
   - Suspense boundary handling

3. **Async Component Support**
   - Await async server components
   - Parallel data fetching
   - Streaming with Suspense

4. **Persistent Caching**
   - Redis/DB-backed cache
   - Cross-request revalidation
   - Cache tagging

## Testing

Run tests to see current status:

```bash
cd @render/packages/core
npm test
```

Expected results:
- Flight protocol tests: ✅ PASS
- Server actions tests: ✅ PASS  
- Caching tests: ✅ PASS
- Streaming tests: ⏳ TODO (need Vite environment)
- E2E tests: ⏳ TODO (need full implementation)
