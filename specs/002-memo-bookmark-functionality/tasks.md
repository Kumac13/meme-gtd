# Tasks: Memo & Task Bookmark Functionality

**Input**: Design documents from `/specs/002-memo-bookmark-functionality/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included - TDD approach with tests before implementation
**Organization**: Tasks grouped by user story for independent implementation

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo**: `packages/cli/`, `packages/db/`, `packages/core/`
- Tests: `packages/cli/test/`, `packages/db/test/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify project structure and dependencies

- [X] T001 Verify monorepo structure (packages/cli, packages/db exist)
- [X] T002 [P] Verify TypeScript + oclif dependencies in packages/cli/package.json
- [X] T003 [P] Verify better-sqlite3 in packages/db/package.json
- [X] T004 [P] Verify node:test is available (Node.js >=22.0.0) ⚠️ Node v20.18.3 detected, but node:test is available

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository layer that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] [Foundation] Add setBookmark() method to packages/db/src/memoRepository.ts
  - Signature: `setBookmark(db: Database, id: number, isBookmarked: boolean): void`
  - SQL: UPDATE issues SET is_bookmarked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = 'memo' AND is_deleted = 0
  - Error handling: Check rows affected, throw if 0 (with type check for better error message)

- [ ] T006 [P] [Foundation] Add setBookmark() method to packages/db/src/taskRepository.ts
  - Same as T005 but with `type = 'task'`
  - Error messages: "Task" instead of "Memo"
  - ⚠️ SKIPPED: taskRepository.ts doesn't exist yet (task feature not implemented)

- [X] T007 [Foundation] Export setBookmark from packages/db/src/index.ts for both repositories
  - Already exported via `export * from './memoRepository.js'`

**Checkpoint**: Foundation ready for memo bookmarking - User Story 1 can now begin

---

## Phase 3: User Story 1 - Quick Access to Important Memos (Priority: P1) 🎯 MVP

**Goal**: Enable users to bookmark memos and filter by bookmark status

**Independent Test**: Create memo → bookmark → list with --bookmarked → verify filtered correctly

### Tests for User Story 1 (TDD)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T008 [P] [US1] Integration test: memo bookmark command in packages/cli/test/commands/memo/bookmark.test.js
  - Test happy path: bookmark memo → verify success message
  - Test idempotency: bookmark twice → both succeed
  - Test JSON output: `--json` flag → verify {id, isBookmarked: true}
  - Test error: non-existent ID → error
  - Test error: task ID → "Issue #X is not a memo"

- [ ] T009 [P] [US1] Integration test: memo unbookmark command in packages/cli/test/commands/memo/bookmark.test.js
  - Test happy path: unbookmark memo → verify success message
  - Test idempotency: unbookmark twice → both succeed
  - Test JSON output: `--json` flag → verify {id, isBookmarked: false}

- [ ] T010 [P] [US1] Integration test: memo list --bookmarked filter in packages/cli/test/commands/memo/bookmark.test.js
  - Create bookmarked and non-bookmarked memos
  - Test filter: `--bookmarked` shows only bookmarked
  - Test combination: `--bookmarked --label X` applies AND logic

### Implementation for User Story 1

- [ ] T011 [P] [US1] Create memo bookmark command in packages/cli/src/commands/memo/bookmark.ts
  - Import setBookmark from @meme-gtd/db
  - Parse ID argument (validate positive integer)
  - Call setBookmark(db, id, true)
  - Output: "Bookmarked memo #<id>" (text) or JSON {id, isBookmarked: true}
  - Error handling: catch and display error messages with exit code 1

- [ ] T012 [P] [US1] Create memo unbookmark command in packages/cli/src/commands/memo/unbookmark.ts
  - Same structure as T011 but call setBookmark(db, id, false)
  - Output: "Removed bookmark from memo #<id>"

- [ ] T013 [US1] Modify memo list command in packages/cli/src/commands/memo/list.ts
  - Add `--bookmarked` flag (Flags.boolean, default: false)
  - Add WHERE clause: `is_bookmarked = 1` when flag is true
  - Add visual indicator: `const indicator = memo.is_bookmarked ? '★' : ' ';`
  - Ensure JSON output includes isBookmarked field (convert SQLite integer to boolean)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Bookmark Priority Tasks (Priority: P2)

