# Tasks: Fuzzy Search for Tasks and Memos

**Input**: Design documents from `/specs/025-a/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `packages/db/`, `packages/api/`, `packages/web/`
- Tests: Same package structure (e.g., `packages/db/test/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [ ] T001 Verify FTS5 infrastructure exists in SQLite schema (schema/001_init.sql lines 97-121)
- [ ] T002 [P] Verify existing FTS5 triggers are working (test with sample insert/update)
- [ ] T003 [P] Review research.md findings on FTS5 snippet() usage

**Note**: No new database schema changes needed - FTS5 already implemented.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core query parser extension that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [Shared] Extend ParsedSearchQuery interface in `packages/web/src/utils/queryParser.ts` to add `freeText?: string` field
- [ ] T005 [Shared] Implement free-text extraction logic in `parseSearchQuery()` function - remove all `key:value` patterns and capture remaining text as `freeText`
- [ ] T006 [Shared] Add unit tests for queryParser in `packages/web/src/utils/queryParser.test.ts` (NEW FILE):
  - Test: `"label:bug login"` → `{ labels: ["bug"], freeText: "login" }`
  - Test: `"status:open authentication screen"` → `{ status: "open", freeText: "authentication screen" }`
  - Test: `"login screen"` → `{ freeText: "login screen" }`
  - Test: Special characters in free-text (`"user@domain.com"`)

**Checkpoint**: Query parser can extract free-text terms - foundation ready

---

## Phase 3: User Story 1 - Search Tasks by Title (Priority: P1) 🎯 MVP

**Goal**: Users can search tasks by typing words from the title (case-insensitive, partial matching)

**Independent Test**: Create tasks with titles containing "login", search for "login", verify matching tasks appear with highlighted previews

### Implementation for User Story 1

#### Database Layer

- [ ] T007 [P] [US1] Add `search?: string` to `ListTaskFilters` interface in `packages/db/src/taskRepository.ts`
- [ ] T008 [US1] Modify `listTasks()` function in `packages/db/src/taskRepository.ts`:
  - Add FTS5 join when `filters.search` is present: `JOIN issues_fts f ON f.issue_id = i.id`
  - Add `snippet(issues_fts, 0, '<mark>', '</mark>', '...', 15) as preview` to SELECT clause
  - Add condition: `f.title MATCH @search`
  - Pass `params.search = filters.search`
- [ ] T009 [US1] Add tests in `packages/db/test/taskRepository.test.ts`:
  - Test: Single-word search returns correct results
  - Test: Multi-word search with implicit AND logic
  - Test: Case-insensitive search
  - Test: Preview field is present when search active
  - Test: Preview includes `<mark>` highlighting

#### API Layer

- [ ] T010 [P] [US1] Add `search: z.string().optional()` to `TaskQuerySchema` in `packages/api/src/schemas/taskSchemas.ts`
- [ ] T011 [US1] Update `listTasksHandler` in `packages/api/src/handlers/taskHandlers.ts` to extract `search` from request.query and pass to service
- [ ] T012 [US1] Add integration tests in `packages/api/test/integration/tasks.test.ts`:
  - Test: `GET /api/tasks?search=login` returns matching tasks
  - Test: Combined filters: `GET /api/tasks?status=open&search=authentication`
  - Test: Preview field present in response
  - Test: Empty search returns all tasks

#### Frontend Layer

- [ ] T013 [P] [US1] Update `TasksService.listTasks()` in `packages/web/src/api/services/TasksService.ts` to accept `search?: string` parameter and append to query params
- [ ] T014 [US1] Modify `TasksList.tsx` in `packages/web/src/pages/TasksList.tsx`:
  - Extract `freeText` from `filters.parsedQuery`
  - Pass `freeText` to `TasksService.listTasks()` as `search` parameter
  - Update `useEffect` dependency to re-fetch when `filters.searchQuery` changes
- [ ] T015 [US1] Add optional `preview?: string` field to Task type in `packages/shared/src/types.ts` (if not already present)

**Checkpoint**: User Story 1 complete - users can search tasks by title on Tasks page

---

## Phase 4: User Story 2 - Search Memos by Body Content (Priority: P1)

