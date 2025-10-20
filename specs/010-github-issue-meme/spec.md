# Feature Specification: Web UI for meme-gtd (Memos & Tasks Management)

**Feature Branch**: `010-github-issue-meme`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/28 を実装する。APIサーバをローカルで実行している前提でやること。"
**API Reference**: `/packages/api/docs/api/openapi.yaml` (v0.6.0)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Memos (Priority: P1)

Users can view their captured memos in a list view filtered by bookmark status, and click to see detailed content including body text, labels, and comment count.

**Why this priority**: Viewing memos is the foundational read operation. Memos are the entry point for GTD capture workflow.

**Independent Test**: Can be fully tested by navigating to /memos URL, verifying memo list displays with bookmark filter, clicking a memo row to see details.

**Acceptance Scenarios**:

1. **Given** 10 memos exist in the system, **When** user navigates to /memos, **Then** all 10 memos are displayed with ID, body preview (first line), bookmark status (isBookmarked), createdAt, and updatedAt
2. **Given** user is viewing memo list, **When** user clicks a memo row, **Then** browser navigates to /memos/:id showing full bodyMd text, labels array, and commentsCount
3. **Given** user selects "Bookmarked only" filter, **When** 3 out of 10 memos have isBookmarked=true, **Then** only those 3 memos are displayed (GET /api/memos?bookmarked=true)

---

### User Story 2 - Browse Tasks (Priority: P1)

Users can view their actionable tasks in a list view with status and bookmark filtering, and click to see detailed information.

**Why this priority**: Viewing tasks is equally foundational to memos. Tasks represent the "do" phase of GTD workflow.

**Independent Test**: Can be fully tested by navigating to /tasks URL, applying status/bookmark filters, and clicking a task to see its details.

**Acceptance Scenarios**:

1. **Given** 15 tasks exist across different statuses, **When** user navigates to /tasks, **Then** all 15 tasks are displayed with ID, title, status, isBookmarked, createdAt, and updatedAt
2. **Given** user selects "open" status filter, **When** 5 tasks have status="open", **Then** only those 5 tasks are displayed (GET /api/tasks?status=open)
3. **Given** user selects "Bookmarked only" filter, **When** 3 tasks have isBookmarked=true, **Then** only those 3 tasks are displayed (GET /api/tasks?bookmarked=true)
4. **Given** user is viewing task list, **When** user clicks a task row, **Then** browser navigates to /tasks/:id showing title, bodyMd, status, scheduledOn, labels array, and commentsCount

---

### User Story 3 - Create and Edit Memos (Priority: P2)

Users can create new memos with markdown body text and edit existing memo content from the detail page.

**Why this priority**: Creating memos enables the GTD capture phase. This is critical but depends on viewing memos first.

**Independent Test**: Can be tested by clicking "New memo" button, entering bodyMd, saving (POST /api/memos), and verifying the memo appears in the list. Edit can be tested by updating bodyMd (PATCH /api/memos/{id}).

**Acceptance Scenarios**:

1. **Given** user is on /memos, **When** user clicks "New memo" button, **Then** browser navigates to /memos/new with a bodyMd textarea
2. **Given** user enters markdown text and clicks "Save", **When** form submits POST /api/memos with {bodyMd}, **Then** memo is created (201) and browser navigates to /memos/:id
3. **Given** user is viewing memo details, **When** user clicks "Edit" button, **Then** browser navigates to /memos/:id/edit with editable bodyMd textarea pre-filled
4. **Given** user updates bodyMd and clicks "Save", **When** form submits PATCH /api/memos/{id} with {bodyMd}, **Then** memo is updated (200) and browser returns to /memos/:id

---

### User Story 4 - Create and Edit Tasks (Priority: P2)

Users can create new tasks with title, body, status, and optional scheduled date, and edit existing task details.

**Why this priority**: Creating tasks is essential for GTD workflow but depends on viewing tasks first.

**Independent Test**: Can be tested by clicking "New task" button, filling title/bodyMd/status fields, saving (POST /api/tasks), and verifying task appears in list.

**Acceptance Scenarios**:

