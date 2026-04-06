# React Server Components (RSC)

This document covers the RSC implementation in @render.js.

## Core Concepts

### Server vs Client Components

**Server Components** render on the server and can:
- Access databases directly
- Read files from disk
- Use server-only APIs
- Stream content to client

**Client Components** (`'use client'`) render on both server and client:
- Use React hooks (useState, useEffect)
- Handle user interactions
- Access browser APIs

```tsx
// Server Component (default)
async function ServerData() {
  const data = await fetchData(); // Direct database access
  return <ul>{data.map(item => <li key={item.id}>{item.name}</li>)}</ul>;
}

// Client Component
'use client';
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

## Caching System

### unstable_cache

Cache async function results:

```tsx
import { unstable_cache } from '@renderjs/core';

const getUser = unstable_cache(
  async (id: string) => {
    const user = await db.users.find(id);
    return user;
  },
  ['user'], // cache tag
  { ttl: 60000 } // 1 minute
);

// Usage in server component
async function UserProfile({ id }: { id: string }) {
  const user = await getUser(id);
  return <div>{user.name}</div>;
}
```

### revalidateTag

Invalidate cache by tag:

```tsx
import { revalidateTag } from '@renderjs/core';

// After mutations
revalidateTag('user');

// Invalidate all
import { revalidate } from '@renderjs/core';
revalidate({ all: true });
```

## Server Actions

### Defining Actions

```tsx
import { createServerAction } from '@renderjs/core';

export async function submitForm(formData: FormData) {
  'use server';
  
  const email = formData.get('email');
  await db.subscribers.create({ email });
  
  revalidateTag('subscribers');
  return { success: true };
}
```

### Using Actions in Forms

```tsx
'use client';
import { Form, useActionState } from '@renderjs/core';
import { submitForm } from './actions';

export default function SubscribeForm() {
  const [state, action, isPending] = useActionState(submitForm, null);
  
  return (
    <Form action={action}>
      <input name="email" type="email" required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Subscribing...' : 'Subscribe'}
      </button>
      {state?.success && <p>Subscribed!</p>}
    </Form>
  );
}
```

## Flight Protocol

The framework uses a flight protocol for serializing React elements between server and client.

### Serialization

```tsx
import { serializeValue, deserializeValue } from '@renderjs/core';

// Serialize complex data
const data = {
  users: [{ id: 1, name: 'Alice' }],
  settings: { theme: 'dark' },
};

const serialized = serializeValue(data);
const deserialized = deserializeValue(serialized);
```

### Base64 Encoding

```tsx
import { arrayToBase64, base64ToUint8Array } from '@renderjs/core';

const binaryData = new Uint8Array([72, 101, 108, 108, 111]);
const encoded = arrayToBase64(binaryData); // "SGVsbG8="
const decoded = base64ToUint8Array(encoded);
```

## Streaming

### renderToReadableStream

Render React elements to a stream:

```tsx
import { renderToReadableStream } from '@renderjs/core';

const stream = await renderToReadableStream(
  <App />,
  {
    signal: AbortSignal.timeout(5000),
    onError: (error) => console.error(error),
  }
);
```

### createFromReadableStream

Parse streamed RSC data on the client:

```tsx
import { createFromReadableStream } from '@renderjs/core';

const { stream, close } = createFromReadableStream(response.body);
```

## Dynamic Routes

### Route Parameters

```tsx
// src/pages/blog/[slug].tsx
export default function BlogPost({ params }) {
  return <h1>{params.slug}</h1>;
}

// src/pages/users/[id]/posts/[postId].tsx
export default function UserPost({ params }) {
  return (
    <div>
      <p>User: {params.id}</p>
      <p>Post: {params.postId}</p>
    </div>
  );
}
```

### Layouts

```tsx
// src/pages/_layout.tsx (applies to all pages)
export default function Layout({ children }) {
  return (
    <html>
      <body>
        <nav>Navigation</nav>
        {children}
        <footer>Footer</footer>
      </body>
    </html>
  );
}

// src/pages/users/_layout.tsx (applies to /users/*)
export default function UsersLayout({ children }) {
  return (
    <div className="users-layout">
      <aside>Users Sidebar</aside>
      {children}
    </div>
  );
}
```

## Known Limitations

1. **No parallel data fetching** - Async components not fully supported
2. **Limited `use()` support** - Promise unwrapping limited
3. **Streaming Suspense** - Basic implementation, needs Vite transforms
4. **Cache by default** - No automatic deduplication yet