**Goal**: Users can search memos by typing words from the body text (case-insensitive, with 50-char preview)

**Independent Test**: Create memos with various body content, search for "quarterly", verify matching memos appear with context previews

### Implementation for User Story 2

#### Database Layer

- [ ] T016 [P] [US2] Add `search?: string` to `ListMemoFilters` interface in `packages/db/src/memoRepository.ts`
- [ ] T017 [US2] Modify `listMemos()` function in `packages/db/src/memoRepository.ts`:
  - Add FTS5 join when `filters.search` is present
  - Add `snippet(issues_fts, 1, '<mark>', '</mark>', '...', 15) as preview` to SELECT (column index 1 = body_md)
  - Add condition: `f.body_md MATCH @search`
  - Pass `params.search = filters.search`
- [ ] T018 [US2] Add tests in `packages/db/test/memoRepository.test.ts`:
  - Test: Search matches memo body content
  - Test: Preview shows context around search term
  - Test: Preview truncated to ~50 characters
  - Test: Multiple memos with same search term all returned

#### API Layer

- [ ] T019 [P] [US2] Add `search: z.string().optional()` to `MemoQuerySchema` in `packages/api/src/schemas/memoSchemas.ts`
- [ ] T020 [US2] Update `listMemosHandler` in `packages/api/src/handlers/memoHandlers.ts` to extract `search` from request.query and pass to service
- [ ] T021 [US2] Add integration tests in `packages/api/test/integration/memos.test.ts`:
  - Test: `GET /api/memos?search=quarterly` returns matching memos
  - Test: Combined filters: `GET /api/memos?label=meeting&search=review`
  - Test: Preview field shows highlighted context
  - Test: Preview includes ellipsis when truncated

#### Frontend Layer

- [ ] T022 [P] [US2] Update `MemosService.listMemos()` in `packages/web/src/api/services/MemosService.ts` to accept `search?: string` parameter
- [ ] T023 [US2] Modify `MemosList.tsx` in `packages/web/src/pages/MemosList.tsx`:
  - Extract `freeText` from `filters.parsedQuery`
  - Pass `freeText` to `MemosService.listMemos()` as `search` parameter
  - Update `useEffect` dependency
- [ ] T024 [US2] Update memo list display to show preview text when available (render with `dangerouslySetInnerHTML` for highlighting)

**Checkpoint**: User Story 2 complete - users can search memos by body content on Memos page

---

## Phase 5: User Story 3 - Combined Structured and Free-Text Search (Priority: P2)

**Goal**: Power users can combine label/status filters with free-text search (e.g., "label:bug status:open authentication")

**Independent Test**: Create tasks with various labels/statuses/titles, search with combined query, verify only tasks matching ALL criteria appear

### Implementation for User Story 3

**Note**: Most foundation already exists from US1/US2. This phase focuses on integration testing and edge cases.

- [ ] T025 [P] [US3] Add integration test in `packages/api/test/integration/tasks.test.ts`:
  - Test: `GET /api/tasks?status=open&label=bug&search=auth` returns tasks matching all three filters
  - Test: Verify AND logic between structured filters and search
  - Test: Label OR logic still works with search (e.g., `label=bug,enhancement&search=API`)
- [ ] T026 [P] [US3] Add integration test for memos combining label + search
- [ ] T027 [US3] Test edge case in `packages/web/src/pages/TasksList.tsx`:
  - Verify structured filters in URL are preserved when search query changes
  - Test: Navigate with filters, add search, verify filters remain
- [ ] T028 [US3] Add end-to-end test (optional - if E2E tests requested):
  - User types `"label:bug authentication"` in search bar
  - Verify both bug label filter and authentication search are applied
  - Verify results update correctly

**Checkpoint**: User Story 3 complete - combined structured + free-text search works correctly

---

## Phase 6: User Story 4 - Link Creation with Fuzzy Search (Priority: P2)

**Goal**: Users can search for tasks/memos when creating links (no need to remember IDs)

**Independent Test**: Open task detail page, click "Add Link", search for "API", verify search results appear, select result to create link

### Implementation for User Story 4

#### New Search Results Component

