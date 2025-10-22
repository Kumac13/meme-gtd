# Tasks: Add Comment Count to API List Responses

**Input**: Design documents from `/specs/012-https-github-com/`
**Prerequisites**: ✅ plan.md, ✅ spec.md, ✅ research.md, ✅ data-model.md, ✅ contracts/

**Tests**: Test tasks are included (TDD approach for quality assurance)

**Organization**: Single user story feature - tasks organized by implementation layer

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story this task belongs to (US1 = Display Comment Counts)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `packages/[package-name]/src/` and `packages/[package-name]/test/`
- Primary packages: `db`, `core`, `api`, `shared`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare development environment

✅ **Note**: No setup tasks needed - project infrastructure already exists

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure for comment count feature

✅ **Note**: No foundational tasks needed - all required infrastructure (database schema, API framework) already exists

**Checkpoint**: Foundation ready - user story implementation can begin immediately

---

## Phase 3: User Story 1 - Display Comment Counts in Web UI Lists (Priority: P1) 🎯 MVP

**Goal**: Enable Web UI to display comment counts for memos and tasks by adding `commentCount` field to GET /api/memos and GET /api/tasks responses. The count will show non-deleted comments, calculated efficiently via SQL aggregation.

**Independent Test**: Make GET requests to `/api/memos` and `/api/tasks` endpoints and verify each item includes an accurate `commentCount` field matching the actual number of non-deleted comments in the database.

### Database Layer Tests (Write First - TDD)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] **T001** [P] [US1] Add test: `listMemos()` returns `commentCount` field for each memo in `packages/db/test/memoRepository.test.ts`
  - Test memo with 0 comments returns `commentCount: 0`
  - Test memo with N comments returns `commentCount: N`
  - Test memo with mix of active and soft-deleted comments counts only active comments
  - Test filtered results (e.g., bookmarked memos) include accurate comment counts

- [ ] **T002** [P] [US1] Add test: `listTasks()` returns `commentCount` field for each task in `packages/db/test/taskRepository.test.ts`
  - Test task with 0 comments returns `commentCount: 0`
  - Test task with N comments returns `commentCount: N`
  - Test task with soft-deleted comments excludes them from count
  - Test filtered results (e.g., by status) include accurate comment counts

### Database Layer Implementation

- [ ] **T003** [US1] Update `listMemos()` query to include comment count subquery in `packages/db/src/memoRepository.ts`
  - Modify SELECT to add: `(SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count`
  - Apply to both standard filter path (line ~104) and FTS search path (line ~115)
  - Update `memoRowToMemo()` mapper to include: `commentCount: row.comment_count ?? 0`

- [ ] **T004** [US1] Update `listTasks()` query to include comment count subquery in `packages/db/src/taskRepository.ts`
  - Modify SELECT to add: `(SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count`
  - Apply to both standard filter path and FTS search path
  - Update `taskRowToTask()` mapper to include: `commentCount: row.comment_count ?? 0`

- [ ] **T005** [P] [US1] Update `Memo` interface to include optional `commentCount` field in `packages/shared/src/types.ts`
  - Add: `commentCount?: number;` to Memo interface

- [ ] **T006** [P] [US1] Update `Task` interface to include optional `commentCount` field in `packages/shared/src/types.ts`
  - Add: `commentCount?: number;` to Task interface

**Checkpoint**: Run `pnpm --filter meme-gtd-db test` - all tests should pass

### API Layer Tests (Write First - TDD)

- [ ] **T007** [P] [US1] Add test: GET /api/memos includes `commentCount` in response in `packages/api/test/integration/memos.test.ts`
  - Create memo with 2 comments, verify response includes `commentCount: 2`
  - Create memo with 0 comments, verify response includes `commentCount: 0`
  - Verify Zod schema validation passes with new field

- [ ] **T008** [P] [US1] Add test: GET /api/tasks includes `commentCount` in response in `packages/api/test/integration/tasks.test.ts`
  - Create task with 3 comments, verify response includes `commentCount: 3`
  - Create task with 0 comments, verify response includes `commentCount: 0`
  - Verify filtered queries (e.g., by status) include comment counts

