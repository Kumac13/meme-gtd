# Tasks: Projects Sidebar in Task/Memo Detail Pages

**Feature**: 017-https-github-com
**Input**: Design documents from `/specs/017-https-github-com/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api-reference.md, research.md, quickstart.md

**Tests**: ✅ Test tasks included (as per plan.md testing requirements)

**Organization**: Tasks are grouped by user story (US1-US5) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4, US5)
- File paths follow monorepo structure: `packages/web/src/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and shared TypeScript types

- [x] **T001** [P] Create TypeScript type definitions file `packages/web/src/types/project.ts`
  - Define: `Project`, `ProjectItem`, `ProjectViewMeta`, `ProjectStatus`, `ProjectWithMeta`
  - Define: `RecentProjectsStorage`, `ProjectListItem`
  - Export all interfaces and types

- [x] **T002** [P] Verify test environment setup
  - Confirm `pnpm server:dev` runs (port 3001)
  - Confirm test database exists at `test-data/test.db`
  - Create sample projects: `pnpm mgtd:test project create "Test Project 1"` and `"Test Project 2"`
  - Create sample task: `pnpm mgtd:test task create -t "Test Task" --no-editor`

**Checkpoint**: Types defined, test environment ready

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extend API service layer with methods needed by all user stories

**⚠️ CRITICAL**: No user story implementation can begin until this phase is complete

- [x] **T003** Extend ProjectsService with `getProjectsForIssue` method in `packages/web/src/api/services/ProjectsService.ts`
  - Add static method: `getProjectsForIssue(issueId: number): Promise<ProjectWithMeta[]>`
  - Implementation: Fetch all projects via `listProjects()`, then fetch each project detail via `getProject(id)` to extract items matching `issueId`
  - For matched items, construct `ProjectWithMeta` with status from `viewMeta` (default: "No status")
  - Return array of enriched projects

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Associated Projects (Priority: P1) 🎯 MVP

**Goal**: Display associated projects in a sidebar section on task/memo detail pages. This is the foundational capability - users must see projects before they can manage them.

**Independent Test**: Navigate to task/memo detail page → verify projects displayed in sidebar with icons, names, and status. If no projects, sidebar should not appear.

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] **T004** [P] [US1] Create unit test file `packages/web/tests/components/ProjectsSection.test.tsx`
  - Test: Component hides when no projects associated (empty array)
  - Test: Component displays projects with correct name, icon, status
  - Test: Component shows loading state while fetching
  - Test: Component shows error state on fetch failure
  - Mock ProjectsService.getProjectsForIssue()
  - Use React Testing Library + Vitest

### Implementation for User Story 1

- [x] **T005** [US1] Create ProjectsSection component in `packages/web/src/components/ProjectsSection.tsx`
  - Props: `{ itemId: number, itemType: 'memo' | 'task' }`
  - State: `projects`, `associatedProjects`, `loading`, `error`
  - useEffect: Fetch projects on mount via `ProjectsService.getProjectsForIssue(itemId)`
  - Render: Conditionally hide if `associatedProjects.length === 0`
  - Render: "Projects" header with gear icon (⚙️) placeholder (onClick does nothing yet)
  - Render: List of projects (name, icon placeholder, status text)
  - Styling: Follow LinkSection pattern (gray background, padding, rounded corners)

- [x] **T006** [US1] Integrate ProjectsSection into ItemDetail component in `packages/web/src/components/ItemDetail.tsx`
  - Import `ProjectsSection`
  - Add after `<LinkSection ... />` and before `<EditableContent ... />`
  - Pass props: `itemId={item.id}` and `itemType={itemType}`

**Checkpoint**: User Story 1 complete - Projects sidebar displays on detail pages ✅

**Validation**:
- Navigate to `/tasks/:id` → see Projects section with associated projects
- Navigate to `/tasks/:id` with no projects → Projects section hidden
- Verify SC-001: Projects load within 1 second

---

## Phase 4: User Story 2 & 3 - Add/Remove Projects (Priority: P2)

**Goal**: Allow users to add and remove project associations via a modal dialog. Modal stays open for multiple operations.

**Independent Test**: Click gear icon → modal opens → check/uncheck projects → verify sidebar updates. Modal remains open after each toggle.

### Tests for User Stories 2 & 3

