# Feature Specification: Include Labels in API Responses

**Feature Branch**: `011-https-github-com`
**Created**: 2025-10-21
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/30 をコメントまで含めて確認して検討しろ"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Labels in Web UI (Priority: P1)

As a user viewing memos and tasks in the Web UI, I want to see which labels are attached to each item so that I can quickly identify and categorize my content.

**Why this priority**: This is the core functionality that unblocks the Web UI from displaying labels. Without this, the Web UI cannot show any label information despite the frontend being ready.

**Independent Test**: Can be fully tested by creating a memo/task with labels via CLI, then viewing it in the Web UI and verifying the labels are displayed.

**Acceptance Scenarios**:

1. **Given** a memo has labels "important" and "work" attached, **When** user views the memo list in Web UI, **Then** the labels "important" and "work" are displayed next to the memo
2. **Given** a task has label "urgent" attached, **When** user views the task detail page in Web UI, **Then** the label "urgent" is visible on the detail page
3. **Given** a memo has no labels attached, **When** user views the memo in Web UI, **Then** no labels are displayed (empty state)

---

### User Story 2 - Filter by Labels in Web UI (Priority: P2)

As a user with many labeled items, I want the Web UI to receive label data so that future filtering features can be implemented.

**Why this priority**: This enables future enhancements but is not immediately blocking. The primary value is viewing labels, not filtering.

**Independent Test**: Can be tested by verifying API responses contain label arrays that can be used for client-side filtering.

**Acceptance Scenarios**:

1. **Given** multiple memos with different labels, **When** Web UI fetches the memo list, **Then** each memo includes its complete label array in the response
2. **Given** tasks with overlapping labels, **When** Web UI fetches task list, **Then** all labels for each task are included in the response

---

### User Story 3 - View Labels in CLI JSON Output (Priority: P3)

As a CLI user viewing JSON output, I want to see labels included in the response so that I can process label data programmatically.

**Why this priority**: This improves CLI user experience but is lower priority than Web UI functionality. CLI users can already view labels using dedicated commands.

**Independent Test**: Can be tested by running `mgtd memo list --json` and verifying labels array is present in output.

**Acceptance Scenarios**:

1. **Given** a memo with labels, **When** user runs `mgtd memo list --json`, **Then** the JSON output includes a `labels` array for each memo
2. **Given** a task with labels, **When** user runs `mgtd task view <id> --json`, **Then** the JSON output includes the `labels` array

---

### Edge Cases

- What happens when an item has many labels (e.g., 20+ labels)? Response should include all labels without truncation.
- How does the system handle deleted labels that are still attached to items? Deleted labels should not appear in responses.
- What happens when labels have special characters in names? Labels should be returned as-is without encoding issues.
- How does the system handle items with duplicate label assignments? System should deduplicate labels in the response.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: List endpoints (`GET /api/memos`, `GET /api/tasks`) MUST include a `labels` array field in each item response
- **FR-002**: Detail endpoints (`GET /api/memos/:id`, `GET /api/tasks/:id`) MUST include a `labels` array field in the response
- **FR-003**: The `labels` array MUST contain label names as strings (e.g., `["important", "work"]`)
- **FR-004**: The `labels` array MUST be empty (`[]`) when no labels are attached to an item
- **FR-005**: The `labels` array MUST NOT include deleted labels (items with `is_deleted = 1`)
- **FR-006**: The `labels` array MUST NOT contain duplicate label names for the same item
- **FR-007**: CLI commands with `--json` flag MUST include the `labels` array in their output
- **FR-008**: The system MUST retrieve labels by joining `issue_labels` and `labels` tables on `label_id`
- **FR-009**: Labels MUST be ordered alphabetically by name in the response array

### Key Entities

- **Memo/Task (Issue)**: An item that can have zero or more labels attached via the `issue_labels` junction table
- **Label**: A categorization tag with a unique name that can be attached to multiple items
- **Issue-Label Association**: The relationship between an item and a label, stored in the `issue_labels` table

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of API responses for memos and tasks include a `labels` array field
- **SC-002**: Web UI displays labels for all items that have labels attached (verified by visual inspection)
- **SC-003**: CLI JSON output includes labels array for all memo and task commands
- **SC-004**: API response time increases by less than 50ms when labels are included (ensures performance is not significantly degraded)
- **SC-005**: Users can visually identify labeled items in Web UI within 1 second of page load
