# Tasks: Label and Status Search for Tasks and Memos

**Input**: Design documents from `/specs/024-tasks-memos-label/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in this feature specification. Test tasks are omitted to focus on implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: `packages/api/`, `packages/web/`, `packages/cli/`, `packages/db/`
- Paths shown below match the actual project structure from plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization - No changes required, existing monorepo structure is already in place

✅ **This phase is already complete** - The project structure exists and is properly configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core database layer changes that MUST be complete before ANY user story interface can be implemented

**⚠️ CRITICAL**: No UI/API/CLI work can begin until this phase is complete. All user stories depend on database layer supporting comma-separated labels.

- [ ] T001 [DB] Update `ListTaskFilters` interface in `packages/db/src/taskRepository.ts` to add `labels?: string[]` field (keep `label?: string` for backward compatibility)
- [ ] T002 [DB] Update `ListMemoFilters` interface in `packages/db/src/memoRepository.ts` to add `labels?: string[]` field (keep `label?: string` for backward compatibility)
- [ ] T003 [DB] Modify `listTasks()` function in `packages/db/src/taskRepository.ts` to support multiple labels with SQL `IN` clause (OR logic for comma-separated values)
- [ ] T004 [DB] Modify `listMemos()` function in `packages/db/src/memoRepository.ts` to support multiple labels with SQL `IN` clause (OR logic for comma-separated values)

**Checkpoint**: ✅ Database layer now supports multi-label filtering - ALL user stories can now begin in parallel

---

## Phase 3: User Story 1 - Search Tasks by Single Label (Priority: P1) 🎯 MVP - Web UI

**Goal**: Allow users to filter tasks by typing `label:bug` in the Web UI search box

**Independent Test**: Create tasks with labels "bug", "enhancement", "documentation". Type `label:bug` in search box. Verify only "bug" tasks display.

### Implementation for User Story 1

- [ ] T005 [P] [US1-Web] Create `queryParser.ts` in `packages/web/src/utils/` - Parse `label:value` syntax from search string
- [ ] T006 [P] [US1-Web] Create `useUrlFilters.ts` hook in `packages/web/src/hooks/` - Sync filters with URL search params using React Router
- [ ] T007 [P] [US1-Web] Create `SearchInput.tsx` component in `packages/web/src/components/` - GitHub-style search input with 300ms debounce
- [ ] T008 [US1-Web] Update `TasksPage.tsx` in `packages/web/src/pages/` - Integrate SearchInput, parse query, call API with `?label=` parameter
- [ ] T009 [US1-Web] Add subtle hint display in `SearchInput.tsx` for invalid syntax (show "検索例: label:bug" below input)

**Checkpoint**: ✅ User Story 1 complete - Users can filter tasks by single label in Web UI

---

## Phase 4: User Story 2 - Search Memos by Single Label (Priority: P1) - Web UI

**Goal**: Allow users to filter memos by typing `label:idea` in the Web UI search box

**Independent Test**: Create memos with labels "idea", "meeting-notes", "todo". Type `label:idea` in search box. Verify only "idea" memos display.

### Implementation for User Story 2

- [ ] T010 [US2-Web] Update `MemosPage.tsx` in `packages/web/src/pages/` - Integrate SearchInput (reuse from US1), parse query, call API with `?label=` parameter
- [ ] T011 [US2-Web] Add memo-specific warning in `SearchInput.tsx` when `status:` filter is used on memos page (show "注意: ステータスフィルターはメモには適用されません")

**Checkpoint**: ✅ User Story 2 complete - Users can filter memos by single label in Web UI

---

## Phase 5: User Story 3 - Search by Multiple Labels (Priority: P2) - Web UI

**Goal**: Allow users to filter by multiple labels using `label:bug,enhancement` syntax in Web UI

**Independent Test**: Create tasks with labels "bug", "enhancement", "documentation". Type `label:bug,enhancement`. Verify only tasks with "bug" OR "enhancement" display.

### Implementation for User Story 3

- [ ] T012 [US3-Web] Update `queryParser.ts` in `packages/web/src/utils/` - Split comma-separated label values (e.g., `bug,enhancement` → `['bug', 'enhancement']`)
- [ ] T013 [US3-Web] Update `useUrlFilters.ts` hook in `packages/web/src/hooks/` - Serialize multiple labels as comma-separated query param

**Checkpoint**: ✅ User Story 3 complete - Users can filter by multiple labels using comma syntax in Web UI

---

## Phase 6: User Story 4 - Search Tasks by Status (Priority: P2) - Web UI

**Goal**: Allow users to filter tasks by typing `status:open` or `status:closed` in Web UI

**Independent Test**: Create tasks with statuses "open" and "closed". Type `status:open`. Verify only open tasks display.

### Implementation for User Story 4

- [ ] T014 [US4-Web] Update `queryParser.ts` in `packages/web/src/utils/` - Parse `status:value` syntax from search string
- [ ] T015 [US4-Web] Update `TasksPage.tsx` in `packages/web/src/pages/` - Pass parsed status filter to API call with `?status=` parameter
- [ ] T016 [US4-Web] Add status validation in `queryParser.ts` - Check against valid values (open, next, waiting, scheduled, done, canceled), show error for invalid values with list of valid options

**Checkpoint**: ✅ User Story 4 complete - Users can filter tasks by status in Web UI

---

## Phase 7: User Story 5 - Combine Label and Status Search (Priority: P3) - Web UI

**Goal**: Allow users to combine filters like `label:bug status:open` in Web UI

**Independent Test**: Create tasks with various labels and statuses. Type `label:bug status:open`. Verify only open "bug" tasks display.

### Implementation for User Story 5

- [ ] T017 [US5-Web] Update `queryParser.ts` in `packages/web/src/utils/` - Parse both label and status from same query string (e.g., "label:bug status:open")
- [ ] T018 [US5-Web] Update `TasksPage.tsx` in `packages/web/src/pages/` - Combine both filters in API call (e.g., `?label=bug&status=open`)

**Checkpoint**: ✅ User Story 5 complete - Users can combine label and status filters in Web UI

---

## Phase 8: User Story 6 - API: Filter Tasks and Memos by Label (Priority: P1)

**Goal**: Enable API clients to filter tasks/memos with `GET /api/tasks?label=bug` or `GET /api/memos?label=idea`

**Independent Test**: Send `GET /api/tasks?label=bug`. Verify response contains only tasks with "bug" label.

### Implementation for User Story 6

- [ ] T019 [P] [US6-API] Update `TaskQuerySchema` in `packages/api/src/schemas/taskSchemas.ts` - Add `label: z.string().optional()` field
- [ ] T020 [P] [US6-API] Update `MemoQuerySchema` in `packages/api/src/schemas/memoSchemas.ts` - Add `label: z.string().optional()` field
- [ ] T021 [US6-API] Update `listTasksHandler` in `packages/api/src/handlers/taskHandlers.ts` - Parse `label` query param, split by comma, pass `labels` array to service
- [ ] T022 [US6-API] Update `listMemosHandler` in `packages/api/src/handlers/memoHandlers.ts` - Parse `label` query param, split by comma, pass `labels` array to service
- [ ] T023 [P] [US6-API] Update OpenAPI spec in `packages/api/docs/api/openapi.yaml` - Add `label` query parameter documentation for `/api/tasks` and `/api/memos` endpoints

**Checkpoint**: ✅ User Story 6 complete - API supports label filtering for tasks and memos

---

## Phase 9: User Story 7 - API: Filter Tasks by Status (Priority: P1)

**Goal**: Enable API clients to filter tasks with `GET /api/tasks?status=open`

**Independent Test**: Send `GET /api/tasks?status=open`. Verify response contains only open tasks.

### Implementation for User Story 7

- [ ] T024 [US7-API] Update `listTasksHandler` in `packages/api/src/handlers/taskHandlers.ts` - Add status validation, return 400 Bad Request for invalid status values with error message listing valid options
- [ ] T025 [US7-API] Update `listMemosHandler` in `packages/api/src/handlers/memoHandlers.ts` - Silently ignore `status` query param if provided (memos don't have status)
- [ ] T026 [US7-API] Update OpenAPI spec in `packages/api/docs/api/openapi.yaml` - Add `status` query parameter documentation for `/api/tasks` endpoint with validation rules

**Checkpoint**: ✅ User Story 7 complete - API supports status filtering for tasks with proper validation

---

## Phase 10: User Story 8 - CLI: Filter Tasks and Memos by Label (Priority: P1)

**Goal**: Enable CLI users to filter with `mgtd task list --label bug` or `mgtd memo list --label idea`

**Independent Test**: Run `mgtd task list --label bug`. Verify output shows only tasks with "bug" label.

### Implementation for User Story 8

- [ ] T027 [P] [US8-CLI] Update `TaskListCommand` in `packages/cli/src/commands/task/list.ts` - Parse comma-separated `--label` flag, split into array, pass `labels` to service
- [ ] T028 [P] [US8-CLI] Update `MemoListCommand` in `packages/cli/src/commands/memo/list.ts` - Parse comma-separated `--label` flag, split into array, pass `labels` to service
- [ ] T029 [P] [US8-CLI] Update help text for `--label` flag in both commands - Document comma-separated syntax (e.g., "Filter by label. Comma-separated for OR logic (e.g., bug,enhancement)")

**Checkpoint**: ✅ User Story 8 complete - CLI supports label filtering for tasks and memos with comma syntax

---

## Phase 11: User Story 9 - CLI: Filter Tasks by Status (Priority: P1)

**Goal**: Enable CLI users to filter with `mgtd task list --status open`

**Independent Test**: Run `mgtd task list --status open`. Verify output shows only open tasks.

### Implementation for User Story 9

- [ ] T030 [US9-CLI] Update `TaskListCommand` in `packages/cli/src/commands/task/list.ts` - Add status validation, display error to stderr for invalid status with list of valid options
- [ ] T031 [US9-CLI] Update `MemoListCommand` in `packages/cli/src/commands/memo/list.ts` - Display warning to stderr when `--status` flag is used (e.g., "Warning: --status flag is ignored for memos")

**Checkpoint**: ✅ User Story 9 complete - CLI supports status filtering for tasks with proper validation and warnings

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final documentation

- [ ] T032 [P] [Polish] Add pagination support to API - Update handlers to support `limit` (default: 100, max: 1000) and `offset` (default: 0) query parameters
- [ ] T033 [P] [Polish] Add pagination metadata to API responses - Return `X-Total-Count`, `X-Page-Size`, `X-Offset` headers
- [ ] T034 [P] [Polish] Update `docs/cli-commands.md` - Document new `--label` comma syntax and examples for both task and memo list commands
- [ ] T035 [P] [Polish] Create `docs/api-filtering.md` - Document API query parameters for filtering with curl examples
- [ ] T036 [P] [Polish] Update README.md - Add "Search and Filter" section with examples for all three interfaces (Web, API, CLI)
- [ ] T037 [Polish] Regenerate OpenAPI spec - Run `cd packages/api && pnpm openapi:generate`
- [ ] T038 [Polish] Manual validation using quickstart.md - Test filtering across all interfaces with test database

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ Already complete - No action needed
- **Foundational (Phase 2)**: Database layer changes - BLOCKS all user stories
- **User Stories (Phases 3-11)**: All depend on Foundational phase completion
  - Web UI stories (US1-US5): Can proceed in sequence or parallel after Phase 2
  - API stories (US6-US7): Can proceed in parallel after Phase 2
  - CLI stories (US8-US9): Can proceed in parallel after Phase 2
  - **All three interfaces can be developed in parallel by different team members**
- **Polish (Phase 12)**: Depends on all desired user stories being complete

### User Story Dependencies

**After Phase 2 (Foundational) completes, stories are independent:**

- **US1 (P1-Web)**: Tasks label filtering in Web UI → No dependencies
- **US2 (P1-Web)**: Memos label filtering in Web UI → Reuses SearchInput from US1
- **US3 (P2-Web)**: Multiple labels in Web UI → Extends US1/US2 query parser
- **US4 (P2-Web)**: Status filtering in Web UI → Independent (parallel with US3)
- **US5 (P3-Web)**: Combined filters in Web UI → Combines US3 + US4 logic
- **US6 (P1-API)**: API label filtering → No dependencies
- **US7 (P1-API)**: API status filtering → Independent (parallel with US6)
- **US8 (P1-CLI)**: CLI label filtering → No dependencies
- **US9 (P1-CLI)**: CLI status filtering → Independent (parallel with US8)

### Within Each User Story

- Tasks within a story marked [P] can run in parallel
- Web UI stories: queryParser → hooks → components → page integration
- API stories: schemas → handlers → OpenAPI docs (schemas and OpenAPI can be parallel)
- CLI stories: command updates and help text can be done together

### Parallel Opportunities

**Maximum Parallelization** (if team capacity allows):

After completing Phase 2 (Foundational):
1. **Developer A**: Web UI stories (US1 → US2 → US3 → US4 → US5)
2. **Developer B**: API stories (US6, US7 in parallel)
3. **Developer C**: CLI stories (US8, US9 in parallel)

All three interfaces can be developed simultaneously without conflicts.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Cannot parallelize T001-T004 - all modify same repository files
# Must execute sequentially:
T001: Update ListTaskFilters interface
T002: Update ListMemoFilters interface
T003: Modify listTasks() function
T004: Modify listMemos() function
```

