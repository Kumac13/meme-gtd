# Tasks: Item Detail Back Navigation with Filter Preservation

**Feature**: 022-github
**Input**: Design documents from `/specs/022-github/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: This feature does NOT explicitly request tests, so test tasks are excluded per template guidelines.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app monorepo**: `packages/web/src/`, `packages/web/tests/`
- All paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and utility functions

- [ ] T001 [P] Create `packages/web/src/utils/navigationHelpers.ts` with utility structure (empty functions)
- [ ] T002 [P] Create `packages/web/tests/unit/navigationHelpers.test.ts` test file structure
- [ ] T003 Review existing `packages/web/src/utils/urlFilterHelpers.ts` from PR #65 for integration patterns

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core utility functions that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement `encodeReturnFilters()` function in `packages/web/src/utils/navigationHelpers.ts`
  - Input: `URLSearchParams` (current filters from list page)
  - Output: URL-encoded string for `returnFilters` parameter
  - Validation: Whitelist parameter names (status, bookmarked only)
  - Error handling: Log invalid parameters, continue with valid ones

- [ ] T005 [P] Implement `decodeReturnFilters()` function in `packages/web/src/utils/navigationHelpers.ts`
  - Input: Encoded `returnFilters` string from URL, `itemType`
  - Output: `DecodedReturnFilters` object (success, filters, error)
  - Validation: Item-type-specific parameter whitelist
  - Error handling: Graceful fallback to empty filters, security logging

- [ ] T006 [P] Implement `createItemDetailUrl()` helper in `packages/web/src/utils/navigationHelpers.ts`
  - Input: `basePath`, `itemId`, `currentFilters` (optional)
  - Output: Complete detail URL with `returnFilters` parameter
  - Usage: Called by list components to generate detail links

- [ ] T007 [P] Implement `createBackUrl()` helper in `packages/web/src/utils/navigationHelpers.ts`
  - Input: `basePath`, `returnFiltersEncoded` (optional)
  - Output: Complete list URL with restored filters
  - Usage: Called by detail components for back navigation

- [ ] T008 Write unit tests for `encodeReturnFilters()` in `packages/web/tests/unit/navigationHelpers.test.ts`
  - Test cases: Valid filters, invalid parameter names, empty filters, XSS attempts
  - Verify: Whitelist validation, URL encoding correctness

- [ ] T009 [P] Write unit tests for `decodeReturnFilters()` in `packages/web/tests/unit/navigationHelpers.test.ts`
  - Test cases: Valid encoded filters, corrupted strings, item-type-specific validation
  - Verify: Error handling, security logging, graceful degradation

- [ ] T010 [P] Write unit tests for `createItemDetailUrl()` and `createBackUrl()` in `packages/web/tests/unit/navigationHelpers.test.ts`
  - Test cases: With/without filters, different item types, edge cases
  - Verify: Correct URL construction, parameter encoding

- [ ] T011 Run all unit tests to verify foundational utilities work correctly
  - Command: `pnpm --filter meme-gtd-web test navigationHelpers.test.ts`
  - Expected: All tests pass, no errors

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Preserve Filter State on Back Navigation (Priority: P1) 🎯 MVP

**Goal**: Users can navigate from filtered lists to item details and back, with filters preserved

**Independent Test**: Filter tasks by status "Open" → click a task → click "Back to tasks" → verify filter preserved

### Implementation for User Story 1

- [ ] T012 [P] [US1] Update `packages/web/src/components/ItemList.tsx` to accept `currentFilters` prop
  - Add prop: `currentFilters?: URLSearchParams`
  - Update link generation to use `createItemDetailUrl()` helper
  - Pass `currentFilters` when creating detail URLs
  - Preserve existing functionality (no breaking changes)

- [ ] T013 [P] [US1] Update `packages/web/src/components/ItemDetail.tsx` to accept `returnFilters` prop
  - Add prop: `returnFilters?: string | null`
  - Update "Back to [items]" link to use `createBackUrl()` helper
  - Decode `returnFilters` and restore in back URL
  - Handle missing `returnFilters` (direct access case)

- [ ] T014 [US1] Update `packages/web/src/pages/TasksList.tsx` to pass filters to ItemList
  - Extract `searchParams` using existing `useSearchParams` hook (PR #65 pattern)
  - Pass `searchParams` as `currentFilters` prop to ItemList component
  - No other changes needed (existing filter logic unchanged)

- [ ] T015 [US1] Update `packages/web/src/pages/TaskDetail.tsx` to extract and pass returnFilters
  - Extract `returnFilters` parameter from URL using `useSearchParams`
  - Pass `returnFilters` string to ItemDetail component
  - Verify `/tasks/` base path passed correctly

- [ ] T016 [P] [US1] Update `packages/web/src/pages/MemosList.tsx` to pass filters to ItemList
  - Extract `searchParams` using `useSearchParams` hook
  - Pass `searchParams` as `currentFilters` prop to ItemList
  - Same pattern as TasksList (consistency)

- [ ] T017 [P] [US1] Update `packages/web/src/pages/MemoDetail.tsx` to extract and pass returnFilters
  - Extract `returnFilters` from URL using `useSearchParams`
  - Pass `returnFilters` to ItemDetail component
  - Verify `/memos/` base path passed correctly

- [ ] T018 [P] [US1] Update `packages/web/src/pages/ProjectsList.tsx` to pass filters to ItemList
  - Extract `searchParams` using `useSearchParams` hook
  - Pass `searchParams` as `currentFilters` prop to ItemList
  - Same pattern as TasksList/MemosList

- [ ] T019 [P] [US1] Update `packages/web/src/pages/ProjectDetail.tsx` to extract and pass returnFilters
  - Extract `returnFilters` from URL using `useSearchParams`
  - Pass `returnFilters` to ItemDetail component
  - Verify `/projects/` base path passed correctly

- [ ] T020 [US1] Manual testing: Tasks filter preservation
  - Start test environment: `pnpm server:dev` (port 3001)
  - Test: `/tasks/?status=open` → click task → back → verify filter preserved
  - Test: `/tasks/?status=next&bookmarked=true` → click task → back → verify both filters preserved
  - Test: Direct access `/tasks/123` → back → verify default list (no filters)
  - Document: Any issues found

- [ ] T021 [P] [US1] Manual testing: Memos filter preservation
  - Test: `/memos/?bookmarked=true` → click memo → back → verify filter preserved
  - Test: Direct access `/memos/456` → back → verify default list
  - Verify: Same behavior as tasks (consistency)

- [ ] T022 [P] [US1] Manual testing: Projects filter preservation
  - Test: `/projects/?bookmarked=true` → click project → back → verify filter preserved
  - Test: Direct access `/projects/789` → back → verify default list
  - Verify: Same behavior as tasks/memos

- [ ] T023 [US1] Performance measurement for navigation
  - Use browser Performance API to measure navigation time
  - Test: Multiple navigations (list → detail → back) for each item type
  - Verify: All navigations complete in < 500ms (SC-005)
  - Document: Actual measured times

**Checkpoint**: User Story 1 complete - All item types support filter preservation

---

## Phase 4: User Story 2 - Handle Direct Item Detail Access (Priority: P2)

**Goal**: Users accessing detail pages directly see correct fallback behavior (no errors)

**Independent Test**: Directly enter `/tasks/123` in browser → click back → verify navigation to `/tasks/` (default)

### Implementation for User Story 2

- [ ] T024 [US2] Verify direct access handling in `packages/web/src/components/ItemDetail.tsx`
  - Review `createBackUrl()` usage: Should handle `null` returnFilters
  - Test: Component renders correctly without returnFilters prop
  - Test: Back link generates correct default URL (e.g., `/tasks/`)
  - No code changes expected (already handled by US1 implementation)

- [ ] T025 [US2] Manual testing: Direct access without filters
  - Test: Directly enter `/tasks/123` → click back → verify `/tasks/`
  - Test: Directly enter `/memos/456` → click back → verify `/memos/`
  - Test: Directly enter `/projects/789` → click back → verify `/projects/`
  - Verify: No console errors, smooth navigation

- [ ] T026 [US2] Manual testing: Browser back button behavior
  - Test: `/tasks/?status=open` → click task → use browser back button → verify filter preserved
  - Test: Direct `/tasks/123` → use browser back button → verify default list or previous page
  - Verify: Browser history works correctly with filter preservation

**Checkpoint**: User Story 2 complete - Direct access handled gracefully

---

## Phase 5: User Story 3 - Shareable Item Links with Return Context (Priority: P3)

**Goal**: Users can share detail URLs with returnFilters, and recipients see the same filtered view

**Independent Test**: Copy URL `/tasks/123?returnFilters=status%3Dopen` → share → recipient clicks back → sees filtered list

### Implementation for User Story 3

- [ ] T027 [US3] Test URL shareability manually
  - Copy detail URL with returnFilters: `/tasks/123?returnFilters=status%3Dopen`
  - Open in incognito/different browser
  - Click "Back to tasks"
  - Verify: Navigates to `/tasks/?status=open` (filter restored)

- [ ] T028 [P] [US3] Test URL shareability for memos
  - Copy detail URL: `/memos/456?returnFilters=bookmarked%3Dtrue`
  - Open in different session
  - Click back
  - Verify: Navigates to `/memos/?bookmarked=true`

- [ ] T029 [P] [US3] Test URL shareability for projects
  - Copy detail URL: `/projects/789?returnFilters=bookmarked%3Dtrue`
  - Open in different session
  - Click back
  - Verify: Navigates to `/projects/?bookmarked=true`

- [ ] T030 [US3] Test bookmark functionality
  - Bookmark detail URL with returnFilters
  - Close browser
  - Reopen bookmark
  - Verify: Back navigation still works with preserved filters

**Checkpoint**: User Story 3 complete - URLs are shareable with preserved context

---

## Phase 6: Edge Cases & Security Validation

**Purpose**: Test error handling, security, and edge cases across all user stories

- [ ] T031 [P] Test invalid returnFilters parameter handling
  - Manually craft invalid URL: `/tasks/123?returnFilters=invalid%20data`
  - Click back
  - Verify: Navigation to default list (no error)
  - Verify: Console shows error log (FR-009 compliance)

- [ ] T032 [P] Test XSS attempt in returnFilters
  - Craft malicious URL: `/tasks/123?returnFilters=status%3D%3Cscript%3Ealert(1)%3C%2Fscript%3E`
  - Click back
  - Verify: Script not executed
  - Verify: Navigation to default list, console shows validation failure

- [ ] T033 [P] Test cross-item-type filter leak
  - Simulate: Memo detail with task status filter `/memos/456?returnFilters=status%3Dopen`
  - Click back
  - Verify: Status filter removed (memos don't support it)
  - Verify: Navigation to `/memos/` (default)

- [ ] T034 Test URL length with maximum filters
  - Create URL: `/tasks/123?returnFilters=status%3Dscheduled%26bookmarked%3Dtrue`
  - Verify: URL length < 500 characters (SC-004)
  - Test: Back navigation works correctly

- [ ] T035 Verify error logging for troubleshooting (FR-009)
  - Review browser console during edge case tests
  - Verify: All validation failures logged with details
  - Verify: Log format includes: itemType, encoded value, error message, timestamp

**Checkpoint**: Edge cases handled, security validated

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple user stories

- [ ] T036 [P] Add TypeScript type safety checks
  - Review all component prop types for `currentFilters` and `returnFilters`
  - Ensure type imports from `contracts/return-filters.types.ts`
  - Run TypeScript build: `pnpm --filter meme-gtd-web build`
  - Fix any type errors

- [ ] T037 [P] Code review for consistency
  - Review: All 6 page components (TasksList/Detail, MemosList/Detail, ProjectsList/Detail)
  - Verify: Consistent patterns across item types
  - Verify: No code duplication (shared helpers used correctly)

- [ ] T038 Performance optimization review
  - Profile navigation with React DevTools
  - Verify: No unnecessary re-renders
  - Verify: URL parameter parsing < 1ms (research.md baseline)
  - Optimize if any issues found

- [ ] T039 Documentation updates
  - Update `packages/web/src/utils/navigationHelpers.ts` with JSDoc comments
  - Document function parameters, return values, examples
  - Add usage examples in comments

- [ ] T040 Verify PR #65 regression
  - Run existing filter tests: `pnpm --filter meme-gtd-web test urlFilterHelpers.test.ts`
  - Verify: All PR #65 tests still pass (SC-007 compliance)
  - Fix any regressions immediately

- [ ] T041 Run full test suite
  - Command: `pnpm --filter meme-gtd-web test`
  - Verify: All tests pass
  - Review code coverage if available

- [ ] T042 Final manual testing across all scenarios
  - Re-run quickstart.md test scenarios
  - Test all 3 user stories independently
  - Test edge cases
  - Document: Feature is production-ready

**Checkpoint**: Feature complete and production-ready

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User Story 1 (P1): Can start after Foundational
  - User Story 2 (P2): Can start after Foundational (validates US1 implementation)
  - User Story 3 (P3): Can start after Foundational (validates US1 + US2)
- **Edge Cases (Phase 6)**: Depends on User Stories 1-3 completion
- **Polish (Phase 7)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories - Core filter preservation
- **User Story 2 (P2)**: No dependencies on US1 (validates fallback behavior independently)
- **User Story 3 (P3)**: No dependencies on US1/US2 (validates shareability independently)

All user stories are independently testable and can be validated separately.

### Within Each User Story

- Foundation utilities (T004-T011) MUST complete first
- Component updates can run in parallel (marked [P])
- Manual testing happens after all component updates
- Each story checkpoint validates independent functionality

### Parallel Opportunities

- **Phase 1 (Setup)**: All 3 tasks can run in parallel
- **Phase 2 (Foundational)**:
  - T004-T007 (implementation) can run in parallel
  - T008-T010 (tests) can run in parallel after implementation
- **Phase 3 (US1)**:
  - T012-T013 (ItemList + ItemDetail) can run in parallel
  - T014-T019 (6 page components) can run in parallel after T012-T013
  - T020-T022 (3 manual tests) can run in parallel
- **Phase 4 (US2)**: T025-T026 can run in parallel
- **Phase 5 (US3)**: T027-T029 can run in parallel
- **Phase 6 (Edge Cases)**: T031-T034 can run in parallel
- **Phase 7 (Polish)**: T036-T037 can run in parallel

---

## Parallel Example: User Story 1 (Core Implementation)

```bash
# After Foundational phase completes, launch these in parallel:

