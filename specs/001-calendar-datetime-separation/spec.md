# Feature Specification: Calendar Datetime Separation

**Feature Branch**: `001-calendar-datetime-separation`
**Created**: 2025-12-07
**Status**: Draft
**Input**: User description: "Separate scheduled (planned) times from actual (executed) times for tasks, with calendar displaying scheduled times and detail panel showing both"

## Clarifications

### Session 2025-12-07

- Q: How should tasks without scheduled times but with actual times appear on the calendar? → A: Scheduled times take priority; if no scheduled times exist, display at actual execution times (fallback).
- Q: Calendar query filter logic? → A: Query must be `(scheduledStart IN range) OR (scheduledStart IS NULL AND actualStart IN range)` to support fallback display.
- Q: Data migration for done tasks? → A: Done tasks get scheduled_on+start_time migrated to actual_start, and end_date+end_time to actual_end.
- Q: Can users edit actual_start/actual_end freely? → A: Yes, via CLI, API, and Web UI.
- Q: Can users toggle is_all_day? → A: Yes, via CLI (`--all-day`/`--no-all-day`), API, and Web UI.
- Q: Is documentation update required? → A: Yes, docs/cli-commands.md and docs/requirements.md must be updated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Schedule a Task with Specific Time (Priority: P1)

A user wants to schedule a meeting or task for a specific date and time so they can see it on their calendar at that exact time slot.

**Why this priority**: Core functionality - without scheduling capability, the calendar has no events to display.

**Independent Test**: Can be fully tested by creating a task with scheduled start/end times and verifying it appears on the calendar at the correct position.

**Acceptance Scenarios**:

1. **Given** a user is creating a new task, **When** they set a scheduled start time of "2025-01-15 09:00" and end time of "2025-01-15 10:00", **Then** the task appears on the calendar at the 09:00-10:00 slot on January 15th.

2. **Given** a user is editing an existing task, **When** they add or modify the scheduled times, **Then** the calendar updates to reflect the new time slot.

3. **Given** a task has scheduled times, **When** the user views the calendar, **Then** the task is displayed at its scheduled position regardless of its completion status.

---

### User Story 2 - Automatic Execution Time Recording (Priority: P1)

A user wants the system to automatically record when they actually started and finished a task, so they can later review how their planned schedule compared to reality.

**Why this priority**: Core functionality for execution tracking - enables the "what did I actually do" use case.

**Independent Test**: Can be tested by changing a task's status to "next" and then "done" and verifying actual_start and actual_end are recorded.

**Acceptance Scenarios**:

1. **Given** a task exists in any status, **When** the user changes the status to "next", **Then** the system automatically records the current date/time as the actual start time.

2. **Given** a task is in "next" status, **When** the user changes the status to "done", **Then** the system automatically records the current date/time as the actual end time.

3. **Given** a task with auto-recorded actual times, **When** the user opens the task details, **Then** they can see both the scheduled times and the actual execution times.

---

### User Story 3 - All-Day Event Handling (Priority: P2)

A user wants to create tasks that span an entire day or multiple days without specifying exact times, so they can track events like "vacation" or "conference" that don't have specific hour-based schedules.

**Why this priority**: Important for common use cases like holidays, multi-day events, and tasks without specific time requirements.

**Independent Test**: Can be tested by creating a task marked as all-day spanning multiple dates and verifying correct calendar display.

**Acceptance Scenarios**:

1. **Given** a user is creating a task, **When** they mark it as "all-day" and set dates December 7-9, **Then** the task appears as an all-day event spanning those three days on the calendar.

2. **Given** an all-day event exists, **When** viewing the calendar, **Then** it displays in the all-day section, not as a timed event.

3. **Given** an existing timed task, **When** the user toggles "all-day" on, **Then** the specific times are hidden and the task becomes an all-day event.

---

### User Story 4 - View and Edit Actual Execution Times (Priority: P2)

A user wants to view and manually correct the automatically recorded execution times when they don't accurately reflect when work actually happened.

**Why this priority**: Allows users to maintain accurate execution records for review and analysis.

**Independent Test**: Can be tested by opening a completed task's detail panel and modifying the actual start/end times.

**Acceptance Scenarios**:

1. **Given** a completed task with auto-recorded actual times, **When** the user opens the task detail panel, **Then** they see separate sections for "Scheduled" times and "Actual" times.

2. **Given** the actual times are displayed, **When** the user edits the actual start or end time, **Then** the system saves the manually entered values.

3. **Given** a task that was interrupted and resumed, **When** the user needs to correct the actual times, **Then** they can manually set times that differ from the auto-recorded values.

---

### User Story 5 - Calendar Display Priority: Scheduled First, Actual as Fallback (Priority: P2)

A user wants to see tasks on the calendar at their originally scheduled times; if no scheduled times exist, the task appears at its actual execution times so all work is visible.

**Why this priority**: Ensures calendar shows planned schedule when available, but still captures unplanned work for visibility.

**Independent Test**: Can be tested by completing a task at a different time than scheduled and verifying calendar position.

**Acceptance Scenarios**:

1. **Given** a task scheduled for 13:00-14:00, **When** the user completes it at 16:00, **Then** the task remains displayed at 13:00-14:00 on the calendar.