- [ ] **T007** [P] [US2/US3] Create unit test file `packages/web/tests/components/SelectProjectsModal.test.tsx`
  - Test: Modal opens with correct projects list
  - Test: Checkboxes show correct checked state based on associations
  - Test: Checking checkbox calls onProjectToggle with (projectId, true)
  - Test: Unchecking checkbox calls onProjectToggle with (projectId, false)
  - Test: Modal closes on ESC key press
  - Test: Modal closes on backdrop click
  - Test: Modal stays open after checkbox toggle (does not auto-close)
  - Mock props: isOpen, onClose, onProjectToggle

- [ ] **T008** [P] [US2/US3] Create E2E test file `packages/web/tests/e2e/projects-sidebar.spec.ts`
  - Test: Full add flow (click gear → check project → verify appears in sidebar)
  - Test: Full remove flow (click gear → uncheck project → verify removed from sidebar)
  - Test: Multiple toggles without modal close
  - Test: First project added makes Projects section appear
  - Test: Last project removed makes Projects section disappear
  - Use Playwright

### Implementation for User Stories 2 & 3

- [x] **T009** [P] [US2/US3] Create SelectProjectsModal component in `packages/web/src/components/SelectProjectsModal.tsx`
  - Props: `{ isOpen: boolean, onClose: () => void, itemId: number, associatedProjectIds: Set<number>, allProjects: Project[], onProjectToggle: (projectId: number, isAssociated: boolean) => Promise<void> }`
  - Render using React Portal (`ReactDOM.createPortal`)
  - Modal structure: backdrop (click to close) + dialog content
  - Header: "Select projects" title
  - Body: Project list with checkboxes (for now, simple list - search and recent come in later phases)
  - Each project: checkbox (checked if in `associatedProjectIds`), icon placeholder, name
  - Checkbox onChange: call `onProjectToggle(project.id, !isAssociated)`
  - ARIA attributes: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
  - Keyboard: ESC key closes modal
  - Focus trap: Keep focus inside modal while open
  - Styling: TailwindCSS modal pattern (fixed overlay, centered dialog)

- [x] **T010** [US2/US3] Update ProjectsSection to integrate SelectProjectsModal in `packages/web/src/components/ProjectsSection.tsx`
  - Add state: `modalOpen: boolean`
  - Add gear icon onClick: `setModalOpen(true)`
  - Fetch all projects on mount: `ProjectsService.listProjects()` and store in state
  - Create `handleProjectToggle` function:
    - If `isAssociated === true`: Call `ProjectsService.addProjectItem(projectId, { issueId: itemId, viewMeta: { status: 'No status' } })`
    - If `isAssociated === false`: Call `ProjectsService.removeProjectItem(projectId, itemId)`
    - Optimistic update: Update `associatedProjects` immediately before API call
    - On error: Revert optimistic update, show error message (console.error for MVP)
    - On success (add): Refetch associated projects to get latest data
  - Render `<SelectProjectsModal>` with props:
    - `isOpen={modalOpen}`
    - `onClose={() => setModalOpen(false)}`
    - `itemId={itemId}`
    - `associatedProjectIds={new Set(associatedProjects.map(p => p.id))}`
    - `allProjects={projects}`
    - `onProjectToggle={handleProjectToggle}`

**Checkpoint**: User Stories 2 & 3 complete - Add/remove functionality works ✅

**Validation**:
- Click gear → modal opens with all projects
- Check project → immediately added (sidebar updates)
- Uncheck project → immediately removed (sidebar updates)
- Modal stays open during multiple toggles
- Verify SC-002: Add operation completes in <3 seconds
- Verify SC-005: Operations complete in <1 second with visual feedback

---

## Phase 5: User Story 4 - Search/Filter Projects (Priority: P3)

**Goal**: Enable search/filter in modal to find projects quickly from a long list (up to 50).

**Independent Test**: Open modal → type in search box → verify only matching projects shown. Clear search → all projects reappear. Filter applies to both Recent and Organization sections (once Recent is added).

### Tests for User Story 4

- [ ] **T011** [P] [US4] Add search filter tests to `packages/web/tests/components/SelectProjectsModal.test.tsx`
  - Test: Typing in search box filters projects (case-insensitive, substring match)
  - Test: Clearing search shows all projects again
  - Test: Checking a filtered project works correctly
  - Test: Search debounces input (300ms delay)

### Implementation for User Story 4

- [x] **T012** [US4] Add search functionality to SelectProjectsModal in `packages/web/src/components/SelectProjectsModal.tsx`
  - Add state: `searchQuery: string`
  - Add debounced search value using `useMemo` or custom debounce hook (300ms delay)
  - Add search input at top of modal: placeholder "Filter projects"
  - Filter `allProjects` by `project.name.toLowerCase().includes(debouncedSearch.toLowerCase())`
  - Render filtered list instead of full list
  - Keep checkbox onChange logic unchanged

