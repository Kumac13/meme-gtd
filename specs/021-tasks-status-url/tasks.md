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

### Implementation for User Story 1

- [x] T011 [US1] Modify TasksList component to use useSearchParams in `packages/web/src/pages/TasksList.tsx`
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

- [x] T012 [US1] Implement status filter change handler in `packages/web/src/pages/TasksList.tsx`
  - Create `handleStatusFilterChange` function that:
    - Calls `updateStatusParam(searchParams, newStatus)`
    - Calls `setSearchParams(updatedParams)`
  - Update FilterBar onStatusFilterChange prop to use new handler (L94)

- [x] T013 [US1] Implement bookmark filter change handler in `packages/web/src/pages/TasksList.tsx`
  - Create `handleBookmarkFilterChange` function that:
    - Calls `updateBookmarkedParam(searchParams, newBookmarked)`
    - Calls `setSearchParams(updatedParams)`
  - Update FilterBar onBookmarkFilterChange prop to use new handler (L95)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Users can:
- Apply filters and see URL update
- Refresh page with filters preserved
- Use browser back/forward buttons
- Share/bookmark filtered URLs

---

## Phase 4: User Story 2 - Bookmark Filter State Persistence (Priority: P2)

**Goal**: Enable users to bookmark specific filtered views (e.g., Open + Bookmarked tasks) for quick access

**Independent Test**: Apply both status and bookmark filters, bookmark the URL, close browser, reopen bookmark and verify both filters are restored exactly

### Implementation for User Story 2

**NOTE**: Implementation is already complete from User Story 1 (bookmark filter handlers were added in T013).

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Users can:
- Bookmark any combination of filters
- Multiple bookmarked views work correctly
- Switching between bookmarks restores exact filter state

---

## Phase 5: User Story 3 - Shareable Filtered Views (Priority: P3)

**Goal**: Enable users to share filtered task list URLs with colleagues, with recipients seeing the same view

**Independent Test**: Generate a filtered view URL, send to another user (or open in incognito mode), verify recipient sees identical filtered view

### Implementation for User Story 3

**NOTE**: Implementation is already complete from User Story 1.

**Checkpoint**: All user stories should now be independently functional. Users can:
- Share filtered views via URL
- Recipients see exact same view without login/session
- Invalid parameters handled gracefully

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [x] T014 [P] Verify unit test coverage for URL helpers
  - Execute: `pnpm --filter meme-gtd-web test`
  - Assert all unit tests pass (T002-T005)
  - Verify 100% coverage of urlFilterHelpers.ts functions
  - Result: 20/20 tests passing ✓

- [x] T015 [P] TypeScript build validation
  - Execute: `pnpm build:web`
  - Assert no TypeScript errors
  - Assert build succeeds
  - Result: Build successful ✓

- [x] T016 Code cleanup and documentation
  - Add JSDoc comments to urlFilterHelpers.ts functions (if not already present)
  - Remove any unused imports from TasksList.tsx
  - Verify code follows project style guide
  - Result: All JSDoc comments present, no unused imports ✓

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
- **User Story 2 (P2)**: Depends on T011-T013 (US1 implementation) - Implementation complete in US1
- **User Story 3 (P3)**: Depends on T011-T013 (US1 implementation) - Implementation complete in US1

### Within Each User Story

- US1: T011 (useSearchParams) → T012 (status handler) → T013 (bookmark handler)
- US2: No additional implementation needed
- US3: No additional implementation needed

### Parallel Opportunities

- **Phase 1**: T001 runs alone (single file creation)
- **Phase 2**: T002, T003, T004, T005 can run in parallel (different test cases in same file, but independent)
- **User Story 1 Implementation**: T011, T012, T013 are sequential (same file, TasksList.tsx)
- **Phase 6**: T014, T015, T016 can run in parallel (different validation tasks)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002-T005) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T011-T013)
4. **STOP and VALIDATE**:
   - Run `pnpm --filter meme-gtd-web test` (unit tests)
   - Run `pnpm build:web` (TypeScript validation)
   - Manual test against development server
5. Deploy if ready (User Story 1 provides core value)

### Validation Approach

**Automated Testing**:
- Unit tests for URL filter helpers (20 tests, all passing)
- TypeScript build validation (no errors)

**Manual Testing** (recommended):
1. Start development server: `pnpm dev:web`
2. Navigate to `/tasks/`
3. Test scenarios:
   - Click status filters → verify URL updates
   - Refresh page → verify filter persists
   - Use browser back/forward buttons
   - Manually enter filtered URLs
   - Test invalid URL parameters

---

## Task Summary

- **Total Tasks**: 16
- **Setup Phase**: 1 task
- **Foundational Phase**: 4 tasks (blocking)
- **User Story 1**: 3 tasks (implementation only)
- **User Story 2**: 0 tasks (implementation complete in US1)
- **User Story 3**: 0 tasks (implementation complete in US1)
- **Polish Phase**: 3 tasks
- **Parallel Opportunities**: All foundational tests (T002-T005) can run in parallel
- **Estimated Total Time**: 1-2 hours

---

## Notes

- [P] tasks = different files, no dependencies
- Implementation complete in T001-T013 (11 tasks)
- All 3 user stories implemented (US2 and US3 reuse US1 implementation)
- Validation via unit tests (20/20 passing) and TypeScript build
- Manual testing recommended for full verification
- Commit after each phase completion