# Component updates (different files):
Task T012: "Update ItemList.tsx to accept currentFilters prop"
Task T013: "Update ItemDetail.tsx to accept returnFilters prop"

# Then launch all page components in parallel:
Task T014: "Update TasksList.tsx"
Task T015: "Update TaskDetail.tsx"
Task T016: "Update MemosList.tsx"
Task T017: "Update MemoDetail.tsx"
Task T018: "Update ProjectsList.tsx"
Task T019: "Update ProjectDetail.tsx"

# Then launch all manual tests in parallel:
Task T020: "Manual testing: Tasks"
Task T021: "Manual testing: Memos"
Task T022: "Manual testing: Projects"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T011) - CRITICAL
3. Complete Phase 3: User Story 1 (T012-T023)
4. **STOP and VALIDATE**: Test filter preservation independently
5. Deploy/demo if ready

**Result**: Core filter preservation working for all 3 item types

### Incremental Delivery

1. **Foundation** (Phase 1-2) → Utilities ready
2. **MVP** (Phase 3) → Filter preservation working → Deploy!
3. **Robustness** (Phase 4) → Direct access handled → Deploy!
4. **Shareability** (Phase 5) → URLs shareable → Deploy!
5. **Production-Ready** (Phase 6-7) → Edge cases + polish → Final deploy!

