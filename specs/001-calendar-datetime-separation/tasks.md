# Tasks: Calendar Datetime Separation

**Input**: Design documents from `/specs/001-calendar-datetime-separation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDD required for backend (repository/API layer) per Testing Strategy in spec.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

## Path Conventions

This is a monorepo with:
- `packages/shared/src/` - Shared types
- `packages/db/src/` - Database repository
- `packages/api/src/` - Fastify API
- `packages/web/src/` - React frontend
- `packages/cli/src/` - CLI commands
- `schema/` - SQL migrations
- `docs/` - Documentation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema and shared types - foundation for all stories

- [x] T001 [Setup] Update migration file `schema/007_add_calendar_datetime_fields.sql` to add `notify_before_minutes INTEGER` column and `idx_issues_actual_start` index
- [x] T002 [Setup] Update `packages/shared/src/index.ts` to add new fields to IssueBase interface (scheduledStart, scheduledEnd, isAllDay, actualStart, actualEnd) with deprecation comments on old fields
- [x] T003 [Setup] Run migration on test database and verify columns exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Repository layer updates that ALL user stories depend on

**CRITICAL**: No user story can be implemented until repository supports new fields

### Tests First (TDD)

- [ ] T004 [P] [Found] Write test: create task with scheduledStart/scheduledEnd/isAllDay in `packages/db/test/taskRepository.test.ts`
- [ ] T005 [P] [Found] Write test: taskRowToTask mapper reads new columns in `packages/db/test/taskRepository.test.ts`
- [ ] T006 [P] [Found] Write test: updateTask with new datetime fields in `packages/db/test/taskRepository.test.ts`

### Implementation

- [ ] T007 [Found] Update `CreateTaskInput` interface in `packages/db/src/taskRepository.ts` to add scheduledStart, scheduledEnd, isAllDay fields
- [ ] T008 [Found] Update `UpdateTaskInput` interface in `packages/db/src/taskRepository.ts` to add scheduledStart, scheduledEnd, isAllDay, actualStart, actualEnd fields
- [ ] T009 [Found] Update `taskRowToTask` mapper in `packages/db/src/taskRepository.ts` to read new columns from database row
- [ ] T010 [Found] Update `createTask` function in `packages/db/src/taskRepository.ts` to write new fields to database
- [ ] T011 [Found] Update `updateTask` function in `packages/db/src/taskRepository.ts` to handle new fields
- [ ] T012 [Found] Remove writes to deprecated fields (scheduled_on, start_time, end_date, end_time) in createTask/updateTask

**Checkpoint**: Repository supports new datetime fields - user story implementation can begin

---

## Phase 3: User Story 1 - Schedule a Task with Specific Time (Priority: P1) MVP

**Goal**: Users can create/edit tasks with scheduled start/end times and see them on the calendar

**Independent Test**: Create task with scheduled times via API, verify it appears on calendar at correct position

### Tests First (TDD)

- [ ] T013 [P] [US1] Write API test: POST /api/tasks with scheduledStart/scheduledEnd returns task with new fields in `packages/api/test/taskHandlers.test.ts`
- [ ] T014 [P] [US1] Write API test: PATCH /api/tasks/{id} with scheduledStart/scheduledEnd updates correctly in `packages/api/test/taskHandlers.test.ts`
- [ ] T015 [P] [US1] Write API test: GET /api/tasks returns tasks with new datetime fields in `packages/api/test/taskHandlers.test.ts`

### Implementation - API Layer

- [ ] T016 [US1] Update Zod schemas in `packages/api/src/schemas/taskSchemas.ts` to add scheduledStart, scheduledEnd, isAllDay to create/update schemas
- [ ] T017 [US1] Update task response schema in `packages/api/src/schemas/taskSchemas.ts` to include new fields
- [ ] T018 [US1] Update `packages/api/src/handlers/taskHandlers.ts` createTask handler to pass new fields to repository
- [ ] T019 [US1] Update `packages/api/src/handlers/taskHandlers.ts` updateTask handler to pass new fields to repository
- [ ] T020 [US1] Update `packages/api/docs/api/openapi.yaml` to document new request/response fields

### Implementation - Web UI

- [ ] T021 [US1] Update `packages/web/src/utils/calendarMapper.ts` to use scheduledStart for event positioning (isAllDay for all-day detection)
- [ ] T022 [US1] Update `packages/web/src/components/ScheduleSection.tsx` to add scheduledStart/scheduledEnd datetime inputs
- [ ] T023 [US1] Update task create/edit form to send scheduledStart/scheduledEnd to API

### Implementation - CLI

- [ ] T024 [US1] Add `--scheduled-start` and `--scheduled-end` options to `packages/cli/src/commands/task/create.ts`
- [ ] T025 [US1] Add `--scheduled-start` and `--scheduled-end` options to `packages/cli/src/commands/task/edit.ts`

**Checkpoint**: Users can schedule tasks with specific times via CLI, API, and Web UI

---

## Phase 4: User Story 2 - Automatic Execution Time Recording (Priority: P1)

**Goal**: System auto-records actual_start on "next" and actual_end on "done" status change

**Independent Test**: Change task status to "next", verify actual_start is set; change to "done", verify actual_end is set

### Tests First (TDD)

- [ ] T026 [P] [US2] Write test: setTaskStatus to "next" auto-sets actual_start in `packages/db/test/taskRepository.test.ts`
- [ ] T027 [P] [US2] Write test: setTaskStatus to "done" auto-sets actual_end in `packages/db/test/taskRepository.test.ts`
- [ ] T028 [P] [US2] Write test: reopening task (done -> other) clears actual_end but preserves actual_start in `packages/db/test/taskRepository.test.ts`

### Implementation

- [ ] T029 [US2] Update `setTaskStatus` in `packages/db/src/taskRepository.ts` to auto-set actual_start when status changes to "next"
- [ ] T030 [US2] Update `setTaskStatus` in `packages/db/src/taskRepository.ts` to auto-set actual_end when status changes to "done"
- [ ] T031 [US2] Update `setTaskStatus` in `packages/db/src/taskRepository.ts` to clear actual_end when task is reopened from "done" status

**Checkpoint**: Status changes automatically record execution times

---

## Phase 5: User Story 3 - All-Day Event Handling (Priority: P2)

**Goal**: Users can create all-day events that span multiple days without specific times

**Independent Test**: Create task with isAllDay=true spanning Dec 7-9, verify it displays as all-day event on calendar

### Tests First (TDD)

- [ ] T032 [P] [US3] Write test: create task with isAllDay=true in `packages/db/test/taskRepository.test.ts`
- [ ] T033 [P] [US3] Write API test: task with isAllDay=true returns correctly in `packages/api/test/taskHandlers.test.ts`

### Implementation

- [ ] T034 [US3] Update `packages/web/src/components/ScheduleSection.tsx` to add isAllDay toggle switch
- [ ] T035 [US3] Update `packages/web/src/utils/calendarMapper.ts` to handle isAllDay flag for ScheduleX all-day events
- [ ] T036 [US3] Add `--all-day` flag to `packages/cli/src/commands/task/create.ts`
- [ ] T037 [US3] Add `--all-day` / `--no-all-day` flags to `packages/cli/src/commands/task/edit.ts`

**Checkpoint**: All-day events display correctly spanning multiple days

---

## Phase 6: User Story 4 - View and Edit Actual Execution Times (Priority: P2)

**Goal**: Users can view scheduled vs actual times separately and manually edit actual times

**Independent Test**: Open completed task, see both scheduled and actual times, edit actual_start and verify it saves

### Tests First (TDD)

- [ ] T038 [P] [US4] Write test: manual update of actualStart/actualEnd via updateTask in `packages/db/test/taskRepository.test.ts`
- [ ] T039 [P] [US4] Write API test: PATCH with actualStart/actualEnd overrides auto-set values in `packages/api/test/taskHandlers.test.ts`

### Implementation - API Layer

- [ ] T040 [US4] Update Zod schemas in `packages/api/src/schemas/taskSchemas.ts` to add actualStart, actualEnd to update schema
- [ ] T041 [US4] Update `packages/api/docs/api/openapi.yaml` to document actualStart/actualEnd in PATCH request

### Implementation - Web UI

- [ ] T042 [US4] Update `packages/web/src/components/calendar/TaskDetailPanel.tsx` to show separate "Scheduled" and "Actual" sections
- [ ] T043 [US4] Update `packages/web/src/components/ScheduleSection.tsx` to add actualStart/actualEnd datetime inputs with "Actual Execution" section
- [ ] T044 [US4] Update task edit form to send actualStart/actualEnd to API

### Implementation - CLI

- [ ] T045 [US4] Add `--actual-start` and `--actual-end` options to `packages/cli/src/commands/task/edit.ts`

**Checkpoint**: Users can view and manually edit actual execution times

---

## Phase 7: User Story 5 - Calendar Display Priority: Scheduled First, Actual as Fallback (Priority: P2)

**Goal**: Calendar shows tasks at scheduled position; if no scheduled time, falls back to actual time

**Independent Test**:
1. Task scheduled 13:00 completed at 16:00 -> appears at 13:00
2. Task with no scheduled time but actual_start -> appears at actual time

### Tests First (TDD)

- [ ] T046 [P] [US5] Write test: listTasks with calendarFrom/To returns tasks by scheduled time priority in `packages/db/test/taskRepository.test.ts`
- [ ] T047 [P] [US5] Write test: listTasks with calendarFrom/To returns tasks without scheduledStart if actualStart in range (fallback) in `packages/db/test/taskRepository.test.ts`
- [ ] T048 [P] [US5] Write API test: GET /api/tasks?calendarFrom=X&calendarTo=Y returns correct tasks in `packages/api/test/taskHandlers.test.ts`

### Implementation - Repository Layer

- [ ] T049 [US5] Add `calendarFrom` and `calendarTo` to `ListTaskFilters` in `packages/db/src/taskRepository.ts`
- [ ] T050 [US5] Update `listTasks` in `packages/db/src/taskRepository.ts` to implement fallback query: `(scheduledStart IN range) OR (scheduledStart IS NULL AND actualStart IN range)`

### Implementation - API Layer

- [ ] T051 [US5] Add calendarFrom/calendarTo query parameters to list endpoint in `packages/api/src/schemas/taskSchemas.ts`
- [ ] T052 [US5] Update `packages/api/src/handlers/taskHandlers.ts` listTasks to pass calendarFrom/calendarTo to repository
- [ ] T053 [US5] Update `packages/api/docs/api/openapi.yaml` to document calendarFrom/calendarTo query parameters

### Implementation - Web UI

- [ ] T054 [US5] Update `packages/web/src/pages/Calendar.tsx` to use calendarFrom/calendarTo API parameters instead of scheduledFrom/scheduledTo
- [ ] T055 [US5] Update `packages/web/src/utils/calendarMapper.ts` to use scheduledStart for position, fallback to actualStart if null

**Checkpoint**: Calendar displays tasks at scheduled position with actual time fallback

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, validation, and final cleanup

- [ ] T056 [P] [Polish] Update `docs/cli-commands.md` with new datetime options (--scheduled-start, --scheduled-end, --actual-start, --actual-end, --all-day)
- [ ] T057 [P] [Polish] Update `docs/requirements.md` with new data model fields and scheduled vs actual time concept
- [ ] T058 [P] [Polish] Add deprecation notices to OpenAPI spec for old fields (scheduledOn, startTime, endDate, endTime)
- [ ] T059 [Polish] Run `pnpm --filter meme-gtd-api openapi:validate` to verify OpenAPI spec consistency
- [ ] T060 [Polish] Run `pnpm --filter meme-gtd-api lint` and fix any issues
- [ ] T061 [Polish] Run full test suite: `pnpm --filter meme-gtd-api test` and `pnpm --filter meme-gtd-db test`
- [ ] T062 [Polish] Run `pnpm build` to verify build succeeds
- [ ] T063 [Polish] Manual testing: create task with scheduled time, change status, verify auto-timestamps, edit actual times

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - migration and types
- **Phase 2 (Foundational)**: Depends on Phase 1 - BLOCKS all user stories
- **Phase 3-7 (User Stories)**: All depend on Phase 2 completion
  - US1 and US2 are both P1 priority, can proceed in parallel
  - US3, US4, US5 are P2 priority, can proceed after Phase 2
- **Phase 8 (Polish)**: After all user stories complete

### User Story Dependencies

- **US1 (P1)**: Schedule tasks - After Foundational, no story dependencies
- **US2 (P1)**: Auto execution times - After Foundational, no story dependencies
- **US3 (P2)**: All-day events - After Foundational, independent
- **US4 (P2)**: Edit actual times - After Foundational, benefits from US2 but independent
- **US5 (P2)**: Calendar fallback - After Foundational, uses US1/US2 data but independent

### Within Each User Story

1. Tests MUST be written and FAIL before implementation (TDD)
2. Repository/DB before API
3. API before UI
4. Story complete before marking checkpoint

### Parallel Opportunities

**Phase 2 (Foundational)**:
- T004, T005, T006 can run in parallel (different test files)
- T007, T008 can run in parallel (different interfaces)

**User Stories**:
- US1 and US2 (both P1) can run in parallel
- US3, US4, US5 (all P2) can run in parallel after Foundational

**Within US1**:
- T013, T014, T015 can run in parallel (API tests)
- T021, T022, T023 can run in parallel with T024, T025 (Web vs CLI)

**Within US5**:
- T046, T047, T048 can run in parallel (tests)

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch all foundational tests in parallel:
Task: T004 "Write test: create task with scheduledStart/scheduledEnd/isAllDay"
Task: T005 "Write test: taskRowToTask mapper reads new columns"
Task: T006 "Write test: updateTask with new datetime fields"

# After tests written, implement sequentially:
Task: T007 "Update CreateTaskInput interface"
Task: T008 "Update UpdateTaskInput interface"
Task: T009 "Update taskRowToTask mapper"
```

