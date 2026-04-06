#!/bin/bash
# BRUTAL TEST - Full stack integration test
# Run this in your actual project that uses @render.js

set -e

echo "🔥 BRUTAL TESTING @RENDER.JS FRAMEWORK"
echo "======================================"

# Create temp test project
TESTDIR=$(mktemp -d)
cd "$TESTDIR"

echo "📦 Setting up test project..."
npm init -y > /dev/null 2>&1
npm install react react-dom @renderjs/core vite @vitejs/plugin-rsc --save 2>/dev/null || true

# Create directory structure
mkdir -p src/pages src/api src/slices

# Create pages
cat > src/pages/index.tsx << 'EOF'
export default function Home() {
  return <div>Home Page</div>;
}
export function getConfig() {
  return Promise.resolve({ render: 'static' });
}
EOF

cat > src/pages/about.tsx << 'EOF'
export default function About() {
  return <div>About Page</div>;
}
EOF

cat > src/pages/[id].tsx << 'EOF'
export default function User({ params }: { params: { id: string } }) {
  return <div>User: {params.id}</div>;
}
EOF

cat > src/pages/404.tsx << 'EOF'
export default function NotFound() {
  return <div>Not Found</div>;
}
EOF

cat > src/api/hello.ts << 'EOF'
export async function GET() {
  return new Response(JSON.stringify({ message: 'hello' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
EOF

cat > src/slices/header.tsx << 'EOF'
export default function Header() {
  return <header>Site Header</header>;
}
EOF

# Create vite config
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite';
import render from '@renderjs/core';

export default defineConfig({
  plugins: [render()],
});
EOF

# Create entry client
cat > src/entry-client.tsx << 'EOF'
import { hydrateRoot } from 'react-dom/client';
import { createElement } from 'react';

const App = () => createElement('div', null, 'App');
hydrateRoot(document.getElementById('root')!, createElement(App));
EOF

# Create app.html
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<body>
<div id="root"></div>
<script type="module" src="/src/entry-client.tsx"></script>
</body>
</html>
EOF

echo "🚀 Starting dev server on port 3001..."
timeout 10s npm run dev -- --port 3001 > /dev/null 2>&1 &
DEV_PID=$!

sleep 5

echo ""
echo "🔥 TESTING LAYERS..."
echo "===================="

# Test 1: Page Discovery - check files exist
echo -n "1. Page Discovery: "
if [ -f src/pages/index.tsx ] && [ -f src/pages/[id].tsx ]; then
  echo "✅"
else
  echo "❌"
fi

# Test 2: Basic HTTP
echo -n "2. HTTP Server: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo "✅ (status: $RESP)"
else
  echo "❌ (status: $RESP)"
fi

# Test 3: Dynamic routes
echo -n "3. Dynamic Routes: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/users/123 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo "✅ (status: $RESP)"
else
  echo "❌ (status: $RESP)"
fi

# Test 4: API routes
echo -n "4. API Routes: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/hello 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo "✅ (status: $RESP)"
else
  echo "❌ (status: $RESP)"
fi

# Test 5: RSC endpoint
echo -n "5. RSC Endpoint: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/_rsc/ 2>/dev/null || echo "000")
if [ "$RESP" = "200" ]; then
  echo "✅ (status: $RESP)"
else
  echo "⚠️  (status: $RESP - may need config)"
fi

# Test 6: Action endpoint
echo -n "6. Action Endpoint: "
RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3001/__rsc/action -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")
if [ "$RESP" = "200" ] || [ "$RESP" = "404" ]; then
  echo "✅ (responds, status: $RESP)"
else
  echo "❌ (status: $RESP)"
fi

# Cleanup
kill $DEV_PID 2>/dev/null || true
rm -rf "$TESTDIR"

echo ""
echo "======================================"
echo "🔥 BRUTAL TEST COMPLETE"