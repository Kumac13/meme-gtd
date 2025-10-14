# Feature Specification: mgtd task Command Implementation

**Feature Branch**: `005-docs-mgtd-task`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "現状の実装とdocs/を元にmgtd taskを作成したい。実装はmgtd memoを参照すること。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Task Directly (Priority: P1)

Users need to create actionable tasks directly without first capturing them as memos, allowing them to move immediately into execution phase when the action is already clear.

**Why this priority**: Core functionality that enables users to define actionable items in the GTD workflow. This is the entry point for all direct task creation.

**Independent Test**: Can be fully tested by running `mgtd task create --title "Test task"` and verifying a new task record is created in the database with `type=task` and delivers immediate value for task management.

**Acceptance Scenarios**:

1. **Given** no existing tasks, **When** user runs `mgtd task create --title "Buy groceries" --body "Milk, eggs, bread"`, **Then** system creates task with unique ID, title, body, status "open", and displays confirmation
2. **Given** valid editor configuration, **When** user runs `mgtd task create --title "Write report"` without body, **Then** system launches editor for body input
3. **Given** user provides labels, **When** user runs `mgtd task create --title "Fix bug" --label urgent --label backend`, **Then** system creates task with both labels attached
4. **Given** user provides status, **When** user runs `mgtd task create --title "Review PR" --status next`, **Then** system creates task with status "next" instead of default "open"
5. **Given** user provides scheduled date, **When** user runs `mgtd task create --title "Meeting" --scheduled-on 2025-10-20`, **Then** system creates task with scheduled_on field set

---

### User Story 2 - List and Filter Tasks (Priority: P1)

Users need to view tasks filtered by status, labels, or search criteria to focus on relevant actionable items during different phases of the GTD workflow.

**Why this priority**: Essential for navigating the task system and implementing GTD's Next Actions, Waiting For, and Scheduled lists.

**Independent Test**: Can be fully tested by creating sample tasks with different statuses/labels and verifying `mgtd task list --status next` returns only tasks with status "next", delivering immediate value for GTD workflow navigation.

**Acceptance Scenarios**:

1. **Given** 10 tasks exist with mixed statuses, **When** user runs `mgtd task list --status next`, **Then** system displays only tasks with status "next"
2. **Given** tasks with various labels, **When** user runs `mgtd task list --label urgent`, **Then** system displays only tasks tagged "urgent"
3. **Given** 50 tasks exist, **When** user runs `mgtd task list --limit 10`, **Then** system displays first 10 tasks sorted by updated_at descending
4. **Given** tasks containing keyword "report", **When** user runs `mgtd task list --search report`, **Then** system displays tasks whose title or body contains "report" using FTS
5. **Given** tasks exist, **When** user runs `mgtd task list --json`, **Then** system outputs machine-readable JSON array
6. **Given** bookmarked tasks exist, **When** user runs `mgtd task list --bookmarked`, **Then** system displays only bookmarked tasks

---

### User Story 3 - View Task Details (Priority: P1)

Users need to view complete details of a single task including title, body, status, labels, scheduled date, and related links to make informed decisions about task execution.

**Why this priority**: Core read operation required for task review and decision-making in GTD workflow.

**Independent Test**: Can be fully tested by creating a task and running `mgtd task view <id>` to verify all fields display correctly, delivering immediate value for task inspection.

**Acceptance Scenarios**:

1. **Given** task ID 42 exists, **When** user runs `mgtd task view 42`, **Then** system displays title, body, status, labels, created/updated timestamps
2. **Given** task has scheduled_on date, **When** user views task, **Then** system displays scheduled date in human-readable format
3. **Given** task has comments, **When** user runs `mgtd task view 42 --comments`, **Then** system displays task details followed by comment timeline
4. **Given** task ID does not exist, **When** user runs `mgtd task view 999`, **Then** system displays error "Task not found"
5. **Given** user provides memo ID to task command, **When** user runs `mgtd task view 10` where 10 is memo, **Then** system displays error "ID refers to different type (memo)"

---

### User Story 4 - Update Task Properties (Priority: P2)

Users need to modify task title, body, status, labels, and scheduled date as tasks evolve through the GTD workflow phases.

**Why this priority**: Important for task lifecycle management but not required for initial task creation and viewing.

**Independent Test**: Can be fully tested by creating a task, editing it with `mgtd task edit <id> --title "New title"`, and verifying the change persists, delivering value for task refinement.

**Acceptance Scenarios**:

1. **Given** task ID 42 exists, **When** user runs `mgtd task edit 42 --title "Updated title"`, **Then** system updates title and displays confirmation
2. **Given** task exists, **When** user runs `mgtd task edit 42 --body "New content"`, **Then** system updates body without launching editor
3. **Given** task exists, **When** user runs `mgtd task edit 42 --editor`, **Then** system launches editor with current body for editing
4. **Given** task exists, **When** user runs `mgtd task edit 42 --status next`, **Then** system updates status to "next"
5. **Given** task exists, **When** user runs `mgtd task edit 42 --add-label urgent`, **Then** system adds "urgent" label without removing existing labels
6. **Given** task has label "old", **When** user runs `mgtd task edit 42 --remove-label old`, **Then** system removes "old" label

