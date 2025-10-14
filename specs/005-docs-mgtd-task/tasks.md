# Tasks: mgtd task Command Implementation

**Input**: Design documents from `/specs/005-docs-mgtd-task/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD approach mandatory per plan.md - tests written FIRST, must FAIL before implementation

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo with pnpm workspaces
- Packages: `packages/cli/`, `packages/core/`, `packages/db/`, `packages/shared/`
- Tests: Per-package (e.g., `packages/db/test/`, `packages/cli/test/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend existing packages for task support

- [ ] T001 [P] Add Task type to `packages/shared/src/types.ts` (parallel to Memo type)
- [ ] T002 [P] Add TaskStatus type to `packages/shared/src/types.ts` ('open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled')
- [ ] T003 [P] Create task command directory structure: `packages/cli/src/commands/task/` (with subdirs: comment/, label/)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core repository and service layer that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundation (TDD - Write FIRST, ensure FAIL)

- [ ] T004 [P] Test: createTask() in `packages/db/test/taskRepository.test.ts` - Verify task creation with type='task'
- [ ] T005 [P] Test: getTask() in `packages/db/test/taskRepository.test.ts` - Verify type validation (reject memo IDs)
- [ ] T006 [P] Test: listTasks() in `packages/db/test/taskRepository.test.ts` - Verify filtering by status/label
- [ ] T007 [P] Test: updateTask() in `packages/db/test/taskRepository.test.ts` - Verify field updates
- [ ] T008 [P] Test: deleteTask() in `packages/db/test/taskRepository.test.ts` - Verify logical deletion
- [ ] T009 [P] Test: setTaskStatus() in `packages/db/test/taskRepository.test.ts` - Verify status transitions
- [ ] T010 [P] Test: TaskService methods in `packages/core/test/taskService.test.ts` - Verify service layer delegation

### Foundation Implementation

- [ ] T011 Create `packages/db/src/taskRepository.ts` with taskRowToTask helper (mirror memoRepository structure)
- [ ] T012 Implement createTask() in taskRepository.ts - Insert with type='task', attachLabels/Projects
- [ ] T013 Implement getTask() in taskRepository.ts - Include type validation logic
- [ ] T014 Implement listTasks() in taskRepository.ts - Support status, label, search (FTS5), bookmark filters
- [ ] T015 Implement updateTask() in taskRepository.ts - Handle title, body, status, scheduledOn, labels
- [ ] T016 Implement deleteTask() in taskRepository.ts - Logical deletion with type check
- [ ] T017 [P] Implement setTaskStatus() in taskRepository.ts - Direct status update for close/cancel/reopen
- [ ] T018 [P] Implement task comment functions in taskRepository.ts - addComment, updateComment, deleteComment, listComments (reuse comment helpers)
- [ ] T019 [P] Implement task label functions in taskRepository.ts - listTaskLabels, setTaskLabels (reuse label helpers)
- [ ] T020 [P] Implement setBookmark() for tasks in taskRepository.ts - Set is_bookmarked flag with type validation
- [ ] T021 Export all task repository functions from `packages/db/src/index.ts`
- [ ] T022 Create `packages/core/src/index.ts` modifications - Add TaskService class parallel to MemoService
- [ ] T023 Implement TaskService constructor and private db field in core/src/index.ts
- [ ] T024 Implement TaskService CRUD methods in core/src/index.ts - create, list, show, edit, remove (delegate to repository)
- [ ] T025 Implement TaskService state transition methods in core/src/index.ts - close, cancel, reopen (use setTaskStatus + optional addComment)
- [ ] T026 [P] Implement TaskService comment methods in core/src/index.ts - addComment, updateComment, deleteComment, listComments
- [ ] T027 [P] Implement TaskService label methods in core/src/index.ts - listLabels, setLabels
- [ ] T028 [P] Implement TaskService bookmark methods in core/src/index.ts - setBookmark
- [ ] T029 Export TaskService from `packages/core/src/index.ts` alongside MemoService

**Checkpoint**: Foundation ready - repository and service layers tested and working. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Create Task Directly (Priority: P1) 🎯 MVP

**Goal**: Users can create tasks with title, body, status, scheduled date, and labels

**Independent Test**: `mgtd task create --title "Test" --body "Content"` creates task #1 with type='task' and status='open'

### Tests for User Story 1 (TDD - Write FIRST)

