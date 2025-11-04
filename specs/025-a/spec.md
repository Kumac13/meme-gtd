# Feature Specification: Fuzzy Search for Tasks and Memos

**Feature Branch**: `025-a`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "オプションA"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Tasks by Title Text (Priority: P1)

A user wants to find a task about "login functionality" but doesn't remember the exact title or ID. They type "login" in the search bar on the Tasks page and see all tasks with "login" in their title, even if the full title is "Implement OAuth login feature" or "Fix login redirect bug".

**Why this priority**: This is the most fundamental search capability. Users currently must remember exact IDs or browse through all tasks, which becomes unmanageable as the task list grows. Free-text search is essential for basic task discoverability.

**Independent Test**: Can be fully tested by creating tasks with various titles containing the word "login", searching for "login", and verifying that all matching tasks appear in the results. Delivers immediate value by enabling users to find tasks without knowing IDs.

**Acceptance Scenarios**:

1. **Given** a task exists with title "Implement login feature", **When** user searches for "login", **Then** the task appears in search results
2. **Given** multiple tasks exist with "login" in their titles, **When** user searches for "login", **Then** all matching tasks are displayed
3. **Given** a task with title "User Authentication", **When** user searches for "login", **Then** that task does NOT appear (no fuzzy matching)
4. **Given** user types "LOGIN" (uppercase), **When** search is performed, **Then** results include tasks with "login" in any case (case-insensitive)

---

### User Story 2 - Search Memos by Body Content (Priority: P1)

A user wants to find a memo they wrote about a meeting with a client. They don't remember when they created it, but they know it mentioned "quarterly review". They search for "quarterly review" in the Memos page and find all memos containing that phrase in their body text.

**Why this priority**: Memos don't have titles, so searching by body content is the ONLY way to find specific memos without browsing. This is equally critical to task title search.

**Independent Test**: Can be fully tested by creating memos with various body content, searching for specific phrases, and verifying correct results. Delivers immediate value for memo discovery.

**Acceptance Scenarios**:

1. **Given** a memo exists with body "Discussed quarterly review with client", **When** user searches for "quarterly", **Then** the memo appears in search results
2. **Given** a memo contains "Q4 quarterly review" and another contains "quarterly sales report", **When** user searches for "quarterly", **Then** both memos appear
3. **Given** a memo with body "Annual report", **When** user searches for "quarterly", **Then** that memo does NOT appear
4. **Given** multiple memos contain the search term, **When** search is performed, **Then** results show 50-character preview text with search term context (truncated with ellipsis if longer)

---

### User Story 3 - Combined Structured and Free-Text Search (Priority: P2)

A user wants to find open tasks related to "authentication" that are tagged with the "bug" label. They type "label:bug status:open authentication" in the search bar. The system filters tasks by both the structured filters (label and status) AND the free-text search term ("authentication" in the title).

**Why this priority**: Power users need to combine filters to narrow down large task lists efficiently. This builds on P1 functionality to enable more precise queries.

**Independent Test**: Can be fully tested by creating tasks with various combinations of labels, statuses, and titles, then verifying that combined queries return only matching tasks. Delivers value by enabling precise filtering.

**Acceptance Scenarios**:

1. **Given** tasks with different labels and titles, **When** user searches "label:bug authentication", **Then** only tasks with "bug" label AND "authentication" in title appear
2. **Given** user types "status:open label:feature login screen", **When** search is performed, **Then** only open tasks with "feature" label and "login screen" in title appear
3. **Given** user types "label:bug,enhancement API", **When** search is performed, **Then** tasks with either "bug" OR "enhancement" label AND "API" in title appear
4. **Given** user enters only free-text without structured filters, **When** search is performed, **Then** all items matching the text are shown regardless of status/labels

---

### User Story 4 - Link Creation with Fuzzy Search (Priority: P2)

A user is viewing Task #45 and wants to link it to a related task about API implementation, but they don't remember the exact task ID. Instead of typing an ID in the link field, they type "API implementation" in the search field and press Enter (or click the search icon). A list of matching tasks/memos appears below. They click on "Task #23: Implement REST API endpoints" from the results, select the link type, and create the link.

**Why this priority**: Current ID-based linking is cumbersome and error-prone. Users must leave the detail page, search for the related task, memorize the ID, then return. Fuzzy search makes linking intuitive and fast.

**Independent Test**: Can be fully tested by creating multiple tasks/memos, opening one item's detail page, typing search text in the link search field, executing the search (Enter/click), verifying results appear below, and confirming link creation on selection. Delivers value by streamlining a common workflow.

**Acceptance Scenarios**:

1. **Given** user is on a task detail page and clicks "Add Link", **When** they type "API" in the search field and press Enter or click search icon, **Then** a results list shows all tasks/memos with "API" in title or body
2. **Given** search results show multiple items, **When** user clicks on a result, **Then** the link type selector appears and link is created upon confirmation
3. **Given** user types an exact task ID (e.g., "23") and executes search, **When** Task #23 exists, **Then** Task #23 appears in results and can be selected
4. **Given** no results match the search text, **When** search is executed, **Then** results area shows "No results found" message
5. **Given** user types text in search field, **When** they have not yet executed search (no Enter/click), **Then** no results are displayed (search must be explicitly triggered)

