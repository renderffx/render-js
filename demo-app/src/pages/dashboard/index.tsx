import React, { createElement as h } from 'react';
import { unstable_cache } from '@renderjs/core';
import { Link, useActionState, Form } from '@renderjs/core';

const getStats = unstable_cache(async () => {
  await new Promise(resolve => setTimeout(resolve, 50));
  return {
    totalUsers: 1234,
    totalOrders: 5678,
    revenue: 98765.43,
  };
}, ['dashboard-stats'], { ttl: 60000 });

async function updateProfile(prevState: unknown, formData: FormData) {
  'use server';
  const name = formData.get('name');
  await new Promise(resolve => setTimeout(resolve, 500));
  return { success: true, message: `Updated ${name}` };
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return h('div', { className: 'stat-card' },
    h('span', { className: 'stat-label' }, label),
    h('span', { className: 'stat-value' }, String(value))
  );
}

export default function Dashboard() {
  const stats = getStats();
  const [state, action, isPending] = useActionState(updateProfile, null);
  
  return h('main', { className: 'dashboard' },
    h('h1', null, 'Dashboard'),
    
    h('section', { className: 'stats' },
      h('h2', null, 'Statistics'),
      h('div', { className: 'stats-grid' },
        h(StatCard, { label: 'Users', value: stats.totalUsers }),
        h(StatCard, { label: 'Orders', value: stats.totalOrders }),
        h(StatCard, { label: 'Revenue', value: `$${stats.revenue}` })
      )
    ),
    
    h('section', { className: 'profile' },
      h('h2', null, 'Profile Settings'),
      h(Form, { action },
        h('div', null,
          h('label', { htmlFor: 'name' }, 'Name'),
          h('input', { type: 'text', name: 'name', id: 'name', required: true })
        ),
        h('button', { type: 'submit', disabled: isPending },
          isPending ? 'Saving...' : 'Save'
        ),
        state?.success && h('p', { className: 'success' }, state.message)
      )
    ),
    
    h('nav', null,
      h(Link, { href: '/' }, 'Home'),
      h('span', null, ' | '),
      h(Link, { href: '/blog' }, 'Blog')
    )
  );
}