- [ ] T030 [P] [US1] Test: task create command in `packages/cli/test/commands/task/create.test.ts` - Verify CLI flag parsing (title, body, status, scheduled-on, label)
- [ ] T031 [P] [US1] Test: task create --editor in create.test.ts - Verify editor launch when no body provided
- [ ] T032 [P] [US1] Test: task create validation in create.test.ts - Verify empty title error, invalid status error, invalid date format error
- [ ] T033 [P] [US1] Test: task create --json in create.test.ts - Verify JSON output format

### Implementation for User Story 1

- [ ] T034 [US1] Create `packages/cli/src/commands/task/create.ts` - Implement oclif command class with flags (title, body, body-file, editor, no-editor, status, scheduled-on, label, project, json)
- [ ] T035 [US1] Add legacy flag detection in task/create.ts - Detect --bodyFile, --scheduledOn camelCase and error with migration guidance
- [ ] T036 [US1] Implement editor logic in task/create.ts - Use maybePromptEditor() helper from lib/editor.js
- [ ] T037 [US1] Implement validation in task/create.ts - Validate title non-empty, status enum, scheduled-on date format (ISO 8601)
- [ ] T038 [US1] Call TaskService.create() in task/create.ts and format output (text or JSON)
- [ ] T039 [US1] Add task/create.ts metadata (summary, description, usage, examples)

**Checkpoint**: US1 Complete - Users can create tasks via CLI ✅

---

## Phase 4: User Story 2 - List and Filter Tasks (Priority: P1)

**Goal**: Users can view and filter tasks by status, label, search query, bookmark status

**Independent Test**: Create 3 tasks with different statuses, run `mgtd task list --status next`, verify only 'next' tasks shown

### Tests for User Story 2 (TDD - Write FIRST)

- [ ] T040 [P] [US2] Test: task list command in `packages/cli/test/commands/task/list.test.ts` - Verify flag parsing (status, label, search, limit, order, bookmarked, json)
- [ ] T041 [P] [US2] Test: task list --status in list.test.ts - Verify filtering by status
- [ ] T042 [P] [US2] Test: task list --label in list.test.ts - Verify filtering by label
- [ ] T043 [P] [US2] Test: task list --search in list.test.ts - Verify FTS5 search
- [ ] T044 [P] [US2] Test: task list --bookmarked in list.test.ts - Verify bookmark filtering
- [ ] T045 [P] [US2] Test: task list --json in list.test.ts - Verify JSON output format

### Implementation for User Story 2