---

### Edge Cases

- What happens when a search query contains only structured filters (e.g., "label:bug") without free text? → System applies only the structured filters, returns all matching items
- What happens when search text contains special characters (e.g., "user@email.com" or "C++ code")? → System treats them as literal characters for partial matching
- What happens when user searches for a very common word (e.g., "the" or "a") that appears in hundreds of items? → System returns all matches (potentially implementing result limits in planning phase, but spec focuses on correctness)
- What happens when user combines incompatible filters (e.g., "status:open" in memo search)? → System ignores invalid filters for that item type and shows a warning message
- What happens when database contains tasks/memos with special Unicode characters? → System performs case-insensitive search that works correctly with Unicode

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support partial text matching for task titles (case-insensitive substring search)
- **FR-002**: System MUST support partial text matching for memo body content (case-insensitive substring search)
- **FR-003**: System MUST parse search queries to separate structured filters (label:, status:) from free-text search terms
- **FR-004**: System MUST apply free-text search AND structured filters together (AND logic between filter types)
- **FR-005**: System MUST maintain existing structured filter behavior (OR logic for multiple labels within label: filter)
- **FR-006**: Search queries MUST be case-insensitive for both structured filters and free-text terms
- **FR-007**: System MUST provide search capability when creating links between tasks/memos using same UI pattern as Tasks/Memos pages (search icon, explicit execution via Enter key or icon click); link search supports free-text only and does NOT parse structured filters (label:, status:)
- **FR-008**: Link search results MUST display both tasks and memos matching the search query
- **FR-008a**: Link search results MUST limit display to maximum 20 results; if more matches exist, show "More results available - refine your search" message
- **FR-009**: Link search results MUST show item type (task/memo), ID, and title/preview text (preview limited to 50 characters for memos)
- **FR-010**: System MUST support searching by exact numeric ID (returns that specific item if it exists)
- **FR-012**: System MUST preserve current URL-based filter state when applying searches
- **FR-013**: System MUST display appropriate messages for empty search results
- **FR-014**: System MUST handle search queries with special characters without errors
- **FR-015**: Memo search results MUST include context preview showing where search term appears in body (maximum 50 characters, truncated with ellipsis if longer)

### Key Entities

- **Search Query**: Represents user input containing both structured filters (label:, status:) and free-text search terms; parsed into separate components for API processing
- **Search Result Item**: Represents a task or memo matching search criteria; includes item type, ID, title/preview, and relevance context for display
- **Link Search Suggestion**: Represents a potential link target displayed in dropdown; contains enough information for user to identify the correct item (ID, type, title/preview)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find a specific task by searching for a word from its title in under 5 seconds
- **SC-002**: Users can find a specific memo by searching for a phrase from its content in under 5 seconds
- **SC-003**: Users can create a link to a related item without knowing its ID in under 10 seconds
- **SC-004**: Search results appear within 1 second for queries on databases containing up to 10,000 items
- **SC-005**: 90% of users successfully find and link related items on their first search attempt
- **SC-006**: Combined filter and text searches return accurate results matching ALL specified criteria
- **SC-007**: Search functionality works correctly across different languages and character sets (Latin, Japanese, emoji, etc.)

## Clarifications

### Session 2025-11-04

- Q: Multi-word search order sensitivity - should words match in exact order, contiguously with flexible order, or anywhere in any order? → A: Contiguous phrase matching with flexible word order (e.g., "login screen" matches both "login screen bug" AND "screen login feature")
- Q: Link search dropdown result display limit - how many results should be shown when many items match? → A: Maximum 20 items displayed, with "More results available" message if additional matches exist
- Q: Memo search preview text length - how many characters should be shown in search results and link dropdown? → A: 50 characters maximum
- Q: Link search interaction pattern - should it be real-time dropdown or explicit search execution? → A: Use same search UI pattern as existing Tasks/Memos pages (search icon, Enter key or click to execute search, NOT real-time dropdown)
- Q: Link search structured filter support - should link search support label:/status: filters or free-text only? → A: Free-text only (structured filters not parsed in link search context)

## Assumptions

- **Performance**: Search queries will be executed on databases with up to 10,000 tasks/memos; larger datasets may require optimization strategies (not specified in this feature scope)
- **Partial matching**: Simple substring matching is sufficient; advanced fuzzy matching algorithms (e.g., Levenshtein distance) are not required
- **Result ordering**: Search results can be ordered by creation date or ID; relevance ranking is not required for this feature
- **Search scope**: Searches apply only to non-deleted items; deleted items are excluded from results
- **Multi-word search**: Words in free-text portion must appear contiguously but order is flexible (e.g., "login screen" matches "screen login"); both words must be present in sequence but can appear in any order
- **Link search UI**: Uses same search input component as Tasks/Memos pages (search icon, Enter/click to execute); results display below search field; exact positioning and styling details are implementation concerns

## Out of Scope

- Full-text search indexing or advanced search algorithms
- Search history or saved searches
- Bulk operations on search results
- Export of search results
- Search across comments (only task titles and memo bodies)
- Search performance optimization for databases exceeding 10,000 items
- Autocomplete suggestions for structured filters (label:, status:)
- Search analytics or usage tracking