1. **Given** user is on /tasks, **When** user clicks "New task" button, **Then** browser navigates to /tasks/new with title, bodyMd, status select, and scheduledOn inputs
2. **Given** user enters title="Buy groceries", bodyMd="Milk, eggs", status="open", and clicks "Save", **When** form submits POST /api/tasks with {title, bodyMd, status}, **Then** task is created (201) and browser navigates to /tasks/:id
3. **Given** user is viewing task details, **When** user clicks "Edit" button, **Then** browser navigates to /tasks/:id/edit with editable title, bodyMd, status, and scheduledOn fields pre-filled
4. **Given** user updates title and status, clicks "Save", **When** form submits PATCH /api/tasks/{id} with {title, status}, **Then** task is updated (200) and browser returns to /tasks/:id

---

### User Story 5 - Manage Labels (Priority: P3)

Users can view all available labels, create new labels, assign labels to memos/tasks, and remove label assignments.

**Why this priority**: Labels enhance organization but core workflow functions without them.

**Independent Test**: Can be tested by fetching labels (GET /api/labels), creating a label (POST /api/labels), assigning it to an issue (POST /api/issues/{issueId}/labels), and verifying labels array updates.

**Acceptance Scenarios**:

1. **Given** user is viewing memo/task details, **When** user clicks [+] in Labels section, **Then** a modal displays all available labels from GET /api/labels
2. **Given** user selects label with id=5 and clicks "Assign", **When** modal submits POST /api/issues/{issueId}/labels with {labelId: 5}, **Then** label is assigned (200) and modal closes
3. **Given** user enters new label name="urgent" and description="High priority" and clicks "Create & Assign", **When** POST /api/labels creates label (201), then POST /api/issues/{issueId}/labels assigns it, **Then** new label appears on the memo/task
4. **Given** a memo/task has labels ["bug", "urgent"], **When** user clicks [Delete] on "bug" label, **Then** DELETE /api/labels/bug is called (204) and label is removed from all issues

---

### User Story 6 - Manage Links (Priority: P3)

Users can create links between memos/tasks with relationship types (parent/child/relates/derived_from) and remove links.

**Why this priority**: Links enable relationship management but aren't required for basic task completion.

**Independent Test**: Can be tested by creating a link (POST /api/links), fetching issue links (GET /api/issues/{id}/links), and deleting a link (DELETE /api/links/{id}).

**Acceptance Scenarios**:

1. **Given** user is viewing memo/task details with id=10, **When** user clicks [+] in Links section, **Then** a modal displays link type selector (parent/child/relates/derived_from) and target issue ID input
2. **Given** user selects linkType="child" and enters targetIssueId=23, clicks "Create Link", **When** modal submits POST /api/links with {sourceIssueId: 10, targetIssueId: 23, linkType: "child"}, **Then** link is created (201) and modal closes
3. **Given** memo/task details are refreshed, **When** GET /api/issues/10/links is called, **Then** links are displayed grouped by linkType with direction (outgoing/incoming) indicator
4. **Given** a link exists with id=50, **When** user clicks [x] on the link, **Then** DELETE /api/links/50 is called (204) and link is removed from UI

---

### User Story 7 - Post and Manage Comments (Priority: P4)

Users can view comments, add new comments with markdown text, edit existing comments, and delete comments on memos and tasks.

**Why this priority**: Comments add value but aren't essential for core GTD workflow.

**Independent Test**: Can be tested by fetching comments (GET /api/memos/{id}/comments), posting a comment (POST /api/memos/{id}/comments), editing (PATCH), and deleting (DELETE).

**Acceptance Scenarios**:

1. **Given** user is viewing memo details with id=5, **When** page loads, **Then** GET /api/memos/5/comments is called and existing comments are displayed with bodyMd, createdAt, updatedAt
2. **Given** user enters markdown text in comment textarea and clicks "Comment", **When** POST /api/memos/5/comments with {bodyMd} is submitted, **Then** comment is created (201) and appears in comment list
3. **Given** a comment exists with id=100, **When** user clicks "Edit" on the comment, edits text, and saves, **Then** PATCH /api/memos/5/comments/100 with {bodyMd} updates the comment (200)
4. **Given** a comment exists with id=100, **When** user clicks "Delete" on the comment, **Then** DELETE /api/memos/5/comments/100 is called (204) and comment is removed from UI