- [ ] T046 [US2] Create `packages/cli/src/commands/task/list.ts` - Implement oclif command with flags (status, label, search, limit, order, bookmarked, json)
- [ ] T047 [US2] Call TaskService.list(filters) in task/list.ts
- [ ] T048 [US2] Format table output in task/list.ts - Mirror memo list format (★ for bookmarked, #ID, title preview, status, updatedAt)
- [ ] T049 [US2] Format JSON output in task/list.ts - Return { tasks: Task[] }
- [ ] T050 [US2] Add task/list.ts metadata (summary, description, usage, examples)

**Checkpoint**: US2 Complete - Users can list and filter tasks ✅

---

## Phase 5: User Story 3 - View Task Details (Priority: P1)

**Goal**: Users can view complete details of a single task including comments

**Independent Test**: `mgtd task view <id>` displays all task fields; `mgtd task view <memoId>` shows type error

### Tests for User Story 3 (TDD - Write FIRST)

- [ ] T051 [P] [US3] Test: task view command in `packages/cli/test/commands/task/view.test.ts` - Verify ID argument parsing
- [ ] T052 [P] [US3] Test: task view <id> in view.test.ts - Verify task details display (title, body, status, scheduledOn, labels, timestamps)
- [ ] T053 [P] [US3] Test: task view --comments in view.test.ts - Verify comment timeline display
- [ ] T054 [P] [US3] Test: task view type mismatch in view.test.ts - Verify error when ID is memo
- [ ] T055 [P] [US3] Test: task view --json in view.test.ts - Verify JSON output format

### Implementation for User Story 3

- [ ] T056 [US3] Create `packages/cli/src/commands/task/view.ts` - Implement oclif command with id arg and flags (comments, json)
- [ ] T057 [US3] Call TaskService.show(id) in task/view.ts and handle type mismatch error
- [ ] T058 [US3] Format text output in task/view.ts - Display title, status, body, labels, scheduledOn, timestamps
- [ ] T059 [US3] Implement --comments flag in task/view.ts - Call TaskService.listComments() and format timeline
- [ ] T060 [US3] Format JSON output in task/view.ts - Return full Task object with optional comments array
- [ ] T061 [US3] Add task/view.ts metadata (summary, description, usage, examples)

**Checkpoint**: US3 Complete - Users can view task details ✅

---

## Phase 6: User Story 4 - Update Task Properties (Priority: P2)

**Goal**: Users can edit task title, body, status, scheduled date, and labels

**Independent Test**: `mgtd task edit <id> --title "Updated"` persists change; `mgtd task edit <id> --add-label new` adds label without removing existing

### Tests for User Story 4 (TDD - Write FIRST)

- [ ] T062 [P] [US4] Test: task edit command in `packages/cli/test/commands/task/edit.test.ts` - Verify flag parsing (title, body, body-file, editor, no-editor, status, scheduled-on, add-label, remove-label, json)
- [ ] T063 [P] [US4] Test: task edit --title in edit.test.ts - Verify title update
- [ ] T064 [P] [US4] Test: task edit --status in edit.test.ts - Verify status update
- [ ] T065 [P] [US4] Test: task edit --add-label in edit.test.ts - Verify incremental label add
- [ ] T066 [P] [US4] Test: task edit --editor in edit.test.ts - Verify editor launch with current body
- [ ] T067 [P] [US4] Test: task edit validation in edit.test.ts - Verify empty title error, invalid status, invalid date

### Implementation for User Story 4

- [ ] T068 [US4] Create `packages/cli/src/commands/task/edit.ts` - Implement oclif command with id arg and flags
- [ ] T069 [US4] Add legacy flag detection in task/edit.ts - Detect --bodyFile, --addLabel, --removeLabel, --scheduledOn camelCase
- [ ] T070 [US4] Fetch existing task in task/edit.ts - Call TaskService.show(id)
- [ ] T071 [US4] Implement editor logic in task/edit.ts - Launch editor with current body if no --body and not --no-editor
- [ ] T072 [US4] Implement validation in task/edit.ts - Validate title, status, scheduled-on format
- [ ] T073 [US4] Call TaskService.edit() in task/edit.ts with update inputs
- [ ] T074 [US4] Format output in task/edit.ts - Text confirmation or JSON
- [ ] T075 [US4] Add task/edit.ts metadata

**Checkpoint**: US4 Complete - Users can edit task properties ✅

---

## Phase 7: User Story 5 - Change Task State (Priority: P2)

**Goal**: Users can close, cancel, and reopen tasks with optional comments

**Independent Test**: `mgtd task close <id>` sets status to 'done'; `mgtd task cancel <id> --comment "Reason"` sets status to 'canceled' and adds comment

### Tests for User Story 5 (TDD - Write FIRST)

- [ ] T076 [P] [US5] Test: task close command in `packages/cli/test/commands/task/close.test.ts` - Verify status change to 'done'
- [ ] T077 [P] [US5] Test: task close --comment in close.test.ts - Verify comment added
- [ ] T078 [P] [US5] Test: task cancel command in `packages/cli/test/commands/task/cancel.test.ts` - Verify status change to 'canceled'
- [ ] T079 [P] [US5] Test: task reopen command in `packages/cli/test/commands/task/reopen.test.ts` - Verify status change to 'open'
- [ ] T080 [P] [US5] Test: task close/cancel/reopen --json in respective test files - Verify JSON output

### Implementation for User Story 5

- [ ] T081 [P] [US5] Create `packages/cli/src/commands/task/close.ts` - Implement command with id arg and flags (comment, json)
- [ ] T082 [P] [US5] Create `packages/cli/src/commands/task/cancel.ts` - Implement command with id arg and flags (comment, json)
- [ ] T083 [P] [US5] Create `packages/cli/src/commands/task/reopen.ts` - Implement command with id arg and flag (json)
- [ ] T084 [US5] Call TaskService.close/cancel/reopen() in respective command files
- [ ] T085 [US5] Format output in close/cancel/reopen commands - Text confirmation or JSON
- [ ] T086 [P] [US5] Add metadata to close.ts, cancel.ts, reopen.ts

**Checkpoint**: US5 Complete - Users can transition task states ✅

---

## Phase 8: User Story 6 - Manage Task Comments (Priority: P3)

**Goal**: Users can add, edit, and delete comments on tasks

**Independent Test**: `mgtd task comment add <taskId> --body "Note"` creates comment; `mgtd task view <id> --comments` shows comment

### Tests for User Story 6 (TDD - Write FIRST)

- [ ] T087 [P] [US6] Test: task comment add in `packages/cli/test/commands/task/comment/add.test.ts` - Verify comment creation
- [ ] T088 [P] [US6] Test: task comment edit in `packages/cli/test/commands/task/comment/edit.test.ts` - Verify comment update and revision save
- [ ] T089 [P] [US6] Test: task comment delete in `packages/cli/test/commands/task/comment/delete.test.ts` - Verify logical deletion with confirmation

### Implementation for User Story 6

- [ ] T090 [P] [US6] Create `packages/cli/src/commands/task/comment/add.ts` - Mirror memo comment add structure
- [ ] T091 [P] [US6] Create `packages/cli/src/commands/task/comment/edit.ts` - Mirror memo comment edit structure
- [ ] T092 [P] [US6] Create `packages/cli/src/commands/task/comment/delete.ts` - Mirror memo comment delete structure (confirmation prompt, --yes flag)
- [ ] T093 [P] [US6] Create `packages/cli/src/commands/task/comment/index.ts` - Export comment subcommands
- [ ] T094 [US6] Implement comment add logic - Call TaskService.addComment(), handle editor, format output
- [ ] T095 [US6] Implement comment edit logic - Call TaskService.updateComment(), handle editor, format output
- [ ] T096 [US6] Implement comment delete logic - Confirmation prompt (reuse from memo delete), call TaskService.deleteComment()
- [ ] T097 [P] [US6] Add metadata to comment add.ts, edit.ts, delete.ts

**Checkpoint**: US6 Complete - Users can manage task comments ✅

---

## Phase 9: User Story 7 - Manage Task Labels (Priority: P3)

**Goal**: Users can add, set, and remove labels on tasks

**Independent Test**: `mgtd task label add <id> --label new` adds label; `mgtd task label set <id> --label a --label b` replaces all labels with a, b

### Tests for User Story 7 (TDD - Write FIRST)

- [ ] T098 [P] [US7] Test: task label add in `packages/cli/test/commands/task/label/add.test.ts` - Verify incremental label add
- [ ] T099 [P] [US7] Test: task label set in `packages/cli/test/commands/task/label/set.test.ts` - Verify label replacement
- [ ] T100 [P] [US7] Test: task label remove in `packages/cli/test/commands/task/label/remove.test.ts` - Verify label removal

### Implementation for User Story 7

- [ ] T101 [P] [US7] Create `packages/cli/src/commands/task/label/add.ts` - Mirror memo label add structure
- [ ] T102 [P] [US7] Create `packages/cli/src/commands/task/label/set.ts` - Mirror memo label set structure
- [ ] T103 [P] [US7] Create `packages/cli/src/commands/task/label/remove.ts` - Mirror memo label remove structure
- [ ] T104 [P] [US7] Create `packages/cli/src/commands/task/label/index.ts` - Export label subcommands
- [ ] T105 [US7] Implement label add logic - Call TaskService.edit({ addLabels }), format output
- [ ] T106 [US7] Implement label set logic - Call TaskService.setLabels(), format output
- [ ] T107 [US7] Implement label remove logic - Call TaskService.edit({ removeLabels }), format output
- [ ] T108 [P] [US7] Add metadata to label add.ts, set.ts, remove.ts

**Checkpoint**: US7 Complete - Users can manage task labels ✅

---

## Phase 10: User Story 8 - Bookmark/Unbookmark Tasks (Priority: P3)

**Goal**: Users can bookmark tasks for quick access and filter by bookmark status

**Independent Test**: `mgtd task bookmark <id>` sets bookmark; `mgtd task list --bookmarked` shows only bookmarked tasks

### Tests for User Story 8 (TDD - Write FIRST)

- [ ] T109 [P] [US8] Test: task bookmark in `packages/cli/test/commands/task/bookmark.test.ts` - Verify bookmark set (idempotent)
- [ ] T110 [P] [US8] Test: task unbookmark in `packages/cli/test/commands/task/unbookmark.test.ts` - Verify bookmark clear (idempotent)

### Implementation for User Story 8

- [ ] T111 [P] [US8] Create `packages/cli/src/commands/task/bookmark.ts` - Mirror memo bookmark structure
- [ ] T112 [P] [US8] Create `packages/cli/src/commands/task/unbookmark.ts` - Mirror memo unbookmark structure
- [ ] T113 [US8] Implement bookmark logic - Call TaskService.setBookmark(id, true), format output
- [ ] T114 [US8] Implement unbookmark logic - Call TaskService.setBookmark(id, false), format output
- [ ] T115 [P] [US8] Add metadata to bookmark.ts, unbookmark.ts

**Checkpoint**: US8 Complete - Users can bookmark tasks ✅

---

## Phase 11: Delete Task (Cross-Cutting)

**Goal**: Users can delete tasks with confirmation prompt

**Independent Test**: `mgtd task delete <id>` prompts for confirmation; `mgtd task delete <id> --yes` deletes without prompt

### Tests for Delete (TDD - Write FIRST)

- [ ] T116 [P] Test: task delete in `packages/cli/test/commands/task/delete.test.ts` - Verify confirmation prompt behavior
- [ ] T117 [P] Test: task delete --yes in delete.test.ts - Verify confirmation skip
- [ ] T118 [P] Test: task delete validation in delete.test.ts - Verify type mismatch error, non-TTY requires --yes

### Implementation for Delete

- [ ] T119 Create `packages/cli/src/commands/task/delete.ts` - Mirror memo delete structure (confirmation prompt, --yes flag, TTY detection)
- [ ] T120 Implement delete logic - Confirmation prompt (show task preview), call TaskService.remove(), format output
- [ ] T121 Add metadata to delete.ts

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Improvements affecting multiple user stories

- [ ] T122 [P] Create `packages/cli/src/commands/task/index.ts` - Export all task commands for oclif discovery
- [ ] T123 [P] Update CHANGELOG.md with v0.2.0 entry - Document all task commands, breaking changes (if any), migration guide
- [ ] T124 [P] Run integration tests across all task commands - Verify end-to-end workflows from quickstart.md
- [ ] T125 [P] Verify memo commands still work - Ensure backward compatibility (no regression)
- [ ] T126 Code cleanup - Extract common helpers if duplicated between memo/task (e.g., editor logic, confirmation prompts)
- [ ] T127 Performance validation - Run task list on 1000+ tasks, verify <1 second filtering (SC-002)
- [ ] T128 Type safety validation - Test memo ID rejection in all task commands (SC-003)
- [ ] T129 [P] Update README.md with task command examples
- [ ] T130 Run quickstart.md validation - Execute all examples from quickstart.md, verify outputs match

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Foundational phase completion
  - US1, US2, US3 (P1 stories) can proceed in parallel after Foundation
  - US4, US5 (P2 stories) can proceed in parallel after Foundation
  - US6, US7, US8 (P3 stories) can proceed in parallel after Foundation
- **Delete (Phase 11)**: Can proceed after Foundation (uses TaskService.remove)
- **Polish (Phase 12)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Create)**: No dependencies on other stories (only Foundation)
- **US2 (List)**: No dependencies on other stories (only Foundation)
- **US3 (View)**: No dependencies on other stories (only Foundation)
- **US4 (Edit)**: No dependencies on other stories (only Foundation)
- **US5 (State Transitions)**: No dependencies on other stories (only Foundation)
- **US6 (Comments)**: No dependencies on other stories (only Foundation)
- **US7 (Labels)**: No dependencies on other stories (only Foundation)
- **US8 (Bookmarks)**: No dependencies on other stories (only Foundation)

