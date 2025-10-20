# Feature Specification: Link Command for Task Relationship Management

**Feature Branch**: `008-https-github-com`
**Created**: 2025-10-18
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/18 を実装したい"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Parent-Child Task Relationships (Priority: P1)

Users need to break down large tasks into smaller actionable items while maintaining visibility of the hierarchical structure. For example, a project task "Launch product website" can be broken into child tasks like "Design homepage mockup", "Implement contact form", etc.

**Why this priority**: Core functionality for GTD methodology - enables users to decompose complex projects into actionable next steps, which is fundamental to the GTD workflow.

**Independent Test**: Can be fully tested by creating a parent task, creating child tasks, linking them together, and verifying the relationship is stored and displayed correctly. Delivers immediate value by allowing hierarchical task organization.

**Acceptance Scenarios**:

1. **Given** I have two existing tasks (ID 5 and ID 10), **When** I link task 5 as a child of task 10 using `mgtd link add --type parent --source 5 --target 10`, **Then** the link is created successfully and I see a confirmation message
2. **Given** I have two existing tasks (ID 5 and ID 10), **When** I link task 10 as a child of task 5 using `mgtd link add --type child --source 5 --target 10`, **Then** the link is created successfully (inverse notation achieving same result as scenario 1)
3. **Given** I have linked task 5 as a child of task 10, **When** I list links for task 5, **Then** I see task 10 listed as its parent
4. **Given** I have linked task 5 as a child of task 10, **When** I list links for task 10, **Then** I see task 5 listed as its child

---

### User Story 2 - View Task Relationships (Priority: P2)

Users need to quickly see all relationships for a given task or memo - both incoming and outgoing links. This helps understand the context and dependencies of any item.

**Why this priority**: Essential for navigation and understanding task context, but requires P1 (link creation) to be implemented first. Without the ability to view relationships, the link functionality is incomplete.

**Independent Test**: Can be tested by creating several linked items and verifying that `mgtd link list` displays all relationships correctly with proper formatting, both in human-readable and JSON formats.

**Acceptance Scenarios**:

1. **Given** task 5 has a parent (task 10) and a related task (task 7), **When** I run `mgtd link list 5`, **Then** I see both relationships displayed in a human-readable format
2. **Given** task 5 has multiple links, **When** I run `mgtd link list 5 --json`, **Then** I receive a JSON array containing all link objects with their IDs, types, source, and target
3. **Given** task 5 has multiple link types, **When** I run `mgtd link list 5 --type parent`, **Then** I see only the parent-type links filtered from all relationships
4. **Given** task 5 has no links, **When** I run `mgtd link list 5`, **Then** I see a message indicating no links exist

---

### User Story 3 - Create Related Task Connections (Priority: P3)

Users need to mark tasks as related when they share common context but don't have a hierarchical relationship. For example, "Research competitor pricing" and "Create pricing strategy" are related but neither is a parent of the other.

**Why this priority**: Useful for task organization but not critical for basic GTD workflow. Can be implemented after core parent-child functionality is working.

**Independent Test**: Can be tested independently by creating two unrelated tasks, linking them with "relates" type, and verifying the bidirectional relationship is visible from both tasks.

**Acceptance Scenarios**:

1. **Given** I have two tasks (ID 3 and ID 8), **When** I link them using `mgtd link add --type relates --source 3 --target 8`, **Then** the "relates" link is created successfully
2. **Given** I have created a "relates" link between tasks 3 and 8, **When** I list links for either task, **Then** I see the related task displayed

---

### User Story 4 - Track Memo-to-Task Derivation (Priority: P3)

Users need to record when a task was created from a memo during the GTD clarification process. This maintains traceability from initial capture (memo) to actionable item (task).

**Why this priority**: Supports GTD best practices but is not essential for core functionality. The "derived_from" link type is already supported in the schema and can be used once basic link operations work.

**Independent Test**: Can be tested by creating a memo, creating a task, linking with "derived_from" type, and verifying the derivation is traceable.

**Acceptance Scenarios**:

1. **Given** I have a memo (ID 2) and a task (ID 15), **When** I link the task as derived from the memo using `mgtd link add --type derived_from --source 15 --target 2`, **Then** the derivation link is created successfully
2. **Given** a task is derived from a memo, **When** I list links for the task, **Then** I see the source memo displayed with "derived_from" type

---

### User Story 5 - Remove Obsolete Links (Priority: P3)

Users need to remove links when relationships change or were created in error. For example, when a task is reclassified or a relationship is no longer relevant.

**Why this priority**: Cleanup functionality is important but not urgent - users can work around missing deletion by recreating tasks if needed. Should be implemented for completeness.

**Independent Test**: Can be tested by creating a link, noting its ID, removing it, and verifying it no longer appears in link lists.

**Acceptance Scenarios**:

1. **Given** I have a link with ID 42, **When** I run `mgtd link remove 42 --yes`, **Then** the link is deleted and I see a confirmation message
2. **Given** I have removed link ID 42, **When** I list links for the previously linked tasks, **Then** the removed link does not appear
3. **Given** I run `mgtd link remove 42` without `--yes`, **When** prompted for confirmation, **Then** I must confirm before the link is deleted

---

### Edge Cases

- What happens when attempting to create a link between non-existent tasks (source or target ID doesn't exist)?
- What happens when attempting to create a duplicate link (same source, target, and type already exists)?
- What happens when attempting to create a circular parent-child relationship (task A parent of B, B parent of A)?
- What happens when attempting to create a self-referential link (task linking to itself)?
- What happens when attempting to remove a non-existent link ID?
- How does the system handle cascading deletion when a task with links is deleted?
- What happens when listing links for a non-existent task ID?
- What happens when filtering by an invalid link type?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create links between any two existing tasks or memos using source ID, target ID, and link type
- **FR-002**: System MUST support four link types: `parent`, `child`, `relates`, and `derived_from`
- **FR-003**: System MUST validate that both source and target IDs exist before creating a link
- **FR-004**: System MUST prevent creation of duplicate links (same source, target, and type combination)
- **FR-005**: System MUST prevent creation of self-referential links (source equals target)
- **FR-006**: System MUST allow users to list all links for a given task or memo ID
- **FR-007**: System MUST allow users to filter link listings by link type
- **FR-008**: System MUST provide both human-readable and JSON output formats for link listings
- **FR-009**: System MUST allow users to delete a link by its link ID
- **FR-010**: System MUST require confirmation before deleting a link, unless explicit `--yes` flag is provided
- **FR-011**: System MUST automatically delete all links when a task or memo is deleted (cascade delete)
- **FR-012**: System MUST assign a unique auto-incrementing ID to each link
- **FR-013**: System MUST record creation timestamp for each link
- **FR-014**: System MUST return appropriate error messages for invalid operations (non-existent IDs, invalid types, etc.)
- **FR-015**: System MUST maintain referential integrity between links and tasks/memos

### Key Entities

- **Link**: Represents a relationship between two tasks or memos. Contains source issue ID, target issue ID, link type, unique link ID, and creation timestamp. Enforces referential integrity with cascade deletion.
- **Issue (Task/Memo)**: Existing entity that can participate in link relationships. Links reference issues by their ID.
- **Link Type**: Enumeration of valid relationship types - `parent` (target is parent of source), `child` (target is child of source), `relates` (non-hierarchical association), `derived_from` (source was created from target during GTD processing).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create any type of link between two items in under 10 seconds with a single command
- **SC-002**: Users can view all relationships for a task without navigating to multiple screens or commands
- **SC-003**: Link listing clearly distinguishes between relationship types without requiring user interpretation
- **SC-004**: Link deletion prevents accidental data loss through confirmation prompts
- **SC-005**: System maintains data integrity by preventing invalid link configurations (circular references, missing targets, duplicates)
- **SC-006**: JSON output enables programmatic integration and automation of link management
- **SC-007**: Users can trace task derivation from original memos for audit and review purposes