**Goal**: Extend bookmark functionality to tasks with bookmark preservation during promotion

**Independent Test**: Create task → bookmark → list with --bookmarked → promote bookmarked memo → verify task inherits bookmark

### Tests for User Story 2 (TDD)

- [ ] T014 [P] [US2] Integration test: task bookmark command in packages/cli/test/commands/task/bookmark.test.js
  - Test happy path: bookmark task → verify success
  - Test idempotency: bookmark twice → both succeed
  - Test JSON output: verify {id, isBookmarked: true}
  - Test error: memo ID → "Issue #X is not a task"

- [ ] T015 [P] [US2] Integration test: task unbookmark command in packages/cli/test/commands/task/bookmark.test.js
  - Test happy path: unbookmark task → verify success
  - Test idempotency: unbookmark twice → both succeed

- [ ] T016 [P] [US2] Integration test: task list --bookmarked filter in packages/cli/test/commands/task/bookmark.test.js
  - Create bookmarked and non-bookmarked tasks
  - Test filter: `--bookmarked` shows only bookmarked tasks
  - Test with status filter: `--bookmarked --status next` applies AND logic

- [ ] T017 [US2] Integration test: memo promote preserves bookmark in packages/cli/test/commands/memo/bookmark.test.js
  - Bookmark memo → promote to task → verify task has isBookmarked: true
  - Promote unbookmarked memo → verify task has isBookmarked: false

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create task bookmark command in packages/cli/src/commands/task/bookmark.ts
  - Import setBookmark from @meme-gtd/db (taskRepository)
  - Same structure as memo bookmark (T011) but for tasks
  - Output: "Bookmarked task #<id>"

- [ ] T019 [P] [US2] Create task unbookmark command in packages/cli/src/commands/task/unbookmark.ts
  - Same structure as memo unbookmark (T012) but for tasks
  - Output: "Removed bookmark from task #<id>"

- [ ] T020 [US2] Modify task list command in packages/cli/src/commands/task/list.ts
  - Add `--bookmarked` flag (same as T013)
  - Add WHERE clause for bookmarked filter
  - Add visual indicator (★) for bookmarked tasks
  - Ensure JSON output includes isBookmarked field

- [ ] T021 [US2] Modify memo promote command in packages/cli/src/commands/memo/promote.ts
  - When creating new task from memo, copy is_bookmarked field
  - Code: `is_bookmarked: sourceMemo.is_bookmarked`
  - No user-visible change (transparent preservation)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Visual Bookmark Indicators (Priority: P3)

**Goal**: Ensure bookmark status is visible in all outputs (text and JSON)

**Independent Test**: Bookmark items → run list/view commands → verify ★ indicator and JSON isBookmarked field

### Tests for User Story 3 (TDD)

- [ ] T022 [P] [US3] Integration test: visual indicators in packages/cli/test/commands/memo/bookmark.test.js
  - Create bookmarked and non-bookmarked memos
  - Run `memo list` → verify ★ appears for bookmarked items
  - Verify non-bookmarked items show space (not empty string) for alignment

- [ ] T023 [P] [US3] Integration test: JSON output in packages/cli/test/commands/memo/bookmark.test.js
  - Run `memo list --json` → verify all items have isBookmarked field
  - Verify bookmarked items have isBookmarked: true
  - Verify non-bookmarked items have isBookmarked: false

- [ ] T024 [P] [US3] Integration test: memo view shows bookmark status in packages/cli/test/commands/memo/bookmark.test.js
  - Bookmark memo → run `memo view <id>` → verify bookmark status displayed
  - Run `memo view <id> --json` → verify isBookmarked field present

### Implementation for User Story 3

- [ ] T025 [US3] Verify memo list visual indicators (completed in T013 - validation only)
  - Confirm ★ character renders correctly
  - Confirm space character maintains alignment

- [ ] T026 [US3] Verify task list visual indicators (completed in T020 - validation only)
  - Confirm ★ character renders correctly for tasks

- [ ] T027 [US3] Modify memo view command in packages/cli/src/commands/memo/view.ts
  - Add bookmark status to text output (e.g., "Bookmarked: Yes/No" or use ★ indicator)
  - Ensure JSON output includes isBookmarked field

