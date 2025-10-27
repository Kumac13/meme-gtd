# Feature Specification: Project Management CLI Commands

**Feature Branch**: `015-https-github-com`
**Created**: 2025-10-24
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/19"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and List Projects (Priority: P1)

A user wants to organize their tasks and memos into projects for better management. They create a new project and view all available projects.

**Why this priority**: This is the foundation - users must be able to create projects before using any other project features. Without this, no other project functionality can work.

**Independent Test**: User can run `mgtd project create "My Project"` and then `mgtd project list` to see their new project. This delivers immediate value by allowing project creation and listing.

**Acceptance Scenarios**:

1. **Given** no projects exist, **When** user runs `mgtd project create "Marketing Campaign"`, **Then** a new project is created and confirmation message is shown
2. **Given** multiple projects exist, **When** user runs `mgtd project list`, **Then** all projects are displayed with their names and IDs
3. **Given** user wants structured output, **When** user runs `mgtd project create "Sprint 1" --json`, **Then** project details are returned in JSON format
4. **Given** user wants to add context, **When** user runs `mgtd project create "Q4 Goals" --description "Year-end objectives"`, **Then** project is created with the description

---

### User Story 2 - Add Items to Projects (Priority: P2)

A user has created a project and now wants to add existing tasks and memos to it to organize their work.

**Why this priority**: Once users can create projects, the next essential step is populating them. This enables the core organizational value of projects.

**Independent Test**: User can run `mgtd project add 5 12` to add issue #12 to project #5, then verify with `mgtd project view 5` that the issue appears in the project.

**Acceptance Scenarios**:

1. **Given** project #5 exists and issue #12 exists, **When** user runs `mgtd project add 5 12`, **Then** issue #12 is added to project #5
2. **Given** issue is added to project, **When** user runs `mgtd project view 5`, **Then** the issue appears in the project's item list
3. **Given** user wants to specify position, **When** user runs `mgtd project add 5 20 --position 1.5`, **Then** issue is added at position 1.5 in the project

---

### User Story 3 - View Project Details (Priority: P2)

A user wants to see all tasks and memos associated with a specific project to understand the project's current state.

**Why this priority**: Parallel with US2, this allows users to view what they've organized. These two features together complete the basic CRUD cycle for project management.

**Independent Test**: User can run `mgtd project view 5` to see all issues in project #5, including their titles, IDs, and types.

**Acceptance Scenarios**:

1. **Given** project #5 has 3 issues, **When** user runs `mgtd project view 5`, **Then** all 3 issues are displayed with their details
2. **Given** user wants structured data, **When** user runs `mgtd project view 5 --json`, **Then** project details and items are returned in JSON format
3. **Given** project has no items, **When** user runs `mgtd project view 5`, **Then** empty project message is shown

---

### User Story 4 - Remove Items and Delete Projects (Priority: P3)

A user needs to remove tasks from a project or delete entire projects that are no longer needed.

**Why this priority**: Cleanup operations are important but not critical for initial functionality. Users can work effectively with create/add/view operations first.

**Independent Test**: User can run `mgtd project remove 5 12 --yes` to remove issue #12 from project #5, or `mgtd project delete 5 --yes` to delete the entire project.

**Acceptance Scenarios**:

1. **Given** issue #12 is in project #5, **When** user runs `mgtd project remove 5 12 --yes`, **Then** issue is removed from project but issue itself remains in database
2. **Given** project #5 exists, **When** user runs `mgtd project delete 5 --yes`, **Then** project is deleted and all project_items associations are removed (issues remain)
3. **Given** user runs delete without confirmation, **When** user runs `mgtd project delete 5`, **Then** confirmation prompt is shown before deletion

---

### User Story 5 - Reorder Items in Projects (Priority: P3)

A user wants to rearrange tasks within a project to reflect priorities or workflow stages.

**Why this priority**: This is an enhancement for better organization but not essential for basic project management functionality.

**Independent Test**: User can run `mgtd project move 5 12 --position 2.0` to change issue #12's position in project #5.

**Acceptance Scenarios**:

1. **Given** issue #12 is in project #5, **When** user runs `mgtd project move 5 12 --position 2.0`, **Then** issue's position is updated to 2.0
2. **Given** user wants to move to column, **When** user runs `mgtd project move 5 12 --column "Done"`, **Then** issue is moved and column metadata is stored in view_meta

---

### Edge Cases