**Checkpoint**: User Story 4 complete - Search/filter works ✅

**Validation**:
- Type "test" → only projects with "test" in name appear
- Clear search → all projects reappear
- Check filtered project → works correctly
- Verify SC-003: Find and add project using search in <5 seconds

---

## Phase 6: User Story 5 - Access Recent Projects (Priority: P3)

**Goal**: Show recently used projects (max 2) in a "Recent" section above the full "Organization" list for quick access.

**Independent Test**: Add task to Project A → open modal on different task → verify Project A appears in Recent section. Recent section respects search filter.

### Tests for User Story 5

- [ ] **T013** [P] [US5] Create unit test file `packages/web/tests/hooks/useRecentProjects.test.ts`
  - Test: Hook initializes from localStorage
  - Test: addRecentProject() updates localStorage
  - Test: getRecentProjects() returns top 2 most recent
  - Test: Handles localStorage errors gracefully (fallback)
  - Test: Limits stored projects to 5
  - Mock localStorage

- [ ] **T014** [P] [US5] Add recent projects tests to `packages/web/tests/components/SelectProjectsModal.test.tsx`
  - Test: Recent section displays top 2 projects
  - Test: Recent section respects search filter
  - Test: Recent section shows projects in correct order

### Implementation for User Story 5

- [x] **T015** [US5] Create useRecentProjects hook in `packages/web/src/hooks/useRecentProjects.ts`
  - Return: `{ recentProjectIds: number[], addRecentProject: (projectId: number) => void, getRecentProjects: (allProjects: Project[]) => Project[] }`
  - Storage key: `'mgtd:recentProjects'`
  - Storage format: `RecentProjectsStorage` type from types/project.ts
  - On mount: Read from localStorage, parse JSON, handle errors (return empty array on failure)
  - `addRecentProject`: Add projectId to list with current timestamp, keep last 5, save to localStorage
  - `getRecentProjects`: Filter allProjects to recentProjectIds, sort by lastUsedAt, return top 2
  - Wrap localStorage access in try-catch for Safari private mode compatibility

- [x] **T016** [US5] Update SelectProjectsModal to show Recent section in `packages/web/src/components/SelectProjectsModal.tsx`
  - Import and use `useRecentProjects` hook
  - When project is added (checkbox checked): call `addRecentProject(projectId)` from hook
  - When project is removed (checkbox unchecked): do NOT call addRecentProject (removal indicates de-prioritization)
  - Render two sections:
    - **Recent** section: Header "Recent", list of `getRecentProjects(filteredProjects).slice(0, 2)`
    - **Organization** section: Header "Organization", list of all `filteredProjects`
  - Both sections respect search filter
  - Both sections show checkboxes with same onChange logic

**Checkpoint**: User Story 5 complete - Recent projects feature works ✅

**Validation**:
- Add task to Project A → modal shows Project A in Recent on next open
- Recent section shows max 2 projects
- Recent section filtered by search query
- localStorage persists across page reloads

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements and validation

- [ ] **T017** [P] Add error toast/notification for API failures
  - Update ProjectsSection handleProjectToggle to show user-friendly error messages
  - Consider using a toast library or simple alert for MVP

- [ ] **T018** [P] Add loading indicators for project toggles
  - Show spinner or disable checkbox while API call in progress
  - Prevent duplicate clicks during operation

- [ ] **T019** [P] Add project icon support (if icons are available in backend)
  - Update rendering to show actual icons instead of placeholders
  - Default icon if project has none

- [ ] **T020** [P] Run E2E test suite
  - Execute: `pnpm --filter meme-gtd-web test:e2e`
  - Verify all user story scenarios pass

- [ ] **T021** [P] Run unit test suite
  - Execute: `pnpm --filter meme-gtd-web test`
  - Verify all component tests pass

- [ ] **T022** Performance validation
  - Test with 50 projects in modal
  - Verify modal open < 100ms (SC-004)
  - Verify search filter response < 50ms
  - Verify project list rendering < 200ms

- [ ] **T023** Accessibility audit
  - Verify modal has correct ARIA attributes
  - Test keyboard navigation (Tab, ESC)
  - Test focus trap in modal
  - Test screen reader compatibility

- [ ] **T024** Run quickstart.md validation
  - Follow quickstart.md success criteria checklist
  - Verify all SC-001 through SC-007 are met

- [ ] **T025** Code cleanup and formatting
  - Run `pnpm --filter meme-gtd-web format`
  - Remove console.log statements
  - Add JSDoc comments to public functions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Phase 2 completion
