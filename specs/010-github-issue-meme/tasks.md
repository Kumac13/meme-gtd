# Tasks: Web UI for meme-gtd (Memos & Tasks Management)

**Input**: Design documents from `/specs/010-github-issue-meme/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-routes.md

**Tests**: E2E tests will be added after MVP implementation (User Story 1-2 complete)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `packages/web/src/` for frontend code, `packages/api/src/` for backend modifications
- All paths are relative to repository root `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, package creation, and basic structure setup

**Tasks**:

- [x] T001 Create `packages/web/` directory and initialize package with `pnpm init`
- [x] T002 Install frontend dependencies: `react`, `react-dom`, `react-router-dom`, `react-markdown`, `remark-gfm`
- [x] T003 [P] Install dev dependencies: `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `typescript`, `vite`
- [x] T004 [P] Install styling dependencies: `tailwindcss`, `postcss`, `autoprefixer`
- [x] T005 [P] Install testing dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`, `@playwright/test`
- [x] T006 [P] Install API client generator: `openapi-typescript-codegen`
- [x] T007 Create `packages/web/tsconfig.json` extending `../../tsconfig.base.json` with React/DOM config
- [x] T008 Create `packages/web/tsconfig.node.json` for Vite config
- [x] T009 Create `packages/web/vite.config.ts` with React plugin, proxy to API server, and test config
- [x] T010 Initialize TailwindCSS: run `npx tailwindcss init -p`, create `tailwind.config.js` with content paths
- [x] T011 Create `packages/web/src/styles/index.css` with Tailwind directives
- [x] T012 Create `packages/web/index.html` with root div and script tag
- [x] T013 Create `packages/web/package.json` scripts: `dev`, `build`, `preview`, `test`, `test:e2e`, `generate:api`
- [x] T014 Update root `pnpm-workspace.yaml` to include `packages/web` if not already present
- [x] T015 Update root `package.json` with `build:web` and `dev:web` scripts

**Checkpoint**: Package structure and build tooling ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

**Tasks**:

- [ ] T016 Generate API client: run `pnpm --filter meme-gtd-web generate:api` to create `src/api/` from OpenAPI spec
- [ ] T017 Create `packages/web/src/main.tsx` entry point rendering `<App />` to `#root`
- [ ] T018 Create `packages/web/src/App.tsx` with BrowserRouter and basic route structure
- [ ] T019 Create `packages/web/src/components/Layout.tsx` component with navigation header (links to /memos and /tasks)
- [ ] T020 Create `packages/web/src/components/ErrorBoundary.tsx` component for error handling
- [ ] T021 Modify `packages/api/src/server.ts`: install `@fastify/static`, register plugin to serve `packages/web/dist`
- [ ] T022 Modify `packages/api/src/server.ts`: add SPA fallback (setNotFoundHandler to serve index.html for non-API routes)
- [ ] T023 [P] Create `packages/web/src/utils/dates.ts` with date formatting helper functions
- [ ] T024 [P] Create `packages/web/src/utils/validation.ts` with form validation helper functions
- [ ] T025 [P] Create `packages/web/src/utils/markdown.ts` with react-markdown wrapper component

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse Memos (Priority: P1) 🎯 MVP

**Goal**: Users can view memo list with bookmark filter and see detailed memo content including labels and comment count

**Independent Test**: Navigate to /memos, verify list displays, apply bookmark filter, click a memo to see details

**Acceptance Scenarios** (from spec.md):
1. Display all memos with ID, body preview, bookmark status, timestamps
2. Click memo row navigates to detail page showing full body, labels, comment count
3. Bookmark filter shows only bookmarked memos

**Tasks**:

- [ ] T026 [P] [US1] Create `packages/web/src/hooks/useMemos.ts` custom hook for fetching memos (with bookmark filter param)
- [ ] T027 [P] [US1] Create `packages/web/src/components/MemoList.tsx` component displaying memo table with columns
- [ ] T028 [P] [US1] Create `packages/web/src/components/MemoDetail.tsx` component displaying memo body (markdown), labels, comment count
- [ ] T029 [US1] Create `packages/web/src/pages/MemosPage.tsx` using useMemos hook and MemoList component, with bookmark filter toggle
- [ ] T030 [US1] Create `packages/web/src/pages/MemoDetailPage.tsx` using useParams to fetch memo by ID and display MemoDetail
- [ ] T031 [US1] Add routes in `App.tsx`: `/memos` → MemosPage, `/memos/:id` → MemoDetailPage