- [ ] T028 [P] [US3] Modify task view command in packages/cli/src/commands/task/view.ts
  - Same changes as T027 but for tasks

**Checkpoint**: All user stories should now be independently functional with complete visual feedback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T029 Run all tests to verify full functionality: `pnpm test`
- [ ] T030 Manual verification using quickstart.md scenarios
- [ ] T031 [P] Update CHANGELOG.md with bookmark feature (version 0.2.0)
- [ ] T032 [P] Verify CLI help text for new commands (`--help` output)
- [ ] T033 Code review: check for consistent error messages across memo/task commands
- [ ] T034 Performance check: verify bookmark operations complete in <2s
- [ ] T035 Final build verification: `pnpm build` succeeds

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 → US2 → US3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent (promotion integration with US1 is optional enhancement)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Validates US1 and US2 outputs

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Repository methods before CLI commands (Foundation phase handles this)
- CLI commands can be implemented in parallel
- List modifications can run in parallel with bookmark/unbookmark commands
- Validation tasks run after implementation

### Parallel Opportunities

- **Phase 1 (Setup)**: All tasks marked [P] can run in parallel (T002, T003, T004)
- **Phase 2 (Foundational)**: T005 and T006 can run in parallel
- **Phase 3 (US1)**:
  - Tests: T008, T009, T010 can run in parallel (write all tests first)
  - Implementation: T011 and T012 can run in parallel (different files)
- **Phase 4 (US2)**:
  - Tests: T014, T015, T016 can run in parallel
  - Implementation: T018 and T019 can run in parallel
- **Phase 5 (US3)**:
  - Tests: T022, T023, T024 can run in parallel
  - Implementation: T027 and T028 can run in parallel
- **Phase 6 (Polish)**: T031 and T032 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Write all US1 tests first (in parallel):
Task T008: "Integration test: memo bookmark command"
Task T009: "Integration test: memo unbookmark command"
Task T010: "Integration test: memo list --bookmarked filter"

# Then implement commands (in parallel):
Task T011: "Create memo bookmark command in packages/cli/src/commands/memo/bookmark.ts"
Task T012: "Create memo unbookmark command in packages/cli/src/commands/memo/unbookmark.ts"

# Then modify list (depends on T011, T012 being available for full testing):
Task T013: "Modify memo list command in packages/cli/src/commands/memo/list.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T007) - CRITICAL BLOCKING
3. Complete Phase 3: User Story 1 (T008-T013)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Repository layer ready
2. Add User Story 1 → Test independently → Memo bookmarking works! (MVP)
3. Add User Story 2 → Test independently → Task bookmarking + promotion works!
4. Add User Story 3 → Test independently → Visual indicators complete!
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T007)
2. Once Foundational is done:
   - Developer A: User Story 1 (T008-T013)
   - Developer B: User Story 2 (T014-T021)
   - Developer C: User Story 3 (T022-T028)
3. Stories complete and integrate independently
4. Team reunites for Polish phase (T029-T035)

---

## Task Summary

**Total Tasks**: 35

**By Phase**:
- Phase 1 (Setup): 4 tasks
- Phase 2 (Foundational): 3 tasks (BLOCKING)
- Phase 3 (US1): 6 tasks (3 tests + 3 implementation)
- Phase 4 (US2): 8 tasks (4 tests + 4 implementation)
- Phase 5 (US3): 7 tasks (3 tests + 4 implementation)
- Phase 6 (Polish): 7 tasks

**Parallel Opportunities**:
- Phase 1: 3 tasks can run in parallel
- Phase 2: 2 tasks can run in parallel
- Phase 3: 5 tasks can run in parallel (tests + commands)
- Phase 4: 6 tasks can run in parallel (tests + commands)
- Phase 5: 5 tasks can run in parallel (tests + view commands)
- Phase 6: 2 tasks can run in parallel

**Critical Path**: Phase 1 → Phase 2 (blocking) → Any User Story → Polish
**Estimated Time**: 4-6 hours (with tests, as noted in quickstart.md)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label (US1, US2, US3) maps task to specific user story
- [Foundation] label marks tasks that block all user stories
- Each user story is independently completable and testable
- TDD: Verify tests fail (RED) before implementing (GREEN)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Reference quickstart.md for detailed implementation guidance
- Reference contracts/cli-commands.md for exact command signatures
