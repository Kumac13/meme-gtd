# Feature Specification: Memo & Task Bookmark Functionality

**Feature Branch**: `002-memo-bookmark-functionality`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "memo bookmark functionality"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Access to Important Memos (Priority: P1)

As a user capturing various ideas throughout the day, I need to mark certain memos as bookmarked so that I can quickly return to the most important or frequently referenced items without searching through the entire captured pool.

**Why this priority**: This is the core value proposition - enabling quick access to prioritized items. Without this, users cannot distinguish between routine captures and critical items that need frequent attention.

**Independent Test**: Can be fully tested by creating a memo, bookmarking it, and verifying it appears in a filtered list of bookmarked items. Delivers immediate value by reducing time to find important memos.

**Acceptance Scenarios**:

1. **Given** I have an existing memo with ID 12, **When** I run `mgtd memo bookmark 12`, **Then** the memo is marked as bookmarked and a success message is displayed
2. **Given** I have a bookmarked memo with ID 12, **When** I run `mgtd memo list --bookmarked`, **Then** only bookmarked memos are displayed in the list
3. **Given** I have a bookmarked memo with ID 12, **When** I run `mgtd memo unbookmark 12`, **Then** the bookmark is removed and the memo no longer appears in `--bookmarked` filtered lists

---

### User Story 2 - Bookmark Priority Tasks (Priority: P2)

As a user managing multiple tasks in different states (open, next, waiting), I need to bookmark certain tasks so that I can maintain focus on the most critical work items across various lists and projects.

**Why this priority**: Extends bookmark functionality to the task domain. While less critical than memo bookmarking (since tasks already have status-based filtering), it provides consistent UX and supports power users managing many tasks.

**Independent Test**: Can be fully tested by creating a task, bookmarking it, and verifying the bookmark persists across status changes and filtering operations. Delivers value by helping users track high-priority work items.

**Acceptance Scenarios**:

1. **Given** I have an existing task with ID 45, **When** I run `mgtd task bookmark 45`, **Then** the task is marked as bookmarked
2. **Given** I have multiple tasks with different statuses, some bookmarked, **When** I run `mgtd task list --bookmarked`, **Then** only bookmarked tasks are displayed regardless of status
3. **Given** I bookmark a memo and then promote it to a task, **When** I view the new task, **Then** the bookmark status is preserved from the original memo

---

### User Story 3 - Visual Bookmark Indicators (Priority: P3)

As a user viewing lists of memos or tasks, I need to see which items are bookmarked so that I can quickly identify prioritized items without applying special filters.

**Why this priority**: Enhances discoverability but not essential for core functionality. Users can still access bookmarked items via filters even without visual indicators.

**Independent Test**: Can be fully tested by bookmarking items and verifying that list views (both default and JSON formats) clearly indicate bookmark status. Delivers value through improved visual scanning efficiency.

**Acceptance Scenarios**:

1. **Given** I have bookmarked and non-bookmarked memos, **When** I run `mgtd memo list`, **Then** bookmarked items are visually distinguished (e.g., with a ★ indicator)
2. **Given** I have a bookmarked memo, **When** I run `mgtd memo view 12`, **Then** the detailed view shows the bookmark status
3. **Given** I have bookmarked items, **When** I run `mgtd memo list --json`, **Then** the JSON output includes `"is_bookmarked": true` for bookmarked items

---

### Edge Cases

- What happens when a user tries to bookmark an already-bookmarked memo? (Should succeed idempotently without error)
- What happens when a user tries to unbookmark a memo that is not bookmarked? (Should succeed idempotently without error)
- How does the system handle bookmarking a memo that is subsequently deleted? (Bookmark flag should be preserved for potential undelete operations)
- What happens when a bookmarked memo is promoted to a task? (Bookmark status should transfer to the new task via the promotion workflow)
- How does bookmark filtering interact with other filters (e.g., `--bookmarked --label urgent`)? (Should apply AND logic - items must satisfy all filter conditions)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to bookmark any memo by its ID
- **FR-002**: System MUST allow users to remove a bookmark from any memo by its ID
- **FR-003**: System MUST allow users to bookmark any task by its ID
- **FR-004**: System MUST allow users to remove a bookmark from any task by its ID
- **FR-005**: System MUST support filtering memo lists to show only bookmarked items
- **FR-006**: System MUST support filtering task lists to show only bookmarked items
- **FR-007**: System MUST preserve bookmark status when a memo is promoted to a task
- **FR-008**: System MUST display bookmark status in detailed views of memos and tasks
- **FR-009**: System MUST include bookmark status in JSON output for all memo and task operations
- **FR-010**: Bookmark operations MUST be idempotent (bookmarking an already-bookmarked item succeeds, unbookmarking a non-bookmarked item succeeds)
- **FR-011**: System MUST preserve bookmark status for deleted items (in case of undelete operations)
- **FR-012**: Bookmark filtering MUST combine correctly with other filters using AND logic
- **FR-013**: System MUST validate that the target ID exists before performing bookmark operations

### Key Entities

- **Memo**: Existing entity with `is_bookmarked` boolean field (default: false)
- **Task**: Existing entity with `is_bookmarked` boolean field (default: false)
- **Bookmark Status**: Boolean attribute on issues table, inherited by both memo and task types

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can bookmark or unbookmark any memo or task in under 2 seconds
- **SC-002**: Users can retrieve a filtered list of all bookmarked items in under 1 second regardless of total memo/task count
- **SC-003**: 100% of bookmark operations succeed idempotently (no errors when bookmarking already-bookmarked items)
- **SC-004**: Bookmark status is preserved across 100% of memo-to-task promotion operations
- **SC-005**: All bookmark operations return consistent status indicators in both text and JSON output formats

## Assumptions

- The database schema already includes the `is_bookmarked` boolean field in the issues table
- CLI commands follow the GitHub CLI (`gh`) command structure conventions
- Users primarily use bookmarks for personal prioritization rather than as a categorization mechanism (labels serve that purpose)
- Bookmark operations do not require confirmation prompts (unlike delete operations)
- The default value for `is_bookmarked` on new records is `false`

## Out of Scope

- Bookmark sorting (e.g., ordering bookmarked items by bookmark timestamp)
- Bookmark limits or quotas
- Shared or collaborative bookmarks (single-user system)
- Bookmark export/import functionality
- Automatic bookmarking based on rules or patterns
- Bookmark analytics or statistics