## Parallel Example: User Story 1 (API + UI)

```bash
# After API tests written, launch API and UI in parallel:
# Developer A (API):
Task: T016 "Update Zod schemas"
Task: T017 "Update response schema"
Task: T018 "Update createTask handler"

# Developer B (UI + CLI):
Task: T021 "Update calendarMapper.ts"
Task: T024 "Add --scheduled-start to CLI"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Complete Phase 1: Setup (migration + types)
2. Complete Phase 2: Foundational (repository)
3. Complete Phase 3: User Story 1 (schedule tasks)
4. Complete Phase 4: User Story 2 (auto execution times)
5. **STOP and VALIDATE**: Core scheduling and tracking works
6. Deploy/demo MVP

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 → Test scheduling → Demo
3. Add US2 → Test auto-timestamps → Demo
4. Add US3 → Test all-day events → Demo
5. Add US4 → Test actual time editing → Demo
6. Add US5 → Test calendar fallback → Demo
7. Polish → Final release

---

## Summary

| Phase | Tasks | Purpose |
|-------|-------|---------|
| Setup | T001-T003 | Migration, types |
| Foundational | T004-T012 | Repository layer (BLOCKS all) |
| US1 (P1) | T013-T025 | Schedule tasks |
| US2 (P1) | T026-T031 | Auto execution times |
| US3 (P2) | T032-T037 | All-day events |
| US4 (P2) | T038-T045 | Edit actual times |
| US5 (P2) | T046-T055 | Calendar fallback |
| Polish | T056-T063 | Documentation, validation |

**Total Tasks**: 63
**MVP Tasks** (Setup + Foundational + US1 + US2): 31 tasks