## Parallel Example: Phase 8 (User Story 6)

```bash
# These tasks modify different files - can run in parallel:
Task: "Update TaskQuerySchema in packages/api/src/schemas/taskSchemas.ts"
Task: "Update MemoQuerySchema in packages/api/src/schemas/memoSchemas.ts"
Task: "Update OpenAPI spec in packages/api/docs/api/openapi.yaml"

# Then sequentially:
Task: "Update listTasksHandler" (depends on TaskQuerySchema)
Task: "Update listMemosHandler" (depends on MemoQuerySchema)
```

## Parallel Example: Phase 12 (Polish)

```bash
# All documentation tasks can run in parallel (different files):
Task: "Update docs/cli-commands.md"
Task: "Create docs/api-filtering.md"
Task: "Update README.md"
Task: "Add pagination support to API"
Task: "Add pagination metadata to API responses"
```

---

## Implementation Strategy

### MVP First (Web UI Only - User Stories 1-2)

1. Complete Phase 2: Foundational (Database layer) - **4 tasks, ~2 hours**
2. Complete Phase 3: User Story 1 (Tasks label filtering in Web UI) - **5 tasks, ~4 hours**
3. Complete Phase 4: User Story 2 (Memos label filtering in Web UI) - **2 tasks, ~1 hour**
4. **STOP and VALIDATE**: Test Web UI filtering independently
5. Deploy/demo if ready

