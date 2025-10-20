# Feature Specification: HTTP API Server for CLI-Equivalent Operations

**Feature Branch**: `009-https-github-com`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/25 と現状の実装に基づいて、実装をしたい。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Basic HTTP Access to Memo Operations (Priority: P1)

A developer wants to access their memo pool from a web frontend or iPhone app through a local HTTP API server, performing the same operations available in the CLI (create, list, view, edit, delete, promote, bookmark, comment).

**Why this priority**: This is the core value proposition - making memo operations accessible via HTTP. Without this, no external clients can interact with the memo pool, blocking all web/mobile app development.

**Independent Test**: Can be fully tested by starting the API server, making HTTP requests to create/list/view memos with JSON payloads, and verifying responses match CLI behavior. Delivers immediate value by enabling basic remote memo management.

**Acceptance Scenarios**:

1. **Given** API server is running on localhost:3000, **When** POST /api/memos with `{"bodyMd": "Test memo"}`, **Then** server responds 201 with created memo object containing id, bodyMd, createdAt, labels, isBookmarked
2. **Given** several memos exist in database, **When** GET /api/memos?limit=10, **Then** server responds 200 with array of memo objects sorted by updatedAt descending
3. **Given** memo ID 5 exists, **When** GET /api/memos/5, **Then** server responds 200 with full memo details including body, labels, comments
4. **Given** memo ID 5 exists, **When** PATCH /api/memos/5 with `{"bodyMd": "Updated content"}`, **Then** server responds 200 with updated memo
5. **Given** memo ID 5 exists, **When** DELETE /api/memos/5, **Then** server responds 200 with `{"deleted": true}` and memo is logically deleted
6. **Given** memo ID 5 exists, **When** POST /api/memos/5/promote with `{"title": "New task"}`, **Then** server responds 201 with new task object and derived_from link created
7. **Given** memo ID 5 exists, **When** POST /api/memos/5/bookmark, **Then** server responds 200 and isBookmarked becomes true
8. **Given** memo ID 5 exists with comment ID 10, **When** PATCH /api/memos/5/comments/10 with `{"bodyMd": "Updated comment"}`, **Then** server responds 200 with updated comment

---

### User Story 2 - Task Management via HTTP API (Priority: P1)

A developer wants to manage tasks (create, list, filter by status, update, close/cancel/reopen, delete, bookmark) through HTTP endpoints, maintaining the same business logic and validation as the CLI.

**Why this priority**: Task management is equally important as memo operations - users need to manage actionable items through external clients. This completes the full GTD workflow over HTTP.

**Independent Test**: Can be fully tested by creating tasks via POST /api/tasks, listing with status filters, updating task status/fields, and verifying all state transitions match CLI behavior. Delivers standalone value for task-focused workflows.

**Acceptance Scenarios**:

1. **Given** API server is running, **When** POST /api/tasks with `{"title": "Buy groceries", "bodyMd": "", "status": "open"}`, **Then** server responds 201 with created task (bodyMd can be empty per v0.4.0 spec)
2. **Given** multiple tasks with different statuses exist, **When** GET /api/tasks?status=next&limit=20, **Then** server responds 200 with array of tasks filtered by status=next
3. **Given** task ID 15 with status=open exists, **When** PATCH /api/tasks/15 with `{"status": "done"}`, **Then** server responds 200 and task status transitions to done
4. **Given** task ID 15 exists, **When** POST /api/tasks/15/close with optional `{"comment": "Finished shopping"}`, **Then** server responds 200, status becomes done, and comment is added
5. **Given** task ID 15 exists, **When** POST /api/tasks/15/cancel with optional comment, **Then** server responds 200 and status becomes canceled
6. **Given** task ID 15 with status=done exists, **When** POST /api/tasks/15/reopen, **Then** server responds 200 and status becomes open
7. **Given** task ID 15 exists, **When** GET /api/tasks/15, **Then** server responds 200 with full task details including title, bodyMd, status, scheduledOn, labels, comments

---

### User Story 3 - Label and Link Management (Priority: P2)

A developer wants to manage labels and relationships between issues (memos/tasks) through HTTP endpoints, enabling organizational features like tagging and task hierarchies.

**Why this priority**: Labels and links are supplementary organizational features. While valuable, they aren't required for basic memo/task CRUD. Users can still capture and manage items without labels/links.

**Independent Test**: Can be fully tested by creating labels via POST /api/labels, assigning them via POST /api/issues/{id}/labels, creating links via POST /api/links, and listing relationships. Delivers value independently for users who want to organize their data.

**Acceptance Scenarios**:

