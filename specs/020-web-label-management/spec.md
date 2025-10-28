# Feature Specification: Web UI Label Management

**Feature Branch**: `020-web-label-management`
**Created**: 2025-10-28
**Status**: Draft
**Input**: User description: "Web UI: Label管理機能の実装 - ラベルの作成、割り当て、削除をWeb UIで管理できるようにする"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assign Existing Labels to Tasks/Memos (Priority: P1)

A user viewing a task or memo needs to categorize it by assigning one or more labels. They open the item detail page, select labels from an available list, and immediately see those labels appear on the item. This allows quick organization and filtering of work items.

**Why this priority**: Label assignment is the core functionality that provides immediate value. Without it, users cannot organize their items effectively, making this the foundation for all other label-related features.

**Independent Test**: Can be fully tested by opening an item detail, clicking a label selector, choosing one or more labels from the list, and verifying the labels appear on the item. Delivers the ability to categorize items.

**Acceptance Scenarios**:

1. **Given** a user is viewing a task detail page, **When** they click the label management control and select "bug" from the available labels, **Then** the "bug" label appears on the task
2. **Given** a task already has the "bug" label assigned, **When** the user opens the label selector, **Then** "bug" appears as checked/selected
3. **Given** a user selects multiple labels (e.g., "bug" and "urgent"), **When** they confirm the selection, **Then** both labels appear on the task with consistent visual styling
4. **Given** a task has labels assigned, **When** the user views the task in a list view, **Then** the same labels are visible on the list item

---

### User Story 2 - Create New Labels (Priority: P2)

A user needs a new label category that doesn't exist yet. From the label selector, they choose "Create new label", enter a name (required) and optional description, see a preview of how it will look, and create it. The new label is immediately available for assignment to any item.

**Why this priority**: Label creation enables users to customize their organization system. While P2 because users can work with existing labels initially, this unlocks full flexibility for personalized workflows.

**Independent Test**: Can be tested by clicking "Create new label" from the label selector, entering name and description, verifying the preview shows the expected appearance, creating the label, and confirming it appears in the available labels list.

**Acceptance Scenarios**:

1. **Given** a user clicks "Create new label" from the label selector, **When** they enter name "documentation" and description "Related to docs", **Then** a preview shows the label with auto-generated color based on the name
2. **Given** a user is creating a new label, **When** they leave the name field empty and try to create, **Then** they see an error message "Name is required"
3. **Given** a user creates a label named "feature", **When** the creation succeeds, **Then** the label appears immediately in the available labels list without requiring page refresh
4. **Given** a label named "bug" already exists, **When** a user tries to create another label with the same name, **Then** they see an error message indicating the duplicate

---

### User Story 3 - Remove Labels from Items (Priority: P2)

A user realizes a label is incorrectly assigned to an item. They open the label selector, uncheck the label, and it immediately disappears from the item. This maintains accurate categorization as work evolves.

**Why this priority**: While less frequent than assignment, label removal is essential for maintaining data accuracy. Ranked P2 because it's equally important as creation for complete label lifecycle management.

**Independent Test**: Can be tested by opening an item with assigned labels, opening the label selector, unchecking a label, and verifying it no longer appears on the item.

**Acceptance Scenarios**:

1. **Given** a task has "bug" and "urgent" labels assigned, **When** the user unchecks "urgent" in the label selector, **Then** only "bug" remains visible on the task
2. **Given** a user removes the last label from an item, **When** the removal completes, **Then** the item displays with no labels
3. **Given** a user removes a label from one item, **When** they view other items with the same label, **Then** those items still show the label (only the specific item is affected)

---

### User Story 4 - Quick Access to Recently Used Labels (Priority: P3)

A user frequently assigns the same few labels to multiple items. The label selector shows recently used labels at the top, allowing faster assignment without searching through all available labels.

**Why this priority**: This is a convenience feature that improves efficiency for power users. Ranked P3 because the system is fully functional without it, and it's a workflow optimization rather than core functionality.

**Independent Test**: Can be tested by assigning a label to an item, then opening another item's label selector and verifying the recently used label appears in a "Recent" section at the top.

**Acceptance Scenarios**:

1. **Given** a user has assigned "bug" to three items in the current session, **When** they open the label selector on a new item, **Then** "bug" appears in a "Recent" section above the full list
2. **Given** the recent labels section shows 5 labels, **When** the user assigns a 6th different label, **Then** the oldest recent label is removed from the recent section but remains in the full list
3. **Given** a user's recent labels are stored locally, **When** they close and reopen the application, **Then** their recent labels are still available in the selector

---

### User Story 5 - Delete Labels Globally (Priority: P4)

A user realizes a label is no longer needed across the entire system (e.g., a completed project phase). They can delete the label, which removes it from all items that have it assigned and from the available labels list.