- What happens when user tries to add the same issue to a project twice? (System should show error: "Issue already exists in this project" - enforced by UNIQUE constraint)
- What happens when user tries to create a project with a duplicate name? (System should show error: "Project name already exists" - enforced by UNIQUE constraint)
- What happens when user tries to add a non-existent issue to a project? (System should show error: "Issue not found")
- What happens when user tries to view/delete a non-existent project? (System should show error: "Project not found")
- What happens when user deletes a project? (Project is deleted, project_items are deleted via CASCADE, but issues remain intact)
- What happens when an issue is deleted? (project_items entry is automatically removed via CASCADE, project remains)
- What happens with --json output when operations succeed/fail? (Success: JSON with data, Failure: JSON with error object)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide `mgtd project create` command to create new projects with required name parameter
- **FR-002**: System MUST support optional `--description` flag for project creation
- **FR-003**: System MUST support optional `--view` flag for project creation (values: board, table), storing view type and default columns in view_meta JSON field
- **FR-003a**: For board view, system MUST initialize view_meta with default columns: `{"viewType": "board", "columns": ["To Do", "In Progress", "Done"]}`
- **FR-003b**: For table view, system MUST initialize view_meta with: `{"viewType": "table"}`
- **FR-003c**: If no --view flag is provided, system MUST default to board view with standard columns
- **FR-004**: System MUST provide `mgtd project list` command to display all projects
- **FR-005**: System MUST provide `mgtd project view <project-id>` command to show project details and associated issues
- **FR-006**: System MUST provide `mgtd project add <project-id> <issue-id>` command to add issues to projects
- **FR-007**: System MUST support optional `--position` flag for specifying item order (REAL type, allows fractional positioning)
- **FR-008**: System MUST support optional `--column` flag for board view organization
- **FR-009**: System MUST provide `mgtd project remove <project-id> <issue-id>` command to remove issues from projects
- **FR-010**: System MUST provide `mgtd project delete <project-id>` command to delete projects
- **FR-011**: System MUST require `--yes` flag for destructive operations (remove, delete) or show confirmation prompt
- **FR-012**: System MUST support `--json` flag for all commands to output structured JSON
- **FR-013**: System MUST provide `mgtd project move <project-id> <issue-id>` command to reorder items or change columns
- **FR-014**: System MUST enforce unique constraint: one issue cannot be added to same project twice
- **FR-015**: System MUST enforce unique constraint: project names must be unique across system
- **FR-016**: System MUST validate that issue exists before adding to project
- **FR-017**: System MUST validate that project exists before operations
- **FR-018**: System MUST allow both tasks and memos to be added to projects
- **FR-019**: System MUST preserve issues when project is deleted (only remove association)
- **FR-020**: System MUST automatically remove project_items when issue is deleted (CASCADE)
- **FR-021**: System MUST automatically remove project_items when project is deleted (CASCADE)

### API Requirements

- **FR-022**: System MUST provide `POST /api/projects` endpoint to create new projects
- **FR-023**: System MUST provide `GET /api/projects` endpoint to list all projects
- **FR-024**: System MUST provide `GET /api/projects/:id` endpoint to retrieve project details with associated items
- **FR-025**: System MUST provide `POST /api/projects/:id/items` endpoint to add issues to projects
- **FR-026**: System MUST provide `DELETE /api/projects/:id/items/:issueId` endpoint to remove issues from projects
- **FR-027**: System MUST provide `PATCH /api/projects/:id/items/:issueId` endpoint to update item position or column
- **FR-028**: System MUST provide `DELETE /api/projects/:id` endpoint to delete projects
- **FR-029**: API endpoints MUST return appropriate HTTP status codes (200, 201, 400, 404, 409)
- **FR-030**: API endpoints MUST validate request bodies using Zod schemas
- **FR-031**: API endpoints MUST follow existing RESTful patterns (consistent with tasks, memos, links APIs)
- **FR-032**: API responses MUST include all relevant project and item data (matching CLI --json output structure)

### Key Entities

- **Project**: Represents a collection of related tasks and memos
  - Attributes: id (auto-increment), name (unique), description (optional), created_at
  - Projects organize work but don't modify the issues themselves

- **Project Item**: Represents the association between a project and an issue
  - Attributes: id, project_id, issue_id, position (REAL for flexible ordering), view_meta (JSON for UI state), created_at, updated_at
  - Unique constraint on (project_id, issue_id) pair
  - Allows flexible positioning using fractional numbers (1.0, 1.5, 2.0)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a new project and see it in the list in under 10 seconds
- **SC-002**: Users can add an existing issue to a project with a single command
- **SC-003**: Users can view all issues within a project organized by their position
- **SC-004**: Project operations complete successfully 100% of the time when inputs are valid
- **SC-005**: Error messages clearly indicate what went wrong (e.g., "Issue #45 not found") without exposing technical details
- **SC-006**: Users can manage multiple projects (tested with 50+ projects) without performance degradation
- **SC-007**: 95% of users can successfully complete project creation, item addition, and project viewing on first attempt

## Assumptions & Constraints *(optional)*

### Assumptions

- Projects table and project_items table are already implemented in database schema (verified in schema/001_init.sql)
- Users are familiar with basic CLI command syntax from existing `mgtd` commands (memo, task, etc.)
- Project IDs and Issue IDs are numeric integers
- Position values use fractional numbers (REAL type) to allow insertion between existing items without renumbering
- Default position for new items is the highest current position + 1.0
- Board view projects initialize with three default columns: "To Do", "In Progress", "Done"
- Column names in --column flag are free-text strings - users can specify any column name, not limited to defaults
- view_meta stores project-level view configuration; project_items.view_meta stores item-level metadata (e.g., which column an item belongs to)

### Constraints

- Database enforces UNIQUE constraint on (project_id, issue_id) - same issue cannot appear twice in one project
- Database enforces UNIQUE constraint on project name - no duplicate project names allowed
- CASCADE deletion: when project is deleted, all project_items are removed automatically
- CASCADE deletion: when issue is deleted, all project_items referencing it are removed automatically
- Issues (tasks/memos) remain intact when removed from projects - only the association is deleted

### Dependencies

- Existing issue management system (tasks and memos must exist to be added to projects)
- SQLite database with projects and project_items tables already created
- Existing CLI infrastructure (similar to memo, task, link commands)

## Out of Scope *(optional)*

The following are explicitly excluded from this feature:

- Project sharing or collaboration features
- Project templates or duplication
- Bulk operations (adding multiple issues at once)
- Project archiving (separate from deletion)
- Project statistics or analytics (e.g., completion percentage)
- Custom fields or metadata beyond view_meta
- Project permissions or access control
- Synchronization with external project management tools (GitHub Projects, Jira, etc.)
- Web UI for project management (CLI only in this scope)
- Project search or filtering (beyond basic list)
- Project tags or categories
