# @render.js - Deep Technical Analysis: Why It's NOT Truly Vercel-Native

## Executive Summary

Despite claiming "Vercel-native" support, `@render.js` is **NOT truly Vercel-native**. It uses custom implementations that **simulate** Vercel features rather than integrating with Vercel's actual native APIs and infrastructure.

---

## Critical Issues: Why This Is NOT Vercel-Native

### 1. Uses Internal `react-dom/edge` (Not Public)

**File:** `src/lib/server/edge-server.ts:1-2`
```typescript
// @ts-expect-error - react-dom/edge is only available in Vercel Edge Runtime
import { renderToReadableStream } from 'react-dom/edge';
```

**Problem:** 
- `react-dom/edge` is **NOT a public npm package**
- It's an internal Vercel implementation of React DOM for Edge Runtime
- This code will **FAIL** outside Vercel Edge Runtime environment
- No public API for this - uses `@ts-expect-error` to silence TypeScript

**What Vercel Native Actually Uses:**
- `@vercel/rsc` - The official Vercel RSC package
- Proper public exports from `@vercel/rsc`

---

### 2. Build System Uses Vite, NOT Vercel Build Pipeline

**File:** `src/lib/vite-plugins/main.ts`

**Problem:**
```typescript
export function mainPlugin(config: Required<Config>): Plugin {
  return {
    name: 'render:vite-plugins:main',
    // Uses Vite environments, not @vercel/build-output
  }
}
```

**What This Framework Does:**
- Custom Vite plugin for build
- Generates Vercel output structure manually
- Uses `@vitejs/plugin-rsc` for RSC compilation

**What Vercel Native Actually Uses:**
- `@vercel/build-output` for proper build output
- `@vercel/turbopack` for fast builds (optional)
- Native Vercel build pipeline

---

### 3. Simulates Vercel Environment Variables

**File:** `src/vercel-native.ts:97-107`
```typescript
export function getVercelRegion(): string {
  if (typeof globalThis !== 'undefined') {
    const region = (globalThis as any).__VERCEL_REGION__;
    if (region) return region;
  }
  return process.env.VERCEL_REGION || 'unknown';
}

export function getVercelDeploymentUrl(): string {
  return process.env.VERCEL_URL || 'localhost';
}
```

**Problem:**
- Falls back to `'unknown'` or `'localhost'` when not on Vercel
- This is **simulated behavior**, not native integration
- No actual `@vercel/edge` package usage

**What Vercel Native Actually Uses:**
- `@vercel/edge` - Official Edge runtime with real `request.cf`, `env.region`, etc.
- Proper type-safe environment access

---

### 4. RSC Implementation Is Custom, Not @vercel/rsc

**File:** `src/index.ts:206-248`
```typescript
// RSC Core - Full RSC Implementation
export {
  renderRSCToStream,
  renderRSCToPipe,
  createRSCStreamReader,
  // ... custom implementations
} from './lib/rsc/streaming.js';

export {
  createFlightEncoder,
  createFlightDecoder,
  // ... custom flight protocol
} from './lib/rsc/flight-protocol.js';
```

**Problem:**
- Completely custom RSC implementation
- Re-implements React Server Components from scratch
- Not using `@vercel/rsc` which is the official Vercel implementation

**What Vercel Native Actually Uses:**
- `@vercel/rsc` - The actual Vercel RSC package
- Proper RSC serialization/deserialization
- Real `server.action()` and `client.cache()` from `@vercel/rsc`

---

### 5. Edge Functions Are Generated, Not Native

**File:** `src/lib/server/edge-server.ts:191-211`
```typescript
export function generateEdgeFunctionCode(
  pagePath: string,
  isPrerender = false,
  revalidate?: number
): string {
  return `
import { renderRSCToEdgeResponse } from '@renderjs/core/edge';
import Page from '${pagePath}';
// ... custom code generation
`;
}
```

**Problem:**
- Generates Edge Function code at build time
- Wraps custom React rendering in Edge-compatible format
- Not using `@vercel/edge` runtime directly

**What Vercel Native Actually Uses:**
- Native Edge Runtime from `@vercel/edge`
- Real Web API bindings (Fetch, Request, Response)
- Proper Edge Runtime context (`ctx.waitUntil`, `ctx.next()`)

---

### 6. Vercel Config Is Optional/Defaults to Node.js

**File:** `src/config.ts:176-184`
```typescript
vercel: {
  outputDir: config.vercel?.outputDir ?? '.vercel/output',
  functionConfig: {
    memory: config.vercel?.functionConfig?.memory ?? 1024,
    maxDuration: config.vercel?.functionConfig?.maxDuration ?? 10,
    regions: config.vercel?.functionConfig?.regions ?? ['iad1'],
    runtime: config.vercel?.functionConfig?.runtime ?? 'nodejs22.x', // NOT edge by default!
    // ...
  },
  edgeFunctions: config.vercel?.edgeFunctions ?? true,
  // ...
}
```

