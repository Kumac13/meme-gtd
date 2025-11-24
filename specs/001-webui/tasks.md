---
description: "Task list for Calendar View Web UI feature implementation"
---

# Tasks: Calendar View for Web UI

**Input**: Design documents from `/specs/001-webui/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-extension.yaml, quickstart.md

**Tests**: Not explicitly requested in feature spec - tests are OPTIONAL

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Monorepo structure**: packages/api/, packages/web/
- API: packages/api/src/
- Web: packages/web/src/

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependencies and configure adapters

- [ ] T001 Install @schedule-x/react @schedule-x/calendar @schedule-x/theme-default in packages/web
- [ ] T002 Install nuqs in packages/web
- [ ] T003 Configure NuqsAdapter in packages/web/src/App.tsx (wrap BrowserRouter)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API extension and routing structure that MUST be complete before calendar UI can work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 [P] Extend TaskQuerySchema with scheduledFrom/scheduledTo in packages/api/src/schemas/taskSchemas.ts
- [ ] T005 [P] Create calendar route in packages/web/src/App.tsx (/calendar)
- [ ] T006 Add Calendar tab to navigation in packages/web/src/components/Layout.tsx
- [ ] T007 Implement date range filter logic in packages/api/src/routes/tasks.ts
- [ ] T008 Create Calendar.tsx page component in packages/web/src/pages/Calendar.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Tasks on Monthly Calendar (Priority: P1) 🎯 MVP

**Goal**: Display scheduled tasks in monthly calendar format with status-based color coding

**Independent Test**: Open Calendar tab, verify monthly calendar shows scheduled tasks with Done=green, others=white, canceled excluded

### Implementation for User Story 1

- [ ] T009 [P] [US1] Create useCalendarState.ts hook in packages/web/src/hooks/useCalendarState.ts (manage view/date/taskId with nuqs)
- [ ] T010 [P] [US1] Create Task to CalendarEvent mapper utility in packages/web/src/utils/calendarMapper.ts
- [ ] T011 [US1] Implement CalendarView.tsx component in packages/web/src/components/calendar/CalendarView.tsx (integrate @schedule-x/calendar)
- [ ] T012 [US1] Add month view configuration to CalendarView.tsx
- [ ] T013 [US1] Implement task fetching in Calendar.tsx page with scheduledFrom/scheduledTo parameters
- [ ] T014 [US1] Map Task status to calendar tile colors in packages/web/src/components/calendar/TaskTile.tsx (Done=green-600, others=white)
- [ ] T015 [US1] Filter out status=canceled tasks in Calendar.tsx
- [ ] T016 [US1] Implement 10-item display limit with scroll in CalendarView.tsx for monthly view cells
- [ ] T017 [US1] Connect useCalendarState to Calendar.tsx and CalendarView.tsx

**Checkpoint**: At this point, User Story 1 should be fully functional - monthly calendar displays scheduled tasks with proper color coding

---

## Phase 4: User Story 2 - View Tasks on Weekly/Daily Calendar (Priority: P2)

**Goal**: Enable week/day views with time-based task placement (start_time → time slot, no start_time → all-day area)

**Independent Test**: Switch to week/day view, verify tasks with start_time appear in correct time slots, all-day tasks appear in top area

### Implementation for User Story 2

- [ ] T018 [P] [US2] Add week view configuration to CalendarView.tsx in packages/web/src/components/calendar/CalendarView.tsx
- [ ] T019 [P] [US2] Add day view configuration to CalendarView.tsx in packages/web/src/components/calendar/CalendarView.tsx
- [ ] T020 [US2] Create CalendarToolbar.tsx for view mode toggle in packages/web/src/components/calendar/CalendarToolbar.tsx
- [ ] T021 [US2] Implement time-slot logic in calendarMapper.ts (start_time present → time slot, absent → all-day)
- [ ] T022 [US2] Handle multi-day events (end_date > scheduled_on) in calendarMapper.ts for all-day area
- [ ] T023 [US2] Update useCalendarState to manage view mode (month/week/day)
- [ ] T024 [US2] Connect CalendarToolbar view toggle to useCalendarState in Calendar.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - month/week/day views all functional

---

## Phase 5: User Story 3 - Navigate Calendar (Priority: P2)

**Goal**: Provide navigation controls (Today, Previous, Next) to move between periods

**Independent Test**: Use navigation buttons to move to previous/next month, use Today button to return to current period

### Implementation for User Story 3

- [ ] T025 [P] [US3] Add Today button to CalendarToolbar.tsx in packages/web/src/components/calendar/CalendarToolbar.tsx
- [ ] T026 [P] [US3] Add Previous button to CalendarToolbar.tsx
- [ ] T027 [P] [US3] Add Next button to CalendarToolbar.tsx
- [ ] T028 [US3] Implement Today action in useCalendarState (reset date to today)
- [ ] T029 [US3] Implement Previous action in useCalendarState (decrement period based on view mode)
- [ ] T030 [US3] Implement Next action in useCalendarState (increment period based on view mode)
- [ ] T031 [US3] Update Calendar.tsx to refetch tasks when date changes

**Checkpoint**: All navigation should work - users can browse different periods and return to today

---

## Phase 6: User Story 4 - View and Edit Task from Calendar (Priority: P3)

**Goal**: Open task detail modal on tile click (right side 1/3 panel), enable editing with live calendar updates

**Independent Test**: Click task tile, verify modal appears on right, edit task (title/status/date), verify changes reflected in calendar

### Implementation for User Story 4

- [ ] T032 [US4] Add mode prop ('page' | 'modal') to ItemDetail.tsx in packages/web/src/components/ItemDetail.tsx
- [ ] T033 [US4] Add onClose prop to ItemDetail.tsx and hide back link in modal mode
- [ ] T034 [US4] Create TaskDetailModal.tsx wrapper in packages/web/src/components/calendar/TaskDetailModal.tsx
- [ ] T035 [US4] Style TaskDetailModal for right 1/3 panel layout (w-1/3, fixed right positioning)
- [ ] T036 [US4] Implement tile click handler in CalendarView.tsx to set taskId in useCalendarState
- [ ] T037 [US4] Render TaskDetailModal in Calendar.tsx when taskId is set
- [ ] T038 [US4] Implement modal close on outside click in TaskDetailModal.tsx
- [ ] T039 [US4] Handle task update events in Calendar.tsx to refetch and update calendar display
- [ ] T040 [US4] Update calendar tile when task status changes to done (green) or other (white)

**Checkpoint**: Task editing from calendar should be fully functional - edits immediately reflected

---

## Phase 7: User Story 5 - Persist Calendar State in URL (Priority: P3)

**Goal**: All calendar state (view mode, date, selected task) persisted in URL query params for bookmarking/sharing

**Independent Test**: Change view/date/task, verify URL updates, reload page or paste URL, verify state restored

### Implementation for User Story 5

- [ ] T041 [P] [US5] Configure view parameter serialization in useCalendarState.ts (parseAsStringEnum for month/week/day)
- [ ] T042 [P] [US5] Configure date parameter serialization in useCalendarState.ts (parseAsString with YYYY-MM-DD format)
- [ ] T043 [P] [US5] Configure taskId parameter serialization in useCalendarState.ts (parseAsInteger)
- [ ] T044 [US5] Test URL state restoration on Calendar.tsx mount (read from URL params)
- [ ] T045 [US5] Verify URL updates when view mode changes
- [ ] T046 [US5] Verify URL updates when date navigation occurs
- [ ] T047 [US5] Verify URL updates when task modal opens/closes

**Checkpoint**: All state should round-trip through URL - bookmark any calendar state and restore perfectly

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Refinements and documentation that affect the overall feature

- [ ] T048 [P] Add CSS classes for task status colors in packages/web/src/index.css (.task-done, .task-pending)
- [ ] T049 [P] Import @schedule-x theme CSS in packages/web/src/App.tsx
- [ ] T050 Optimize task fetching to minimize API calls (only fetch visible date range)
- [ ] T051 Add loading states to Calendar.tsx during task fetches
- [ ] T052 Add error handling for task fetch failures in Calendar.tsx
- [ ] T053 Test performance with 100 tasks in a single month
- [ ] T054 Test scroll performance with 50 tasks in a single day
- [ ] T055 Validate against quickstart.md manual testing steps
- [ ] T056 Update documentation if needed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P2 → P3 → P3)
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories ✅ INDEPENDENT
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 CalendarView component but extends it ✅ MOSTLY INDEPENDENT
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Adds navigation to existing calendar ✅ MOSTLY INDEPENDENT
- **User Story 4 (P3)**: Can start after US1 complete - Requires calendar display working ⚠️ DEPENDS ON US1
- **User Story 5 (P3)**: Can start after Foundational (Phase 2) - URL state independent of display ✅ INDEPENDENT (but best after UI complete)

### Within Each User Story

- Tasks marked [P] can run in parallel (different files)
- Mapper/utilities before components that use them
- Components before pages that compose them
- State management before components that consume state

### Parallel Opportunities

- **Setup (Phase 1)**: T001 and T002 in parallel (different packages)
- **Foundational (Phase 2)**: T004 and T005 and T006 in parallel (different files)
- **User Story 1**: T009 and T010 in parallel (different files)
- **User Story 2**: T018 and T019 in parallel (same file, different view configs)
- **User Story 3**: T025, T026, T027 in parallel (same file, different buttons - can draft in parallel)
- **User Story 5**: T041, T042, T043 in parallel (same file, different params)
- **Polish (Phase 8)**: T048 and T049 in parallel (different files)

---

## Parallel Example: User Story 1

```bash
# Launch these tasks in parallel for User Story 1:
Task T009: Create useCalendarState.ts hook (hooks/useCalendarState.ts)
Task T010: Create Task to CalendarEvent mapper (utils/calendarMapper.ts)

