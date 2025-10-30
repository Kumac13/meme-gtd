# Feature Specification: Tasks Page URL State Synchronization

**Feature Branch**: `021-tasks-status-url`
**Created**: 2025-10-30
**Status**: Draft
**Input**: User description: "tasks/ページでstatusフィルター適用時にURLが更新されず、UXが悪化している"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Persistent Filter State via URL (Priority: P1)

A user applying a status filter (e.g., "Open" or "Done") expects the URL to update to reflect the current view, allowing them to bookmark the filtered view, share it with others, or return to it using browser navigation (back/forward buttons).

**Why this priority**: This is the core issue - without URL synchronization, users cannot bookmark specific views, share filtered lists, or navigate reliably. This makes the filter feature partially unusable for common workflows.

**Independent Test**: Can be fully tested by applying any status filter on `/tasks/` and verifying that (1) URL updates to include the filter parameter, (2) refreshing the page maintains the filter state, and (3) browser back/forward buttons work correctly.

**Acceptance Scenarios**:

1. **Given** user is on `/tasks/` (All tasks view), **When** user selects "Open" status filter, **Then** URL updates to `/tasks/?status=open` and only Open tasks are displayed
2. **Given** user is on `/tasks/?status=done`, **When** user clicks browser back button, **Then** URL returns to previous state and corresponding filter is applied
3. **Given** user receives URL `/tasks/?status=next`, **When** user opens the URL in browser, **Then** page loads with "Next" status filter already applied
4. **Given** user is on `/tasks/?status=open`, **When** user selects "All" filter, **Then** URL updates to `/tasks/` (status parameter removed)

---

### User Story 2 - Bookmark Filter State Persistence (Priority: P2)

A user wants to bookmark a specific filtered view (e.g., all Open tasks with bookmarked flag) for quick access during daily work. The bookmarked URL should restore the exact filter state when opened.

**Why this priority**: Supports power users who frequently access specific task views. Enhances productivity by enabling one-click access to frequently used filters.

**Independent Test**: Can be tested by applying multiple filters (status + bookmark), bookmarking the URL, clearing browser state, and reopening the bookmark to verify all filters are restored.

**Acceptance Scenarios**:

1. **Given** user has applied status filter "Open" and bookmark filter "true", **When** user bookmarks the URL `/tasks/?status=open&bookmarked=true`, **Then** opening the bookmark later restores both filters exactly
2. **Given** user has multiple bookmarked task views (Open, Done, Next), **When** user switches between bookmarks, **Then** each bookmark loads the correct filtered view

---

### User Story 3 - Shareable Filtered Views (Priority: P3)

A user wants to share a specific task list view (e.g., all Done tasks) with a colleague via URL. The recipient should see the same filtered view when opening the shared link.

**Why this priority**: Facilitates team collaboration by enabling quick sharing of specific task views during discussions or reviews. Less critical than core URL sync but valuable for team workflows.

**Independent Test**: Can be tested by generating a filtered view URL, sending it to another user (or opening in incognito mode), and verifying the recipient sees the same filtered view.

**Acceptance Scenarios**:

1. **Given** user has filtered tasks to "Done" status, **When** user copies URL `/tasks/?status=done` and shares it via email/chat, **Then** recipient opening the URL sees the same filtered view
2. **Given** user has combined filters applied (status=open&bookmarked=true), **When** shared URL is opened by another user, **Then** all filter states are preserved and applied

---

### Edge Cases

- What happens when URL contains invalid status parameter (e.g., `/tasks/?status=invalid`)? System should default to "All" view and optionally show a warning.
- What happens when URL contains multiple conflicting status parameters (e.g., `/tasks/?status=open&status=done`)? System should use the first valid parameter and ignore duplicates.
- What happens when user navigates from `/tasks/?status=open` to another page and then uses browser back button? System should restore the filtered view correctly.
- What happens when bookmarked filter is applied but user has no bookmarked tasks? System should display empty state with appropriate message.
- What happens if user manually edits URL to include unsupported parameters? System should ignore unknown parameters and apply only recognized filters.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST update URL query parameters whenever a user applies or changes a status filter (open, done, next, all)
- **FR-002**: System MUST read status filter state from URL query parameters on page load and apply the corresponding filter
- **FR-003**: System MUST update URL query parameters when bookmark filter is toggled (bookmarked=true or removed)
- **FR-004**: System MUST read bookmark filter state from URL query parameters on page load
- **FR-005**: System MUST remove status parameter from URL when "All" filter is selected (default state)
- **FR-006**: System MUST remove bookmarked parameter from URL when bookmark filter is disabled
- **FR-007**: System MUST maintain browser history entries for each filter change, enabling proper back/forward button navigation
- **FR-008**: System MUST handle invalid or unsupported URL parameters gracefully by defaulting to "All" view
- **FR-009**: System MUST support multiple simultaneous query parameters (e.g., `?status=open&bookmarked=true`)
- **FR-010**: System MUST preserve other unrelated query parameters when updating filter-related parameters

### Key Entities

- **Status Filter**: Represents the task status being filtered (values: all, open, done, next). Stored in URL as `?status={value}` query parameter. When value is "all", parameter is omitted from URL.
- **Bookmark Filter**: Represents whether to show only bookmarked tasks (boolean). Stored in URL as `?bookmarked=true` when enabled, omitted when disabled.
- **URL State**: The complete set of query parameters representing all active filters. Must be synchronized bidirectionally with UI filter controls.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can bookmark a filtered task view and return to the exact same view when opening the bookmark (100% filter state preservation)
- **SC-002**: Browser back/forward buttons correctly navigate between different filter states without losing any applied filters
- **SC-003**: Shared URLs preserve all filter states when opened by different users or in different sessions (100% shareability)
- **SC-004**: Page refresh maintains current filter state without resetting to "All" view (100% state persistence)
- **SC-005**: Filter state changes update URL within 100ms of user interaction (perceived as instant)