- [ ] T029 [P] [US4] Create `SearchResults.tsx` component in `packages/web/src/components/SearchResults.tsx`:
  - Props: `results: (Task | Memo)[]`, `onSelect`, `maxResults: number`, `emptyMessage: string`
  - Display item type, ID, title/preview for each result
  - Slice to maxResults (default 20)
  - Show "More results available..." if results.length > maxResults
  - Render preview with `dangerouslySetInnerHTML` for highlighting
  - Make each result clickable (calls onSelect)
- [ ] T030 [US4] Add component tests for SearchResults in `packages/web/test/components/SearchResults.test.tsx` (NEW FILE):
  - Test: Displays all results when < 20 items
  - Test: Displays only 20 results when > 20 items
  - Test: Shows "More results available" message when truncated
  - Test: Calls onSelect when result clicked
  - Test: Shows empty state message when no results

#### Link Search Service

- [ ] T031 [US4] Add `searchForLinking(query: string)` method in `packages/web/src/api/services/LinksService.ts`:
  - Call `TasksService.listTasks(undefined, undefined, undefined, query)` for tasks
  - Call `MemosService.listMemos(undefined, undefined, query)` for memos
  - Combine results: `[...tasks, ...memos]`
  - Sort by ID descending
  - Return combined array

#### Modify AddLinkInline Component

- [ ] T032 [US4] Refactor `AddLinkInline.tsx` in `packages/web/src/components/AddLinkInline.tsx`:
  - Import `SearchInput` and `SearchResults` components
  - Add state: `searchQuery`, `searchResults`, `selectedItem`
  - Replace ID number input with SearchInput component
  - Add debounced search handler (300ms delay)
  - Minimum 3 characters before triggering search
  - Display SearchResults below SearchInput
  - Handle result selection → set selectedItem → proceed to link type selector
  - **Important**: Do NOT parse structured filters in link search (free-text only per clarification Q5)
- [ ] T033 [US4] Update `LinkSection.tsx` in `packages/web/src/components/LinkSection.tsx` if needed for search UI integration
- [ ] T034 [US4] Add tests for updated AddLinkInline in `packages/web/test/components/AddLinkInline.test.tsx`:
  - Test: SearchInput appears when adding link
  - Test: Search triggered after 3 characters
  - Test: Results displayed below search field
  - Test: Selecting result proceeds to link type selector
  - Test: "No results found" shown when search returns empty

**Checkpoint**: User Story 4 complete - link creation uses search instead of ID input

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [ ] T035 [P] Update OpenAPI documentation via `pnpm openapi:generate` (regenerate from updated Zod schemas)
- [ ] T036 [P] Verify TypeScript types are correct across all packages (run `pnpm build`)
- [ ] T037 [P] Test search with Unicode characters (Japanese, emoji) per SC-007
- [ ] T038 [P] Performance test with 10K test data per SC-004 (should be <1 second)
- [ ] T039 Code cleanup: Remove any debug logging or commented code
- [ ] T040 [P] Update CHANGELOG.md with new search features
- [ ] T041 Validate all quickstart.md test scenarios pass
- [ ] T042 [P] Security review: Sanitize snippet() HTML output if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - verification only
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 completion
- **Phase 4 (US2)**: Depends on Phase 2 completion - independent of US1
- **Phase 5 (US3)**: Depends on Phase 2, US1, US2 (integration testing)
- **Phase 6 (US4)**: Depends on Phase 2, US1, US2 (uses search endpoints)
- **Phase 7 (Polish)**: Depends on desired user stories being complete

### User Story Dependencies

- **US1 (Search Tasks)**: Can start after Phase 2 - No dependencies on other stories
- **US2 (Search Memos)**: Can start after Phase 2 - Independent of US1 (parallel)
- **US3 (Combined Filters)**: Requires US1 and US2 complete (integration testing)
- **US4 (Link Search)**: Requires US1 and US2 complete (uses their search endpoints)

### Within Each User Story

- Database layer before API layer
- API layer before frontend layer
- Tests at each layer before moving to next layer
- [P] tasks within a layer can run in parallel

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T004, T005 can run in parallel (different concerns)
- T006 runs after T004, T005

**Phase 3 (US1 Database)**:
- T007, T009 can run in parallel (interface vs tests - if following TDD)
- T008 sequential (implementation)