2. **Given** a completed task with scheduled times, **When** viewing the calendar, **Then** the task appears at its scheduled position with a visual indicator of completion status.

3. **Given** a task without scheduled times but with actual times, **When** viewing the calendar, **Then** the task appears on the calendar at its actual execution time (fallback display).

---

### Edge Cases

- What happens when a task has no scheduled times? The task appears on the calendar at its actual execution times (if recorded via status changes); if neither scheduled nor actual times exist, the task does not appear on the calendar.
- What happens when a user sets actual_start but not actual_end? The system displays the partial execution data in the detail panel.
- What happens when scheduled_end is before scheduled_start? The system should validate and prevent this invalid state.
- What happens to existing data during migration? Old scheduling fields are migrated to new fields; done tasks get their scheduled_on+start_time moved to actual_start and end_date+end_time moved to actual_end.
- What happens when a task is reopened after being done? The actual_end is cleared, but actual_start is preserved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST store scheduled times separately from actual execution times for each task.
- **FR-002**: System MUST provide fields for scheduled start datetime, scheduled end datetime, and all-day flag.
- **FR-003**: System MUST provide fields for actual start datetime and actual end datetime.
- **FR-004**: System MUST automatically set actual_start to current datetime when task status changes to "next".
- **FR-005**: System MUST automatically set actual_end to current datetime when task status changes to "done".
- **FR-006**: System MUST allow users to manually edit actual_start and actual_end values via CLI, API, and Web UI.
- **FR-007**: System MUST display tasks on the calendar based on scheduled times (priority), falling back to actual times if no scheduled times exist.
- **FR-008**: System MUST display both scheduled and actual times in the task detail panel.
- **FR-009**: System MUST support all-day events that span one or multiple days, with is_all_day toggle available via CLI, API, and Web UI.
- **FR-010**: System MUST migrate existing scheduling data to new field structure without data loss.
- **FR-011**: System MUST preserve deprecated fields as read-only for rollback safety.
- **FR-012**: System MUST filter calendar view by time range, querying tasks where (scheduledStart is in range) OR (scheduledStart is null AND actualStart is in range).
- **FR-013**: System MUST provide notification preparation field (notify_before_minutes) for future notification feature.
- **FR-014**: Documentation in docs/ MUST be updated to reflect new datetime fields, CLI options, and API changes.

### Key Entities

- **Task Scheduling Data**: Represents when a task is planned to occur
  - scheduled_start: The planned start datetime
  - scheduled_end: The planned end datetime
  - is_all_day: Whether this is an all-day event (no specific hours)

- **Task Execution Data**: Represents when a task was actually performed
  - actual_start: When work actually began (auto-set on "next" status)
  - actual_end: When work actually finished (auto-set on "done" status)

- **Notification Preparation**: Structure for future notification feature
  - notify_before_minutes: Minutes before scheduled_start to send notification (null = no notification)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can schedule tasks with specific times and see them appear correctly on the calendar.
- **SC-002**: Actual execution times are automatically captured when users change task status, reducing manual time tracking effort.
- **SC-003**: Users can view their planned schedule (calendar) separately from their execution history (task details).
- **SC-004**: All-day events display correctly across multiple days on the calendar.
- **SC-005**: Existing task data is preserved during migration with no loss of scheduling information.
- **SC-006**: Users can manually correct auto-recorded execution times when needed.
- **SC-007**: Completed tasks remain at their scheduled calendar position, maintaining the calendar as a planning view.

## Assumptions

- Users operate in a single timezone (Asia/Tokyo is currently hardcoded in the calendar UI).
- All datetime values are stored as local time without timezone offset (YYYY-MM-DDTHH:MM:SS format).
- The existing deprecated fields (scheduled_on, start_time, end_date, end_time) will remain in the database for rollback safety but will not receive new writes.
- Notification functionality will be implemented in a separate future feature; this feature only prepares the data structure.
- Tasks without scheduled times will appear on the calendar at their actual execution times (fallback); tasks with neither scheduled nor actual times will not appear on the calendar.

## Out of Scope

- Notification delivery mechanism and UI (data structure only is prepared).
- Timezone conversion or multi-timezone support.
- Recurring event patterns.
- Calendar event drag-and-drop to reschedule.
- Integration with external calendars (Google Calendar, iCal, etc.).

## Testing Strategy

Backend implementation MUST follow test-first development:

1. **Unit Tests (Repository Layer)**: Write tests for new field CRUD operations before implementing
   - Test creating task with scheduledStart, scheduledEnd, isAllDay
   - Test automatic actual_start setting on status change to "next"
   - Test automatic actual_end setting on status change to "done"
   - Test manual override of actual_start/actual_end
   - Test data migration from old fields to new fields

2. **Integration Tests (API Layer)**: Write tests for API endpoints before implementing
   - Test task creation with new datetime fields
   - Test task update with datetime modifications
   - Test calendar query with calendarFrom/To filters (scheduled priority, actual fallback)
   - Test task response includes both scheduled and actual times
   - Test fallback display: task without scheduledStart but with actualStart appears in calendar query

3. **User Acceptance Tests**: Derived from acceptance scenarios above
   - Each acceptance scenario should be verifiable through manual or automated testing
