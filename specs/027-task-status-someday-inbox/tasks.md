# Tasks: Add "inbox" and "someday" Task Statuses

**Input**: Design documents from `/home/user/meme-gtd/specs/027-task-status-someday-inbox/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Test tasks are NOT included below as they were not explicitly requested in the feature specification. Tests can be added separately if needed.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a **monorepo** with 8 packages:
- **Shared types**: `packages/shared/src/`
- **Database**: `packages/db/src/`
- **Core logic**: `packages/core/src/`
- **API**: `packages/api/src/`, `packages/api/docs/api/`
- **CLI**: `packages/cli/src/commands/`
- **Web UI**: `packages/web/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update shared TypeScript type definition that all packages depend on

- [ ] T001 Extend TaskStatus type in packages/shared/src/index.ts to include 'inbox' and 'someday' in GTD workflow order
- [ ] T002 Rebuild shared package to propagate type changes: `pnpm --filter meme-gtd-shared build`

**Checkpoint**: Shared types updated - all dependent packages can now reference new status values

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Update validation schemas and API contracts that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Update TaskStatusSchema in packages/api/src/schemas/taskSchemas.ts to include 'inbox' and 'someday' in GTD workflow order
- [ ] T004 Rebuild API package to propagate schema changes: `pnpm --filter meme-gtd-api build`
- [ ] T005 Regenerate OpenAPI specification from Zod schemas: `pnpm --filter meme-gtd-api openapi:generate`
- [ ] T006 Validate OpenAPI syntax: `pnpm --filter meme-gtd-api openapi:validate`
- [ ] T007 Regenerate Web UI TypeScript API client from updated OpenAPI spec: `pnpm --filter meme-gtd-web generate:api`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Capture Tasks to Inbox Without Classification (Priority: P1) 🎯 MVP

**Goal**: Enable users to create tasks with status="inbox" for unprocessed items, supporting GTD capture workflow

**Independent Test**:
1. Create task via CLI: `pnpm mgtd:test task create -t "Test inbox" --status inbox --no-editor`
2. Verify task exists: `pnpm mgtd:test task list --status inbox --json`
3. Expected: Task appears with status="inbox"

### Implementation for User Story 1