All user stories are independently testable and can be implemented in parallel.

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Repository/service layer before CLI commands
- CLI command implementation before metadata

### Parallel Opportunities

#### Phase 1 (Setup)
- T001, T002, T003 can all run in parallel (different files)

#### Phase 2 (Foundation - Tests)
- T004-T010 can all run in parallel (different test files)

#### Phase 2 (Foundation - Implementation)
- After T011 (taskRepository file created):
  - T012-T020 can run in parallel (different functions in same file but parallelizable if using good git practices)
- T021 (export) depends on T012-T020 completion
- After T022 (TaskService class created):
  - T024-T028 can run in parallel (different methods)
- T029 (export) depends on T023-T028 completion

#### User Stories (After Foundation Complete)
- All 8 user stories (Phase 3-10) can be worked on in parallel by different developers
- Within each story, tests can run in parallel
- Within each story, CLI command files can be created in parallel

**Example: US1 Parallel Execution**
```bash
# Tests (all parallel):
Task T030-T033 (all in different test scenarios, can parallelize)

# Implementation:
Task T034 (create.ts) - Independent
Task T035-T039 (modifications to create.ts) - Sequential
```

**Example: Multi-Story Parallel Execution**
```bash
# After Foundation (T001-T029) complete, launch in parallel:
Developer A: Phase 3 (US1) T030-T039
Developer B: Phase 4 (US2) T040-T050
Developer C: Phase 5 (US3) T051-T061
Developer D: Phase 6 (US4) T062-T075
Developer E: Phase 7 (US5) T076-T086
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T029) - CRITICAL
3. Complete Phase 3: US1 Create (T030-T039)
4. Complete Phase 4: US2 List (T040-T050)
5. Complete Phase 5: US3 View (T051-T061)
6. **STOP and VALIDATE**: Test create → list → view workflow
7. Deploy/demo if ready

**MVP Delivers**: Users can create tasks, list them, and view details. This covers core GTD workflow needs.

### Incremental Delivery

1. Complete Setup + Foundation → Foundation ready
2. Add US1 (Create) → Test independently → Deploy/Demo (MVP!)
3. Add US2 (List) → Test independently → Deploy/Demo
4. Add US3 (View) → Test independently → Deploy/Demo
5. Add US4 (Edit) → Test independently → Deploy/Demo
6. Add US5 (State) → Test independently → Deploy/Demo
7. Add US6-US8 (Comments/Labels/Bookmarks) → Test independently → Deploy/Demo
8. Add Delete → Test independently → Deploy/Demo
9. Polish phase → Final release

### Parallel Team Strategy

With 5 developers:

1. All developers complete Setup + Foundation together (T001-T029)
2. Once Foundation is done (checkpoint):
   - Developer A: US1 Create (T030-T039)
   - Developer B: US2 List (T040-T050)
   - Developer C: US3 View (T051-T061)
   - Developer D: US4 Edit (T062-T075)
   - Developer E: US5 State (T076-T086)
3. As developers finish:
   - Pick up US6-US8 and Delete
4. All developers collaborate on Polish phase

---

## Notes

- [P] tasks = different files, no dependencies within that task group
- [Story] label (US1-US8) maps task to specific user story for traceability
- Each user story is independently completable and testable
- TDD mandatory: Verify tests fail before implementing (run `pnpm test` after writing tests, expect failures)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Mirror memo command patterns for consistency (copy structure, adapt for tasks)
- Reuse existing helpers: editor.js, io.js, legacy-flags.js
- Type validation critical: Every task command must handle memo ID rejection gracefully

---

## Task Count Summary

- **Phase 1 (Setup)**: 3 tasks
- **Phase 2 (Foundation)**: 26 tasks (7 tests + 19 implementation)
- **Phase 3 (US1 - Create)**: 10 tasks (4 tests + 6 implementation)
- **Phase 4 (US2 - List)**: 11 tasks (6 tests + 5 implementation)
- **Phase 5 (US3 - View)**: 11 tasks (5 tests + 6 implementation)
- **Phase 6 (US4 - Edit)**: 14 tasks (6 tests + 8 implementation)
- **Phase 7 (US5 - State)**: 11 tasks (5 tests + 6 implementation)
- **Phase 8 (US6 - Comments)**: 11 tasks (3 tests + 8 implementation)
- **Phase 9 (US7 - Labels)**: 11 tasks (3 tests + 8 implementation)
- **Phase 10 (US8 - Bookmarks)**: 7 tasks (2 tests + 5 implementation)
- **Phase 11 (Delete)**: 6 tasks (3 tests + 3 implementation)
- **Phase 12 (Polish)**: 9 tasks

**Total**: 130 tasks

**Per User Story**:
- US1: 10 tasks
- US2: 11 tasks
- US3: 11 tasks
- US4: 14 tasks
- US5: 11 tasks
- US6: 11 tasks
- US7: 11 tasks
- US8: 7 tasks
- Foundation: 26 tasks (shared)
- Setup: 3 tasks (shared)
- Delete: 6 tasks (shared)
- Polish: 9 tasks (shared)

**Parallel Opportunities**: 60+ tasks marked [P] can run in parallel (different files or independent functions)

**Suggested MVP Scope**: Phase 1-5 (Setup + Foundation + US1 + US2 + US3) = 61 tasks