---

### User Story 8 - Promote Memo to Task (Priority: P4)

Users can promote a memo to an actionable task by providing a title and initial status.

**Why this priority**: Promotion is a GTD-specific workflow enhancement but not required for MVP.

**Independent Test**: Can be tested by calling POST /api/memos/{id}/promote with title and status, and verifying a new task is created.

**Acceptance Scenarios**:

1. **Given** user is viewing memo details with id=8, **When** user clicks "Promote to Task" button, **Then** a modal appears with title input and status select (open/next/waiting/scheduled)
2. **Given** user enters title="Implement feature X" and selects status="next", clicks "Promote", **When** modal submits POST /api/memos/8/promote with {title, status}, **Then** a new task is created (200) and browser navigates to /tasks/:taskId

---

### User Story 9 - Bookmark Memos and Tasks (Priority: P4)

Users can bookmark and unbookmark memos and tasks for quick access filtering.

**Why this priority**: Bookmark is a convenience feature for filtering important items. These enhance workflow but aren't blockers for core functionality.

**Independent Test**: Can be tested by calling POST /api/memos/{id}/bookmark or POST /api/memos/{id}/unbookmark, then verifying isBookmarked field updates and filter works.

**Acceptance Scenarios**:

1. **Given** user is viewing memo details with id=3 and isBookmarked=false, **When** user clicks "Bookmark" button, **Then** POST /api/memos/3/bookmark is called (200), isBookmarked becomes true, and button changes to "Unbookmark"
2. **Given** user is viewing task details with id=7 and isBookmarked=true, **When** user clicks "Unbookmark" button, **Then** POST /api/tasks/7/unbookmark is called (200), isBookmarked becomes false, and button changes to "Bookmark"
3. **Given** user is on /memos with "Bookmarked only" filter active, **When** GET /api/memos?bookmarked=true is called, **Then** only memos with isBookmarked=true are displayed

---

### User Story 10 - Close, Cancel, and Reopen Tasks (Priority: P4)

Users can close tasks (set status to done), cancel tasks (set status to canceled), and reopen closed/canceled tasks (set status to open).

**Why this priority**: Status transitions are task-specific workflow management that enhance workflow but aren't blockers.

**Independent Test**: Can be tested by calling POST /api/tasks/{id}/close, POST /api/tasks/{id}/cancel, or POST /api/tasks/{id}/reopen and verifying status field updates.

**Acceptance Scenarios**:

1. **Given** user is viewing task details with id=12 and status="open", **When** user clicks "Close" button, **Then** POST /api/tasks/12/close is called (200), status becomes "done", and button changes to "Reopen"
2. **Given** user is viewing task details with id=15 and status="waiting", **When** user clicks "Cancel" button, **Then** POST /api/tasks/15/cancel is called (200), status becomes "canceled"
3. **Given** user is viewing task details with id=12 and status="done", **When** user clicks "Reopen" button, **Then** POST /api/tasks/12/reopen is called (200), status becomes "open", and button changes to "Close"

---

### User Story 11 - Delete Memos and Tasks (Priority: P5)

Users can soft-delete memos and tasks which sets isDeleted=true without removing them from the database.

**Why this priority**: Deletion is a low-priority operation that can be deferred for MVP.

**Independent Test**: Can be tested by calling DELETE /api/memos/{id} or DELETE /api/tasks/{id} and verifying the item no longer appears in list views.

**Acceptance Scenarios**:

1. **Given** user is viewing memo details with id=20, **When** user clicks "Delete" button and confirms, **Then** DELETE /api/memos/20 is called (204) and browser navigates to /memos
2. **Given** user is viewing task details with id=25, **When** user clicks "Delete" button and confirms, **Then** DELETE /api/tasks/25 is called (204) and browser navigates to /tasks

---

### Edge Cases