- [ ] T008 [P] [US1] Add 'inbox' and 'someday' to status options array in packages/cli/src/commands/task/create.ts (line 47)
- [ ] T009 [P] [US1] Update status description text in packages/cli/src/commands/task/create.ts to list all 8 statuses including inbox/someday (line 46)
- [ ] T010 [P] [US1] Add 'inbox' and 'someday' to status options array in packages/cli/src/commands/task/edit.ts
- [ ] T011 [P] [US1] Add 'inbox' and 'someday' to status filter options in packages/cli/src/commands/task/list.ts
- [ ] T012 [P] [US1] Update TaskStatus type definition in packages/web/src/components/TaskForm.tsx (line 9) to include 'inbox' and 'someday'
- [ ] T013 [P] [US1] Add `<option value="inbox">Inbox</option>` to status dropdown in packages/web/src/components/TaskForm.tsx (after line 163, before "Open")
- [ ] T014 [P] [US1] Add `<option value="someday">Someday</option>` to status dropdown in packages/web/src/components/TaskForm.tsx (after "Scheduled", before Done/Canceled conditional)
- [ ] T015 [US1] Rebuild CLI package: `pnpm --filter meme-gtd-cli build`
- [ ] T016 [US1] Rebuild Web package: `pnpm --filter meme-gtd-web build`
- [ ] T017 [US1] Manual test: Start dev API server (`pnpm server:dev`) and create task with inbox status via API
- [ ] T018 [US1] Manual test: Create task via CLI with `--status inbox` and verify with `task list --status inbox`
- [ ] T019 [US1] Manual test: Open Web UI (http://localhost:3001/tasks/new), verify dropdown includes Inbox/Someday, create task

**Checkpoint**: At this point, User Story 1 should be fully functional - users can create and filter inbox/someday tasks via all interfaces

---

## Phase 4: User Story 2 - Defer Tasks to Someday List (Priority: P1)

**Goal**: Enable users to update existing tasks to status="someday" for deferred ideas, completing GTD Someday/Maybe workflow

**Independent Test**:
1. Create task: `pnpm mgtd:test task create -t "Future idea" --status open --no-editor`
2. Update to someday: `pnpm mgtd:test task edit <id> --status someday`
3. Filter someday tasks: `pnpm mgtd:test task list --status someday --json`
4. Expected: Task appears with status="someday"

### Implementation for User Story 2

**Note**: Most implementation already completed in Phase 3 (CLI options, Web UI dropdown, API schemas all support both inbox AND someday)

- [ ] T020 [US2] Verify status update works via API: `curl -X PUT http://localhost:3001/api/tasks/1 -H "Content-Type: application/json" -d '{"status": "someday"}'`
- [ ] T021 [US2] Verify status filtering works via API: `curl http://localhost:3001/api/tasks?status=someday`
- [ ] T022 [US2] Manual test: Update existing task to "Someday" status via Web UI and verify persistence
- [ ] T023 [US2] Manual test: Navigate to `/tasks?status=someday` in browser and verify URL filtering works

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - full inbox/someday functionality is available

---

## Phase 5: User Story 3 - Filter and Search by New Statuses in Web UI (Priority: P2)

**Goal**: Enable URL-based filtering for inbox/someday statuses in Web UI, consistent with existing status filters

**Independent Test**:
1. Navigate to `http://localhost:3001/tasks?status=inbox`
2. Expected: Only tasks with status="inbox" are displayed
3. Navigate to `http://localhost:3001/tasks?status=someday`
4. Expected: Only tasks with status="someday" are displayed

### Implementation for User Story 3

**Note**: URL filtering is already implemented in existing Web UI routing and uses API query parameters, which were updated in Phase 2

- [ ] T024 [US3] Verify URL parameter routing in packages/web/src/pages/Tasks.tsx handles status=inbox correctly
- [ ] T025 [US3] Verify URL parameter routing in packages/web/src/pages/Tasks.tsx handles status=someday correctly
- [ ] T026 [US3] Manual test: Navigate to `/tasks?status=inbox` and verify correct filtering (no code changes expected)
- [ ] T027 [US3] Manual test: Navigate to `/tasks?status=someday` and verify correct filtering (no code changes expected)
- [ ] T028 [US3] Manual test: Verify status dropdown in task edit view includes Inbox/Someday options (packages/web/src/pages/TaskEdit.tsx)

**Checkpoint**: All user stories should now be independently functional - complete inbox/someday support across CLI, API, and Web UI

---

## Phase 6: Memo Promotion Default Status (FR-015 Requirement)

**Goal**: Change memo promotion default from status="open" to status="inbox" per GTD workflow

**Independent Test**:
1. Create memo: `pnpm mgtd:test memo create --body "Test memo" --no-editor`
2. Promote to task via Web UI without selecting status
3. Expected: Promoted task has status="inbox" (not "open")

### Implementation for Memo Promotion

- [ ] T029 [US-PROMO] Update validStatuses array in packages/web/src/components/TaskForm.tsx (line 54) to include 'inbox' at the beginning
- [ ] T030 [US-PROMO] Change default promotionStatus from 'open' to 'inbox' in packages/web/src/components/TaskForm.tsx (line 55)
- [ ] T031 [US-PROMO] Locate memo promotion logic in packages/core/src/memo.ts or packages/api/src/routes/memo.ts
- [ ] T032 [US-PROMO] Update backend memo promotion default status parameter from 'open' to 'inbox' (if parameter exists)
- [ ] T033 [US-PROMO] Rebuild Core package if modified: `pnpm --filter meme-gtd-core build`
- [ ] T034 [US-PROMO] Rebuild API package if routes modified: `pnpm --filter meme-gtd-api build`
- [ ] T035 [US-PROMO] Rebuild Web package: `pnpm --filter meme-gtd-web build`
- [ ] T036 [US-PROMO] Manual test: Create memo in Web UI, click "Promote to Task", verify default status is "Inbox"
- [ ] T037 [US-PROMO] Manual test: Promote memo via API and verify response has status="inbox"

**Checkpoint**: Memo promotion now defaults to inbox status, aligning with GTD capture workflow

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final verification

- [ ] T038 [P] Update CHANGELOG.md with new inbox/someday status values (MINOR version bump expected)
- [ ] T039 [P] Update README.md or user documentation to explain new status values and GTD workflow
- [ ] T040 [P] Update CLI help text description in packages/cli/src/commands/task/index.ts to mention inbox/someday
- [ ] T041 Verify all 18 functional requirements from spec.md are met (use quickstart.md checklist)
- [ ] T042 Verify all 6 success criteria from spec.md are met
- [ ] T043 Run full test suite: `pnpm test`
- [ ] T044 Build all packages: `pnpm build`
- [ ] T045 Perform end-to-end smoke test of all three user stories via CLI, API, and Web UI

**Checkpoint**: Feature complete, documented, and verified

---

## Dependencies & Execution Strategy

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation)
                ↓
    ┌───────────┴───────────┐
    ↓                       ↓
