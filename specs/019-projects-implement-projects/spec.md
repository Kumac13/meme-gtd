# Feature Specification: Project Detail Page with Multiple Views

**Feature Branch**: `019-projects-implement-projects`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "Projects UI: Implement /projects/:id detail page with Kanban and Lists views"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Project in Kanban Board Format (Priority: P1)

Users need to visualize their project tasks and memos in a board format to track progress across different stages. This allows quick identification of bottlenecks and work distribution.

**Why this priority**: Kanban view is the primary visualization for project management, providing immediate visual feedback on project status and work distribution.

**Independent Test**: Navigate to a project, see tasks organized by status columns (Open, Next, Waiting, etc.) and memos in a Documents column. Verify items are grouped correctly and counts are accurate.

**Acceptance Scenarios**:

1. **Given** I have a project with 5 tasks and 3 memos, **When** I open the project detail page, **Then** I see a Kanban board with columns for each task status plus a Documents column for memos
2. **Given** I'm viewing a Kanban board, **When** I look at column headers, **Then** I see the column name and count of items in that column (e.g., "Open 3")
3. **Given** tasks exist with status "Open", **When** I view the Kanban board, **Then** those tasks appear in the "Open" column
4. **Given** memos exist in the project, **When** I view the Kanban board, **Then** all memos appear in the "Documents" column

---

### User Story 2 - Move Items Between Columns (Priority: P1)

Users need to update task status by dragging cards between columns, providing a natural and intuitive way to reflect work progress without navigating to separate edit forms.

**Why this priority**: Core interaction pattern for Kanban boards - without drag-and-drop, the Kanban view loses its primary value proposition.

**Independent Test**: Drag a task card from "Open" to "Done" column, verify the card moves visually and the change persists after page reload.

**Acceptance Scenarios**:

1. **Given** I see a task card in the "Open" column, **When** I drag it to the "Done" column, **Then** the card moves to the Done column immediately
2. **Given** I've moved a card to a different column, **When** I reload the page, **Then** the card remains in its new column
3. **Given** I'm dragging a card, **When** the save operation fails, **Then** the card returns to its original column and I see an error message
4. **Given** I'm viewing a Kanban board, **When** I drag a card between columns, **Then** column counts update immediately to reflect the change

---

### User Story 3 - View Project as a List (Priority: P2)

Users need an alternative list view to see all project items in a compact, scannable format similar to the main tasks and memos pages, useful for quick review or bulk operations.

**Why this priority**: Provides alternative viewing option for users who prefer linear lists over board layouts, important for accessibility and user preference.

**Independent Test**: Switch to List view, verify all project tasks and memos are displayed in a flat list format matching the style of `/tasks` and `/memos` pages.

**Acceptance Scenarios**:

1. **Given** I'm viewing a project in Kanban view, **When** I click the "Lists" tab, **Then** I see all project items in a list format
2. **Given** I'm in List view, **When** I look at the items, **Then** I see task titles, memo previews, status indicators, and IDs similar to the main tasks/memos pages
3. **Given** I'm viewing a project, **When** I switch between Kanban and Lists tabs, **Then** the same items are shown in both views
4. **Given** I'm in List view, **When** I click on an item, **Then** I navigate to that task or memo's detail page

---

### User Story 4 - Switch Between View Modes (Priority: P2)

Users need to easily toggle between Kanban and Lists views to choose the most appropriate visualization for their current task, with the URL reflecting their choice for bookmarking and sharing.

**Why this priority**: Essential for providing user choice and enabling shareable/bookmarkable views, but secondary to the core viewing functionality.

**Independent Test**: Click between Kanban and Lists tabs, verify URL updates and view changes accordingly. Share the URL with someone else and verify they see the same view.

**Acceptance Scenarios**:

1. **Given** I'm on a project page, **When** I click the "Lists" tab, **Then** the URL changes to include `/views/list`
2. **Given** I'm in List view, **When** I click the "Kanban" tab, **Then** the URL changes to `/views/kanban`
3. **Given** I directly visit `/projects/:id`, **When** the page loads, **Then** I'm redirected to `/projects/:id/views/kanban` (default view)
4. **Given** I bookmark `/projects/:id/views/list`, **When** I visit that bookmark, **Then** I see the List view directly

---

### Edge Cases

- What happens when a project has no items (empty project)?
- How does the system handle a project that only contains memos (no tasks)?
- What happens when a task has a status that doesn't match any predefined column?
- How does the system behave when drag-and-drop operation takes longer than expected (network lag)?
- What happens when trying to access a non-existent project ID?
- How does the system handle a project with hundreds of items (performance)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display project details including project name, description, and associated items (tasks and memos)
- **FR-002**: System MUST provide two distinct view modes for projects: Kanban board and List
- **FR-003**: System MUST organize tasks into columns based on their status (Open, Next, Waiting, Scheduled, Done, Canceled)
- **FR-004**: System MUST display all memos in a single "Documents" column in Kanban view
- **FR-005**: System MUST show item count for each column in the Kanban board
- **FR-006**: System MUST allow users to move tasks between status columns using drag-and-drop interaction
- **FR-007**: System MUST immediately reflect drag-and-drop changes in the UI (optimistic update)
- **FR-008**: System MUST persist column changes when a user moves a task
- **FR-009**: System MUST revert UI changes if the save operation fails
- **FR-010**: System MUST display tasks and memos in List view matching the style and format of the main tasks and memos list pages
- **FR-011**: System MUST provide visible tab navigation to switch between Kanban and Lists views
- **FR-012**: System MUST update the URL when users switch between views
- **FR-013**: System MUST default to Kanban view when accessing a project without specifying a view
- **FR-014**: System MUST display appropriate error messages for non-existent projects
- **FR-015**: System MUST display loading states while fetching project data

### Key Entities

- **Project**: Container for related tasks and memos; has a name, description, and view metadata
- **Project Item**: Association between a project and a task/memo; includes position and column information for board view
- **Column**: Visual grouping in Kanban view; represents task status or memo collection (Documents)
- **Card**: Visual representation of a task or memo within a Kanban column; displays item ID and title/preview

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view project contents in under 2 seconds after navigating to project page
- **SC-002**: Users can successfully drag and drop task cards between columns with immediate visual feedback (under 100ms response time)
- **SC-003**: 95% of drag-and-drop operations complete successfully and persist changes
- **SC-004**: Users can switch between Kanban and Lists views in under 1 second
- **SC-005**: Project pages with up to 100 items load and remain responsive
- **SC-006**: Users can identify project status at a glance through column organization and counts