---

### User Story 5 - Change Task State (Priority: P2)

Users need to transition tasks through lifecycle states (close, cancel, reopen) with optional comments explaining the state change.

**Why this priority**: Essential for task completion workflow but depends on task creation/viewing being available first.

**Independent Test**: Can be fully tested by creating a task and running `mgtd task close <id>` to verify status changes to "done", delivering value for completing GTD workflow.

**Acceptance Scenarios**:

1. **Given** task ID 42 has status "open", **When** user runs `mgtd task close 42`, **Then** system sets status to "done" and displays confirmation
2. **Given** task has status "next", **When** user runs `mgtd task cancel 42`, **Then** system sets status to "canceled"
3. **Given** task has status "done", **When** user runs `mgtd task reopen 42`, **Then** system sets status to "open"
4. **Given** user provides comment, **When** user runs `mgtd task close 42 --comment "Completed successfully"`, **Then** system adds comment with status change
5. **Given** confirmation required, **When** user runs destructive command without --yes, **Then** system prompts for confirmation before executing

---

### User Story 6 - Manage Task Comments (Priority: P3)

Users need to add, edit, and delete comments on tasks to document progress, blockers, or decision history.

**Why this priority**: Useful for task documentation but not critical for basic task management.

**Independent Test**: Can be fully tested by adding comment with `mgtd task comment add <id> --body "Note"` and verifying comment appears in task view, delivering value for task documentation.

**Acceptance Scenarios**:

1. **Given** task ID 42 exists, **When** user runs `mgtd task comment add 42 --body "Work started"`, **Then** system creates comment and links to task
2. **Given** comment ID 5 exists, **When** user runs `mgtd task comment edit 5 --body "Updated note"`, **Then** system updates comment and saves revision history
3. **Given** comment ID 5 exists, **When** user runs `mgtd task comment delete 5`, **Then** system prompts for confirmation and performs logical deletion
4. **Given** no body provided, **When** user runs `mgtd task comment add 42`, **Then** system launches editor for comment input

---

### User Story 7 - Manage Task Labels (Priority: P3)

Users need to add, set, or remove labels on tasks to categorize and filter tasks by context, priority, or project.

**Why this priority**: Helpful for organization but tasks can function without labels.

**Independent Test**: Can be fully tested by running `mgtd task label add <id> --label context:work` and verifying label appears in task list, delivering value for task categorization.

**Acceptance Scenarios**:

1. **Given** task ID 42 exists, **When** user runs `mgtd task label add 42 --label urgent`, **Then** system adds "urgent" label without affecting existing labels
2. **Given** task has labels "a" and "b", **When** user runs `mgtd task label set 42 --label x --label y`, **Then** system replaces all labels with "x" and "y"
3. **Given** task has label "old", **When** user runs `mgtd task label remove 42 --label old`, **Then** system removes "old" label
4. **Given** label does not exist, **When** user attempts to add non-existent label, **Then** system displays error "Label not found"

---

### User Story 8 - Bookmark/Unbookmark Tasks (Priority: P3)

Users need to mark important tasks with bookmarks for quick access and filtering, supporting focused work on high-priority items.

**Why this priority**: Convenience feature for power users but not essential for basic task management.

**Independent Test**: Can be fully tested by running `mgtd task bookmark <id>` and verifying bookmark flag is set and task appears in `--bookmarked` filter, delivering value for task prioritization.

**Acceptance Scenarios**:

1. **Given** task ID 42 exists, **When** user runs `mgtd task bookmark 42`, **Then** system sets is_bookmarked to true and displays confirmation
2. **Given** task is already bookmarked, **When** user runs `mgtd task bookmark 42`, **Then** system succeeds idempotently without error
3. **Given** bookmarked task exists, **When** user runs `mgtd task unbookmark 42`, **Then** system sets is_bookmarked to false
4. **Given** task is not bookmarked, **When** user runs `mgtd task unbookmark 42`, **Then** system succeeds idempotently without error

---

### Edge Cases

