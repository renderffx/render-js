# Real-World Examples

This directory contains practical examples of @render.js features.

## Example 1: Blog with Dynamic Routes

```tsx
// src/pages/blog/index.tsx
import { cache } from '@renderjs/core';
import { Link } from '@renderjs/core';

const getPosts = cache(async () => {
  // Simulate database call
  const posts = await db.posts.findMany({ 
    select: { id: true, title: true, excerpt: true }
  });
  return posts;
}, ['posts'], { ttl: 300000 }); // 5 min cache

export default async function BlogIndex() {
  const posts = await getPosts();
  
  return (
    <main>
      <h1>Blog</h1>
      <ul>
        {posts.map(post => (
          <li key={post.id}>
            <Link href={`/blog/${post.id}`}>{post.title}</Link>
            <p>{post.excerpt}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

```tsx
// src/pages/blog/[slug].tsx
import { notFound } from '@renderjs/core';
import { cache } from '@renderjs/core';
import { revalidateTag } from '@renderjs/core';

const getPost = cache(async (slug: string) => {
  const post = await db.posts.find({ slug });
  if (!post) notFound();
  return post;
}, ['posts'], { ttl: 60000 });

export default async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  
  return (
    <article>
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />
    </article>
  );
}

// Server action to create new post
export async function createPost(formData: FormData) {
  'use server';
  
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;
  
  await db.posts.create({ title, content });
  revalidateTag('posts');
  
  return { success: true };
}
```

## Example 2: E-commerce Product Listing

```tsx
// src/pages/products/index.tsx
import { cache } from '@renderjs/core';
import { Link, useSearchParams } from '@renderjs/core';
import { Suspense } from 'react';

const getProducts = cache(async (category?: string) => {
  const where = category ? { category } : {};
  return db.products.findMany({ where });
}, ['products'], { ttl: 120000 });

const ProductSkeleton = () => (
  <div className="animate-pulse">
    <div className="bg-gray-200 h-48 rounded" />
    <div className="bg-gray-200 h-4 w-24 mt-2" />
    <div className="bg-gray-200 h-4 w-16 mt-1" />
  </div>
);

async function ProductList({ category }: { category?: string }) {
  const products = await getProducts(category);
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {products.map(product => (
        <Link key={product.id} href={`/products/${product.id}`}>
          <img src={product.image} alt={product.name} />
          <h3>{product.name}</h3>
          <p>${product.price}</p>
        </Link>
      ))}
    </div>
  );
}

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || undefined;
  
  return (
    <main>
      <h1>Products</h1>
      <Suspense fallback={<ProductSkeleton />}>
        <ProductList category={category} />
      </Suspense>
    </main>
  );
}
```

## Example 3: User Dashboard with Layouts

```tsx
// src/pages/dashboard/_layout.tsx
import { cache } from '@renderjs/core';
import { Link, usePathname } from '@renderjs/core';

const getUser = cache(async () => {
  return await db.users.find(session.userId);
}, ['user'], { ttl: 30000 });

export default async function DashboardLayout({ children }) {
  const user = await getUser();
  
  const navItems = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/settings', label: 'Settings' },
    { href: '/dashboard/orders', label: 'Orders' },
  ];
  
  return (
    <div className="flex">
      <aside className="w-64 bg-gray-100">
        <div className="p-4">
          <p>Welcome, {user.name}</p>
        </div>
        <nav>
          {navItems.map(item => (
            <Link 
              key={item.href}
              href={item.href}
              className={usePathname() === item.href ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
```

```tsx
// src/pages/dashboard/index.tsx
import { cache } from '@renderjs/core';
import { useAction, useActionState } from '@renderjs/core';

const getStats = cache(async () => {
  const [orders, revenue, users] = await Promise.all([
    db.orders.count(),
    db.orders.sum('amount'),
    db.users.count(),
  ]);
  return { orders, revenue, users };
}, ['dashboard-stats'], { ttl: 60000 });

export async function updateProfile(formData: FormData) {
  'use server';
  
  const name = formData.get('name') as string;
  await db.users.update(session.userId, { name });
  revalidateTag('user');
  
  return { success: true };
}

export default function DashboardOverview() {
  const stats = getStats();
  const [state, action, isPending] = useActionState(updateProfile, null);
  
  return (
    <div>
      <h1>Dashboard</h1>
      
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Orders" value={stats.orders} />
        <StatCard label="Revenue" value={`$${stats.revenue}`} />
        <StatCard label="Users" value={stats.users} />
      </div>
      
      <form action={action}>
        <input name="name" placeholder="Your name" />
        <button disabled={isPending}>Update</button>
      </form>
    </div>
  );
}
```

## Example 4: API Routes

```tsx
// src/pages/api/users.ts
import { defineGetApi, definePostApi, createJsonResponse } from '@renderjs/core';

export const GET = defineGetApi('/api/users', async ({ query }) => {
  const page = parseInt(query.page || '1');
  const limit = parseInt(query.limit || '10');
  
  const users = await db.users.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });
  
  return createJsonResponse({ users, page, limit });
});

export const POST = definePostApi('/api/users', async ({ body }) => {
  const { name, email } = body;
  
  const user = await db.users.create({ name, email });
  
  return createJsonResponse({ user }, { status: 201 });
});
```

## Example 5: Middleware

```tsx
// middleware.ts
import { defineMiddleware, withCors, withLogger, withCache } from '@renderjs/core';

export default defineMiddleware([
  withCors({
    origin: ['https://example.com'],
    credentials: true,
  }),
  withCache({
    maxAge: 60,
    sMaxAge: 3600,
  }),
  withLogger(),
]);
```

## Example 6: Edge Functions

```tsx
// vercel.json configuration
{
  "framework": "@renderjs/core",
  "regions": ["iad1"],
  "functions": {
    "src/pages/api/**/*.ts": {
      "runtime": "edge",
      "memory": 256
    }
  }
}
```

## File Structure

```
src/
├── pages/
│   ├── _layout.tsx           # Root layout
│   ├── index.tsx              # Home page
│   ├── blog/
│   │   ├── _layout.tsx        # Blog layout
│   │   ├── index.tsx          # Blog index
│   │   └── [slug].tsx         # Dynamic post
│   ├── products/
│   │   ├── index.tsx
│   │   └── [category]/
│   │       └── index.tsx
│   ├── dashboard/
│   │   ├── _layout.tsx        # Dashboard layout
│   │   └── index.tsx          # Overview
│   ├── api/
│   │   └── users.ts
│   └── actions.ts            # Server actions
├── components/
│   ├── ClientComponent.tsx    # 'use client'
│   └── ServerComponent.tsx
├── lib/
│   ├── db.ts                  # Database client
│   └── utils.ts
└── entry-client.tsx
```
