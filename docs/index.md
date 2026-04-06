# @render.js Documentation

## Quick Links

- [Overview](./README.md) - Framework overview and status
- [RSC Guide](./rsc/README.md) - React Server Components implementation
- [Examples](./examples/README.md) - Real-world code examples
- [Reserved Components](./reserved-components.md) - React reserved component names
- [Issues](./ISSUES.md) - Known issues and missing features

## Quick Start

```bash
# Install
pnpm add @renderjs/core

# Configure (render.config.ts)
import { defineConfig } from '@renderjs/core';

export default defineConfig({
  server: { port: 3000 },
  srcDir: 'src',
});

# Add to vite.config.ts
import { vitePlugin } from '@renderjs/core';

export default {
  plugins: [vitePlugin()],
};
```

## What's Working

| Feature | Status |
|---------|--------|
| File-based routing | ✅ |
| Server caching | ✅ |
| Server actions | ✅ |
| Flight protocol | ✅ |
| Client navigation | ✅ |
| API routes | ✅ |
| Middleware | ✅ |
| Vercel integration | ✅ |

## What's Missing

| Feature | Status |
|---------|--------|
| Full RSC streaming | 🚧 |
| Async server components | ❌ |
| Parallel data fetching | ❌ |
| Native Suspense | ❌ |

## Key Files

```
@render/
├── packages/core/src/
│   ├── index.ts                    # Main exports
│   ├── lib/rsc/
│   │   ├── streaming.ts           # RSC streaming
│   │   ├── flight-protocol.ts     # Serialization
│   │   ├── server-actions.ts      # Server actions
│   │   └── cache.ts                # Caching
│   └── lib/vite-plugins/          # Vite integration
└── docs/
    ├── README.md                   # This file
    ├── rsc/README.md               # RSC guide
    ├── examples/README.md          # Examples
    ├── reserved-components.md      # Reserved names
    └── ISSUES.md                  # Issues tracking
```
