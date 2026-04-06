# Reserved React Components

React reserves certain component names that cannot be used as regular user-defined components. Understanding these helps avoid confusion and debugging issues.

## Complete List of Reserved Components

### `<Context>`

React's Context API uses special JSX syntax that looks like components but aren't:

```tsx
// ✅ Correct way to use Context
import { createContext } from 'react';

const ThemeContext = createContext('light');

function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Child />
    </ThemeContext.Provider>
  );
}

// ✅ Accessing Context
import { useContext } from 'react';

function Child() {
  const theme = useContext(ThemeContext);
  return <div className={theme}>Content</div>;
}
```

### `<ErrorBoundary>`

Error boundaries catch JavaScript errors in their child component tree:

```tsx
// ✅ @renderjs/core provides ErrorBoundary
import { ErrorBoundary } from '@renderjs/core';

function App() {
  return (
    <ErrorBoundary fallback={<ErrorFallback />}>
      <RiskyComponent />
    </ErrorBoundary>
  );
}

// ✅ Using NotFoundBoundary for 404s
import { NotFoundBoundary } from '@renderjs/core';

function App() {
  return (
    <NotFoundBoundary fallback={<NotFoundPage />}>
      <Routes />
    </NotFoundBoundary>
  );
}
```

### `<Suspense>`

Suspense boundaries show fallback content while loading:

```tsx
// ✅ @renderjs/core streaming handles Suspense automatically
import { createStreamingRenderer } from '@renderjs/core';

const { Suspense } = createStreamingRenderer();

// Or use built-in components
import { LoadingOverlay, PendingUI } from '@renderjs/core';

// PendingUI shows loading state for navigation
<PendingUI>
  {(isPending) => isPending ? <Spinner /> : null}
</PendingUI>
```

### `<Fragment>`

Fragments let you group elements without adding extra DOM nodes:

```tsx
// ✅ Multiple ways to use Fragment
import { Fragment } from 'react';

function List() {
  return (
    <Fragment>
      <li>Item 1</li>
      <li>Item 2</li>
    </Fragment>
  );
}

// ✅ Shorthand syntax (preferred)
function List() {
  return (
    <>
      <li>Item 1</li>
      <li>Item 2</li>
    </>
  );
}
```

### `<Profiler>`

Profiler measures rendering performance (React DevTools only):

```tsx
// ❌ Not available outside DevTools
// Don't try to use this as a regular component
```

### `<StrictMode>`

StrictMode highlights potential problems in development:

```tsx
// ✅ Only used once at root in development
import { StrictMode } from 'react';

function Root() {
  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}
```

### `<Portal>`

Portals render children into a different DOM subtree:

```tsx
// ✅ Use createPortal from react-dom
import { createPortal } from 'react-dom';

function Modal({ children, isOpen }) {
  if (!isOpen) return null;
  
  return createPortal(
    <div className="modal">{children}</div>,
    document.body
  );
}
```

## Common Mistakes

### ❌ Don't Do This

```tsx
// WRONG - Using reserved names as components
function ErrorBoundary({ children }) {
  return <div className="error">{children}</div>;
}

function Fragment({ items }) {
  return items.map(item => <span key={item.id}>{item.name}</span>);
}

// WRONG - Confusing Context with components
function Context({ children }) {
  const value = useContext(MyContext);
  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
}
```

### ✅ Do This Instead

```tsx
// CORRECT - Use descriptive names
function ErrorDisplay({ children }) {
  return <div className="error">{children}</div>;
}

function ItemList({ items }) {
  return items.map(item => <span key={item.id}>{item.name}</span>);
}

// CORRECT - Use Context properly
function ThemeProvider({ children }) {
  return <MyContext.Provider value="dark">{children}</MyContext.Provider>;
}

function ThemedComponent() {
  const theme = useContext(MyContext);
  return <div className={theme}>Content</div>;
}
```

## @renderjs/core Alternatives

| Reserved Name | @renderjs/core Alternative |
|---------------|---------------------------|
| `ErrorBoundary` | `import { ErrorBoundary } from '@renderjs/core'` |
| `NotFoundBoundary` | `import { NotFoundBoundary } from '@renderjs/core'` |
| `Suspense` | Streaming handled automatically |
| `Fragment` | Use `<>...</>` shorthand |

## Summary

1. **Never** define components named `ErrorBoundary`, `Suspense`, `Fragment`, `Profiler`, `Context`, `StrictMode`, or `Portal`
2. Use the **`@renderjs/core`** exports for error handling and loading states
3. Use React's **Context API properly** with `createContext()` and `useContext()`
4. Use **shorthand `<>`** for fragments instead of `<Fragment>`
