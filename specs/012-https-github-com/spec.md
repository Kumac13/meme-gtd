# Feature Specification: Add Comment Count to API List Responses

**Feature Branch**: `012-https-github-com`
**Created**: 2025-10-21
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/29 issueにそって実装したい。現状の処理をみて要件を固めろ。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Display Comment Counts in Web UI Lists (Priority: P1)

When users view lists of memos or tasks in the Web UI, they need to see how many comments each item has without clicking into each one. This helps users identify active discussions and prioritize which items to review.

**Why this priority**: This is the primary value proposition identified in issue #29. The Web UI currently cannot display comment counts because the API doesn't provide this data. This is a critical UX improvement for the Web UI.

**Independent Test**: Can be fully tested by making GET requests to `/api/memos` and `/api/tasks` endpoints and verifying that each item in the response includes a `commentCount` field with an accurate count. Delivers immediate value to Web UI users who can now see comment activity at a glance.

**Acceptance Scenarios**:

1. **Given** a memo with 3 comments exists, **When** GET /api/memos is called, **Then** the response includes that memo with `commentCount: 3`
2. **Given** a task with 0 comments exists, **When** GET /api/tasks is called, **Then** the response includes that task with `commentCount: 0`
3. **Given** multiple memos with varying comment counts exist, **When** GET /api/memos is called with a bookmark filter, **Then** only filtered memos are returned, each with accurate comment counts
4. **Given** a task has 5 comments but 2 are soft-deleted, **When** GET /api/tasks is called, **Then** the response shows `commentCount: 3` (excluding deleted comments)

---

### Edge Cases

- What happens when an issue has no comments? (Should return `commentCount: 0`)
- What happens when an issue has soft-deleted comments? (Should exclude deleted comments from the count)
- How does the system handle performance with large numbers of comments? (Count aggregation should be efficient via SQL COUNT)
- What happens to existing API consumers expecting the old schema? (The field is additive, so existing consumers will continue to work; the Web UI currently treats it as optional)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The GET /api/memos endpoint MUST include a `commentCount` field in each memo object, representing the number of non-deleted comments associated with that memo
- **FR-002**: The GET /api/tasks endpoint MUST include a `commentCount` field in each task object, representing the number of non-deleted comments associated with that task
- **FR-003**: The `commentCount` field MUST exclude soft-deleted comments (where `is_deleted = 1`) from the count
- **FR-004**: The `commentCount` field MUST be a non-negative integer
- **FR-005**: The comment count calculation MUST be performed efficiently using database aggregation (SQL COUNT) rather than loading all comments into memory
- **FR-006**: The API response schema MUST be updated to include the `commentCount` field in the Zod schema definitions for MemoSchema and TaskSchema
- **FR-007**: The comment count aggregation MUST maintain correct results when filters are applied (e.g., bookmark filter, status filter)

### Key Entities

- **Memo**: An issue of type 'memo' that can have associated comments. The list response representation must now include a count of its comments.
- **Task**: An issue of type 'task' that can have associated comments. The list response representation must now include a count of its comments.
- **Comment**: A comment attached to an issue (memo or task). Only non-deleted comments should be included in the count.
- **API Response Object**: The JSON representation returned by list endpoints, which will be extended to include `commentCount`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users viewing memo or task lists can see comment counts without making additional API requests (reduces API calls needed for this information)
- **SC-002**: The comment count field is accurate for 100% of memos and tasks, matching the actual number of non-deleted comments in the database
- **SC-003**: List endpoint response times remain within acceptable limits (no more than 10% performance degradation compared to current implementation)
- **SC-004**: Web UI can remove the optional handling workaround and display comment counts reliably for all items

## Assumptions

1. **Database Schema**: The existing `comments` table has an `is_deleted` column to support soft deletion
2. **Performance**: The database size and query patterns allow for efficient COUNT aggregation without significant performance impact
3. **API Versioning**: This is an additive change that doesn't require API versioning since it's backward compatible (adding a field doesn't break existing consumers)
4. **Comment Visibility**: Only non-deleted comments should be counted, consistent with existing list operations that filter out deleted records
5. **Default Value**: The field should always be present (not optional) in list responses, with a value of 0 for items with no comments

## Dependencies

- Existing database schema with `issues`, `comments`, and `issue_labels` tables
- Current implementation of `listMemos` and `listTasks` in the database repository layer
- Current implementation of `MemoService.list()` and `TaskService.list()` in the core package
- Current implementation of list handlers in the API package
- Zod schemas for API validation and OpenAPI documentation

## Out of Scope

- Adding comment counts to detail endpoints (GET /api/memos/:id and GET /api/tasks/:id) - these already have access to full comment data via separate endpoints
- Creating new endpoints for comment count aggregation
- Implementing real-time updates when comment counts change
- Adding comment count sorting or filtering capabilities to list endpoints
- Modifying CLI output to include comment counts
