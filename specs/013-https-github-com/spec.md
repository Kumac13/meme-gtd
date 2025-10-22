# Feature Specification: Link Command Implementation

**Feature Branch**: `013-https-github-com`
**Created**: 2025-10-22
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/18 これを進めたい。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create Parent-Child Task Relationships (Priority: P1)

A user wants to break down a large project task into smaller actionable subtasks. They need to establish parent-child relationships so they can track which tasks belong to which parent project.

**Why this priority**: This is the core GTD workflow requirement - breaking large tasks into manageable actions. Without this, users cannot properly organize hierarchical task structures.

**Independent Test**: Can be fully tested by creating two tasks, linking them as parent-child, and verifying the relationship is stored and retrievable. Delivers immediate value by enabling basic task hierarchy.

**Acceptance Scenarios**:

1. **Given** a user has two existing tasks (Task A and Task B), **When** they execute a command to make Task A a child of Task B, **Then** the system creates a link relationship and confirms the link was created
2. **Given** a task with no parent, **When** the user assigns it a parent task, **Then** the task now appears as a child of the parent task
3. **Given** a user attempts to create a parent-child link, **When** either the source or target task ID does not exist, **Then** the system displays an error message and does not create the link

---

### User Story 2 - View Task Relationships (Priority: P2)

A user wants to see all relationships for a specific task - both what it's linked to and what's linked to it. This helps them understand the context and dependencies of any given task.

**Why this priority**: After creating links, users need visibility into relationships to understand task context. This is essential for effective task management but can be added after basic link creation works.

**Independent Test**: Can be tested by creating several linked tasks and verifying that querying one task returns all its relationships with accurate link types and directions.

**Acceptance Scenarios**:

1. **Given** a task has multiple child tasks and one parent task, **When** the user requests to view all links for that task, **Then** the system displays all parent and child relationships
2. **Given** a task has related tasks (non-hierarchical), **When** the user views the task's links, **Then** the system shows all related tasks
3. **Given** a user wants to see only parent relationships, **When** they filter by link type "parent", **Then** the system displays only parent links
4. **Given** a task has no links, **When** the user requests to view its links, **Then** the system displays a message indicating no links exist

---

### User Story 3 - Create Related Task Links (Priority: P3)

A user wants to link two tasks that are related but not in a parent-child hierarchy (e.g., two tasks that should be worked on together, or tasks that share context).

**Why this priority**: Related links provide additional organizational flexibility but are less critical than hierarchical relationships. Users can function with just parent-child links for basic GTD workflows.

**Independent Test**: Can be tested independently by creating two unrelated tasks, establishing a "relates" link between them, and verifying the bidirectional relationship.

**Acceptance Scenarios**:

1. **Given** two independent tasks exist, **When** the user creates a "relates" link between them, **Then** both tasks show the relationship to each other
2. **Given** a user wants to track tasks that share context, **When** they link multiple tasks with "relates" type, **Then** all related tasks are visible from any task in the group

---

### User Story 4 - Delete Task Relationships (Priority: P4)

A user needs to remove outdated or incorrect links between tasks when task organization changes or mistakes were made during link creation.

**Why this priority**: While important for maintenance, users can work with existing links even if they can't remove them immediately. This is primarily a data hygiene feature.

**Independent Test**: Can be tested by creating a link, deleting it by link ID, and verifying it no longer appears in link listings.

**Acceptance Scenarios**:

1. **Given** a link exists between two tasks, **When** the user deletes the link by its ID, **Then** the link is removed and no longer appears in either task's relationships
2. **Given** a user attempts to delete a link, **When** they provide a non-existent link ID, **Then** the system displays an error message
3. **Given** a user wants to delete a link without confirmation, **When** they provide the confirmation flag, **Then** the link is removed immediately without prompting

---

### Edge Cases