- What happens when the API server is not running or unreachable? (network error handling)
- How does the UI handle API errors (400, 404, 409, 500)? (error message display)
- What happens when a user tries to link to a non-existent issue ID? (404 from POST /api/links)
- How does the UI handle markdown rendering of malformed markdown content? (safe markdown parsing)
- What happens when a user navigates to a non-existent memo/task ID? (404 from GET /api/memos/{id} or GET /api/tasks/{id})
- How does the UI handle very long memo bodies (e.g., 10,000 characters)? (textarea scrolling, rendering performance)
- What happens when label creation fails due to duplicate names? (409 from POST /api/labels)
- What happens when promoting a memo without providing required title field? (400 from POST /api/memos/{id}/promote)
- How does the UI handle tasks with null scheduledOn field? (optional field display)
- What happens when bookmark/unbookmark is called on a non-existent issue? (404 from POST /api/memos/{id}/bookmark)

## Requirements *(mandatory)*

### Functional Requirements

**Navigation & Routing**
- **FR-001**: System MUST provide distinct URL routes for memos (/memos) and tasks (/tasks)
- **FR-002**: System MUST support detail routes (/memos/:id, /tasks/:id) for viewing individual items
- **FR-003**: System MUST support creation routes (/memos/new, /tasks/new) for creating new items
- **FR-004**: System MUST support edit routes (/memos/:id/edit, /tasks/:id/edit) for modifying existing items

**Memo List & Detail**
- **FR-005**: System MUST call GET /api/memos to display memo list with id, type, bodyMd, isBookmarked, isDeleted, createdAt, updatedAt
- **FR-006**: System MUST call GET /api/memos?bookmarked=true to filter memos by bookmark status
- **FR-007**: System MUST call GET /api/memos/{id} to display memo details including bodyMd, labels array, and commentsCount
- **FR-008**: System MUST call POST /api/memos with {bodyMd} to create new memos
- **FR-009**: System MUST call PATCH /api/memos/{id} with {bodyMd} to update existing memo body text
- **FR-010**: System MUST call DELETE /api/memos/{id} to soft-delete memos

**Task List & Detail**
- **FR-011**: System MUST call GET /api/tasks to display task list with id, type, title, bodyMd, status, scheduledOn, isBookmarked, isDeleted, createdAt, updatedAt
- **FR-012**: System MUST call GET /api/tasks?status={status} to filter tasks by status (open/next/waiting/scheduled/done/canceled)
- **FR-013**: System MUST call GET /api/tasks?bookmarked=true to filter tasks by bookmark status
- **FR-014**: System MUST call GET /api/tasks/{id} to display task details including title, bodyMd, status, scheduledOn, labels array, and commentsCount
- **FR-015**: System MUST call POST /api/tasks with {title, bodyMd, status, scheduledOn} to create new tasks (title is required)
- **FR-016**: System MUST call PATCH /api/tasks/{id} with {title, bodyMd, status, scheduledOn} to update existing tasks

**Bookmark Management**
- **FR-017**: System MUST call POST /api/memos/{id}/bookmark to bookmark a memo
- **FR-018**: System MUST call POST /api/memos/{id}/unbookmark to unbookmark a memo
- **FR-019**: System MUST call POST /api/tasks/{id}/bookmark to bookmark a task
- **FR-020**: System MUST call POST /api/tasks/{id}/unbookmark to unbookmark a task
- **FR-021**: System MUST update isBookmarked field in UI after bookmark/unbookmark operations

**Task Status Management**
- **FR-022**: System MUST call POST /api/tasks/{id}/close to close a task (set status to done)
- **FR-023**: System MUST call POST /api/tasks/{id}/cancel to cancel a task (set status to canceled)
- **FR-024**: System MUST call POST /api/tasks/{id}/reopen to reopen a task (set status to open)

**Labels Management**
- **FR-025**: System MUST call GET /api/labels to retrieve all available labels with id, name, description, createdAt
- **FR-026**: System MUST call POST /api/labels with {name, description} to create new labels (name is required)
- **FR-027**: System MUST call POST /api/issues/{issueId}/labels with {labelId} to assign labels to memos/tasks
- **FR-028**: System MUST call DELETE /api/labels/{name} to delete labels by name
- **FR-029**: System MUST display labels array from memo/task detail responses

