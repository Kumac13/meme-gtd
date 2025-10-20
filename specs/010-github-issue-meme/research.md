# Research: Web UI for meme-gtd

**Date**: 2025-10-20
**Feature**: Web UI for meme-gtd (Memos & Tasks Management)
**Branch**: `010-github-issue-meme`

## Technology Decisions

### 1. Frontend Framework: React 18

**Decision**: Use React 18 with TypeScript for building the UI

**Rationale**:
- **Ecosystem maturity**: React has the largest ecosystem of UI component libraries, tooling, and community support
- **TypeScript integration**: Excellent TypeScript support with built-in types and strong IDE integration
- **Component reusability**: React's component model aligns well with the feature requirements (MemoList, TaskList, modals, forms)
- **Hooks API**: Modern hooks (useState, useEffect, custom hooks) simplify state management and API integration without requiring external state libraries
- **Server state management**: React Query or SWR can be added later if needed, but useState + useEffect sufficient for MVP
- **Team familiarity**: React is widely known, reducing onboarding friction

**Alternatives Considered**:
- **Vue 3**: Good TypeScript support, simpler syntax, but smaller ecosystem and less familiarity
- **Svelte**: Excellent performance, minimal boilerplate, but smaller ecosystem and less TypeScript maturity
- **Solid.js**: Best performance, React-like API, but newer framework with smaller community

### 2. Build Tool: Vite 5

**Decision**: Use Vite 5 as the build tool and dev server

**Rationale**:
- **Fast dev server**: Native ESM-based dev server with instant HMR (Hot Module Replacement)
- **TypeScript support**: First-class TypeScript support out-of-the-box, no additional configuration needed
- **React integration**: Official `@vitejs/plugin-react` plugin for React Fast Refresh
- **Production builds**: Uses Rollup for optimized production bundles with code splitting
- **Simple configuration**: Minimal config required compared to webpack
- **Modern defaults**: ES2020+ target, tree-shaking, and modern browser optimization

**Alternatives Considered**:
- **Create React App (CRA)**: Deprecated, slow builds, difficult to customize
- **Next.js**: Overkill for SPA (includes SSR/SSG features not needed), more complex setup
- **webpack**: More configuration required, slower dev server compared to Vite

### 3. Routing: React Router 6

**Decision**: Use React Router 6 for client-side routing

**Rationale**:
- **Declarative routing**: Routes defined as React components, easy to understand and maintain
- **Nested routes**: Supports nested layouts (common Layout component for all pages)
- **Programmatic navigation**: `useNavigate` hook for redirects after form submissions
- **Route params**: `useParams` hook for extracting route parameters (/memos/:id)
- **Industry standard**: Most popular routing library for React SPAs
- **TypeScript support**: Full TypeScript support with route type safety

**Alternatives Considered**:
- **TanStack Router**: Better TypeScript route type safety, but newer and less mature
- **Wouter**: Lightweight (~1KB), but lacks nested routes and advanced features

### 4. API Client Generation: openapi-typescript-codegen

**Decision**: Generate TypeScript API client from OpenAPI spec using openapi-typescript-codegen

**Rationale**:
- **Type safety**: Auto-generated TypeScript types ensure API contract compliance
- **Single source of truth**: OpenAPI spec (openapi.yaml) drives both backend and frontend types
- **Reduced boilerplate**: Auto-generates fetch-based client code with request/response types
- **Contract validation**: Type errors caught at compile-time when API contract changes
- **Developer experience**: IntelliSense autocomplete for all API endpoints and payloads

**Alternatives Considered**:
- **Manual fetch calls**: More flexible, but no type safety and high maintenance burden
- **openapi-fetch**: Lighter weight, but requires separate type generation step
- **tRPC**: Excellent type safety, but requires backend changes (not REST-based)

### 5. Styling: TailwindCSS 3

**Decision**: Use TailwindCSS 3 for styling

**Rationale**:
- **Utility-first**: Rapid UI development with utility classes, no context switching to CSS files
- **Responsive design**: Built-in responsive breakpoints (sm:, md:, lg:, xl:)
- **Small bundle size**: PurgeCSS removes unused styles in production
- **Customization**: Easy to configure theme colors, spacing, typography via tailwind.config.js
- **Component consistency**: Utility classes enforce design system consistency
- **Dark mode support**: Built-in dark mode utilities (can be added later)

**Alternatives Considered**:
- **CSS Modules**: Good isolation, but more verbose and slower development
- **styled-components**: Good developer experience, but larger bundle size and runtime cost
- **Plain CSS**: Maximum flexibility, but harder to maintain consistency

### 6. Markdown Rendering: react-markdown

**Decision**: Use react-markdown for rendering markdown content

**Rationale**:
- **Security**: Built-in XSS protection, safe HTML rendering by default
- **React integration**: Renders markdown as React components, not raw HTML strings
- **Customizable**: Supports custom component renderers for links, code blocks, etc.
- **Plugin ecosystem**: Support for GFM (GitHub Flavored Markdown), syntax highlighting via remark/rehype plugins
- **Lightweight**: Smaller bundle than full-featured editors