**Problem:**
- Default runtime is `'nodejs22.x'`, not Edge
- `vercel` config is optional - app works without it
- This means the framework works WITHOUT Vercel

**What Vercel Native Actually Requires:**
- Framework should REQUIRE Vercel configuration
- Native Edge Runtime should be default
- No fallback to Node.js runtime

---

### 7. No Real Vercel SDK Integration

**Files Checked:**
- No `@vercel/kv` usage
- No `@vercel/edge-config` usage
- No `@vercel/analytics` integration
- No `@vercel/blob` usage

**Problem:**
- Claims Vercel-native but doesn't use any Vercel SDKs
- KV cache is simulated with in-memory implementation
- No actual KV store (Redis) integration

**What Vercel Native Actually Includes:**
```typescript
// Should use:
import { VercelKV } from '@vercel/kv';
import { get as getEdgeConfig } from '@vercel/edge-config';
import { analytics } from '@vercel/analytics';
```

---

### 8. ISR Implementation Is Fake

**File:** `src/config.ts:85-95`
```typescript
export interface PrerenderConfig {
  expiration?: number | false;
  group?: number;
  bypassToken?: string;
  // ...
}
```

**Problem:**
- Config only, no actual ISR behavior
- No background revalidation
- No Vercel ISR API integration

**What Vercel Native Actually Requires:**
- `revalidate` tag-based cache invalidation
- On-demand revalidation via Vercel API
- Background regeneration with `x-vercel-cache: REVALIDATED` headers

---

### 9. Build Output Is Custom-Generated, Not Native

**File:** `src/lib/vite-plugins/main.ts:367-438`
```typescript
async closeBundle() {
  // Manually generates:
  // - .vercel/output/static/
  // - .vercel/output/functions/
  // - .vc-config.json
  // - vercel.json
}
```

**Problem:**
- Re-implements Vercel build output format
- Not using `@vercel/build-output`
- Manually copies files and generates configs

**What Vercel Native Actually Uses:**
- `@vercel/build-output` for proper build artifact format
- Native `.vercel/output` structure generation
- Proper route manifest with function configs

---

### 10. Development Server Uses Vite Dev, Not Vercel Emulation

**File:** `src/lib/vite-plugins/main.ts:439-501`
```typescript
async configureServer(server) {
  // Uses Vite's dev server
  const environment = server.environments.rsc!;
  // Custom middleware to handle requests
}
```

**Problem:**
- Uses Vite's dev server, not Vercel dev
- Doesn't emulate Vercel Edge Runtime locally
- Features may work differently in dev vs production

**What Vercel Native Actually Provides:**
- `vercel dev` - Proper Vercel local development
- Real Edge Runtime emulation
- Vercel environment variable simulation

---

## Summary: What Works vs What's Simulated

| Feature | @render.js | Vercel Native |
|---------|-----------|---------------|
| RSC Rendering | Custom (broken) | `@vercel/rsc` |
| Edge Functions | Simulated | `@vercel/edge` |
| Build Output | Custom generation | `@vercel/build-output` |
| ISR/Prerender | Config only | Real background revalidation |
| KV Cache | In-memory fake | `@vercel/kv` |
| Environment | process.env fallback | `@vercel/edge` context |
| Dev Server | Vite | `vercel dev` |

---

## The Real Problem

The framework has **GOOD intentions** - it tries to be a lightweight RSC framework for Vercel. But it makes critical mistakes:

1. **Uses internal Vercel APIs** (`react-dom/edge`) that aren't public
2. **Re-implements features** instead of using Vercel's official packages
3. **No actual Vercel SDK integration** despite claiming "native"
4. **Works without Vercel** - proving it's not truly native

---

## What Would Make It Truly Vercel-Native?

1. Use `@vercel/rsc` instead of custom RSC implementation
2. Use `@vercel/edge` instead of simulated Edge context
3. Use `@vercel/build-output` for build generation
4. Use `@vercel/kv` for actual KV storage
5. Use `vercel dev` for local development
6. Remove `react-dom/edge` import (use public APIs only)
7. Make Vercel configuration **required**, not optional

---

## Conclusion
P
**@render.js is a custom RSC framework that runs ON Vercel, not a Vercel-Native framework.**

It builds to Vercel-compatible output but doesn't integrate with Vercel's actual native features, SDKs, or build pipeline. The name "Vercel-native" is marketing, not reality.

For truly Vercel-native development, use:
- Next.js (official Vercel framework)
- Remix (with `@remix-run/vercel`)
- SvelteKit (with `@sveltejs/adapter-vercel`)
- Or raw `@vercel/rsc` + `@vercel/edge`