**Links Management**
- **FR-030**: System MUST call POST /api/links with {sourceIssueId, targetIssueId, linkType} to create links (all fields required)
- **FR-031**: System MUST support linkType values: parent, child, relates, derived_from
- **FR-032**: System MUST call GET /api/issues/{id}/links to retrieve all links for an issue with direction (outgoing/incoming)
- **FR-033**: System MUST call DELETE /api/links/{id} to delete links by link ID
- **FR-034**: System MUST display links grouped by linkType and direction

**Comments Management**
- **FR-035**: System MUST call GET /api/memos/{memoId}/comments to retrieve memo comments with id, issueId, bodyMd, createdAt, updatedAt
- **FR-036**: System MUST call POST /api/memos/{memoId}/comments with {bodyMd} to create memo comments
- **FR-037**: System MUST call PATCH /api/memos/{memoId}/comments/{commentId} with {bodyMd} to update memo comments
- **FR-038**: System MUST call DELETE /api/memos/{memoId}/comments/{commentId} to delete memo comments
- **FR-039**: System MUST call GET /api/tasks/{taskId}/comments to retrieve task comments
- **FR-040**: System MUST call POST /api/tasks/{taskId}/comments with {bodyMd} to create task comments
- **FR-041**: System MUST call PATCH /api/tasks/{taskId}/comments/{commentId} with {bodyMd} to update task comments
- **FR-042**: System MUST call DELETE /api/tasks/{taskId}/comments/{commentId} to delete task comments

**Memo Promotion**
- **FR-043**: System MUST call POST /api/memos/{id}/promote with {title, status} to promote memos to tasks (both fields required)
- **FR-044**: System MUST support status values for promotion: open, next, waiting, scheduled

**Error Handling & Feedback**
- **FR-045**: System MUST display loading indicators during API requests
- **FR-046**: System MUST display error messages for 400, 404, 409, 500 response codes
- **FR-047**: System MUST handle 404 errors when navigating to non-existent memo/task IDs
- **FR-048**: System MUST validate form inputs before submission (required fields, field formats)

**API Integration**
- **FR-049**: System MUST connect to API server at http://localhost:3000 (as defined in openapi.yaml servers section)
- **FR-050**: System MUST be served as static files from the API server

**Content Rendering**
- **FR-051**: System MUST render bodyMd fields as markdown in read views
- **FR-052**: System MUST provide plain textarea for bodyMd editing (not WYSIWYG markdown editor)

### Key Entities

- **Memo**: Captured thought or note with bodyMd (markdown content), isBookmarked, isDeleted, createdAt, updatedAt. Detail view includes labels array and commentsCount. Type is always "memo", title is always null, status is always null, scheduledOn is always null.
- **Task**: Actionable item with title, bodyMd (markdown content), status (open/next/waiting/scheduled/done/canceled), scheduledOn (nullable datetime), isBookmarked, isDeleted, createdAt, updatedAt. Detail view includes labels array and commentsCount. Type is always "task".
- **Label**: Categorization tag with id, name (unique), description (nullable), createdAt. Can be attached to any issue (memo or task).
- **Link**: Relationship between issues with id, sourceIssueId, targetIssueId, linkType (parent/child/relates/derived_from), createdAt. Direction field (outgoing/incoming) is computed relative to the queried issue.
- **Comment**: Text note attached to issue with id, issueId, bodyMd (markdown content), createdAt, updatedAt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can view memo list and task list in under 2 seconds after navigation
- **SC-002**: Users can create a new memo or task and see it appear in the list within 3 seconds of submission
- **SC-003**: Users can navigate between memo list, task list, and detail pages with single clicks
- **SC-004**: Users can filter memos by bookmark status and see results update immediately
- **SC-005**: Users can filter tasks by status and bookmark status and see results update immediately
- **SC-006**: Users can assign a label to a memo/task within 10 seconds using the label assignment flow
- **SC-007**: Users can create a link between two items within 10 seconds using the link creation flow
- **SC-008**: Users can post a comment and see it appear immediately after submission (under 2 seconds)
- **SC-009**: Users can promote a memo to task and navigate to the new task within 5 seconds
- **SC-010**: 90% of users successfully complete basic operations (view, create, edit, bookmark, assign label) on first attempt without documentation
- **SC-011**: The web UI remains responsive and usable with up to 500 combined memos and tasks loaded
- **SC-012**: Error messages are clear enough that users understand what went wrong without technical knowledge
- **SC-013**: Markdown content renders correctly in memo/task bodies and comments