**Alternatives Considered**:
- **marked**: Fast, but returns raw HTML (requires separate sanitization with DOMPurify)
- **markdown-it**: Powerful, but not React-specific, requires dangerouslySetInnerHTML
- **MDX**: Overkill for simple markdown rendering, designed for markdown + JSX

### 7. Testing: Vitest + Playwright

**Decision**: Use Vitest for unit/component tests and Playwright for E2E tests

**Rationale**:

**Vitest**:
- **Vite integration**: Native Vite integration, shares the same config and plugins
- **Fast execution**: Instant feedback with watch mode, parallel test execution
- **Jest-compatible API**: Familiar API (describe, test, expect) for developers who know Jest
- **Component testing**: Works with @testing-library/react for component tests
- **TypeScript support**: First-class TypeScript support, no additional setup

**Playwright**:
- **Cross-browser**: Tests on Chromium, Firefox, WebKit with single API
- **API contract testing**: Can validate full request/response flow against API
- **Auto-wait**: Built-in auto-wait for elements, reducing flaky tests
- **Debugging**: Excellent debugging tools (trace viewer, inspector, screenshots)
- **Modern API**: Better API than Selenium/Puppeteer

**Alternatives Considered**:
- **Jest + RTL**: Good, but Jest slower than Vitest and requires more configuration with Vite
- **Cypress**: Good E2E testing, but slower than Playwright and limited to Chromium-based browsers

## Best Practices

### React Component Organization

**Decision**: Organize components by type (components/, pages/, hooks/)

**Best Practices**:
1. **Separation of Concerns**:
   - `pages/`: Route-level components that handle URL params and data fetching
   - `components/`: Reusable UI components (lists, forms, modals) with props interface
   - `hooks/`: Custom hooks for data fetching and API interaction logic

2. **Component Structure**:
   ```tsx
   // Example: MemoList.tsx
   interface MemoListProps {
     memos: Memo[];
     onBookmark: (id: number) => void;
     loading?: boolean;
   }

   export function MemoList({ memos, onBookmark, loading }: MemoListProps) {
     // Component logic
   }
   ```

3. **Custom Hooks for API Calls**:
   ```tsx
   // Example: useMemos.ts
   export function useMemos(bookmarked?: boolean) {
     const [memos, setMemos] = useState<Memo[]>([]);
     const [loading, setLoading] = useState(true);
     const [error, setError] = useState<Error | null>(null);

     useEffect(() => {
       fetchMemos(bookmarked).then(setMemos).catch(setError).finally(() => setLoading(false));
     }, [bookmarked]);

     return { memos, loading, error };
   }
   ```

4. **Error Boundaries**: Wrap route components in ErrorBoundary to catch rendering errors