**MVP delivers**: Users can filter tasks and memos by single label in Web UI

### Incremental Delivery (All P1 Stories)

1. Complete Foundational → Foundation ready
2. Add US1 (Tasks Web) → Test independently
3. Add US2 (Memos Web) → Test independently
4. Add US6 (API Label) → Test independently → **API parity achieved**
5. Add US7 (API Status) → Test independently
6. Add US8 (CLI Label) → Test independently → **CLI parity achieved**
7. Add US9 (CLI Status) → Test independently
8. **All P1 stories complete** → Full feature parity across all interfaces

### Full Feature (All Stories + Polish)

1. Complete all P1 stories (US1, US2, US6, US7, US8, US9)
2. Add US3 (Multiple labels Web)
3. Add US4 (Status filtering Web)
4. Add US5 (Combined filters Web)
5. Complete Phase 12 (Polish) - Pagination, documentation, validation

### Parallel Team Strategy

With 3 developers after Foundational phase completes:

1. **Team completes Phase 2 (Foundational) together** → Foundation ready
2. Once Foundational is done:
   - **Developer A**: Web UI stories (US1 → US2 → US3 → US4 → US5)
   - **Developer B**: API stories (US6, US7)
   - **Developer C**: CLI stories (US8, US9)
3. Stories complete and integrate independently
4. All three developers work on Polish (Phase 12) together

