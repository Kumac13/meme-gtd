# Feature Specification: Web UI Memo-to-Task Promotion

**Feature Branch**: `023-web-memo-task`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "Web UI: Memo to Task promotion feature. Users can promote a memo to a task from the memo detail page. Use existing task creation form (no modal). Preserve labels, links, comments, projects, and bookmark status. Delete original memo after promotion."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Memo Promotion (Priority: P1)

A user has captured a quick thought in a memo and now realizes it's actionable. They want to convert it to a task with minimal clicks.

**Why this priority**: This is the core value proposition - enabling users to quickly transition items through their GTD workflow from inbox (memo) to next action (task).

**Independent Test**: Can be fully tested by creating a memo, clicking a "Promote to Task" button on the memo detail page, filling in task title on the task creation form, and verifying the new task exists with the memo's content.

**Acceptance Scenarios**:

1. **Given** a user is viewing a memo detail page, **When** they click the "Promote to Task" button, **Then** they are redirected to the task creation form with the memo's body pre-filled
2. **Given** the user is on the task creation form (promoted from memo), **When** they enter a task title and submit, **Then** a new task is created and the original memo is deleted
3. **Given** a memo has been promoted to task, **When** the user views the new task, **Then** the task's body contains the original memo's content

---

### User Story 2 - Promoted Task with Initial Status (Priority: P2)

A user wants to promote a memo to a task and immediately set its workflow status (e.g., "next", "waiting", "scheduled") to organize their task list.

**Why this priority**: Supports GTD workflow by allowing users to categorize tasks during creation, reducing additional steps.

**Independent Test**: Can be tested by promoting a memo and selecting a specific status (e.g., "next") during task creation, then verifying the task appears with that status.

**Acceptance Scenarios**:

1. **Given** the user is on the task creation form (promoted from memo), **When** they select status "next" and submit, **Then** the created task has status "next"
2. **Given** the user is on the task creation form (promoted from memo), **When** they select status "waiting" and submit, **Then** the created task has status "waiting"

---

### User Story 3 - Data Preservation During Promotion (Priority: P2)

A user has a memo with labels, links, comments, project associations, and bookmark status. When promoting to a task, they expect all this metadata to be preserved.

**Why this priority**: Prevents data loss and maintains context, which is critical for user trust and workflow continuity.

**Independent Test**: Can be tested by creating a memo with labels, comments, links, project associations, and bookmark flag, then promoting it and verifying all metadata appears on the new task.

**Acceptance Scenarios**:

1. **Given** a memo has labels "urgent" and "work", **When** promoted to task, **Then** the new task has labels "urgent" and "work"
2. **Given** a memo has 3 comments, **When** promoted to task, **Then** the new task has 3 comments with identical content
3. **Given** a memo is linked to another issue, **When** promoted to task, **Then** the new task preserves that link
4. **Given** a memo belongs to a project, **When** promoted to task, **Then** the new task belongs to the same project
5. **Given** a memo is bookmarked, **When** promoted to task, **Then** the new task is bookmarked

---

### User Story 4 - Error Handling and Feedback (Priority: P3)

A user attempts to promote a memo but the operation fails (network error, server error). They need clear feedback about what went wrong.

**Why this priority**: Important for user experience but not critical for core functionality.

**Independent Test**: Can be tested by simulating server errors during promotion and verifying appropriate error messages are displayed.

**Acceptance Scenarios**:

1. **Given** the memo promotion API returns an error, **When** the user submits the task form, **Then** an error message is displayed and the memo is not deleted
2. **Given** a network error occurs during promotion, **When** the user submits the task form, **Then** a user-friendly error message is shown with retry option

---

### Edge Cases

- What happens when a memo has no body content (empty memo)?
- What happens when the user navigates away from the task creation form after clicking "Promote"?
- How does the system handle concurrent edits (user edits memo while promotion form is open)?
- What happens if the memo is deleted by another session before promotion completes?
- What happens when a memo has a very large body (10,000+ characters)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Promote to Task" button on memo detail pages
- **FR-002**: System MUST redirect users to the task creation form when "Promote to Task" button is clicked
- **FR-003**: System MUST pre-populate the task creation form's body field with the memo's content
- **FR-004**: System MUST allow users to specify a task title (required field)
- **FR-005**: System MUST allow users to specify initial task status (open, next, waiting, scheduled) with default "open"
- **FR-006**: System MUST call the promote API endpoint (POST /api/memos/:id/promote) when task form is submitted
- **FR-007**: System MUST transfer all labels from memo to task during promotion
- **FR-008**: System MUST transfer all links from memo to task during promotion
- **FR-009**: System MUST transfer all comments from memo to task during promotion
- **FR-010**: System MUST transfer project associations from memo to task during promotion
- **FR-011**: System MUST transfer bookmark status from memo to task during promotion
- **FR-012**: System MUST delete the original memo after successful task creation
- **FR-013**: System MUST create a "derived_from" link between the new task and original memo (for audit trail)
- **FR-014**: System MUST redirect users to the new task detail page after successful promotion
- **FR-015**: System MUST display error messages when promotion fails and NOT delete the original memo
- **FR-016**: System MUST preserve the memo if user cancels the task creation form
- **FR-017**: System MUST validate task title is not empty before allowing promotion

### Key Entities

- **Memo**: Represents inbox items with body content (markdown), labels, comments, links, project associations, and bookmark status
- **Task**: Represents actionable items with title, body (markdown), status, labels, comments, links, project associations, and bookmark status
- **Promotion**: The action of converting a memo to a task, transferring all metadata, and removing the original memo

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can promote a memo to a task within 3 clicks (view memo → click promote → fill title → submit)
- **SC-002**: Promotion operation completes within 2 seconds under normal load
- **SC-003**: 100% of metadata (labels, comments, links, projects, bookmarks) is preserved during promotion
- **SC-004**: Users can successfully complete memo promotion on first attempt without errors (95% success rate)
- **SC-005**: Zero data loss incidents (original memo not deleted if promotion fails)
- **SC-006**: Users receive clear feedback (success or error) within 1 second of submitting promotion

## Assumptions

- The promote API endpoint (POST /api/memos/:id/promote) is already implemented and functional
- Users have permission to create tasks if they can view memos
- Memo body content is in markdown format compatible with task body format
- The system supports soft-delete for memos (can be recovered if needed)
- Users primarily promote memos from the memo detail page, not from list views

## Out of Scope

- Bulk promotion of multiple memos at once
- Modal-based promotion workflow (using existing task creation page instead)
- Undo/rollback of promotion after completion
- Customizing which metadata to transfer (all metadata is transferred by default)
- Promoting tasks back to memos (reverse operation)

## Dependencies

- Existing task creation form and routing
- Memo detail page UI
- Promote API endpoint (POST /api/memos/:id/promote)
- Data migration utilities for transferring metadata