Each phase adds value without breaking previous phases.

### Parallel Team Strategy

With multiple developers:

1. **Together**: Complete Setup + Foundational (Phase 1-2)
2. **Once Foundational done**:
   - Developer A: User Story 1 components (T012-T019)
   - Developer B: Edge case validation (can start T031-T034)
   - Developer C: Documentation and polish preparation (T039)
3. **Testing together**: Manual testing (T020-T023, T025-T030)
4. **Final polish**: All developers on Phase 7

---

## Notes

- **[P] tasks**: Different files, can run in parallel
- **[Story] labels**: Map task to specific user story for traceability
- **Checkpoints**: Stop and validate after each user story
- **No test files**: Feature spec does not explicitly request tests, so following template guidance to exclude test tasks
- **PR #65 compatibility**: All changes extend existing patterns (SC-007 compliance)
- **Performance**: <500ms navigation target validated in T023 (SC-005)
- **Security**: XSS validation in T032, error logging in T035 (FR-005, FR-009)
- **URL length**: Validated in T034 (SC-004)

---

## Success Criteria Validation

Each task maps to specific success criteria:

- **SC-001** (100% filter preservation): T020-T022
- **SC-002** (No errors on direct access): T024-T026
- **SC-003** (Browser back/forward): T026
- **SC-004** (URL length < 500 chars): T034
- **SC-005** (< 500ms navigation): T023
- **SC-006** (Workflow efficiency): Validated by US1 completion

All 9 functional requirements (FR-001 to FR-009) covered across tasks.
