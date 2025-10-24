# Feature Specification: Link Management Web Interface

**Feature Branch**: `014-link-management-web-interface`
**Created**: 2025-10-24
**Status**: Draft
**Input**: User description: "Add link management UI to Web interface"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Existing Links (Priority: P1)

As a user viewing a task or memo detail page, I want to see all related links displayed inline (between Title/Labels and Body) so that I can quickly understand the relationships without leaving the page or using CLI commands.

**Why this priority**: This is the foundation for all link management - users must be able to see links before they can create or delete them. It provides immediate value by surfacing existing relationship information that was previously hidden in the CLI.

**Independent Test**: Can be fully tested by navigating to any task/memo detail page that has existing links and verifying they are displayed with correct type indicators, direction arrows, and target issue titles. Delivers value by making hidden relationships visible.

**Acceptance Scenarios**:

1. **Given** I am viewing a task detail page with 2 outgoing parent links, **When** the page loads, **Then** I see a "Links (2)" section between the Labels and Body sections showing both links with parent indicators (📤) and target task titles
2. **Given** I am viewing a memo with 1 incoming "relates" link from another memo, **When** the page loads, **Then** I see "Links (1)" section with the incoming related link showing bidirectional indicator (🔗) and source memo preview text
3. **Given** I am viewing a task with no links, **When** the page loads, **Then** I see a collapsed "Links (0)" section
4. **Given** I am viewing a memo with 3 links of different types (parent, child, relates), **When** the Links section loads, **Then** each link shows the correct type indicator and direction (📤 outgoing parent, 📥 incoming child, 🔗 relates)

---

### User Story 2 - Create New Links Inline (Priority: P2)