### API Layer Implementation

- [ ] **T009** [US1] Update `MemoSchema` to include required `commentCount` field in `packages/api/src/schemas/memoSchemas.ts`
  - Add: `commentCount: z.number().int().nonnegative().describe('Number of non-deleted comments on this memo')`
  - Ensure field is required (not optional) in the schema

- [ ] **T010** [US1] Update `TaskSchema` to include required `commentCount` field in `packages/api/src/schemas/taskSchemas.ts`
  - Add: `commentCount: z.number().int().nonnegative().describe('Number of non-deleted comments on this task')`
  - Ensure field is required (not optional) in the schema

**Checkpoint**: Run `pnpm --filter meme-gtd-api test` - all tests should pass

### Manual Verification (Test Environment Only)

- [ ] **T011** [US1] Manual test: Verify GET /api/memos returns `commentCount` field
  - Start test server: `pnpm server:dev` (port 3001, test DB)
  - Create test data with memos having varying comment counts
  - Execute: `curl http://localhost:3001/api/memos`
  - Verify each memo includes accurate `commentCount` field

- [ ] **T012** [US1] Manual test: Verify GET /api/tasks returns `commentCount` field
  - Using same test server from T011
  - Create test data with tasks having varying comment counts
  - Execute: `curl http://localhost:3001/api/tasks`
  - Verify each task includes accurate `commentCount` field

**Checkpoint**: User Story 1 is fully functional and independently testable

---

## Phase 4: Performance Validation

**Purpose**: Ensure comment count addition meets performance requirements (< 10% degradation per spec SC-003)

- [ ] **T013** [US1] Create performance benchmark script in `scripts/benchmark-comment-count.ts`
  - Measure average query time for `listMemos()` over 1000 iterations
  - Measure average query time for `listTasks()` over 1000 iterations
  - Report results and compare to baseline (should be < 10% increase)

- [ ] **T014** [US1] Run performance tests with varying data sizes
  - Test with 10, 100, 1000 issues with 0-50 comments each
  - Verify performance remains acceptable at all scales
  - Document results in spec directory

**Checkpoint**: Performance validated, feature ready for production

---

## Phase 5: Polish & Documentation

**Purpose**: Final quality checks and documentation

- [ ] **T015** [P] [US1] Update quickstart.md with actual implementation notes (if changes needed)
  - Document any deviations from planned implementation
  - Add any troubleshooting notes discovered during implementation

- [ ] **T016** [P] [US1] Run full test suite across all packages
  - Execute: `pnpm test` from repository root
  - Verify all existing tests still pass (backward compatibility)
  - Verify new comment count tests pass

- [ ] **T017** [US1] Verify OpenAPI documentation includes `commentCount` field
  - Check Fastify schema registration includes updated Zod schemas
  - If Swagger UI is configured, verify field appears in documentation

- [ ] **T018** [P] [US1] Update CHANGELOG.md with feature addition
  - Add entry under appropriate version section
  - Format: "feat: add commentCount to memo and task list endpoints"

**Checkpoint**: Feature complete, tested, documented, ready for commit/PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: ✅ No tasks (infrastructure exists)
- **Foundational (Phase 2)**: ✅ No tasks (infrastructure exists)
- **User Story 1 (Phase 3)**: Can start immediately
- **Performance (Phase 4)**: Depends on Phase 3 completion
- **Polish (Phase 5)**: Depends on Phase 4 completion

### Within User Story 1 (Phase 3)

**Database Layer**:
1. T001, T002 (tests) - Run in parallel [P]
2. T003 (memo repository) - After tests fail
3. T004 (task repository) - After tests fail
4. T005, T006 (types) - Can run in parallel with T003/T004 [P]
5. Verify T001, T002 now pass

**API Layer**:
1. T007, T008 (tests) - Run in parallel [P] - After database layer complete
2. T009, T010 (schemas) - Can run in parallel [P] - After tests fail
3. Verify T007, T008 now pass

**Manual Testing**:
1. T011, T012 - Sequential (use same test server instance)

### Parallel Opportunities