- **User Stories 2 & 3 (Phase 4)**: Depends on Phase 2 completion (can run parallel with US1 if needed, but US1 recommended first as foundation)
- **User Story 4 (Phase 5)**: Depends on Phase 4 completion (needs modal implementation)
- **User Story 5 (Phase 6)**: Depends on Phase 4 completion (needs modal implementation, can run parallel with US4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - only needs Foundational phase ✅ MVP
- **User Story 2 & 3 (P2)**: Depends on US1 (needs ProjectsSection to exist)
- **User Story 4 (P3)**: Depends on US2/US3 (needs SelectProjectsModal to exist)
- **User Story 5 (P3)**: Depends on US2/US3 (needs SelectProjectsModal to exist), can run parallel with US4

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types before components
- Service methods before components that use them
- Core component before integration
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **User Story 1 Tests**: T004 standalone (write before T005/T006)
- **User Story 2/3 Tests**: T007 and T008 can run in parallel (write before T009/T010)
- **User Story 4 & 5**: After Phase 4 complete, US4 (T011-T012) and US5 (T013-T016) can run in parallel by different developers
- **Polish Phase**: T017, T018, T019, T020, T021, T022, T023 can run in parallel

---

## Parallel Example: User Story 2 & 3

```bash
# After Phase 2 (Foundational) completes, launch tests in parallel:
Task: "Create SelectProjectsModal test file" [T007]
Task: "Create E2E test file for projects sidebar" [T008]

# Once both tests are written and failing, implement components:
Task: "Create SelectProjectsModal component" [T009]
Task: "Update ProjectsSection to integrate modal" [T010]
```

---

## Parallel Example: User Story 4 & 5

```bash
# After Phase 4 (US2/US3) completes, these can run in parallel:

# Developer A works on US4 (Search):
Task: "Add search filter tests" [T011]
Task: "Add search functionality to modal" [T012]

# Developer B works on US5 (Recent):
Task: "Create useRecentProjects test" [T013]
Task: "Add recent projects tests to modal test" [T014]
Task: "Create useRecentProjects hook" [T015]
Task: "Update modal to show Recent section" [T016]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T002)
2. Complete Phase 2: Foundational (T003) - CRITICAL
3. Complete Phase 3: User Story 1 (T004-T006)
4. **STOP and VALIDATE**: Test US1 independently
5. Deploy/demo if ready

**Result**: Users can see which projects their tasks/memos belong to. Read-only functionality.

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add User Story 1 → Test → Deploy/Demo (MVP - read-only)
3. Add User Stories 2 & 3 → Test → Deploy/Demo (full CRUD)
4. Add User Story 4 → Test → Deploy/Demo (with search)
5. Add User Story 5 → Test → Deploy/Demo (with recent projects)
6. Phase 7 Polish → Final release

### Parallel Team Strategy

With 2 developers:

1. Both complete Phase 1 + 2 together
2. Developer A: User Story 1 (Phase 3)
3. Developer A: User Stories 2 & 3 (Phase 4)
4. Once Phase 4 done:
   - Developer A: User Story 4 (Phase 5)
   - Developer B: User Story 5 (Phase 6)
5. Both: Phase 7 Polish

---

## Task Count Summary

- **Total Tasks**: 25
- **Setup**: 2 tasks
- **Foundational**: 1 task (blocking)
- **User Story 1 (P1)**: 3 tasks (1 test + 2 implementation)
- **User Stories 2 & 3 (P2)**: 4 tasks (2 tests + 2 implementation)
- **User Story 4 (P3)**: 2 tasks (1 test + 1 implementation)
- **User Story 5 (P3)**: 4 tasks (2 tests + 2 implementation)
- **Polish**: 9 tasks

**Parallel Opportunities**: 14 tasks marked [P] can run concurrently

**Independent Test Criteria**:
- US1: Navigate to detail page → see projects
- US2/US3: Click gear → toggle projects → verify sidebar updates
- US4: Search in modal → verify filtering
- US5: Add project → verify appears in Recent section

**Suggested MVP Scope**: Phase 1-3 (User Story 1 only) = 6 tasks, ~3-4 hours

---

## Notes

- [P] tasks = different files, can run in parallel
- [Story] label maps task to specific user story (US1-US5)
- Each user story is independently testable
- Tests must fail before implementation (TDD)
- Backend API already exists - zero backend tasks needed
- All file paths use `packages/web/` prefix (monorepo structure)
- Performance targets validated in Phase 7
- Accessibility requirements validated in Phase 7
