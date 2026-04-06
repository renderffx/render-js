import React, { createElement as h } from 'react';
import { unstable_cache, revalidateTag, notFound } from '@renderjs/core';

const getPost = unstable_cache(async (slug: string) => {
  await new Promise(resolve => setTimeout(resolve, 100));
  const posts: Record<string, { id: number; title: string; content: string; author: string }> = {
    'first-post': { id: 1, title: 'First Post', content: 'This is the content of the first post.', author: 'Alice' },
    'second-post': { id: 2, title: 'Second Post', content: 'This is the content of the second post.', author: 'Bob' },
    'third-post': { id: 3, title: 'Third Post', content: 'This is the content of the third post.', author: 'Charlie' },
  };
  return posts[slug] || null;
}, ['posts'], { ttl: 60000 });

async function BlogPost({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  
  if (!post) {
    return notFound();
  }
  
  return h('article', { className: 'blog-post' },
    h('header', null,
      h('h1', null, post.title),
      h('p', { className: 'meta' }, `By ${post.author}`)
    ),
    h('div', { className: 'content' },
      h('p', null, post.content)
    ),
    h('footer', null,
      h('a', { href: '/blog' }, 'Back to blog')
    )
  );
}

export default BlogPost;