- What happens when user provides invalid status value (not in enum)?
- How does system handle scheduled_on date in the past?
- What happens when user tries to edit deleted task?
- How does system prevent memo ID from being used in task commands?
- What happens when user provides both --body and --editor flags?
- How does system handle extremely long task titles (e.g., 10,000 characters)?
- What happens when user provides invalid date format for scheduled_on?
- How does system handle concurrent edits to the same task?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide `mgtd task create` command that creates new task with title (required), body (optional via editor/flags), status (default "open"), scheduled_on (optional), labels (optional), and project association (optional)
- **FR-002**: System MUST provide `mgtd task list` command with filtering by status, label, search query (FTS5), bookmarked flag, and sorting options (default updated_at desc), with --limit for pagination
- **FR-003**: System MUST provide `mgtd task view` command that displays single task details including title, body, status, scheduled_on, labels, timestamps, and optional comments timeline
- **FR-004**: System MUST provide `mgtd task edit` command that updates title, body, status, scheduled_on, and supports --add-label/--remove-label for incremental label changes
- **FR-005**: System MUST provide `mgtd task close` command that sets status to "done" with optional comment
- **FR-006**: System MUST provide `mgtd task cancel` command that sets status to "canceled" with optional comment
- **FR-007**: System MUST provide `mgtd task reopen` command that sets status to "open"
- **FR-008**: System MUST provide `mgtd task delete` command that performs logical deletion with confirmation prompt (--yes to skip)
- **FR-009**: System MUST provide `mgtd task comment add/edit/delete` subcommands following memo comment patterns
- **FR-010**: System MUST provide `mgtd task label add/set/remove` subcommands following memo label patterns
- **FR-011**: System MUST provide `mgtd task bookmark/unbookmark` commands that set is_bookmarked flag idempotently
- **FR-012**: System MUST validate type field and reject operations when provided ID refers to memo instead of task
- **FR-013**: System MUST support --json flag on all commands for machine-readable output
- **FR-014**: System MUST support --editor/--no-editor flags on create and edit commands following GitHub CLI conventions
- **FR-015**: System MUST support --body-file flag accepting file path or "-" for stdin
- **FR-016**: System MUST validate status values against enum (open, next, waiting, scheduled, done, canceled)
- **FR-017**: System MUST parse and validate scheduled_on dates in ISO 8601 format
- **FR-018**: System MUST automatically set type="task" on all records created by task commands
- **FR-019**: System MUST preserve kebab-case naming for all multi-word flags (--body-file, --add-label, --scheduled-on)
- **FR-020**: System MUST detect and reject legacy camelCase flags with migration guidance

### Key Entities

- **Task**: Actionable item with title (required), body (Markdown), status (open/next/waiting/scheduled/done/canceled), scheduled_on (optional date), labels (many-to-many), is_bookmarked flag, type="task", inheriting from issues table schema
- **Comment**: User annotation attached to task with body, timestamps, revision history via comment_revisions table
- **Label**: Categorization tag applied to tasks, managed via labels table with many-to-many through issue_labels
- **Link**: Relationship between issues (parent/child/relates/derived_from), tasks can link to other tasks or reference originating memos via derived_from

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create task and view it in list within 10 seconds (including editor launch time if needed)
- **SC-002**: Users can filter 1000+ tasks by status or label and receive results in under 1 second
- **SC-003**: 100% of task operations maintain type safety and reject memo IDs with clear error messages
- **SC-004**: All task commands support --json output enabling CLI automation and scripting
- **SC-005**: Users can complete full task lifecycle (create → edit → close) in under 30 seconds
- **SC-006**: Task list command displays results in consistent table format matching memo list UX
- **SC-007**: 95% of common task operations (create, list, view, close) succeed on first attempt without consulting help
- **SC-008**: Task commands follow GitHub CLI conventions reducing learning curve for developers familiar with gh CLI

## Assumptions *(include when relevant)*

- Users have already initialized mgtd with `mgtd init` and have valid context.json configuration
- Users have appropriate read/write permissions for SQLite database file
- Editor environment variable ($EDITOR) is configured when using editor-based input
- Users understand GTD workflow phases (Inbox, Next Actions, Waiting For, Scheduled)
- Label entities must be created via `mgtd label create` before being attached to tasks
- Node.js runtime version 22.x or later is available
- Users are familiar with command-line interfaces and flag-based command syntax
- Tasks are single-user focused with no concurrent multi-user access expected
- Logical deletion (is_deleted flag) is sufficient; hard deletion is not required
- Date inputs for scheduled_on use ISO 8601 format (YYYY-MM-DD)

## Dependencies *(include when relevant)*

- **mgtd init**: Database must be initialized with schema version 001_init.sql containing issues table
- **mgtd memo**: Task commands mirror memo implementation patterns for consistency
- **labels table**: Label commands (`mgtd label create`) must exist for label attachment operations
- **context.json**: Configuration file must exist with valid dbPath pointing to SQLite database
- **Core packages**: meme-gtd-core (TaskService), meme-gtd-db (taskRepository), meme-gtd-config (loadConfig)
- **oclif framework**: Command structure depends on @oclif/core for CLI parsing and execution
- **better-sqlite3**: Database operations require SQLite driver for Node.js
- **FTS5**: Full-text search depends on SQLite FTS5 extension enabled in schema

## Out of Scope *(include when relevant)*

- Task assignment to other users (single-user system)
- Due dates with time components (only dates via scheduled_on)
- Task priority field (use labels or status for prioritization)
- Recurring task templates
- Calendar integration (Google Calendar sync)
- Task dependencies or blocking relationships (use links for related tasks)
- Rich text or HTML formatting in body (Markdown only)
- File attachments to tasks
- Real-time notifications or reminders
- Web UI or GUI interface (CLI only)
- Remote API synchronization (local SQLite only)
- Task archiving separate from logical deletion
- Undo/redo operations
- Task time tracking or effort estimation
- Custom task statuses beyond predefined enum