- What happens when a user attempts to create a circular parent-child relationship (Task A is ancestor of Task B, and user tries to make Task A a child of Task B)? → System must detect the cycle and reject the operation with an error message
- How does the system handle deletion of a task that has links to other tasks? → All links are automatically deleted due to CASCADE delete in database
- What happens when a user tries to create duplicate links (same source, target, and type)? → System must reject the duplicate and display an error message
- How does the system behave when querying links for a task ID that doesn't exist? → System displays an error message indicating the task/memo was not found
- What happens when a user creates a child link and later tries to create a parent link for the same pair (inverse relationship)? → For parent/child links, system must block the inverse duplicate; for relates links, bidirectional relationships are valid
- What happens when querying links for a task that has no links? → System displays a message indicating no links exist for that task

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create parent-child relationships between tasks and memos
- **FR-002**: System MUST allow users to create related (non-hierarchical) relationships between tasks and memos
- **FR-003**: System MUST allow users to specify link direction (which item is source and which is target)
- **FR-004**: System MUST validate that both source and target items exist before creating a link
- **FR-005**: System MUST prevent creation of duplicate links (same source, target, and type)
- **FR-006**: System MUST allow users to list all links for a specific task or memo
- **FR-007**: System MUST allow users to filter links by type (parent, child, relates, derived_from)
- **FR-008**: System MUST allow users to delete links by link ID
- **FR-009**: System MUST automatically delete links when either the source or target item is deleted
- **FR-010**: System MUST output link information in both human-readable and JSON formats
- **FR-011**: System MUST distinguish between the four link types: parent, child, relates, and derived_from
- **FR-012**: System MUST require user confirmation before deleting links, unless the `--yes` flag is provided to skip confirmation (consistent with existing command patterns)
- **FR-013**: System MUST detect and prevent circular parent-child hierarchies (e.g., Task A is ancestor of Task B, and Task B cannot become ancestor of Task A). This applies only to parent/child link types, not to relates or derived_from links
- **FR-014**: System MUST prevent inverse duplicate parent-child links - if "Task A is child of Task B" exists, the system must block creation of "Task B is child of Task A". This ensures hierarchical consistency for parent/child relationships

### Key Entities

- **Link**: Represents a relationship between two tasks or memos. Has a source item, target item, link type (parent/child/relates/derived_from), creation timestamp, and unique ID.
- **Task/Memo**: Items that can be linked together. Each has a unique ID and can participate in multiple relationships as either source or target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a link between two tasks in under 10 seconds with a single command
- **SC-002**: Users can view all relationships for any task instantly (under 1 second response time)
- **SC-003**: 100% of links are automatically cleaned up when their associated tasks are deleted
- **SC-004**: Users can manage task hierarchies with up to 5 levels of nesting without confusion
- **SC-005**: Link operations complete successfully for tasks with 50+ child tasks without performance degradation

## Scope *(mandatory)*

### In Scope

- Creating parent-child links between tasks/memos
- Creating related links between tasks/memos
- Listing all links for a specific task/memo
- Filtering links by type
- Deleting links by ID
- JSON output format for programmatic access
- Validation of task/memo existence before link creation
- Cascade deletion of links when tasks/memos are deleted

### Out of Scope

- Visual graph representation of task relationships
- Automatic link suggestions based on task content
- Bulk link operations (creating/deleting multiple links at once)
- Link metadata (notes, labels, or custom properties on links)
- Undo functionality for link deletion
- Link history or audit trail

## Assumptions *(mandatory)*

- The database schema for the `links` table is already implemented and functional
- Users are familiar with basic CLI command patterns used in the meme-gtd tool
- Task and memo IDs are known to users (from list commands or previous operations)
- The existing repository pattern will be extended to include link operations
- Users have write access to the database file
- Link IDs are automatically generated and unique
- The four link types (parent, child, relates, derived_from) are sufficient for user needs

## Dependencies *(mandatory)*

### Technical Dependencies

- Existing database schema with `links` table must be in place
- Task and memo repositories must be accessible for validation
- Database connection and transaction handling infrastructure

### User Dependencies

- Users must have created tasks or memos before they can link them
- Users need to know the IDs of items they want to link

### External Dependencies

- None - this is a self-contained CLI feature

## Constraints *(mandatory)*

- Must use the existing database schema without modifications
- Must follow the established CLI command pattern (mgtd <noun> <verb>)
- Must maintain consistency with existing command options (--json, --yes, etc.)
- Link types are constrained to the four values defined in the database CHECK constraint
- All link operations must respect foreign key constraints