Phase 3 (US1: Inbox)   Phase 6 (Memo Promotion)
    ↓
Phase 4 (US2: Someday) ← depends on US1 infrastructure
    ↓
Phase 5 (US3: URL Filtering) ← depends on US1/US2 completion
    ↓
Phase 7 (Polish)
```

**Key Insight**: After Phase 2, User Story 1 and Memo Promotion can be implemented in parallel (different files).

### Parallel Execution Opportunities

**Within Phase 3 (User Story 1)**:
- Tasks T008-T014 can all run in parallel (marked with [P])
  - T008, T009: CLI create command (packages/cli/src/commands/task/create.ts)
  - T010: CLI edit command (packages/cli/src/commands/task/edit.ts)
  - T011: CLI list command (packages/cli/src/commands/task/list.ts)
  - T012-T014: Web UI TaskForm.tsx (different sections of same file - sequential editing)

**Within Phase 6 (Memo Promotion)**:
- Tasks T029-T030 (Web UI) can run in parallel with T031-T032 (Backend)

**Within Phase 7 (Polish)**:
- Tasks T038-T040 can all run in parallel (marked with [P])

### MVP Scope

**Minimum Viable Product** = Phase 1 + Phase 2 + Phase 3 (User Story 1)

This delivers core inbox status functionality:
- Users can create tasks with status="inbox"
- Users can filter inbox tasks
- Works across CLI, API, and Web UI

Phases 4-6 can be added incrementally after MVP validation.

---

## Implementation Summary

**Total Tasks**: 45 tasks
- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundation)**: 5 tasks
- **Phase 3 (US1 - Inbox)**: 12 tasks
- **Phase 4 (US2 - Someday)**: 4 tasks
- **Phase 5 (US3 - URL Filtering)**: 5 tasks
- **Phase 6 (Memo Promotion)**: 9 tasks
- **Phase 7 (Polish)**: 8 tasks

**Parallel Opportunities**: 11 tasks marked with [P] can run in parallel

**Estimated Time**: 2-3 hours (per quickstart.md)

**Risk Level**: Low (backward compatible, no database migration)

---

## Validation Checklist

### Functional Requirements Coverage

- **FR-001 to FR-006** (API support): ✅ Covered by T003-T007, T020-T021
- **FR-007 to FR-009** (CLI support): ✅ Covered by T008-T011, T018
- **FR-010 to FR-012** (Web UI support): ✅ Covered by T012-T014, T019, T022-T028
- **FR-013** (No workflow restrictions): ✅ Inherent in schema design (no code changes needed)
- **FR-014** (Default status remains "open"): ✅ No changes to default in create commands
- **FR-015** (Memo promotion defaults to "inbox"): ✅ Covered by T029-T037
- **FR-016** (Project board integration): ✅ No code changes needed (status is just a field)
- **FR-017** (GTD workflow order): ✅ Covered by T001, T003, T013-T014 (enum ordering)
- **FR-018** (Preserve existing tasks): ✅ No data migration, backward compatible

### Success Criteria Coverage

- **SC-001** (Performance <2s): ✅ No performance impact (enum extension only)
- **SC-002** (Persistence across interfaces): ✅ Covered by T015-T023
- **SC-003** (Filtering works everywhere): ✅ Covered by T018-T019, T024-T028
- **SC-004** (100% feature parity): ✅ Covered by all implementation tasks
- **SC-005** (Distinguish inbox vs someday): ✅ Covered by UI implementations (T012-T014)
- **SC-006** (Existing "open" tasks unchanged): ✅ No migration, backward compatible

**All requirements and success criteria are covered by the task breakdown above.**

---

## Next Steps

1. **Start with MVP**: Execute Phases 1-3 first (Tasks T001-T019)
2. **Validate MVP**: Test User Story 1 independently before proceeding
3. **Incremental delivery**: Add Phases 4-6 one at a time
4. **Polish**: Complete Phase 7 before merging to main

**Ready for implementation**: Use `/speckit:implement` to begin execution, or proceed manually following this task list.
