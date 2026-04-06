import React, { createElement as h } from 'react';
import { unstable_cache, revalidateTag } from '@renderjs/core';
import { Link } from '@renderjs/core';

const getUser = unstable_cache(async (id: string) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  return { id, name: `User ${id}`, email: `user${id}@example.com` };
}, ['user'], { ttl: 60000 });

const getPosts = unstable_cache(async () => {
  await new Promise(resolve => setTimeout(resolve, 50));
  return [
    { id: 1, title: 'First Post', slug: 'first-post' },
    { id: 2, title: 'Second Post', slug: 'second-post' },
    { id: 3, title: 'Third Post', slug: 'third-post' },
  ];
}, ['posts'], { ttl: 60000 });

async function AsyncServerComponent({ userId }: { userId: string }) {
  const user = await getUser(userId);
  return h('div', { className: 'server-component' }, 
    h('h3', null, 'Async Server Component'),
    h('p', null, `Hello, ${user.name}!`),
    h('p', null, user.email)
  );
}

export default function Home() {
  const posts = getPosts();
  
  return h('main', { className: 'home-page' },
    h('h1', null, 'Welcome to @render.js'),
    h('p', null, 'A pure React Server Components framework'),
    
    h('section', { className: 'features' },
      h('h2', null, 'Features'),
      h('ul', null,
        h('li', null, 'Server Components with async support'),
        h('li', null, 'File-based routing'),
        h('li', null, 'Streaming SSR'),
        h('li', null, 'Server Actions'),
      )
    ),
    
    h('section', { className: 'async-demo' },
      h('h2', null, 'Async Server Components Demo'),
      h(AsyncServerComponent, { userId: '1' })
    ),
    
    h('section', { className: 'posts' },
      h('h2', null, 'Latest Posts'),
      h('ul', null,
        posts.map(post => 
          h('li', { key: post.id },
            h(Link, { href: `/blog/${post.slug}` }, post.title)
          )
        )
      )
    ),
    
    h('nav', { className: 'navigation' },
      h(Link, { href: '/dashboard' }, 'Dashboard'),
      h('span', null, ' | '),
      h(Link, { href: '/blog/first-post' }, 'Blog Post'),
    )
  );
}