**References**:
- [React Docs - Thinking in React](https://react.dev/learn/thinking-in-react)
- [React Docs - Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)

### API Client Integration

**Decision**: Generate API client during build, use custom hooks to wrap API calls

**Best Practices**:
1. **Code Generation Script**:
   ```json
   // package.json scripts
   {
     "generate:api": "openapi-typescript-codegen --input ../api/docs/api/openapi.yaml --output ./src/api --client fetch"
   }
   ```

2. **API Error Handling**:
   ```tsx
   // Custom hook with error handling
   async function createMemo(bodyMd: string) {
     try {
       const memo = await MemosService.createMemo({ bodyMd });
       return { data: memo, error: null };
     } catch (err) {
       return { data: null, error: err as Error };
     }
   }
   ```

3. **Loading States**: Always show loading indicators during API calls
4. **Optimistic Updates**: Update UI immediately, revert on error (can be added later)

**References**:
- [openapi-typescript-codegen Documentation](https://github.com/ferdikoomen/openapi-typescript-codegen)

### Form Handling and Validation

**Decision**: Use controlled components with manual validation

**Best Practices**:
1. **Controlled Inputs**:
   ```tsx
   const [bodyMd, setBodyMd] = useState('');

   <textarea
     value={bodyMd}
     onChange={(e) => setBodyMd(e.target.value)}
     required
   />
   ```

2. **Validation**:
   - Client-side: Check required fields before submission
   - Server-side: Display API validation errors (400 responses)
   ```tsx
   if (!bodyMd.trim()) {
     setError('Body is required');
     return;
   }
   ```

3. **Form Submission**:
   ```tsx
   async function handleSubmit(e: React.FormEvent) {
     e.preventDefault();
     setLoading(true);
     const { data, error } = await createMemo(bodyMd);
     if (error) {
       setError(error.message);
     } else {
       navigate(`/memos/${data.id}`);
     }
     setLoading(false);
   }
   ```

**Alternatives Considered**:
- **React Hook Form**: Reduces boilerplate, but adds dependency for simple forms
- **Formik**: Feature-rich, but heavier bundle size

**References**:
- [React Docs - Managing State](https://react.dev/learn/managing-state)

### Markdown Rendering Security

**Decision**: Use react-markdown with default safe settings

**Best Practices**:
1. **Safe by Default**: react-markdown escapes HTML by default
2. **Plugins**: Add remark-gfm for GitHub Flavored Markdown (tables, strikethrough)
   ```tsx
   import ReactMarkdown from 'react-markdown';
   import remarkGfm from 'remark-gfm';

   <ReactMarkdown remarkPlugins={[remarkGfm]}>
     {bodyMd}
   </ReactMarkdown>
   ```

3. **Custom Components** (optional):
   ```tsx
   <ReactMarkdown
     components={{
       a: ({ href, children }) => (
         <a href={href} target="_blank" rel="noopener noreferrer">
           {children}
         </a>
       )
     }}
   >
     {bodyMd}
   </ReactMarkdown>
   ```

**References**:
- [react-markdown Documentation](https://github.com/remarkjs/react-markdown)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

### Static File Serving from Fastify

**Decision**: Use @fastify/static plugin to serve Vite production build

**Best Practices**:
1. **Plugin Registration**:
   ```typescript
   // packages/api/src/server.ts
   import fastifyStatic from '@fastify/static';
   import path from 'path';

   app.register(fastifyStatic, {
     root: path.join(__dirname, '../../web/dist'),
     prefix: '/',
   });

   // Serve index.html for all non-API routes (SPA fallback)
   app.setNotFoundHandler((request, reply) => {
     if (!request.url.startsWith('/api')) {
       reply.sendFile('index.html');
     }
   });
   ```

2. **Build Order**:
   ```json
   // Root package.json scripts
   {
     "build:web": "pnpm --filter meme-gtd-web build",
     "build:api": "pnpm --filter meme-gtd-api build",
     "build": "pnpm build:web && pnpm build:api"
   }
   ```

3. **Development**: Run Vite dev server separately (localhost:5173) during development, Fastify API on localhost:3000

**References**:
- [@fastify/static Documentation](https://github.com/fastify/fastify-static)

### TypeScript Configuration

**Decision**: Extend root tsconfig.base.json with web-specific overrides

**Best Practices**:
1. **Strict Mode**: Enable strict type checking
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "target": "ES2020",
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "jsx": "react-jsx",
       "module": "ESNext",
       "moduleResolution": "bundler",
       "strict": true,
       "skipLibCheck": true
     }
   }
   ```

2. **Path Aliases** (optional):
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/components/*": ["src/components/*"],
         "@/hooks/*": ["src/hooks/*"]
       }
     }
   }
   ```

**References**:
- [TypeScript Handbook - React](https://www.typescriptlang.org/docs/handbook/react.html)

## Integration Patterns

### API Server + Web UI Integration

**Pattern**: Fastify serves both API endpoints and static web UI files

**Implementation**:
1. **API routes**: All API routes under `/api/*` prefix
2. **Static files**: Web UI served from `/` root path
3. **SPA fallback**: Non-API routes return `index.html` for client-side routing
4. **CORS**: Not required (same origin - both served from localhost:3000)

**Diagram**:
```
Browser Request
    │
    ├─ /api/memos           → Fastify API handler → JSON response
    ├─ /api/tasks           → Fastify API handler → JSON response
    │
    ├─ /                    → Static file (index.html)
    ├─ /memos               → Static file (index.html) → React Router
    ├─ /tasks               → Static file (index.html) → React Router
    └─ /assets/main.js      → Static file (main.js)
```

### State Management Strategy

**Pattern**: useState + useEffect for simple state, custom hooks for API calls

**Implementation**:
1. **Local component state**: Use useState for form inputs, UI toggles
2. **Server state**: Use custom hooks (useMemos, useTasks) for API data
3. **No global state library**: React Context can be added later if needed for auth tokens or theme

**Example**:
```tsx
// pages/MemosPage.tsx
function MemosPage() {
  const [bookmarked, setBookmarked] = useState(false);
  const { memos, loading, error } = useMemos(bookmarked);

  return (
    <div>
      <button onClick={() => setBookmarked(!bookmarked)}>
        {bookmarked ? 'All' : 'Bookmarked only'}
      </button>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      <MemoList memos={memos} />
    </div>
  );
}
```

### Testing Strategy

**Pattern**: Unit tests for components, E2E tests for user flows

**Implementation**:

**Unit Tests** (Vitest + React Testing Library):
```tsx
// tests/unit/MemoList.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoList } from '@/components/MemoList';

test('renders memo list', () => {
  const memos = [
    { id: 1, bodyMd: 'Test memo', isBookmarked: false, createdAt: '2025-01-01' }
  ];
  render(<MemoList memos={memos} />);
  expect(screen.getByText(/Test memo/)).toBeInTheDocument();
});
```

**E2E Tests** (Playwright):
```typescript
// tests/e2e/memos.spec.ts
import { test, expect } from '@playwright/test';

test('create and view memo', async ({ page }) => {
  await page.goto('http://localhost:3000/memos');
  await page.click('text=New memo');
  await page.fill('textarea[name="bodyMd"]', 'My first memo');
  await page.click('button:has-text("Save")');

  await expect(page).toHaveURL(/\/memos\/\d+/);
  await expect(page.locator('text=My first memo')).toBeVisible();
});
```

## Unresolved Questions

None. All technical decisions resolved based on existing API specification and standard React + TypeScript web development practices.
