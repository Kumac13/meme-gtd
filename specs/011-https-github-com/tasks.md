# Tasks: Include Labels in API Responses

**Input**: Design documents from `/specs/011-https-github-com/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included as this feature modifies existing tested endpoints.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo**: `packages/api/`, `packages/core/`, `packages/cli/`, `packages/web/`
- Paths follow existing meme-gtd structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and verification

- [ ] T001 Verify branch `011-https-github-com` is checked out
- [ ] T002 Verify all packages build successfully: `pnpm build`
- [ ] T003 [P] Verify all tests pass: `pnpm test`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Verify existing label query functions in packages/db/src/memoRepository.ts (listMemoLabels)
- [ ] T005 [P] Verify existing label query functions in packages/db/src/taskRepository.ts (listTaskLabels)

**Checkpoint**: Foundation verified - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Labels in Web UI (Priority: P1) 🎯 MVP

**Goal**: Enable Web UI to display labels for memos and tasks by including label data in API responses

**Independent Test**: Create memo/task with labels via CLI, view in Web UI, verify labels are displayed

### Update API Schemas for User Story 1

- [ ] T006 [P] [US1] Update MemoSchema in packages/api/src/schemas/memoSchemas.ts to include labels field
- [ ] T007 [P] [US1] Update TaskSchema in packages/api/src/schemas/taskSchemas.ts to include labels field
- [ ] T008 [P] [US1] Update MemoDetailSchema in packages/api/src/schemas/memoSchemas.ts to include labels in required fields
- [ ] T009 [P] [US1] Update TaskDetailSchema in packages/api/src/schemas/taskSchemas.ts to include labels in required fields

### Update Core Services for User Story 1

- [ ] T010 [US1] Update MemoService.list() in packages/core/src/index.ts to fetch and include labels
- [ ] ] T011 [US1] Update MemoService.show() in packages/core/src/index.ts to fetch and include labels
- [ ] T012 [US1] Update TaskService.list() in packages/core/src/index.ts to fetch and include labels
- [ ] T013 [US1] Update TaskService.show() in packages/core/src/index.ts to fetch and include labels

### Update API Integration Tests for User Story 1

- [ ] T014 [US1] Update memo list test in packages/api/test/integration/memos.test.ts to assert labels field
- [ ] T015 [US1] Update memo detail test in packages/api/test/integration/memos.test.ts to assert labels field
- [ ] T016 [US1] Add test for memo with labels in packages/api/test/integration/memos.test.ts
- [ ] T017 [US1] Add test for memo without labels (empty array) in packages/api/test/integration/memos.test.ts
- [ ] T018 [US1] Update task list test in packages/api/test/integration/tasks.test.ts to assert labels field
- [ ] T019 [US1] Update task detail test in packages/api/test/integration/tasks.test.ts to assert labels field
- [ ] T020 [US1] Add test for task with labels in packages/api/test/integration/tasks.test.ts
- [ ] T021 [US1] Add test for task without labels (empty array) in packages/api/test/integration/tasks.test.ts

### Build and Test for User Story 1

- [ ] T022 [US1] Build API package: `pnpm --filter meme-gtd-api build`
- [ ] T023 [US1] Run API tests: `pnpm --filter meme-gtd-api test`
- [ ] T024 [US1] Verify all tests pass

### Regenerate OpenAPI and Web Client for User Story 1

- [ ] T025 [US1] Regenerate OpenAPI spec: `pnpm --filter meme-gtd-api openapi:generate`
- [ ] T026 [US1] Verify labels field in packages/api/docs/api/openapi.yaml
- [ ] T027 [US1] Regenerate Web UI API client using pnpx openapi-typescript-codegen
- [ ] T028 [US1] Build Web UI: `pnpm --filter meme-gtd-web build`

### Manual Validation for User Story 1

- [ ] T029 [US1] Start API server: `pnpm server:dev`
- [ ] T030 [US1] Create test memo with labels via CLI: `mgtd memo create --body "Test" --label test`
- [ ] T031 [US1] Create test task with labels via CLI: `mgtd task create --title "Test" --body "Test" --label bug`
- [ ] T032 [US1] Start Web UI: `pnpm dev:web`
- [ ] T033 [US1] Verify labels displayed in Web UI memo list
- [ ] T034 [US1] Verify labels displayed in Web UI task list
- [ ] T035 [US1] Verify labels displayed in Web UI memo detail
- [ ] T036 [US1] Verify labels displayed in Web UI task detail

**Checkpoint**: At this point, User Story 1 should be fully functional - Web UI displays labels

---

## Phase 4: User Story 2 - Filter by Labels in Web UI (Priority: P2)

**Goal**: Ensure API responses contain complete label arrays for future Web UI filtering features

**Independent Test**: Verify API responses include all labels for each item that can be used for client-side filtering

**Note**: This user story is already complete with User Story 1 implementation. The API now includes labels in all responses, enabling future filtering without additional backend changes.

### Validation for User Story 2

- [ ] T037 [US2] Verify API response includes labels array: `curl http://localhost:3000/api/memos | jq '.[0].labels'`
- [ ] T038 [US2] Verify API response includes labels array: `curl http://localhost:3000/api/tasks | jq '.[0].labels'`
- [ ] T039 [US2] Verify multiple labels are included in response for items with multiple labels

**Checkpoint**: API responses confirmed to support future filtering capabilities

