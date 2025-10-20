# Quickstart: Web UI for meme-gtd

**Date**: 2025-10-20
**Feature**: Web UI for meme-gtd (Memos & Tasks Management)
**Branch**: `010-github-issue-meme`

## Prerequisites

- Node.js 18+ and pnpm installed
- meme-gtd API server (v0.6.0) implementation complete
- SQLite database initialized with schema

## Setup

### 1. Create Web Package

```bash
# From repository root
cd packages
mkdir web
cd web

# Initialize package.json
pnpm init

# Install dependencies
pnpm add react react-dom react-router-dom react-markdown remark-gfm
pnpm add -D @types/react @types/react-dom @vitejs/plugin-react typescript vite tailwindcss postcss autoprefixer
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
pnpm add -D @playwright/test
pnpm add -D openapi-typescript-codegen
```

### 2. Configure TypeScript

Create `packages/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `packages/web/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### 3. Configure Vite

Create `packages/web/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
  },
});
```

### 4. Configure TailwindCSS

```bash
# Initialize Tailwind
npx tailwindcss init -p
```

Edit `packages/web/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Create `packages/web/src/styles/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 5. Create Entry Files

Create `packages/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>meme-gtd Web UI</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `packages/web/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `packages/web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import MemosPage from './pages/MemosPage';
import MemoDetailPage from './pages/MemoDetailPage';
import MemoEditPage from './pages/MemoEditPage';
import MemoNewPage from './pages/MemoNewPage';
import TasksPage from './pages/TasksPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TaskEditPage from './pages/TaskEditPage';
import TaskNewPage from './pages/TaskNewPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/memos" replace />} />
          <Route path="memos" element={<MemosPage />} />
          <Route path="memos/new" element={<MemoNewPage />} />
          <Route path="memos/:id" element={<MemoDetailPage />} />
          <Route path="memos/:id/edit" element={<MemoEditPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/new" element={<TaskNewPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="tasks/:id/edit" element={<TaskEditPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### 6. Generate API Client

Update `packages/web/package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:e2e": "playwright test",
    "generate:api": "openapi-typescript-codegen --input ../api/docs/api/openapi.yaml --output ./src/api --client fetch"
  }
}
```

Run code generation:

```bash
pnpm generate:api
```

This creates:
- `src/api/models/` - TypeScript interfaces
- `src/api/services/` - API client methods
- `src/api/core/` - Fetch configuration

### 7. Update API Server to Serve Static Files

Install Fastify static plugin:

```bash
cd packages/api
pnpm add @fastify/static
```

Edit `packages/api/src/server.ts`:

```typescript
import fastifyStatic from '@fastify/static';
import path from 'path';

// After app initialization, register static file serving
app.register(fastifyStatic, {
  root: path.join(__dirname, '../../web/dist'),
  prefix: '/',
});

// SPA fallback: serve index.html for all non-API routes
app.setNotFoundHandler((request, reply) => {
  if (!request.url.startsWith('/api')) {
    reply.sendFile('index.html');
  } else {
    reply.status(404).send({ error: 'Not Found' });
  }
});
```

### 8. Update Workspace Configuration

Edit `pnpm-workspace.yaml` (if not already included):

```yaml
packages:
  - 'packages/*'
```

Update root `package.json` with build scripts:

```json
{
  "scripts": {
    "build:web": "pnpm --filter meme-gtd-web build",
    "build:api": "pnpm --filter meme-gtd-api build",
    "build": "pnpm build:web && pnpm build:api",
    "dev:web": "pnpm --filter meme-gtd-web dev",
    "dev:api": "pnpm --filter meme-gtd-api dev"
  }
}
```

## Development Workflow

### Running Development Servers

**Option 1: Separate terminals (recommended for development)**

Terminal 1 - API server:
```bash
pnpm dev:api
# API runs on http://localhost:3000
```

Terminal 2 - Vite dev server:
```bash
pnpm dev:web
# Web UI runs on http://localhost:5173
# API requests proxied to localhost:3000
```

**Option 2: Production build (for testing deployment)**

```bash
# Build web UI
pnpm build:web

# Build API server (includes serving web UI)
pnpm build:api

# Run API server (serves both API and web UI)
pnpm --filter meme-gtd-api start
# Access at http://localhost:3000
```

### Testing

**Unit tests**:
```bash
cd packages/web
pnpm test
```

**E2E tests** (requires API server running):
```bash
# Terminal 1: Start API server
pnpm dev:api