As a user editing a task or memo, I want to add new links to other issues using an inline form (similar to GitHub's "Create sub-issue") so that I can establish relationships without opening modals or switching to CLI.

**Why this priority**: Once users can see links, the natural next need is creating new ones. This builds on P1 by adding the core modification capability. It's P2 because viewing existing links provides value even without creation.

**Independent Test**: Can be fully tested by clicking the [+ Add] button in the Links section, selecting a link type from the dropdown, entering a target issue ID, and verifying the link is created and appears in the list. Delivers value by enabling relationship creation directly in the UI.

**Acceptance Scenarios**:

1. **Given** I am viewing a task detail page, **When** I click the [+ Add] button in the Links section, **Then** I see a dropdown with 4 link type options (parent, child, relates, derived_from)
2. **Given** I selected "parent" from the link type dropdown, **When** I enter a valid task ID (#5) in the target issue field and click [Add], **Then** a new parent link is created and appears in the Links section with the target task's title fetched from the API
3. **Given** I am adding a parent link to task #3, **When** I enter task #3 which would create a circular relationship, **Then** I see an inline error message "Cannot create link: This would create a circular hierarchy" and the link is not created
4. **Given** I am in the process of adding a link, **When** I click [Cancel], **Then** the inline form closes and no link is created
5. **Given** I entered an invalid issue ID (#999999), **When** I click [Add], **Then** I see an inline error "Issue not found" and the link is not created

---

### User Story 3 - Delete Links with Confirmation (Priority: P3)

As a user managing task/memo relationships, I want to delete links with inline confirmation so that I can remove incorrect or outdated relationships safely and quickly.

**Why this priority**: Deletion is important but less frequent than viewing and creating. It's P3 because users can still manage links effectively with just view + create functionality, and deletion can be handled via CLI if needed initially.

**Independent Test**: Can be fully tested by clicking the [×] button next to any link, confirming the deletion, and verifying the link is removed from both the UI and database. Delivers value by completing the CRUD operations for link management.

**Acceptance Scenarios**:

1. **Given** I am viewing a task with 2 links, **When** I click the [×] button next to the first link, **Then** I see an inline confirmation "Delete this link? [Confirm] [Cancel]" for that specific link
2. **Given** I see a delete confirmation prompt, **When** I click [Confirm], **Then** the link is deleted, the confirmation disappears, and the link count updates (e.g., "Links (2)" becomes "Links (1)")
3. **Given** I see a delete confirmation prompt, **When** I click [Cancel], **Then** the confirmation disappears and the link remains unchanged
4. **Given** I am deleting the last link from an issue, **When** I confirm deletion, **Then** the Links section shows "Links (0)" and remains visible (but collapsed by default)

---

### Edge Cases

- What happens when viewing a link to a deleted issue (is_deleted = 1)?
  - System should show "Issue #X (deleted)" as the title and disable the link
- How does the system handle concurrent modifications (two users deleting the same link)?
  - Second deletion attempt should show "Link not found" error inline
- What happens when the target issue title is very long (>100 characters)?
  - Display truncated title with ellipsis (e.g., "Very long task title that goes...")
- How does the system handle slow API responses when fetching links?
  - Show loading indicator in Links section header: "Links (loading...)"
- What happens when a user tries to create a duplicate link?
  - Show inline error: "Link already exists between these issues"
- How does the collapsible section behave when there are many links (10+)?
  - Section remains collapsible; user can expand/collapse; consider pagination if >20 links

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a "Links" section between the Labels and Body sections on all task and memo detail pages
- **FR-002**: System MUST show the count of links in the section header (e.g., "Links (3)")
- **FR-003**: System MUST make the Links section collapsible, defaulting to expanded when links exist and collapsed when empty
- **FR-004**: System MUST display each link with type indicator icon, direction arrow, and target issue title
- **FR-005**: System MUST use distinct icons for link types: 📤/📥 for parent/child (depending on direction), 🔗 for relates, ⚡ for derived_from
- **FR-006**: System MUST fetch link data from `GET /api/issues/:id/links` endpoint on page load, which includes target issue information (id, type, title) in the response
- **FR-007**: System MUST provide an [+ Add] button in the Links section header to initiate link creation
- **FR-008**: System MUST show an inline dropdown with 4 link type options (parent, child, relates, derived_from) when user clicks [+ Add]
- **FR-009**: System MUST show an inline input field for target issue ID after user selects a link type from dropdown
- **FR-010**: System MUST create a new link via `POST /api/links` endpoint when user enters valid target ID and clicks [Add]
- **FR-011**: System MUST refresh the links list after successful link creation without full page reload
- **FR-012**: System MUST display API validation errors inline below the input field (e.g., circular hierarchy, issue not found, duplicate link)
- **FR-013**: System MUST provide a [Cancel] button to close the inline add form without creating a link
- **FR-014**: System MUST show a [×] delete button next to each link
- **FR-015**: System MUST display inline confirmation prompt "Delete this link? [Confirm] [Cancel]" when user clicks [×]
- **FR-016**: System MUST delete the link via `DELETE /api/links/:id` endpoint when user clicks [Confirm]
- **FR-017**: System MUST refresh the links list after successful deletion without full page reload
- **FR-018**: System MUST update the link count in section header after creation or deletion
- **FR-019**: System MUST show loading indicator during API operations (fetch/create/delete)
- **FR-020**: System MUST match the existing Web UI design patterns and styling (consistent with Labels section)

### Key Entities

- **Link Display Item**: Represents a link in the UI with properties: link ID, source issue ID, target issue ID, link type (parent/child/relates/derived_from), direction (outgoing/incoming), target issue title, target issue type (task/memo)
- **Link Creation Form**: Transient UI state containing selected link type, entered target issue ID, validation errors, loading state
- **Delete Confirmation State**: Transient UI state tracking which link is being deleted and confirmation status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view all links for a task/memo without leaving the detail page (0 CLI commands needed)
- **SC-002**: Users can create a new link in under 10 seconds from viewing the detail page (3 clicks: [+ Add] → select type → enter ID → [Add])
- **SC-003**: Users can delete a link in under 5 seconds (2 clicks: [×] → [Confirm])
- **SC-004**: Link section loads within 2 seconds for issues with up to 20 links
- **SC-005**: 90% of link creation attempts succeed on first try (validated by tracking error rate vs. success rate)
- **SC-006**: All validation errors from API are displayed inline within 1 second of user action
- **SC-007**: UI remains responsive during all API operations (no page freezes or unresponsive buttons)
- **SC-008**: Zero need for users to open modals or navigate away from detail page to manage links

## Dependencies

- Existing Web UI infrastructure (packages/web) with React components
- API endpoints from PR #42:
  - `GET /api/issues/:id/links` (enhanced with targetIssue information)
  - `POST /api/links` (with validation for circular hierarchy, duplicates, etc.)
  - `DELETE /api/links/:id`
- Existing Labels section implementation as reference for UI patterns
- Task and Memo detail pages (MemoDetail.tsx, TaskDetail.tsx)

## Assumptions

- Web UI is built with React (based on TypeScript examples in issue #43)
- API responses are JSON formatted
- Error messages from API are in English and user-friendly
- Target issue titles are available in API response (confirmed in issue #43 update)
- Users are familiar with numeric issue IDs (e.g., #5, #10)
- Link operations require no additional authentication beyond existing session
- Browser supports modern JavaScript features (ES6+) and CSS for styling
- Inline forms use simple text input for issue ID (no autocomplete/search in MVP)

## Out of Scope

- Modal dialogs for link creation or deletion
- Advanced link filtering UI (show/hide by type)
- Bulk link operations (create/delete multiple at once)
- Visual graph or tree view of link relationships
- Drag-and-drop link reordering
- Autocomplete or search functionality for target issue selection
- Link editing (changing link type requires delete + create)
- Keyboard shortcuts for link management
- Mobile-optimized touch interactions
- Real-time collaborative link updates (WebSocket/polling)