# Then proceed sequentially:
Task T011: CalendarView.tsx component (uses both hook and mapper)
Task T012: Add month view configuration
# ... and so on
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install dependencies)
2. Complete Phase 2: Foundational (API extension, routing, tab)
3. Complete Phase 3: User Story 1 (monthly calendar display)
4. **STOP and VALIDATE**: Test monthly calendar independently
5. Deploy/demo if ready ✅ **This is your MVP - calendar viewing works!**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! 🎯 Monthly calendar works)
3. Add User Story 2 → Test independently → Deploy/Demo (Week/Day views added)
4. Add User Story 3 → Test independently → Deploy/Demo (Navigation added)
5. Add User Story 4 → Test independently → Deploy/Demo (Editing from calendar added)
6. Add User Story 5 → Test independently → Deploy/Demo (URL bookmarking added)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers (after Foundational complete):

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (monthly calendar)
   - Developer B: User Story 2 (week/day views) + User Story 3 (navigation)
   - Developer C: User Story 5 (URL state)
3. After US1 complete:
   - Developer A: User Story 4 (task editing modal)
4. Stories integrate at the end

---

## Notes

- [P] tasks = different files, no dependencies within that batch
- [Story] label maps task to specific user story from spec.md
- Each user story should be independently completable and testable
- Tests are NOT included (not requested in spec.md)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, breaking previous user stories

---

## Summary

- **Total Tasks**: 56
- **User Story 1 Tasks**: 9 (T009-T017) - Monthly calendar display
- **User Story 2 Tasks**: 7 (T018-T024) - Week/day views
- **User Story 3 Tasks**: 7 (T025-T031) - Navigation
- **User Story 4 Tasks**: 9 (T032-T040) - Task editing modal
- **User Story 5 Tasks**: 7 (T041-T047) - URL state persistence
- **Setup/Foundation Tasks**: 8 (T001-T008)
- **Polish Tasks**: 9 (T048-T056)

**Parallel Opportunities**: 12 tasks marked [P] across all phases

**MVP Scope**: Setup + Foundational + User Story 1 = 17 tasks for working monthly calendar

**Independent Test Criteria**: Each user story has clear validation steps in spec.md acceptance scenarios
