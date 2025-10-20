# Implementation Plan: Web UI for meme-gtd (Memos & Tasks Management)

**Branch**: `010-github-issue-meme` | **Date**: 2025-10-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-github-issue-meme/spec.md`

## Summary

Build a web-based UI for meme-gtd that enables users to browse, create, edit, and manage memos and tasks through a browser interface. The UI will consume the existing meme-gtd REST API (v0.6.0) running locally at http://localhost:3000. Key capabilities include:

- Browse and filter memos/tasks by bookmark status and task status
- Create and edit memos (markdown body) and tasks (title, body, status, scheduled date)
- Manage labels (create, assign, delete) and links (create with types, delete)
- Post, edit, and delete comments on memos/tasks
- Bookmark/unbookmark memos/tasks, close/cancel/reopen tasks, promote memos to tasks

**Technical Approach**: Single-page application (SPA) using React + TypeScript + Vite, served as static files from the existing Fastify API server. Type-safe API client generated from OpenAPI specification. Markdown rendering with react-markdown. UI components styled with TailwindCSS.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2020+ target)
**Primary Dependencies**: React 18, Vite 5, React Router 6, react-markdown, TailwindCSS, openapi-typescript-codegen
**Storage**: N/A (consumes existing REST API, no direct database access)
**Testing**: Vitest for unit/component tests, Playwright for E2E tests
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge - last 2 versions)
**Project Type**: Web frontend (SPA) + existing backend API
**Performance Goals**: Initial page load <2s, API-to-UI updates <3s, 60fps smooth rendering
**Constraints**: API server must be running on localhost:3000, <100MB bundle size, safe markdown rendering (XSS prevention)
**Scale/Scope**: Support 500 combined memos/tasks, ~15 routes, ~20 React components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: Constitution file is template-only (not project-specific). Proceeding with standard web development practices:

- ✅ **Library-First Principle**: React components are self-contained, reusable libraries
- ✅ **Interface Pattern**: REST API already provides text I/O protocol (JSON in/out)
- ✅ **Testing**: Vitest for unit/component tests, Playwright for E2E contract tests
- ✅ **Integration Testing**: E2E tests will validate API contract compliance
- ✅ **Observability**: Browser DevTools + structured console logging, API request/response logging
- ✅ **Simplicity**: Start with minimal dependencies, no state management library initially (React Context/useState sufficient for MVP)

**No violations detected**. Web UI is an additive frontend feature that consumes existing API without modifying backend.

## Project Structure

### Documentation (this feature)

```
specs/010-github-issue-meme/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── ui-routes.md     # Frontend route definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/
├── api/                 # EXISTING - Fastify REST API server
│   ├── src/
│   │   ├── server.ts    # MODIFY: Add @fastify/static to serve web UI
│   │   ├── handlers/
│   │   ├── routes/
│   │   └── schemas/
│   ├── docs/api/
│   │   └── openapi.yaml # EXISTING - API specification (v0.6.0)
│   └── tests/
│
├── web/                 # NEW PACKAGE - Web UI
│   ├── src/
│   │   ├── main.tsx            # Entry point, React root render
│   │   ├── App.tsx             # Root component, React Router setup
│   │   ├── api/
│   │   │   ├── client.ts       # Generated API client (openapi-typescript-codegen)
│   │   │   └── types.ts        # Generated TypeScript types from OpenAPI
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Layout.tsx      # Header, navigation, footer wrapper
│   │   │   ├── MemoList.tsx    # Memo list view with filters
│   │   │   ├── MemoDetail.tsx  # Memo detail view (bodyMd, labels, links, comments)
│   │   │   ├── MemoForm.tsx    # Memo create/edit form
│   │   │   ├── TaskList.tsx    # Task list view with filters
│   │   │   ├── TaskDetail.tsx  # Task detail view (title, bodyMd, status, etc.)
│   │   │   ├── TaskForm.tsx    # Task create/edit form
│   │   │   ├── LabelModal.tsx  # Label assignment modal
│   │   │   ├── LinkModal.tsx   # Link creation modal
│   │   │   ├── CommentList.tsx # Comment display component
│   │   │   ├── CommentForm.tsx # Comment create/edit form
│   │   │   ├── PromoteModal.tsx# Memo → Task promotion modal
│   │   │   └── ErrorBoundary.tsx # Error handling wrapper
│   │   ├── pages/              # Page-level components (route targets)
│   │   │   ├── MemosPage.tsx   # /memos route
│   │   │   ├── MemoDetailPage.tsx # /memos/:id route
│   │   │   ├── MemoEditPage.tsx   # /memos/:id/edit route
│   │   │   ├── MemoNewPage.tsx    # /memos/new route
│   │   │   ├── TasksPage.tsx      # /tasks route
│   │   │   ├── TaskDetailPage.tsx # /tasks/:id route
│   │   │   ├── TaskEditPage.tsx   # /tasks/:id/edit route
│   │   │   └── TaskNewPage.tsx    # /tasks/new route
│   │   ├── hooks/              # Custom React hooks
│   │   │   ├── useMemos.ts     # Hook for fetching/managing memos
│   │   │   ├── useTasks.ts     # Hook for fetching/managing tasks
│   │   │   ├── useLabels.ts    # Hook for fetching/managing labels
│   │   │   ├── useLinks.ts     # Hook for fetching/managing links
│   │   │   └── useComments.ts  # Hook for fetching/managing comments
│   │   ├── utils/              # Utility functions
│   │   │   ├── markdown.ts     # Markdown rendering helpers
│   │   │   ├── dates.ts        # Date formatting helpers
│   │   │   └── validation.ts   # Form validation helpers
│   │   └── styles/
│   │       └── index.css       # TailwindCSS imports + global styles
│   ├── public/                 # Static assets (favicon, etc.)
│   ├── index.html              # HTML entry point
│   ├── vite.config.ts          # Vite build configuration
│   ├── tsconfig.json           # TypeScript configuration
│   ├── tailwind.config.js      # TailwindCSS configuration
│   ├── package.json            # Package dependencies
│   └── tests/
│       ├── unit/               # Component unit tests (Vitest)
│       └── e2e/                # E2E tests (Playwright)
│           ├── memos.spec.ts   # Memo CRUD tests
│           ├── tasks.spec.ts   # Task CRUD tests
│           └── labels-links.spec.ts # Label/Link management tests
│
├── cli/                 # EXISTING - CLI tool (no changes)
├── core/                # EXISTING - Business logic (no changes)
├── db/                  # EXISTING - Database layer (no changes)
├── shared/              # EXISTING - Shared utilities (no changes)
├── logger/              # EXISTING - Logging (no changes)
└── config/              # EXISTING - Configuration (no changes)
```

**Structure Decision**:

- **Web frontend as new package**: `packages/web/` created as a separate pnpm workspace package to maintain clear separation between frontend and backend
- **API server modification**: `packages/api/src/server.ts` modified to serve static files from `packages/web/dist` using `@fastify/static` plugin
- **Type safety**: Use `openapi-typescript-codegen` to generate TypeScript client and types from `/packages/api/docs/api/openapi.yaml`
- **Component organization**:
  - `components/` for reusable UI components (lists, forms, modals)
  - `pages/` for route-specific page components
  - `hooks/` for data fetching and API interaction logic
  - `api/` for generated API client code
- **Monorepo structure preserved**: Web UI integrates as a new workspace package, no changes to existing packages except API server static file serving

## Complexity Tracking

*No Constitution violations detected. This section intentionally left empty.*