**Why this priority**: Global deletion is administrative cleanup functionality. Ranked P4 because it's infrequently used, users can work around it by simply not using unwanted labels, and incorrect deletion could cause data loss if not careful.

**Independent Test**: Can be tested by selecting a label for deletion, confirming the action, and verifying it no longer appears in the available labels list or on any items that previously had it.

**Acceptance Scenarios**:

1. **Given** a label "old-project" is assigned to 5 items, **When** the user deletes the label globally, **Then** it disappears from all 5 items and from the available labels list
2. **Given** a user attempts to delete a label, **When** they see a confirmation prompt, **Then** the prompt warns that the label will be permanently removed from all items and cannot be undone
3. **Given** a label is deleted, **When** the deletion completes, **Then** the label is permanently removed and cannot be restored (matches existing API behavior which performs physical deletion)

---

### Edge Cases

- What happens when a user tries to assign the same label twice to an item? (Should be prevented silently or show a message)
- How does the system handle label names with special characters or very long names? (Character limit and validation rules)
- What happens if two users try to create a label with the same name simultaneously?
- How does the label selector behave when there are hundreds of labels? (Search/filter becomes critical)
- What happens to label assignments when network connectivity is lost during the operation?
- How does the system handle label display when an item has many labels? (Overflow, truncation, "show more" behavior)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display all available labels when a user opens the label management control on an item detail page
- **FR-002**: Users MUST be able to assign multiple labels to a single item (task or memo) simultaneously
- **FR-003**: System MUST prevent duplicate label assignments (assigning the same label twice to one item should be idempotent)
- **FR-004**: Users MUST be able to create new labels by providing a name (required) and optional description
- **FR-005**: System MUST generate a unique color for each label based on its name, ensuring visual consistency across all views
- **FR-006**: System MUST prevent creation of labels with duplicate names (case-sensitive uniqueness)
- **FR-007**: Users MUST be able to remove individual labels from specific items without affecting other items
- **FR-008**: System MUST provide a search/filter capability in the label selector to find labels by name
- **FR-009**: System MUST display recently used labels in a separate section for quick access
- **FR-010**: System MUST persist recent label selections across user sessions using local storage
- **FR-011**: System MUST support global deletion of labels, removing them from all assigned items
- **FR-012**: System MUST display labels with consistent colors across all views (detail page, list view, etc.)
- **FR-013**: System MUST show label assignments immediately without requiring page refresh
- **FR-014**: System MUST validate label names to ensure they are non-empty and meet length requirements
- **FR-015**: System MUST provide visual feedback when label operations succeed or fail

### Key Entities

- **Label**: A reusable categorization tag with a unique name, optional description, and auto-generated color. Can be assigned to multiple items.
- **Label Assignment**: The relationship between a label and an item (task or memo), representing that the item has been categorized with that label.
- **Recent Label Usage**: A record of which labels a user has recently assigned, stored locally to provide quick access in the label selector.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can assign a label to an item in under 5 seconds (from opening label selector to seeing the label appear)
- **SC-002**: Users can create a new label and assign it to an item in under 15 seconds
- **SC-003**: Label colors display consistently across all views (detail page and list views show identical colors for the same label)
- **SC-004**: 90% of label assignment operations complete without requiring page refresh
- **SC-005**: Recent labels feature reduces average label assignment time by 30% for users who frequently use the same labels
- **SC-006**: Users can successfully find and assign any label using the search filter, even with 100+ labels available
- **SC-007**: Label operations provide immediate visual feedback within 1 second of user action

## Scope

### In Scope

- Label assignment and removal for individual items
- Label creation with name and description
- Auto-generated label colors based on name hashing
- Search/filter functionality in label selector
- Recent labels quick access feature
- Global label deletion
- Consistent label display across all views
- Visual feedback for label operations

### Out of Scope

- Custom label color selection (colors are always auto-generated)
- Label editing (changing name or description after creation)
- Bulk label operations (assigning labels to multiple items at once)
- Label usage statistics or analytics
- Label hierarchies or parent-child relationships
- Label-based filtering of item lists (will be addressed in a separate feature)
- Label permissions or access control
- Label templates or predefined label sets

## Assumptions

- Users are already authenticated and viewing the web UI
- The label selector UI will follow the same design patterns as existing project assignment UI for consistency
- Network connectivity is generally available (offline support is not required for this feature)
- The number of labels will typically be under 100; performance with thousands of labels is not a primary concern
- Label names are case-sensitive ("Bug" and "bug" are different labels)
- Recent labels are stored per-user in browser local storage and do not sync across devices
- Label deletion is permanent and cannot be undone (existing API performs physical deletion with CASCADE)
- The color generation algorithm produces sufficiently distinct colors for typical label sets
- This feature implements Web UI for existing label APIs (no API changes required except for the missing DELETE endpoint for removing labels from individual items)