**Checkpoint**: User Story 1 complete - users can browse and view memos

---

## Phase 4: User Story 2 - Browse Tasks (Priority: P1) 🎯 MVP

**Goal**: Users can view task list with status and bookmark filters and see detailed task content

**Independent Test**: Navigate to /tasks, apply status/bookmark filters, click a task to see details

**Acceptance Scenarios** (from spec.md):
1. Display all tasks with ID, title, status, bookmark, timestamps
2. Status filter shows only tasks with selected status
3. Bookmark filter shows only bookmarked tasks
4. Click task row navigates to detail page showing title, body, status, scheduled date, labels, comment count

**Tasks**:

- [ ] T032 [P] [US2] Create `packages/web/src/hooks/useTasks.ts` custom hook for fetching tasks (with status and bookmark filter params)
- [ ] T033 [P] [US2] Create `packages/web/src/components/TaskList.tsx` component displaying task table with columns
- [ ] T034 [P] [US2] Create `packages/web/src/components/TaskDetail.tsx` component displaying task title, body (markdown), status, scheduled date, labels, comment count
- [ ] T035 [US2] Create `packages/web/src/pages/TasksPage.tsx` using useTasks hook and TaskList component, with status select and bookmark filter toggle
- [ ] T036 [US2] Create `packages/web/src/pages/TaskDetailPage.tsx` using useParams to fetch task by ID and display TaskDetail
- [ ] T037 [US2] Add routes in `App.tsx`: `/tasks` → TasksPage, `/tasks/:id` → TaskDetailPage

**Checkpoint**: User Story 2 complete - users can browse and view tasks. **MVP READY** (US1 + US2 combined)

---

## Phase 5: User Story 3 - Create and Edit Memos (Priority: P2)

**Goal**: Users can create new memos and edit existing memo content

**Independent Test**: Click "New memo" button, enter bodyMd, save. Edit existing memo from detail page.

**Acceptance Scenarios** (from spec.md):
1. /memos/new displays form with bodyMd textarea
2. POST /api/memos creates memo and navigates to detail page
3. /memos/:id/edit displays pre-filled form
4. PATCH /api/memos/:id updates memo and returns to detail page

**Tasks**:

- [ ] T038 [P] [US3] Create `packages/web/src/components/MemoForm.tsx` reusable form component with bodyMd textarea, Save/Cancel buttons
- [ ] T039 [US3] Create `packages/web/src/pages/MemoNewPage.tsx` using MemoForm, calls POST /api/memos on submit, navigates to /memos/:id
- [ ] T040 [US3] Create `packages/web/src/pages/MemoEditPage.tsx` using MemoForm pre-filled with existing bodyMd, calls PATCH /api/memos/:id on submit
- [ ] T041 [US3] Update `MemoDetailPage.tsx` to add "Edit" button linking to `/memos/:id/edit`
- [ ] T042 [US3] Update `MemosPage.tsx` to add "New memo" button linking to `/memos/new`
- [ ] T043 [US3] Add routes in `App.tsx`: `/memos/new` → MemoNewPage, `/memos/:id/edit` → MemoEditPage

**Checkpoint**: User Story 3 complete - users can create and edit memos

---

## Phase 6: User Story 4 - Create and Edit Tasks (Priority: P2)

**Goal**: Users can create new tasks and edit existing task details

**Independent Test**: Click "New task" button, enter title/bodyMd/status, save. Edit existing task from detail page.

**Acceptance Scenarios** (from spec.md):
1. /tasks/new displays form with title, bodyMd, status select, scheduledOn inputs
2. POST /api/tasks creates task and navigates to detail page
3. /tasks/:id/edit displays pre-filled form
4. PATCH /api/tasks/:id updates task and returns to detail page

**Tasks**:

- [ ] T044 [P] [US4] Create `packages/web/src/components/TaskForm.tsx` reusable form component with title input, bodyMd textarea, status select, scheduledOn date input, Save/Cancel buttons
- [ ] T045 [US4] Create `packages/web/src/pages/TaskNewPage.tsx` using TaskForm, calls POST /api/tasks on submit, navigates to /tasks/:id
- [ ] T046 [US4] Create `packages/web/src/pages/TaskEditPage.tsx` using TaskForm pre-filled with existing values, calls PATCH /api/tasks/:id on submit
- [ ] T047 [US4] Update `TaskDetailPage.tsx` to add "Edit" button linking to `/tasks/:id/edit`
- [ ] T048 [US4] Update `TasksPage.tsx` to add "New task" button linking to `/tasks/new`
- [ ] T049 [US4] Add routes in `App.tsx`: `/tasks/new` → TaskNewPage, `/tasks/:id/edit` → TaskEditPage