---

## Phase 5: User Story 3 - View Labels in CLI JSON Output (Priority: P3)

**Goal**: Include labels in CLI JSON output for programmatic processing

**Independent Test**: Run `mgtd memo list --json` and verify labels array is present

### Update CLI Formatters for User Story 3

- [ ] T040 [P] [US3] Update memo list formatter in packages/cli/src/commands/memo/list.ts to display labels
- [ ] T041 [P] [US3] Update memo view formatter in packages/cli/src/commands/memo/view.ts to display labels
- [ ] T042 [P] [US3] Update task list formatter in packages/cli/src/commands/task/list.ts to display labels
- [ ] T043 [P] [US3] Update task view formatter in packages/cli/src/commands/task/view.ts to display labels

### Build and Test CLI for User Story 3

- [ ] T044 [US3] Build CLI package: `pnpm --filter meme-gtd-cli build`
- [ ] T045 [US3] Test memo list JSON output: `mgtd memo list --json`
- [ ] T046 [US3] Verify labels array present in JSON output
- [ ] T047 [US3] Test task list JSON output: `mgtd task list --json`
- [ ] T048 [US3] Verify labels array present in JSON output
- [ ] T049 [US3] Test memo view with labels displayed in human-readable format: `mgtd memo view <id>`
- [ ] T050 [US3] Test task view with labels displayed in human-readable format: `mgtd task view <id>`

**Checkpoint**: All user stories complete - CLI displays labels in both JSON and human-readable formats

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

- [ ] T051 [P] Run full test suite: `pnpm test`
- [ ] T052 [P] Build all packages: `pnpm build`
- [ ] T053 Verify performance: response time increase <50ms for list endpoints
- [ ] T054 [P] Update GitHub Issue #30 with completion status
- [ ] T055 Run quickstart.md validation checklist

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - User Story 1 must complete before User Story 2 validation (US2 depends on US1 implementation)
  - User Story 3 can start immediately after Foundational (independent of US1/US2)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Automatically complete with User Story 1 (no additional implementation needed)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Independent of US1/US2

### Within Each User Story

- Schema updates before service updates (T006-T009 before T010-T013)
- Service updates before test updates (T010-T013 before T014-T021)
- Tests before build (T014-T021 before T022)
- Build before OpenAPI regeneration (T022 before T025)
- OpenAPI regeneration before Web client regeneration (T025 before T027)

### Parallel Opportunities

**Phase 1 (Setup)**:
- T002 and T003 can run in parallel

**Phase 2 (Foundational)**:
- T004 and T005 can run in parallel

**Phase 3 (User Story 1)**:
- T006, T007, T008, T009 can all run in parallel (different schema files)
- After schemas done: T010, T011, T012, T013 can run sequentially (same file)
- T014-T021 can be done in pairs: (T014, T015), (T016, T017), (T018, T019), (T020, T021)

**Phase 5 (User Story 3)**:
- T040, T041, T042, T043 can all run in parallel (different command files)

**Phase 6 (Polish)**:
- T051 and T052 can run in parallel

---

## Parallel Example: User Story 1 Schema Updates

```bash
# Launch all schema updates together:
Task: "Update MemoSchema in packages/api/src/schemas/memoSchemas.ts"
Task: "Update TaskSchema in packages/api/src/schemas/taskSchemas.ts"
Task: "Update MemoDetailSchema in packages/api/src/schemas/memoSchemas.ts"
Task: "Update TaskDetailSchema in packages/api/src/schemas/taskSchemas.ts"
```

## Parallel Example: User Story 3 CLI Formatters

```bash
# Launch all CLI formatter updates together:
Task: "Update memo list formatter in packages/cli/src/commands/memo/list.ts"
Task: "Update memo view formatter in packages/cli/src/commands/memo/view.ts"
Task: "Update task list formatter in packages/cli/src/commands/task/list.ts"
Task: "Update task view formatter in packages/cli/src/commands/task/view.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005)
3. Complete Phase 3: User Story 1 (T006-T036)
4. **STOP and VALIDATE**: Web UI displays labels
5. Deploy/demo if ready

**Result**: Core functionality complete - Web UI can display labels

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (T001-T005)
2. Add User Story 1 → Test independently → Deploy/Demo (T006-T036) **MVP!**
3. Validate User Story 2 → Already complete with US1 (T037-T039)
4. Add User Story 3 → Test independently → Deploy/Demo (T040-T050)
5. Polish → Final validation (T051-T055)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T005)
2. Once Foundational is done:
   - Developer A: User Story 1 (T006-T036) - Primary focus
   - Developer B: Can start User Story 3 (T040-T050) in parallel
3. User Story 2 validation can be done by either developer after US1 completes

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- User Story 2 requires no additional implementation - it's automatically satisfied by User Story 1

---

## Summary

**Total Tasks**: 55
**Tasks per User Story**:
- Setup (Phase 1): 3 tasks
- Foundational (Phase 2): 2 tasks
- User Story 1 (P1 - MVP): 31 tasks
- User Story 2 (P2): 3 tasks (validation only)
- User Story 3 (P3): 11 tasks
- Polish (Phase 6): 5 tasks

**Parallel Opportunities**: 13 parallel task groups identified
**MVP Scope**: User Story 1 (Web UI label display) - 31 tasks
**Independent Test Criteria**: Each user story has clear validation steps