**Maximum Parallelism**:
```bash
# Database tests can run together:
Task T001: Test listMemos() in packages/db/test/memoRepository.test.ts
Task T002: Test listTasks() in packages/db/test/taskRepository.test.ts

# Type updates can run while implementing repositories:
Task T005: Update Memo type in packages/shared/src/types.ts
Task T006: Update Task type in packages/shared/src/types.ts

# API tests can run together:
Task T007: Test GET /api/memos in packages/api/test/integration/memos.test.ts
Task T008: Test GET /api/tasks in packages/api/test/integration/tasks.test.ts

# API schema updates can run together:
Task T009: Update MemoSchema in packages/api/src/schemas/memoSchemas.ts
Task T010: Update TaskSchema in packages/api/src/schemas/taskSchemas.ts

# Polish tasks can run together:
Task T015: Update quickstart.md
Task T016: Run full test suite
Task T018: Update CHANGELOG.md
```

---

## Parallel Example: User Story 1 Database Layer

```bash
# Step 1: Launch database tests in parallel (should FAIL initially):
Task: "Add test: listMemos() returns commentCount field in packages/db/test/memoRepository.test.ts"
Task: "Add test: listTasks() returns commentCount field in packages/db/test/taskRepository.test.ts"

# Step 2: Implement changes in parallel:
Task: "Update listMemos() in packages/db/src/memoRepository.ts"
Task: "Update listTasks() in packages/db/src/taskRepository.ts"
Task: "Update Memo interface in packages/shared/src/types.ts"
Task: "Update Task interface in packages/shared/src/types.ts"

# Step 3: Verify tests now PASS
```

---

## Implementation Strategy

### TDD Workflow (Recommended)

1. **Phase 3 - Database Layer (T001-T006)**:
   - Write T001, T002 tests (parallel) → Tests FAIL ✅
   - Implement T003, T004, T005, T006 (parallel where possible) → Tests PASS ✅
   - Checkpoint: `pnpm --filter meme-gtd-db test`

2. **Phase 3 - API Layer (T007-T010)**:
   - Write T007, T008 tests (parallel) → Tests FAIL ✅
   - Implement T009, T010 (parallel) → Tests PASS ✅
   - Checkpoint: `pnpm --filter meme-gtd-api test`

3. **Phase 3 - Manual Verification (T011-T012)**:
   - Start test server, validate real responses
   - Checkpoint: User Story 1 complete

4. **Phase 4 - Performance (T013-T014)**:
   - Benchmark and validate performance requirements
   - Checkpoint: Performance validated

5. **Phase 5 - Polish (T015-T018)**:
   - Documentation, full test suite, CHANGELOG
   - Checkpoint: Ready for commit/PR

### Single Developer Timeline

Estimated time: **2-3 hours**

- Phase 3 (Database): 45 minutes
- Phase 3 (API): 30 minutes
- Phase 3 (Manual): 15 minutes
- Phase 4 (Performance): 20 minutes
- Phase 5 (Polish): 20 minutes

### Validation Checkpoints

After each checkpoint, verify:
- ✅ Tests pass for completed work
- ✅ Feature works independently
- ✅ No regressions in existing functionality

---

## Notes

- **[P] tasks** = different files, can run in parallel
- **[US1] label** = all tasks belong to User Story 1
- **TDD approach**: Tests written before implementation, verify they fail first
- **Test environment only**: NEVER use production DB (see CLAUDE.md)
- **Backward compatibility**: Additive change, no breaking changes
- **Performance requirement**: < 10% query time increase (spec SC-003)
- **Commit strategy**: Commit after each phase checkpoint or logical group
- **Reference**: See quickstart.md for detailed implementation guide

## Success Criteria

Feature is complete when:
1. ✅ All tests (T001-T008, T016) pass
2. ✅ Manual verification (T011-T012) shows correct data
3. ✅ Performance benchmarks (T013-T014) meet requirements
4. ✅ Documentation (T015, T017, T018) updated
5. ✅ No regressions in existing functionality
6. ✅ Web UI can consume new `commentCount` field (validated via manual test)