**Checkpoint**: User Story 4 complete - users can create and edit tasks

---

## Phase 7: User Story 5 - Manage Labels (Priority: P3)

**Goal**: Users can view, create, assign, and delete labels

**Independent Test**: Open label modal from memo/task detail, fetch labels, create new label, assign to issue, delete label

**Acceptance Scenarios** (from spec.md):
1. [+] button in Labels section opens modal displaying all labels
2. Select label and assign to issue (POST /api/issues/:id/labels)
3. Create new label and assign (POST /api/labels, then POST /api/issues/:id/labels)
4. Delete label removes it from all issues (DELETE /api/labels/:name)

**Tasks**:

- [ ] T050 [P] [US5] Create `packages/web/src/hooks/useLabels.ts` custom hook for fetching all labels (GET /api/labels)
- [ ] T051 [US5] Create `packages/web/src/components/LabelModal.tsx` modal component with label list, selection, create form, assign/create-assign/cancel buttons
- [ ] T052 [US5] Update `MemoDetailPage.tsx` to display labels section with [+] button that opens LabelModal, [x] button for delete label
- [ ] T053 [US5] Update `TaskDetailPage.tsx` to display labels section with [+] button that opens LabelModal, [x] button for delete label
- [ ] T054 [US5] Implement label assignment in LabelModal: call POST /api/issues/:issueId/labels, close modal, refresh page
- [ ] T055 [US5] Implement label creation in LabelModal: call POST /api/labels with name/description, then assign, close modal
- [ ] T056 [US5] Implement label deletion in MemoDetailPage/TaskDetailPage: call DELETE /api/labels/:name with confirmation dialog, refresh page

**Checkpoint**: User Story 5 complete - users can manage labels

---

## Phase 8: User Story 6 - Manage Links (Priority: P3)

**Goal**: Users can create and delete links between memos/tasks with relationship types

**Independent Test**: Open link modal from memo/task detail, create link with type and target ID, delete link

**Acceptance Scenarios** (from spec.md):
1. [+] button in Links section opens modal with linkType selector and targetIssueId input
2. Create link (POST /api/links) with sourceIssueId, targetIssueId, linkType
3. Display links grouped by linkType and direction (outgoing/incoming)
4. Delete link (DELETE /api/links/:id)

**Tasks**:

- [ ] T057 [P] [US6] Create `packages/web/src/hooks/useLinks.ts` custom hook for fetching issue links (GET /api/issues/:id/links)
- [ ] T058 [US6] Create `packages/web/src/components/LinkModal.tsx` modal component with linkType select, targetIssueId input, create/cancel buttons
- [ ] T059 [US6] Update `MemoDetailPage.tsx` to display links section grouped by type/direction, [+] button opens LinkModal, [x] button deletes link
- [ ] T060 [US6] Update `TaskDetailPage.tsx` to display links section grouped by type/direction, [+] button opens LinkModal, [x] button deletes link
- [ ] T061 [US6] Implement link creation in LinkModal: call POST /api/links with {sourceIssueId, targetIssueId, linkType}, close modal, refresh page
- [ ] T062 [US6] Implement link deletion in MemoDetailPage/TaskDetailPage: call DELETE /api/links/:id, refresh page

**Checkpoint**: User Story 6 complete - users can manage links

---

## Phase 9: User Story 7 - Post and Manage Comments (Priority: P4)

**Goal**: Users can view, create, edit, and delete comments on memos and tasks

**Independent Test**: Load memo/task detail, fetch comments, post new comment, edit comment, delete comment

**Acceptance Scenarios** (from spec.md):
1. Page load fetches comments (GET /api/memos/:id/comments or /api/tasks/:id/comments)
2. Post comment (POST /api/memos/:id/comments with {bodyMd})
3. Edit comment (PATCH /api/memos/:id/comments/:commentId with {bodyMd})
4. Delete comment (DELETE /api/memos/:id/comments/:commentId)

**Tasks**:

- [ ] T063 [P] [US7] Create `packages/web/src/hooks/useComments.ts` custom hook for fetching comments by issue ID
- [ ] T064 [P] [US7] Create `packages/web/src/components/CommentList.tsx` component displaying comments with bodyMd (markdown), timestamps, Edit/Delete buttons
- [ ] T065 [P] [US7] Create `packages/web/src/components/CommentForm.tsx` component with bodyMd textarea and Comment/Save/Cancel buttons
- [ ] T066 [US7] Update `MemoDetailPage.tsx` to include CommentList and CommentForm, integrate comment CRUD operations
- [ ] T067 [US7] Update `TaskDetailPage.tsx` to include CommentList and CommentForm, integrate comment CRUD operations
- [ ] T068 [US7] Implement comment creation in CommentForm: call POST /api/memos/:id/comments or /api/tasks/:id/comments, refresh comment list
- [ ] T069 [US7] Implement comment editing in CommentList: show inline edit form, call PATCH /api/memos/:id/comments/:commentId or /api/tasks/:id/comments/:commentId
- [ ] T070 [US7] Implement comment deletion in CommentList: call DELETE /api/memos/:id/comments/:commentId or /api/tasks/:id/comments/:commentId, refresh list

**Checkpoint**: User Story 7 complete - users can manage comments

---

## Phase 10: User Story 8 - Promote Memo to Task (Priority: P4)

**Goal**: Users can promote memos to tasks by providing title and initial status

**Independent Test**: Open promotion modal from memo detail, enter title and status, verify new task created

**Acceptance Scenarios** (from spec.md):
1. "Promote to Task" button on memo detail opens modal with title input and status select (open/next/waiting/scheduled only)
2. Submit modal calls POST /api/memos/:id/promote with {title, status}, navigates to /tasks/:taskId

**Tasks**:

- [ ] T071 [US8] Create `packages/web/src/components/PromoteModal.tsx` modal component with title input, status select (open/next/waiting/scheduled), promote/cancel buttons
- [ ] T072 [US8] Update `MemoDetailPage.tsx` to add "Promote to Task" button that opens PromoteModal
- [ ] T073 [US8] Implement promotion in PromoteModal: call POST /api/memos/:id/promote with {title, status}, navigate to /tasks/:taskId on success

**Checkpoint**: User Story 8 complete - users can promote memos to tasks

---

## Phase 11: User Story 9 - Bookmark Memos and Tasks (Priority: P4)

**Goal**: Users can bookmark and unbookmark memos/tasks for quick access filtering

**Independent Test**: Click bookmark/unbookmark button on detail page, verify isBookmarked updates, verify filter works

**Acceptance Scenarios** (from spec.md):
1. Bookmark button calls POST /api/memos/:id/bookmark or /api/tasks/:id/bookmark, updates button to "Unbookmark"
2. Unbookmark button calls POST /api/memos/:id/unbookmark or /api/tasks/:id/unbookmark, updates button to "Bookmark"
3. Bookmark filter on list pages uses isBookmarked field

**Tasks**:

- [ ] T074 [US9] Update `MemoDetailPage.tsx` to add Bookmark/Unbookmark button that calls POST /api/memos/:id/bookmark or /unbookmark, updates state
- [ ] T075 [US9] Update `TaskDetailPage.tsx` to add Bookmark/Unbookmark button that calls POST /api/tasks/:id/bookmark or /unbookmark, updates state
- [ ] T076 [US9] Verify bookmark filter already works in MemosPage (useMemos hook with bookmarked param)
- [ ] T077 [US9] Verify bookmark filter already works in TasksPage (useTasks hook with bookmarked param)

**Checkpoint**: User Story 9 complete - users can bookmark memos/tasks

---

## Phase 12: User Story 10 - Close, Cancel, and Reopen Tasks (Priority: P4)

**Goal**: Users can change task status using close/cancel/reopen actions

**Independent Test**: Click close/cancel/reopen buttons on task detail, verify status updates

**Acceptance Scenarios** (from spec.md):
1. Close button calls POST /api/tasks/:id/close, sets status to "done", button changes to "Reopen"
2. Cancel button calls POST /api/tasks/:id/cancel, sets status to "canceled"
3. Reopen button calls POST /api/tasks/:id/reopen, sets status to "open", button changes to "Close"

**Tasks**:

- [ ] T078 [US10] Update `TaskDetailPage.tsx` to add Close button (shown when status != done/canceled) that calls POST /api/tasks/:id/close, updates status state
- [ ] T079 [US10] Update `TaskDetailPage.tsx` to add Cancel button (shown when status != canceled) that calls POST /api/tasks/:id/cancel, updates status state
- [ ] T080 [US10] Update `TaskDetailPage.tsx` to add Reopen button (shown when status = done/canceled) that calls POST /api/tasks/:id/reopen, updates status state

**Checkpoint**: User Story 10 complete - users can manage task status transitions

---

## Phase 13: User Story 11 - Delete Memos and Tasks (Priority: P5)

**Goal**: Users can soft-delete memos and tasks

**Independent Test**: Click delete button on detail page with confirmation, verify item removed from list

**Acceptance Scenarios** (from spec.md):
1. Delete button on memo detail calls DELETE /api/memos/:id with confirmation, navigates to /memos
2. Delete button on task detail calls DELETE /api/tasks/:id with confirmation, navigates to /tasks

**Tasks**:

- [ ] T081 [US11] Update `MemoDetailPage.tsx` to add Delete button with confirmation dialog, calls DELETE /api/memos/:id, navigates to /memos
- [ ] T082 [US11] Update `TaskDetailPage.tsx` to add Delete button with confirmation dialog, calls DELETE /api/tasks/:id, navigates to /tasks

**Checkpoint**: User Story 11 complete - users can delete memos and tasks

---

## Phase 14: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, loading states, responsive behavior, production build

**Tasks**:

- [ ] T083 [P] Add loading indicators to all pages during API requests (spinner or skeleton screens)
- [ ] T084 [P] Add error message display for all API error responses (400, 404, 409, 500)
- [ ] T085 [P] Add form validation error display (client-side validation before submission)
- [ ] T086 [P] Add 404 page for non-existent memo/task IDs
- [ ] T087 [P] Add confirmation dialogs for destructive actions (delete memo/task, delete label)
- [ ] T088 Test production build: run `pnpm build`, verify `packages/web/dist` created, verify bundle size < 100MB
- [ ] T089 Test API server static file serving: run API server, access http://localhost:3000, verify web UI loads
- [ ] T090 Test all routes work in production: verify /memos, /tasks, /memos/:id, /tasks/:id all render correctly
- [ ] T091 [P] Add basic styling improvements with TailwindCSS (buttons, forms, tables, modals)
- [ ] T092 [P] Add markdown rendering safety verification (ensure react-markdown escapes HTML)

**Checkpoint**: All polish tasks complete - production-ready build

---

## Phase 15: E2E Testing (Optional)

**Purpose**: End-to-end tests for critical user flows

**Note**: E2E tests are optional but recommended for production deployments

**Tasks**:

- [ ] T093 [P] Create `packages/web/tests/setup.ts` for Vitest configuration
- [ ] T094 [P] Create `packages/web/tests/e2e/memos.spec.ts` with Playwright tests for memo CRUD (create, view, edit, bookmark)
- [ ] T095 [P] Create `packages/web/tests/e2e/tasks.spec.ts` with Playwright tests for task CRUD (create, view, edit, status changes)
- [ ] T096 [P] Create `packages/web/tests/e2e/labels-links.spec.ts` with Playwright tests for label/link management
- [ ] T097 Run E2E tests: `pnpm --filter meme-gtd-web test:e2e`, verify all tests pass

**Checkpoint**: E2E test suite complete

---

## Dependencies & Execution Order

### User Story Completion Order (Priority-based)

**MVP (Minimum Viable Product)**: User Story 1 + User Story 2
- US1 (P1): Browse Memos
- US2 (P1): Browse Tasks

**Post-MVP Incremental Delivery**:
- US3 (P2): Create/Edit Memos
- US4 (P2): Create/Edit Tasks
- US5 (P3): Manage Labels
- US6 (P3): Manage Links
- US7 (P4): Manage Comments
- US8 (P4): Promote Memo to Task
- US9 (P4): Bookmark Memos/Tasks
- US10 (P4): Close/Cancel/Reopen Tasks
- US11 (P5): Delete Memos/Tasks