## Assumptions *(mandatory)*

- The meme-gtd API server (v0.6.0) is already implemented and running locally at http://localhost:3000 (as specified in user input and openapi.yaml)
- The API provides all endpoints documented in `/packages/api/docs/api/openapi.yaml`
- The API is accessible via HTTP on localhost with default port 3000
- The API OpenAPI specification is accurate and up-to-date
- Users have a modern web browser (Chrome, Firefox, Safari, Edge - last 2 versions)
- The web UI will be served as static files from the API server using @fastify/static
- Authentication is not required for local development environment
- The database is already set up and accessible by the API server
- The API returns JSON responses for all operations as documented
- Markdown rendering library is available and compatible with the tech stack
- API response times are acceptable for localhost development (<100ms)
- Soft-deleted items (isDeleted=true) are filtered out by the API in list endpoints

## Out of Scope *(mandatory)*

- User authentication and authorization
- Multi-user support and access control
- Real-time collaboration and live updates (WebSocket)
- Mobile-responsive design (desktop browser focus for MVP)
- Full-text search functionality (API does not provide search endpoints)
- Advanced filtering by labels (can be added when API supports it)
- Label removal from individual issues (API only supports label deletion which affects all issues)
- Bulk operations (select multiple items for batch actions)
- Drag-and-drop reordering
- Keyboard shortcuts and accessibility features (ARIA labels, screen reader support)
- Calendar or timeline views for scheduled tasks
- Notifications or reminders
- Data export functionality (CSV, JSON download)
- Offline support or service workers
- Production deployment configuration (HTTPS, environment variables, etc.)
- Performance optimization for large datasets (>500 items)
- Advanced markdown editor with live preview mode
- File attachments or image uploads
- Internationalization (i18n) and localization
- Dark mode or theme customization
- Undo/redo functionality
- Task recurrence or scheduling patterns
- Email notifications
- Integration with external services (Google Calendar, Slack, etc.)

## Dependencies *(include if applicable)*

- **meme-gtd API server (v0.6.0)**: Must be running locally and accessible via HTTP at http://localhost:3000
- **Database**: Must be initialized with schema and accessible to API server (SQLite as per project)
- **Modern web browser**: Required to run the web UI (Chrome, Firefox, Safari, Edge)
- **Node.js and pnpm**: Required for build tooling (Vite) and static file serving
- **OpenAPI specification**: `/packages/api/docs/api/openapi.yaml` required for generating type-safe API client

## Constraints *(include if applicable)*

- **Environment**: Local development only, not production-ready
- **API Contract**: Must use the existing meme-gtd API v0.6.0 without modifications to API endpoints
- **API Server URL**: Fixed to http://localhost:3000 as per openapi.yaml servers configuration
- **Browser Compatibility**: Targets modern browsers only (no IE11 support, ES2020+, native fetch API)
- **Network**: Assumes API server is on localhost with low latency (<100ms average)
- **Data Volume**: Initial version optimized for up to 500 combined memos and tasks
- **Rendering**: Markdown rendering must handle potentially untrusted user input safely (XSS prevention)
- **Field Requirements**: Must enforce API required fields (e.g., title for tasks, bodyMd for memos, title+status for promotion)
- **Status Values**: Task status must be one of: open, next, waiting, scheduled, done, canceled (as per API enum)
- **LinkType Values**: Link linkType must be one of: parent, child, relates, derived_from (as per API enum)
- **Promotion Status Values**: Memo promotion status must be one of: open, next, waiting, scheduled (as per API enum, excludes done/canceled)