---

## Task Summary

- **Total Tasks**: 38 tasks
- **Phase 1 (Setup)**: 0 tasks (already complete)
- **Phase 2 (Foundational)**: 4 tasks - **CRITICAL BLOCKER**
- **Phase 3-11 (User Stories)**: 27 tasks across 9 user stories
  - Web UI (US1-US5): 13 tasks
  - API (US6-US7): 8 tasks
  - CLI (US8-US9): 6 tasks
- **Phase 12 (Polish)**: 7 tasks

### Task Count Per User Story

- **US1** (P1-Web - Tasks label): 5 tasks (~4 hours)
- **US2** (P1-Web - Memos label): 2 tasks (~1 hour)
- **US3** (P2-Web - Multiple labels): 2 tasks (~1 hour)
- **US4** (P2-Web - Status): 3 tasks (~2 hours)
- **US5** (P3-Web - Combined): 2 tasks (~1 hour)
- **US6** (P1-API - Label): 5 tasks (~3 hours)
- **US7** (P1-API - Status): 3 tasks (~2 hours)
- **US8** (P1-CLI - Label): 3 tasks (~2 hours)
- **US9** (P1-CLI - Status): 2 tasks (~1 hour)

### Parallel Opportunities Identified

- **Phase 2**: Sequential (database files conflict)
- **Phase 3-5**: 4 parallel tasks total (query parser, hooks, component creation)
- **Phase 8**: 3 parallel tasks (schemas and OpenAPI docs)
- **Phase 10**: 3 parallel tasks (CLI command updates and help text)
- **Phase 12**: 5 parallel tasks (all documentation tasks)