### Critical Path

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKING: Must complete before any user story
    ↓
    ├─ Phase 3 (US1: Browse Memos) [P1] ─┐
    └─ Phase 4 (US2: Browse Tasks) [P1] ─┴─ MVP READY
              ↓
    ├─ Phase 5 (US3: Create/Edit Memos) [P2]
    └─ Phase 6 (US4: Create/Edit Tasks) [P2]
              ↓
    ├─ Phase 7 (US5: Manage Labels) [P3]
    └─ Phase 8 (US6: Manage Links) [P3]
              ↓
    ├─ Phase 9 (US7: Manage Comments) [P4]
    ├─ Phase 10 (US8: Promote Memo to Task) [P4]
    ├─ Phase 11 (US9: Bookmark) [P4]
    ├─ Phase 12 (US10: Task Status) [P4]
    └─ Phase 13 (US11: Delete) [P5]
              ↓
Phase 14 (Polish & Cross-Cutting)
    ↓
Phase 15 (E2E Testing) [Optional]
```

### Parallel Execution Opportunities

**Phase 1 (Setup)**: T003, T004, T005, T006 can run in parallel (different tool installations)

**Phase 2 (Foundational)**: T023, T024, T025 can run in parallel (different utility files)

**Phase 3 (US1)**: T026, T027, T028 can run in parallel (different components, no dependencies)

**Phase 4 (US2)**: T032, T033, T034 can run in parallel (different components, no dependencies)

**Phase 5 (US3)**: T038 can start immediately (form component independent)

**Phase 6 (US4)**: T044 can start immediately (form component independent)

**Phase 7 (US5)**: T050, T051 can run in parallel (hook and modal are independent)

**Phase 8 (US6)**: T057, T058 can run in parallel (hook and modal are independent)

**Phase 9 (US7)**: T063, T064, T065 can run in parallel (hook and two components are independent)

**Phase 14 (Polish)**: T083, T084, T085, T086, T087, T091, T092 can run in parallel (different concerns)

**Phase 15 (Testing)**: T093, T094, T095, T096 can run in parallel (different test files)

---

## Implementation Strategy

### MVP-First Approach

**Recommended MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1) + Phase 4 (US2)

**Why**: This provides core read-only functionality (browse memos and tasks) which is the foundation of the GTD workflow. Users can verify API integration works before building write operations.

**MVP Delivery Timeline**: ~2-3 days for experienced developer

### Incremental Delivery

After MVP (US1 + US2), deliver in priority order:
1. **US3 + US4** (P2): Create/Edit operations - enables full CRUD
2. **US5 + US6** (P3): Labels + Links - adds organization features
3. **US7-US11** (P4-P5): Comments, Promotion, Bookmark, Status, Delete - polish features

Each user story can be delivered independently and tested in isolation.

---

## Summary

**Total Tasks**: 97
- **Setup**: 15 tasks (T001-T015)
- **Foundational**: 10 tasks (T016-T025)
- **User Story 1 (P1)**: 6 tasks (T026-T031) 🎯 MVP
- **User Story 2 (P1)**: 6 tasks (T032-T037) 🎯 MVP
- **User Story 3 (P2)**: 6 tasks (T038-T043)
- **User Story 4 (P2)**: 6 tasks (T044-T049)
- **User Story 5 (P3)**: 7 tasks (T050-T056)
- **User Story 6 (P3)**: 6 tasks (T057-T062)
- **User Story 7 (P4)**: 8 tasks (T063-T070)
- **User Story 8 (P4)**: 3 tasks (T071-T073)
- **User Story 9 (P4)**: 4 tasks (T074-T077)
- **User Story 10 (P4)**: 3 tasks (T078-T080)
- **User Story 11 (P5)**: 2 tasks (T081-T082)
- **Polish**: 10 tasks (T083-T092)
- **E2E Testing**: 5 tasks (T093-T097) [Optional]

**Parallel Opportunities**: 40+ tasks can run in parallel within their phases

**Independent Test Criteria per Story**:
- US1: Navigate to /memos, verify list + detail views
- US2: Navigate to /tasks, verify list + filters + detail views
- US3: Create and edit a memo, verify persistence
- US4: Create and edit a task, verify persistence
- US5: Assign label to memo/task, create new label, delete label
- US6: Create link between issues, verify display, delete link
- US7: Post comment, edit comment, delete comment
- US8: Promote memo to task, verify new task exists
- US9: Bookmark memo/task, verify filter works
- US10: Close/cancel/reopen task, verify status changes
- US11: Delete memo/task, verify removed from list

**Suggested MVP**: User Story 1 + User Story 2 (12 tasks after setup/foundation)
