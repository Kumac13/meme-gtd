---
description: "Task list for Tasks Page URL State Synchronization feature"
---

# Tasks: Tasks Page URL State Synchronization

**Input**: Design documents from `/specs/021-tasks-status-url/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included - feature spec requires test-first development with unit and E2E tests

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web package**: `packages/web/src/`, `packages/web/tests/`
- All paths shown below use the monorepo structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create utility files and helper functions needed by all user stories

- [x] T001 [P] Create URL filter helper utilities file at `packages/web/src/utils/urlFilterHelpers.ts`
  - Define `VALID_STATUSES` constant array
  - Define `StatusFilter` and `BookmarkFilter` TypeScript types
  - Implement `validateStatus(value: string | null): StatusFilter` function
  - Implement `validateBookmarked(value: string | null): boolean` function
  - Implement `updateStatusParam(params: URLSearchParams, status: StatusFilter): URLSearchParams` function
  - Implement `updateBookmarkedParam(params: URLSearchParams, bookmarked: boolean): URLSearchParams` function
  - Export all types and functions
  - Reference: `contracts/url-params.types.ts` for implementation details

**Checkpoint**: Helper utilities ready for use in all user stories

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 [P] Write unit tests for `validateStatus` function in `packages/web/tests/unit/urlFilterHelpers.test.ts`
  - Test: null input returns 'all'
  - Test: valid status values ('open', 'done', etc.) return unchanged
  - Test: invalid status returns 'all' (fallback behavior)
  - Test: empty string returns 'all'
  - Reference: data-model.md test cases table

- [x] T003 [P] Write unit tests for `validateBookmarked` function in `packages/web/tests/unit/urlFilterHelpers.test.ts`
  - Test: 'true' returns true
  - Test: 'false' returns false
  - Test: null returns false
  - Test: other values ('yes', '1') return false

- [x] T004 [P] Write unit tests for `updateStatusParam` function in `packages/web/tests/unit/urlFilterHelpers.test.ts`
  - Test: setting status to 'all' removes parameter
  - Test: setting valid status adds/updates parameter
  - Test: preserves other parameters (e.g., bookmarked)
  - Test: handles empty URLSearchParams

- [x] T005 [P] Write unit tests for `updateBookmarkedParam` function in `packages/web/tests/unit/urlFilterHelpers.test.ts`
  - Test: setting to true adds parameter
  - Test: setting to false removes parameter
  - Test: preserves other parameters (e.g., status)

**Checkpoint**: Foundation ready - all utility functions have passing tests, user story implementation can now begin

---

## Phase 3: User Story 1 - Persistent Filter State via URL (Priority: P1) 🎯 MVP

**Goal**: Enable URL synchronization for status and bookmark filters, allowing users to bookmark, share, and navigate filtered views using browser history

**Independent Test**: Apply any status filter on `/tasks/`, verify URL updates, refresh page and verify filter persists, use browser back button and verify filter changes

### Tests for User Story 1

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [US1] Write E2E test for status filter URL update in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to /tasks/
  - Click "Open" status filter button
  - Assert URL contains `?status=open`
  - Assert Open tasks are displayed

- [ ] T007 [US1] Write E2E test for filter persistence across page refresh in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to /tasks/
  - Apply "Done" filter
  - Verify URL contains `?status=done`
  - Refresh page
  - Assert URL still contains `?status=done`
  - Assert filter UI shows "Done" as active

- [ ] T008 [US1] Write E2E test for browser back button navigation in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to /tasks/
  - Apply "Open" filter → verify URL
  - Apply "Done" filter → verify URL
  - Click browser back button
  - Assert URL returns to `?status=open`
  - Assert UI shows "Open" filter active

- [ ] T009 [US1] Write E2E test for direct URL navigation in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate directly to `/tasks/?status=next`
  - Assert page loads with "Next" filter applied
  - Assert UI shows "Next" as active filter

- [ ] T010 [US1] Write E2E test for "All" filter clearing URL parameters in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to `/tasks/?status=done`
  - Click "All" filter button
  - Assert URL changes to `/tasks/` (no parameters)

### Implementation for User Story 1

- [ ] T011 [US1] Modify TasksList component to use useSearchParams in `packages/web/src/pages/TasksList.tsx`
  - Import `useSearchParams` from 'react-router-dom'
  - Import `validateStatus`, `validateBookmarked`, `updateStatusParam`, `updateBookmarkedParam` from '../utils/urlFilterHelpers'
  - Replace `const [statusFilter, setStatusFilter] = useState<string>('all')` (L36) with:
    ```typescript
    const [searchParams, setSearchParams] = useSearchParams();
    const statusFilter = validateStatus(searchParams.get('status'));
    ```
  - Replace `const [bookmarkFilter, setBookmarkFilter] = useState(false)` (L37) with:
    ```typescript
    const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));
    ```

- [ ] T012 [US1] Implement status filter change handler in `packages/web/src/pages/TasksList.tsx`
  - Create `handleStatusFilterChange` function that:
    - Calls `updateStatusParam(searchParams, newStatus)`
    - Calls `setSearchParams(updatedParams)`
  - Update FilterBar onStatusFilterChange prop to use new handler (L94)

- [ ] T013 [US1] Implement bookmark filter change handler in `packages/web/src/pages/TasksList.tsx`
  - Create `handleBookmarkFilterChange` function that:
    - Calls `updateBookmarkedParam(searchParams, newBookmarked)`
    - Calls `setSearchParams(updatedParams)`
  - Update FilterBar onBookmarkFilterChange prop to use new handler (L95)

- [ ] T014 [US1] Run E2E tests to verify User Story 1 is complete
  - Execute: `pnpm --filter meme-gtd-web test:e2e`
  - Verify all T006-T010 tests pass
  - Fix any failures before proceeding

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can:
- Apply filters and see URL update
- Refresh page with filters preserved
- Use browser back/forward buttons
- Share/bookmark filtered URLs

---

## Phase 4: User Story 2 - Bookmark Filter State Persistence (Priority: P2)

**Goal**: Enable users to bookmark specific filtered views (e.g., Open + Bookmarked tasks) for quick access

**Independent Test**: Apply both status and bookmark filters, bookmark the URL, close browser, reopen bookmark and verify both filters are restored exactly

### Tests for User Story 2

- [ ] T015 [US2] Write E2E test for combined filters in URL in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to /tasks/
  - Apply "Open" status filter
  - Enable bookmark filter
  - Assert URL contains `?status=open&bookmarked=true`
  - Assert both filters are active in UI

- [ ] T016 [US2] Write E2E test for bookmark filter URL persistence in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to /tasks/
  - Enable bookmark filter only
  - Assert URL contains `?bookmarked=true`
  - Refresh page
  - Assert bookmark filter still active

- [ ] T017 [US2] Write E2E test for disabling bookmark filter clears parameter in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to `/tasks/?status=open&bookmarked=true`
  - Disable bookmark filter
  - Assert URL changes to `/tasks/?status=open` (bookmarked removed)
  - Assert status filter still active

### Implementation for User Story 2

**NOTE**: Implementation is already complete from User Story 1 (bookmark filter handlers were added in T013). This phase focuses on testing the combined filter behavior.

- [ ] T018 [US2] Run E2E tests to verify User Story 2 is complete
  - Execute: `pnpm --filter meme-gtd-web test:e2e`
  - Verify all T015-T017 tests pass
  - Verify bookmark filter works independently and in combination with status filter

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Users can:
- Bookmark any combination of filters
- Multiple bookmarked views work correctly
- Switching between bookmarks restores exact filter state

---

## Phase 5: User Story 3 - Shareable Filtered Views (Priority: P3)

**Goal**: Enable users to share filtered task list URLs with colleagues, with recipients seeing the same view

**Independent Test**: Generate a filtered view URL, send to another user (or open in incognito mode), verify recipient sees identical filtered view

### Tests for User Story 3

- [ ] T019 [US3] Write E2E test for shareable URL with status filter in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate directly to `/tasks/?status=done` in incognito/new context
  - Assert page loads with "Done" filter applied
  - Assert correct tasks are displayed
  - Verify no prior session state is required

- [ ] T020 [US3] Write E2E test for shareable URL with combined filters in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate directly to `/tasks/?status=open&bookmarked=true` in new context
  - Assert both filters are applied correctly
  - Assert correct subset of tasks is displayed

- [ ] T021 [US3] Write E2E test for invalid URL parameters in shared links in `packages/web/tests/e2e/tasks-filters.spec.ts`
  - Navigate to `/tasks/?status=invalid`
  - Assert page defaults to "All" filter gracefully
  - Assert no error messages displayed
  - Navigate to `/tasks/?status=open&bookmarked=yes`
  - Assert status filter works, bookmark filter defaults to false

### Implementation for User Story 3

**NOTE**: Implementation is already complete from User Story 1. This phase validates sharing behavior with fresh browser contexts.

- [ ] T022 [US3] Run E2E tests in incognito/isolated contexts to verify User Story 3
  - Execute: `pnpm --filter meme-gtd-web test:e2e`
  - Verify all T019-T021 tests pass
  - Verify shared URLs work without session dependencies

**Checkpoint**: All user stories should now be independently functional. Users can:
- Share filtered views via URL
- Recipients see exact same view without login/session
- Invalid parameters handled gracefully

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T023 [P] Verify unit test coverage for URL helpers
  - Execute: `pnpm --filter meme-gtd-web test`
  - Assert all unit tests pass (T002-T005)
  - Verify 100% coverage of urlFilterHelpers.ts functions

- [ ] T024 [P] Run full E2E test suite
  - Execute: `pnpm --filter meme-gtd-web test:e2e`
  - Verify all E2E tests pass (T006-T022)
  - Document any browser-specific issues

- [ ] T025 Manual testing against test environment
  - Start test API: `pnpm server:dev` (port 3001)
  - Start web dev: `pnpm dev:web`
  - Navigate to http://localhost:3001/tasks/
  - Complete manual testing checklist from quickstart.md:
    - Basic functionality (filter clicks update URL)
    - Browser navigation (back/forward)
    - URL sharing (copy/paste in new tab)
    - Edge cases (invalid params)

- [ ] T026 Performance validation for SC-005
  - Measure URL update latency in browser DevTools
  - Apply filter and measure time to URL change
  - Assert <100ms (requirement from SC-005)
  - Expected: <10ms based on research.md

- [ ] T027 [P] TypeScript build validation
  - Execute: `pnpm build:web`
  - Assert no TypeScript errors
  - Assert build succeeds

- [ ] T028 Code cleanup and documentation
  - Add JSDoc comments to urlFilterHelpers.ts functions (if not already present)
  - Remove any unused imports from TasksList.tsx
  - Verify code follows project style guide

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion (T001) - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion (T002-T005)
  - User Story 1: Can start after T005
  - User Story 2: Can start after T005 (runs in parallel with US1, but tests depend on T011-T013)
  - User Story 3: Can start after T005 (runs in parallel with US1/US2, but tests depend on T011-T013)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on T001-T005 - No dependencies on other stories
- **User Story 2 (P2)**: Depends on T011-T013 (US1 implementation) - Tests combined filter behavior
- **User Story 3 (P3)**: Depends on T011-T013 (US1 implementation) - Tests sharing with fresh context

### Within Each User Story

- Tests MUST be written FIRST and FAIL before implementation (TDD approach)
- US1: T006-T010 (tests) → T011 (useSearchParams) → T012 (status handler) → T013 (bookmark handler) → T014 (validation)
- US2: T015-T017 (tests) → T018 (validation, no new implementation needed)
- US3: T019-T021 (tests) → T022 (validation, no new implementation needed)

### Parallel Opportunities

- **Phase 1**: T001 runs alone (single file creation)
- **Phase 2**: T002, T003, T004, T005 can run in parallel (different test cases in same file, but independent)
- **User Story 1 Tests**: T006, T007, T008, T009, T010 can run in parallel (different E2E test cases)
- **User Story 1 Implementation**: T011, T012, T013 are sequential (same file, TasksList.tsx)
- **User Story 2 Tests**: T015, T016, T017 can run in parallel (different E2E test cases)
- **User Story 3 Tests**: T019, T020, T021 can run in parallel (different E2E test cases)
- **Phase 6**: T023, T024, T027, T028 can run in parallel (different validation tasks)

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all E2E tests for User Story 1 together (after T001-T005 complete):
Task: "Write E2E test for status filter URL update" (T006)
Task: "Write E2E test for filter persistence across page refresh" (T007)
Task: "Write E2E test for browser back button navigation" (T008)
Task: "Write E2E test for direct URL navigation" (T009)
Task: "Write E2E test for All filter clearing URL parameters" (T010)

# Then run implementation tasks sequentially (same file):
Task: "Modify TasksList to use useSearchParams" (T011)
Task: "Implement status filter change handler" (T012)
Task: "Implement bookmark filter change handler" (T013)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T006-T014)
4. **STOP and VALIDATE**:
   - Run `pnpm --filter meme-gtd-web test`
   - Run `pnpm --filter meme-gtd-web test:e2e`
   - Manual test against http://localhost:3001/tasks/
5. Deploy/demo if ready (User Story 1 provides core value)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T005)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - URL sync, bookmarking, navigation)
3. Add User Story 2 → Test independently → Deploy/Demo (Enhanced bookmark persistence)
4. Add User Story 3 → Test independently → Deploy/Demo (Sharing validation)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T005)
2. Once Foundational is done:
   - Developer A: User Story 1 tests + implementation (T006-T014)
   - Developer B: User Story 2 tests (T015-T017, blocked until T013 completes)
   - Developer C: User Story 3 tests (T019-T021, blocked until T013 completes)
3. Stories complete and integrate independently

**Realistic Approach**: Given the sequential nature of TasksList.tsx modifications, complete US1 first, then US2 and US3 tests can run in parallel.

---

## Task Summary

- **Total Tasks**: 28
- **Setup Phase**: 1 task
- **Foundational Phase**: 4 tasks (blocking)
- **User Story 1**: 9 tasks (5 tests + 4 implementation)
- **User Story 2**: 4 tasks (3 tests + 1 validation)
- **User Story 3**: 4 tasks (3 tests + 1 validation)
- **Polish Phase**: 6 tasks
- **Parallel Opportunities**: 15+ tasks marked [P] or can run in parallel per phase
- **Estimated Total Time**: 2-3 hours (per quickstart.md estimate)

---

## Notes

- [P] tasks = different files or independent test cases
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- **TDD Approach**: All tests MUST fail before implementation begins
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Test Environment**: Always use `pnpm server:dev` (port 3001) and http://localhost:3001 for testing
- **Never use production**: Avoid `mgtd` direct commands, port 3000, or production DB