**Total parallelizable tasks**: 15 out of 38 tasks (39%)

### Independent Test Criteria

Each user story has clear acceptance criteria that can be tested independently:

- **US1**: Create test tasks, search `label:bug`, verify only bug tasks shown
- **US2**: Create test memos, search `label:idea`, verify only idea memos shown
- **US3**: Search `label:bug,enhancement`, verify OR logic works
- **US4**: Search `status:open`, verify only open tasks shown
- **US5**: Search `label:bug status:open`, verify AND logic works
- **US6**: API call `GET /api/tasks?label=bug`, verify JSON response
- **US7**: API call `GET /api/tasks?status=open`, verify JSON response
- **US8**: CLI `mgtd task list --label bug`, verify console output
- **US9**: CLI `mgtd task list --status open`, verify console output

### Suggested MVP Scope

**Recommended MVP: User Stories 1-2 (Web UI label filtering)**
- **Tasks**: Phase 2 (4 tasks) + Phase 3 (5 tasks) + Phase 4 (2 tasks) = **11 tasks**
- **Estimated time**: ~7 hours for single developer
- **Value delivered**: Users can filter tasks and memos by single label in Web UI
- **Test criteria**: Fully testable independently without other stories

**Alternative MVP: All P1 Stories (All interfaces with label filtering)**
- **Tasks**: Foundational (4) + US1 (5) + US2 (2) + US6 (5) + US7 (3) + US8 (3) + US9 (2) = **24 tasks**
- **Estimated time**: ~15 hours for single developer, or ~6-8 hours with 3 developers in parallel
- **Value delivered**: Full feature parity across Web UI, API, and CLI for label and status filtering
- **Test criteria**: Each interface independently testable

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability (US1-US9)
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- **Critical Safety**: Always use `pnpm mgtd:test` for CLI testing (never `mgtd` directly)
- Test environment ports: API on 3001 (`pnpm server:dev`), not production 3000
- All implementation uses test database: `test-data/test.db`
