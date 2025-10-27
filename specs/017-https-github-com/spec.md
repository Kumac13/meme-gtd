# Feature Specification: Projects Sidebar in Task/Memo Detail Pages

**Feature Branch**: `017-https-github-com`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/51"
**Related Issue**: [#51](https://github.com/Kumac13/meme-gtd/issues/51)
**Parent Issue**: [#41](https://github.com/Kumac13/meme-gtd/issues/41)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Associated Projects (Priority: P1)

A user is viewing a task or memo detail page and needs to quickly see which projects it belongs to.

**Why this priority**: This is the foundational capability - users must be able to see project associations before they can manage them. Without this, the entire feature is non-functional.

**Independent Test**: Can be fully tested by navigating to any task/memo detail page and verifying that associated projects are displayed in the right sidebar. Delivers immediate value by providing visibility into project relationships.

**Acceptance Scenarios**:

1. **Given** a task/memo with 2 associated projects, **When** the user views the detail page, **Then** the Projects section displays both project names with their icons and status
2. **Given** a task/memo with no associated projects, **When** the user views the detail page, **Then** the Projects section displays with header and gear icon but no project items
3. **Given** a task/memo with 1 associated project showing "In Progress" status, **When** the user views the detail page, **Then** the project is displayed with its status indicator

---

### User Story 2 - Add Projects to Task/Memo (Priority: P2)

A user wants to associate their task or memo with one or more projects to organize their work.

**Why this priority**: This is the primary action users will take - adding items to projects. While viewing is essential, the ability to add creates the actual value of project organization.

**Independent Test**: Can be tested by clicking the gear icon, selecting projects from the dropdown, and verifying they appear in the sidebar. Delivers the core value of project organization.

**Acceptance Scenarios**:

1. **Given** a task/memo detail page, **When** the user clicks the gear icon in the Projects section, **Then** a "Select projects" dropdown opens showing available projects
2. **Given** the "Select projects" dropdown is open, **When** the user checks a project checkbox, **Then** the task/memo is immediately added to that project and the checkbox remains checked
3. **Given** the "Select projects" dropdown is open with 10 projects, **When** the user checks 3 different projects in sequence, **Then** all 3 projects are added without closing the dropdown
4. **Given** a task/memo with no projects, **When** the user adds the first project, **Then** the project appears in the Projects section

---

### User Story 3 - Remove Projects from Task/Memo (Priority: P2)

A user wants to remove a task or memo from a project when it no longer belongs there.

**Why this priority**: Equal to adding - users need both capabilities to effectively manage project associations. This is part of the core CRUD operations.

**Independent Test**: Can be tested by unchecking projects in the dropdown and verifying they disappear from the sidebar. Delivers flexibility in project organization.

**Acceptance Scenarios**:

1. **Given** a task/memo associated with 2 projects and the dropdown is open, **When** the user unchecks one project, **Then** the task/memo is removed from that project and the sidebar updates
2. **Given** a task/memo associated with 1 project and the dropdown is open, **When** the user unchecks the last project, **Then** the task/memo is removed and the Projects section shows no projects but remains visible
3. **Given** the "Select projects" dropdown is open, **When** the user unchecks and rechecks the same project, **Then** the project is removed then re-added successfully

---

### User Story 4 - Search/Filter Projects (Priority: P3)

A user with many projects wants to quickly find specific projects without scrolling through a long list.

**Why this priority**: This is a usability enhancement that becomes valuable as the number of projects grows, but isn't essential for basic functionality.

**Independent Test**: Can be tested by typing in the filter box and verifying that only matching projects are shown. Delivers efficiency for power users.

**Acceptance Scenarios**:

1. **Given** the "Select projects" dropdown with 15 projects, **When** the user types "marketing" in the filter box, **Then** only projects containing "marketing" in their name are displayed
2. **Given** the filter is showing 3 matching projects, **When** the user clears the filter text, **Then** all projects are displayed again
3. **Given** the filter is active, **When** the user checks a visible project, **Then** the project is added and the filter remains active

---

### User Story 5 - Access Recent Projects (Priority: P3)

A user frequently works with the same 2-3 projects and wants quick access to them without searching.

**Why this priority**: This is a convenience feature that improves workflow efficiency but isn't necessary for core functionality.

**Independent Test**: Can be tested by verifying that recently used projects appear in the Recent section above the full list. Delivers workflow optimization.

**Acceptance Scenarios**:

1. **Given** the "Select projects" dropdown is open, **When** the dropdown displays, **Then** the top 2 most recently used projects appear in a "Recent" section
2. **Given** a user has added a task to "Project A", **When** they open the dropdown for a different task, **Then** "Project A" appears in the Recent section
3. **Given** the Recent section shows 2 projects, **When** the user applies the filter, **Then** the Recent section is also filtered

---

### Edge Cases

- What happens when a project is deleted while the dropdown is open?
- How does the system handle network errors when adding/removing projects?
- What happens if two users modify the same task's projects simultaneously?
- How are project icons displayed when a project has no custom icon?
- What happens when a project name is very long (50+ characters)?
- How does the system handle attempting to add a task to a project it already belongs to?
- What happens when the Recent section would show projects that match the current filter?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Projects" section in the right sidebar of task and memo detail pages
- **FR-002**: System MUST show a gear icon (⚙️) next to the "Projects" header
- **FR-003**: System MUST display each associated project with its icon, name, and status (e.g., "No status")
- **FR-004**: System MUST display the Projects section even when a task/memo has no associated projects (to allow adding projects via gear icon)
- **FR-005**: System MUST show an expand/collapse arrow (▼) for each project in the sidebar
- **FR-006**: System MUST open a "Select projects" dropdown/popover (NOT a modal dialog) when the gear icon is clicked
- **FR-007**: System MUST display a "Filter projects" search box at the top of the dropdown
- **FR-008**: System MUST show a "Recent" section in the dropdown displaying the 2 most recently used projects
- **FR-009**: System MUST show an "Organization" section in the dropdown displaying all available projects
- **FR-010**: System MUST display each project with a checkbox, icon, and name in the dropdown
- **FR-011**: System MUST indicate which projects are currently associated (checked checkboxes)
- **FR-012**: System MUST add a task/memo to a project immediately when its checkbox is checked
- **FR-013**: System MUST remove a task/memo from a project immediately when its checkbox is unchecked
- **FR-014**: System MUST keep the dropdown open after checking or unchecking a project
- **FR-015**: System MUST filter both Recent and Organization sections when text is entered in the search box
- **FR-016**: System MUST perform case-insensitive filtering on project names
- **FR-017**: System MUST update the sidebar display immediately after adding or removing a project
- **FR-018**: System MUST track recently used projects for display in the Recent section
- **FR-019**: System MUST limit the Recent section to 2 projects maximum

### Key Entities

- **Project Association**: The relationship between a task/memo and a project, including the current status within that project
- **Project**: An organizational container with a name, icon, and collection of tasks/memos
- **Project Status**: The current state of an item within a project (e.g., "No status", "In Progress", "Done")

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all associated projects for a task/memo within 1 second of page load
- **SC-002**: Users can add a task/memo to a project in under 3 seconds (from clicking gear icon to checkbox check)
- **SC-003**: Users can find and add a project using search in under 5 seconds
- **SC-004**: The dropdown supports managing associations for tasks/memos with up to 50 available projects without performance degradation
- **SC-005**: Project additions and removals complete within 1 second with visual feedback
- **SC-006**: 95% of users can successfully add a task to a project without assistance
- **SC-007**: The sidebar accurately reflects all project associations with zero discrepancies