1. **Given** API server is running, **When** POST /api/labels with `{"name": "urgent", "description": "High priority items"}`, **Then** server responds 201 with created label
2. **Given** label "urgent" exists and issue ID 5 exists, **When** POST /api/issues/5/labels with `{"labelId": 2}`, **Then** server responds 200 and label is attached to issue (idempotent)
3. **Given** issue IDs 5 and 10 exist, **When** POST /api/links with `{"type": "relates", "sourceId": 5, "targetId": 10}`, **Then** server responds 201 with created link
4. **Given** issue ID 5 has links, **When** GET /api/issues/5/links, **Then** server responds 200 with array of links showing direction (outgoing/incoming)
5. **Given** link ID 3 exists, **When** DELETE /api/links/3, **Then** server responds 200 with `{"deleted": true}`
6. **Given** multiple labels exist, **When** GET /api/labels, **Then** server responds 200 with array of all labels

---

### User Story 4 - Server Configuration and Deployment (Priority: P2)

A developer wants to start the API server with custom configuration (port, database path, CORS settings, logging level) and run it as a persistent background service in their home environment.

**Why this priority**: Server configuration is necessary for production deployment but not required to test the API functionality. Basic server startup with defaults is sufficient for development and testing.

**Independent Test**: Can be fully tested by starting server with various config options, verifying it binds to correct port, connects to specified database, and serves requests. Delivers value for production deployment scenarios.

**Acceptance Scenarios**:

1. **Given** SQLite database at ~/tmp/test.db exists, **When** start server with `--db ~/tmp/test.db --port 4000`, **Then** server starts on port 4000 and connects to specified database
2. **Given** server is running, **When** request arrives from web frontend origin, **Then** server includes appropriate CORS headers in response (configurable origins)
3. **Given** server encounters database error, **When** request is processed, **Then** server logs error details and responds with appropriate HTTP status (400/404/500) and error message
4. **Given** server receives malformed JSON in request body, **When** Zod validation runs, **Then** server responds 400 with validation error details
5. **Given** TailScale network is configured, **When** remote client connects to server IP:port, **Then** server accepts connection and authenticates request (network-level security only, no app-level auth initially)

---

### User Story 5 - OpenAPI Documentation and Client Generation (Priority: P3)

A developer wants to view complete API documentation in Swagger UI and optionally generate client SDKs from the OpenAPI specification to accelerate frontend/mobile app development.

**Why this priority**: Documentation and SDK generation are valuable for long-term maintainability and developer experience, but not required for the API to function. Manual HTTP requests can be made without OpenAPI docs.

**Independent Test**: Can be fully tested by generating OpenAPI spec from code, serving Swagger UI at /api-docs, and verifying all endpoints are documented with request/response schemas. Optionally test client SDK generation. Delivers value for future developers and API consumers.

**Acceptance Scenarios**:

1. **Given** API server is running, **When** navigate to http://localhost:3000/api-docs, **Then** Swagger UI displays with all endpoint documentation
2. **Given** OpenAPI spec is up-to-date, **When** run client generation tool (e.g., openapi-generator), **Then** TypeScript SDK is generated with typed request/response interfaces
3. **Given** endpoint signatures change, **When** OpenAPI spec is regenerated, **Then** spec reflects current implementation and Swagger UI shows updated documentation
4. **Given** Zod schemas exist for validation, **When** OpenAPI spec is generated, **Then** request/response schemas match Zod definitions (single source of truth)

---

### Edge Cases

- What happens when server receives request for non-existent issue ID? → Server responds 404 with `{"error": "Issue #123 not found"}`
- What happens when client attempts to promote a task (not a memo)? → Server responds 400 with `{"error": "Cannot promote: issue #123 is not a memo"}`
- What happens when database file is locked or inaccessible? → Server fails to start with clear error message, or responds 503 if error occurs during request
- What happens when server receives concurrent requests modifying the same issue? → SQLite handles locking; last write wins (no optimistic locking in v1)
- What happens when memo promotion fails mid-transaction (task created but link not)? → Transaction is rolled back entirely; no partial state persists
- What happens when client sends invalid status transition (e.g., cancel→scheduled)? → Server responds 400 with validation error from Zod schema
- What happens when server is behind TailScale but accessed from unauthorized IP? → TailScale network layer blocks request; server never receives it (no app-level IP filtering needed)
- What happens when request body exceeds reasonable size? → Server responds 413 Payload Too Large (configurable limit, e.g., 10MB)

## Requirements *(mandatory)*

### Functional Requirements

**API Server Core**
- **FR-001**: System MUST provide HTTP REST API server exposing all CLI operations (memo, task, label, link, comment) via JSON endpoints
- **FR-002**: System MUST reuse existing `meme-gtd-core` service layer (MemoService, TaskService, LabelService, LinkService) without duplicating business logic
- **FR-003**: System MUST validate all request payloads using Zod schemas shared with existing packages (meme-gtd-shared)
- **FR-004**: System MUST connect to SQLite database specified via configuration file or command-line flag (same context.json as CLI)
- **FR-005**: System MUST return appropriate HTTP status codes (200, 201, 400, 404, 500) and JSON error responses matching CLI error messages

