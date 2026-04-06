import React, { createElement as h } from 'react';
import { unstable_cache } from '@renderjs/core';
import { Link } from '@renderjs/core';

const getAllPosts = unstable_cache(async () => {
  await new Promise(resolve => setTimeout(resolve, 50));
  return [
    { id: 1, title: 'First Post', slug: 'first-post', excerpt: 'The first blog post' },
    { id: 2, title: 'Second Post', slug: 'second-post', excerpt: 'The second blog post' },
    { id: 3, title: 'Third Post', slug: 'third-post', excerpt: 'The third blog post' },
  ];
}, ['posts'], { ttl: 60000 });

export default function BlogIndex() {
  const posts = getAllPosts();
  
  return h('main', { className: 'blog-index' },
    h('h1', null, 'Blog'),
    h('ul', { className: 'post-list' },
      posts.map(post =>
        h('li', { key: post.id },
          h('h2', null, 
            h(Link, { href: `/blog/${post.slug}` }, post.title)
          ),
          h('p', null, post.excerpt)
        )
      )
    ),
    h('nav', null,
      h(Link, { href: '/' }, 'Home')
    )
  );
}