# Terminal 2: Run Playwright tests
cd packages/web
pnpm test:e2e
```

## Implementation Order

Follow this order for implementation (aligned with `/speckit.tasks` output):

### Phase 1: Foundation
1. Setup package structure (above steps)
2. Generate API client (`pnpm generate:api`)
3. Create Layout component with navigation
4. Create ErrorBoundary component

### Phase 2: Memos (P1-P2)
5. Create MemosPage (list view with bookmark filter)
6. Create MemoDetailPage (body, metadata)
7. Create MemoNewPage (create form)
8. Create MemoEditPage (edit form)
9. Add bookmark toggle to MemoDetailPage

### Phase 3: Tasks (P1-P2)
10. Create TasksPage (list view with status + bookmark filters)
11. Create TaskDetailPage (title, body, status, metadata)
12. Create TaskNewPage (create form with title, body, status, scheduledOn)
13. Create TaskEditPage (edit form)
14. Add bookmark toggle to TaskDetailPage
15. Add Close/Cancel/Reopen buttons to TaskDetailPage

### Phase 4: Labels (P3)
16. Create LabelModal component
17. Implement label assignment (POST /api/issues/:id/labels)
18. Implement label creation (POST /api/labels)
19. Implement label deletion (DELETE /api/labels/:name) with warning

### Phase 5: Links (P3)
20. Create LinkModal component
21. Implement link creation (POST /api/links)
22. Implement link display (grouped by type + direction)
23. Implement link deletion (DELETE /api/links/:id)

### Phase 6: Comments (P4)
24. Create CommentList component
25. Create CommentForm component
26. Implement comment creation (POST /api/memos|tasks/:id/comments)
27. Implement comment editing (PATCH /api/memos|tasks/:id/comments/:id)
28. Implement comment deletion (DELETE /api/memos|tasks/:id/comments/:id)

### Phase 7: Memo Promotion (P4)
29. Create PromoteModal component
30. Implement memo promotion (POST /api/memos/:id/promote)

### Phase 8: Testing
31. Write unit tests for key components (MemoList, TaskList, forms)
32. Write E2E tests for critical flows (create memo, create task, assign label, create link)

## Verification Checklist

After implementation, verify:

- [ ] `pnpm dev:web` starts Vite dev server on port 5173
- [ ] `pnpm dev:api` starts API server on port 3000
- [ ] Web UI can connect to API via proxy (check Network tab)
- [ ] All routes render without errors
- [ ] Memo CRUD operations work (create, read, update, delete)
- [ ] Task CRUD operations work (create, read, update, delete)
- [ ] Filters work (bookmark, status)
- [ ] Label assignment works
- [ ] Link creation works
- [ ] Comments work (create, edit, delete)
- [ ] Memo promotion works
- [ ] Task status changes work (close, cancel, reopen)
- [ ] Markdown rendering works
- [ ] Error states display correctly (404, 400, 500)
- [ ] `pnpm build` creates production build successfully
- [ ] Production build served from API server works (all routes accessible)

## Troubleshooting

**API requests fail (CORS error)**:
- Ensure Vite proxy is configured correctly in `vite.config.ts`
- Check API server is running on port 3000

**TypeScript errors after API client generation**:
- Run `pnpm generate:api` again
- Check OpenAPI spec is valid YAML
- Restart TypeScript server in IDE

**Vite build fails**:
- Check all TypeScript errors are resolved
- Run `pnpm build:web` separately to see detailed errors

**Static files not served in production**:
- Ensure `pnpm build:web` runs before `pnpm build:api`
- Check `packages/web/dist` directory exists
- Verify `@fastify/static` configuration in `packages/api/src/server.ts`

**E2E tests fail**:
- Ensure API server is running before tests
- Check test database is initialized (use test DB, not production)
- Run tests in headed mode for debugging: `pnpm test:e2e --headed`

## Next Steps

After quickstart setup is complete:

1. Run `/speckit.tasks` to generate implementation task list
2. Follow task order from tasks.md
3. Implement each task with TDD approach (write test → implement → verify)
4. Create commits at logical checkpoints (e.g., "feat: implement memo list page")
5. Update CHANGELOG.md with new feature when complete
6. Create PR with reference to spec.md and tasks.md