**Memo Endpoints**
- **FR-006**: System MUST provide POST /api/memos endpoint accepting `{bodyMd, labels?}` and returning created memo with id, createdAt, updatedAt
- **FR-007**: System MUST provide GET /api/memos endpoint accepting query params `{limit?, labelId?, search?, order?, bookmarked?}` and returning array of memos
- **FR-008**: System MUST provide GET /api/memos/:id endpoint returning full memo details or 404 if not found/deleted
- **FR-009**: System MUST provide PATCH /api/memos/:id endpoint accepting `{bodyMd?}` and returning updated memo
- **FR-010**: System MUST provide DELETE /api/memos/:id endpoint logically deleting memo (is_deleted=true) and returning `{deleted: true}`
- **FR-011**: System MUST provide POST /api/memos/:id/promote endpoint accepting `{title, bodyMd?, status?, scheduledOn?, labels?}` and returning new task with derived_from link
- **FR-012**: System MUST provide POST /api/memos/:id/bookmark and POST /api/memos/:id/unbookmark endpoints (idempotent)
- **FR-013**: System MUST provide memo comment endpoints: GET/POST /api/memos/:id/comments, PATCH/DELETE /api/memos/:memoId/comments/:commentId

**Task Endpoints**
- **FR-014**: System MUST provide POST /api/tasks endpoint accepting `{title, bodyMd?, status?, scheduledOn?, labels?}` (bodyMd optional per v0.4.0)
- **FR-015**: System MUST provide GET /api/tasks endpoint accepting query params `{status?, labelId?, search?, limit?, bookmarked?}` and returning array of tasks
- **FR-016**: System MUST provide GET /api/tasks/:id endpoint returning full task details or 404 if not found/deleted
- **FR-017**: System MUST provide PATCH /api/tasks/:id endpoint accepting `{title?, bodyMd?, status?, scheduledOn?}` and returning updated task
- **FR-018**: System MUST provide DELETE /api/tasks/:id endpoint logically deleting task and returning `{deleted: true}`
- **FR-019**: System MUST provide POST /api/tasks/:id/close endpoint accepting optional `{comment?}` and transitioning status to 'done'
- **FR-020**: System MUST provide POST /api/tasks/:id/cancel endpoint accepting optional `{comment?}` and transitioning status to 'canceled'
- **FR-021**: System MUST provide POST /api/tasks/:id/reopen endpoint transitioning status to 'open'
- **FR-022**: System MUST provide POST /api/tasks/:id/bookmark and POST /api/tasks/:id/unbookmark endpoints (idempotent)
- **FR-023**: System MUST provide task comment endpoints: GET/POST /api/tasks/:id/comments, PATCH/DELETE /api/tasks/:taskId/comments/:commentId

**Label Endpoints**
- **FR-024**: System MUST provide GET /api/labels endpoint returning array of all labels `[{id, name, description?, createdAt}]`
- **FR-025**: System MUST provide POST /api/labels endpoint accepting `{name, description?}` and returning created label (unique name validation)
- **FR-026**: System MUST provide POST /api/issues/:issueId/labels endpoint accepting `{labelId}` and attaching label to issue (idempotent)
- **FR-027**: System MUST provide DELETE /api/labels/:name endpoint deleting label and cascading issue_labels relationships

**Link Endpoints**
- **FR-028**: System MUST provide POST /api/links endpoint accepting `{type, sourceId, targetId}` with types (parent|child|relates|derived_from)
- **FR-029**: System MUST provide GET /api/issues/:id/links endpoint returning array of links with direction field (outgoing|incoming)
- **FR-030**: System MUST provide DELETE /api/links/:id endpoint deleting link and returning `{deleted: true}`
- **FR-031**: System MUST validate link creation prevents self-references and duplicate links (same source+target+type)

**Server Configuration**
- **FR-032**: System MUST support configuration via CLI flags `--port`, `--db`, `--config` overriding default context.json
- **FR-033**: System MUST support CORS configuration for allowed origins (default: none/same-origin only, configurable for TailScale/web clients)
- **FR-034**: System MUST provide structured JSON logging with configurable log levels (error, warn, info, debug)
- **FR-035**: System MUST gracefully handle shutdown signals (SIGINT, SIGTERM) by closing database connections and pending requests

**Error Handling & Validation**
- **FR-036**: System MUST return 400 Bad Request with Zod validation errors when request payload is invalid
- **FR-037**: System MUST return 404 Not Found when issue/label/link ID does not exist or is deleted
- **FR-038**: System MUST return 400 Bad Request when attempting type-specific operations on wrong type (e.g., promote task, close memo)
- **FR-039**: System MUST return 500 Internal Server Error with sanitized error message when database operations fail
- **FR-040**: System MUST log full error stack traces server-side while returning user-friendly error messages to client