**Phase 3 (US1 API)**:
- T010 and T012 can run in parallel

**Phase 3 (US1 Frontend)**:
- T013 and T015 can run in parallel

**Phase 4 (US2) can run entirely parallel with Phase 3 (US1)** if team capacity allows

**Phase 7 (Polish)**:
- T035, T036, T037, T038, T040, T042 all [P] - can run in parallel

---

## Parallel Example: User Story 1

```bash
# Database layer in parallel:
Task: "T007 [P] [US1] Add search to ListTaskFilters"
Task: "T009 [US1] Add tests for search in taskRepository.test.ts"

# Then implement after tests written:
Task: "T008 [US1] Modify listTasks() to use FTS5 snippet()"

# API layer in parallel:
Task: "T010 [P] [US1] Add search to TaskQuerySchema"
Task: "T012 [US1] Add integration tests for search endpoint"

# Then update handler:
Task: "T011 [US1] Update listTasksHandler to pass search param"

# Frontend layer in parallel:
Task: "T013 [P] [US1] Update TasksService.listTasks() signature"
Task: "T015 [US1] Add preview field to Task type"

# Then update page:
Task: "T014 [US1] Modify TasksList.tsx to use search"
```

---

## Parallel Example: User Stories 1 and 2

```bash
# After Phase 2 completes, both stories can proceed in parallel:
Developer A works on Phase 3 (US1 - Tasks search):
- T007 through T015

Developer B works on Phase 4 (US2 - Memos search):
- T016 through T024

# Both deliver independently testable value
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

**Recommended for single developer or initial validation**:

1. Complete Phase 1: Setup (T001-T003) - Verify foundation
2. Complete Phase 2: Foundational (T004-T006) - Query parser
3. Complete Phase 3: User Story 1 (T007-T015) - Task search
4. **STOP and VALIDATE**: Test task search independently
5. Deploy/demo if ready (fully functional task search)

**Value delivered**: Users can search tasks by title - core search functionality working

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Add Phase 3 (US1) → Task search works → Deploy (MVP!)
3. Add Phase 4 (US2) → Memo search works → Deploy
4. Add Phase 5 (US3) → Combined filters work → Deploy
5. Add Phase 6 (US4) → Link search works → Deploy
6. Add Phase 7 → Polish → Final deploy

Each increment adds value without breaking previous functionality.

### Parallel Team Strategy

**With 2+ developers after Phase 2 completes**:

- **Developer A**: User Story 1 (Task search) - T007-T015
- **Developer B**: User Story 2 (Memo search) - T016-T024
- **Both merge**: User Story 3 (Integration tests) - T025-T028
- **Developer A or B**: User Story 4 (Link search) - T029-T034

Stories complete independently, integrate seamlessly.

---

## Task Summary

**Total Tasks**: 42 tasks

**Tasks per User Story**:
- Setup: 3 tasks
- Foundational: 3 tasks (BLOCKS all stories)
- User Story 1 (P1): 9 tasks (database, API, frontend)
- User Story 2 (P1): 9 tasks (database, API, frontend)
- User Story 3 (P2): 4 tasks (integration testing)
- User Story 4 (P2): 6 tasks (new component, link search)
- Polish: 8 tasks (cross-cutting)

**Parallel Opportunities**: 15 tasks marked [P] can run in parallel within their phases

**Independent Test Criteria**:
- ✅ US1: Create tasks, search by title, verify results with previews
- ✅ US2: Create memos, search by body, verify context previews
- ✅ US3: Search with combined filters, verify AND logic
- ✅ US4: Create link via search UI, verify ID not required

**Suggested MVP Scope**: Phase 1 + Phase 2 + Phase 3 (US1 only) = 15 tasks
- Delivers core task search functionality
- Validates FTS5 approach
- Can deploy for early user feedback

---

## Notes

- [P] tasks target different files with no dependencies - safe to parallelize
- [Story] labels (US1, US2, US3, US4) map tasks to user stories for traceability
- Each user story is independently completable and testable
- **No schema migrations needed** - FTS5 infrastructure already exists
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Research.md findings already validated FTS5 approach (no LIKE queries needed)