### Key Entities

- **HTTP Server**: Web server binding to configured port, managing request/response lifecycle, middleware chain (CORS, logging, error handling, body parsing)
- **API Router**: Route definitions mapping HTTP methods and paths to handler functions that invoke core services
- **Request DTOs**: Validation schemas for incoming JSON payloads for each endpoint (CreateMemoRequest, UpdateTaskRequest, etc.)
- **Response DTOs**: Structured JSON responses matching CLI output format (Memo, Task, Label, Link, Comment entities)
- **Error Response**: Standardized error object `{error: string, details?: object}` with appropriate HTTP status codes
- **Server Config**: Configuration object merging CLI flags, environment variables, and context.json (dbPath, port, corsOrigins, logLevel)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developer can start API server and perform all memo operations (create, list, view, edit, delete, promote, bookmark, comment) via HTTP requests within 30 seconds of server startup
- **SC-002**: API server handles 100 concurrent memo/task creation requests without data corruption or request failures
- **SC-003**: All API endpoints return responses in under 200ms for database with 10,000 issues (measured at 95th percentile)
- **SC-004**: API request/response schemas exactly match CLI JSON output format (--json flag), ensuring clients can switch between local CLI and remote API transparently
- **SC-005**: Server startup with invalid database path or configuration fails within 5 seconds with clear error message indicating what needs to be fixed
- **SC-006**: Developer can generate TypeScript client SDK from OpenAPI spec and use it to interact with API without reading server source code
- **SC-007**: API server runs continuously for 7 days under normal usage (100 requests/hour) without memory leaks or crashes
- **SC-008**: 100% of error scenarios (invalid ID, type mismatch, validation failure) return appropriate HTTP status codes and actionable error messages
- **SC-009**: API documentation in Swagger UI covers all endpoints with request/response examples and matches actual implementation

## Assumptions

- **Network Security**: TailScale or equivalent network-level security is configured by user; no application-level authentication/authorization is implemented in v1
- **Single User**: API server is used by single user (developer) only; no multi-user session management or user isolation required
- **No Sync**: API server and CLI operate on same SQLite database but not concurrently; no conflict resolution or optimistic locking needed in v1
- **SQLite Performance**: SQLite with WAL mode is sufficient for expected load (<1000 requests/hour); no need for connection pooling
- **HTTP Only**: HTTPS/TLS termination is handled by reverse proxy (e.g., Caddy, nginx) or TailScale; server listens on plain HTTP
- **Logging Destination**: Logs are written to stdout/stderr; external log aggregation (e.g., Loki, CloudWatch) is user's responsibility
- **Backup Strategy**: Database backups are user's responsibility; API server does not implement automatic backup or point-in-time recovery
- **OpenAPI Generation**: OpenAPI spec is generated from code annotations or Zod schemas (design-first hybrid), not hand-written separately
- **Request Size Limits**: Maximum request body size is 10MB (sufficient for large memo/task bodies); no support for file uploads in v1
- **CORS Policy**: By default, only same-origin requests are allowed; user must explicitly configure allowed origins for web frontends

## Out of Scope (Non-Goals)

- **CLI Migration to HTTP**: Existing CLI will continue using direct SQLite access; no migration to HTTP client mode in this feature
- **Authentication/Authorization**: No user login, JWT tokens, API keys, or role-based access control (RBAC) in v1
- **Multi-User Support**: No user isolation, concurrent editing, or conflict resolution; single-user assumption maintained
- **Real-Time Updates**: No WebSocket, Server-Sent Events (SSE), or polling endpoints for live updates; clients must manually refresh
- **GraphQL API**: Only REST API is provided; no GraphQL schema or resolver implementation
- **Rate Limiting**: No request throttling, quota management, or abuse prevention (rely on network-level controls)
- **Metrics/Monitoring**: No Prometheus metrics, health check endpoints, or APM integration (can be added later)
- **Database Migration API**: No endpoints to trigger migrations or view schema version; migrations are CLI-only (`mgtd init`)
- **Batch Operations**: No bulk create/update/delete endpoints; clients must make individual requests per item
- **Pagination Cursors**: Only limit-based pagination (no cursor/offset pagination for large result sets)
- **Attachment Uploads**: No support for file attachments, images, or binary data; text-only memo/task bodies

## Related Documents

- `docs/requirement.md`: Overall product requirements including GTD workflow and data model
- `docs/cli_requirement.md`: CLI command specifications and expected behavior (API must match)
- GitHub Issue #25: Original feature request with deployment scenarios and OpenAPI strategy
- `packages/core/src/index.ts`: Existing service layer to be reused by API handlers
- `packages/db/src/index.ts`: Database functions and schemas underlying core services
