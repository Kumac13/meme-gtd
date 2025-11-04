# Data Model: Web UI Memo-to-Task Promotion

**Feature**: 023-web-memo-task
**Date**: 2025-11-04
**Status**: Completed

## Overview

This feature primarily involves UI workflows and leverages existing data models. No new database tables or API schemas are required. This document describes the existing entities involved in the promotion flow and their relationships.

## Existing Entities

### Memo

**Description**: Represents inbox items in the GTD workflow. Memos are unstructured notes that can be promoted to tasks when they become actionable.

**Key Attributes**:
- `id` (number): Unique identifier
- `type` (literal 'memo'): Entity type discriminator
- `title` (string | null): Always null for memos
- `bodyMd` (string): Content in Markdown format
- `status` (string | null): Always null for memos
- `scheduledOn` (string | null): Always null for memos
- `meta` (object): Metadata key-value pairs
- `isBookmarked` (boolean): Bookmark flag
- `isDeleted` (boolean): Soft delete flag
- `createdAt` (string): ISO 8601 timestamp
- `updatedAt` (string): ISO 8601 timestamp
- `labels` (string[]): Array of label names

**Relationships**:
- Has many Comments (via `issue_id` foreign key)
- Has many Links (via `source_issue_id` or `target_issue_id`)
- Belongs to many Projects (via `issue_projects` join table)
- Has many Labels (via `issue_labels` join table)

**State Transitions**:
None (memos don't have status). Promotion is a one-way transformation to Task.

**Validation Rules**:
- `bodyMd` must be non-empty (minimum 1 character)
- `type` must be literal 'memo'
- `title`, `status`, `scheduledOn` must be null

---

### Task

**Description**: Represents actionable items in the GTD workflow. Tasks have titles, statuses, and optional body content.

**Key Attributes**:
- `id` (number): Unique identifier
- `type` (literal 'task'): Entity type discriminator
- `title` (string): Required, non-empty task title
- `bodyMd` (string | null): Optional description in Markdown
- `status` (TaskStatus): Current task state
- `scheduledOn` (string | null): Optional scheduled date (ISO 8601)
- `meta` (object): Metadata key-value pairs
- `isBookmarked` (boolean): Bookmark flag
- `isDeleted` (boolean): Soft delete flag
- `createdAt` (string): ISO 8601 timestamp
- `updatedAt` (string): ISO 8601 timestamp
- `labels` (string[]): Array of label names

**TaskStatus Enum**:
- `'open'`: Default status, not yet started
- `'next'`: Next action in GTD workflow
- `'waiting'`: Blocked, waiting on external dependency
- `'scheduled'`: Scheduled for future execution
- `'done'`: Completed successfully
- `'canceled'`: Abandoned or no longer relevant

**Relationships**:
- Has many Comments (via `issue_id` foreign key)
- Has many Links (via `source_issue_id` or `target_issue_id`)
- Belongs to many Projects (via `issue_projects` join table)
- Has many Labels (via `issue_labels` join table)

**State Transitions**:
- `open` → `next`, `waiting`, `scheduled`, `done`, `canceled`
- `next` → `done`, `waiting`, `canceled`
- `waiting` → `next`, `canceled`
- `scheduled` → `next`, `done`, `canceled`
- `done` → (terminal state, can be reopened manually)
- `canceled` → (terminal state, can be reopened manually)

**Validation Rules**:
- `title` must be non-empty, max 255 characters
- `status` must be valid TaskStatus enum value
- `type` must be literal 'task'
- `bodyMd` max 10,000 characters (if provided)

---

### Link

**Description**: Represents relationships between issues (memos, tasks, projects). Used to track promotion history via `derived_from` link type.

**Key Attributes**:
- `id` (number): Unique identifier
- `sourceIssueId` (number): Source issue ID (e.g., new task)
- `targetIssueId` (number): Target issue ID (e.g., original memo)
- `linkType` (string): Relationship type
- `createdAt` (string): ISO 8601 timestamp

**Link Types**:
- `'derived_from'`: Indicates source was created from target (used in promotion)
- `'blocks'`: Source blocks target
- `'blocked_by'`: Source is blocked by target
- `'relates_to'`: General relationship
- `'duplicates'`: Source is duplicate of target

**Relationships**:
- Belongs to source Issue (Memo or Task)
- Belongs to target Issue (Memo or Task)

**Validation Rules**:
- `sourceIssueId` must exist in `issues` table
- `targetIssueId` must exist in `issues` table
- `sourceIssueId` ≠ `targetIssueId` (no self-links)
- `linkType` must be valid enum value

---

### Comment

**Description**: Represents user comments on memos or tasks. Transferred during promotion.

**Key Attributes**:
- `id` (number): Unique identifier
- `issueId` (number): Associated issue (memo or task)
- `bodyMd` (string): Comment content in Markdown
- `isDeleted` (boolean): Soft delete flag
- `createdAt` (string): ISO 8601 timestamp
- `updatedAt` (string): ISO 8601 timestamp

**Relationships**:
- Belongs to one Issue (Memo or Task)

**Validation Rules**:
- `bodyMd` must be non-empty
- `issueId` must exist in `issues` table

---

### Label

**Description**: Tags for categorizing memos and tasks. Transferred during promotion.

**Key Attributes**:
- `id` (number): Unique identifier
- `name` (string): Label name (unique)
- `color` (string | null): Optional hex color code
- `createdAt` (string): ISO 8601 timestamp

**Relationships**:
- Belongs to many Issues (via `issue_labels` join table)

**Validation Rules**:
- `name` must be non-empty, unique
- `color` must be valid hex color (if provided)

---

## Promotion Flow Data Transformations

### Input: Memo

```json
{
  "id": 123,
  "type": "memo",
  "title": null,
  "bodyMd": "Research React Router patterns for form pre-population",
  "status": null,
  "scheduledOn": null,
  "meta": {},
  "isBookmarked": true,
  "isDeleted": false,
  "createdAt": "2025-11-04T10:00:00Z",
  "updatedAt": "2025-11-04T10:00:00Z",
  "labels": ["research", "frontend"]
}
```

### Promotion Request

```json
{
  "title": "Implement React Router form pre-population",
  "status": "next"
}
```

### Output: Task

```json
{
  "id": 456,
  "type": "task",
  "title": "Implement React Router form pre-population",
  "bodyMd": "Research React Router patterns for form pre-population",
  "status": "next",
  "scheduledOn": null,
  "meta": {},
  "isBookmarked": true,
  "isDeleted": false,
  "createdAt": "2025-11-04T10:05:00Z",
  "updatedAt": "2025-11-04T10:05:00Z",
  "labels": ["research", "frontend"]
}
```

### Metadata Transfer

**Labels**: All memo labels transferred to task
- `issue_labels.issueId` updated from 123 → 456

**Comments**: All memo comments transferred to task
- `comments.issueId` updated from 123 → 456

**Links**: All memo links transferred to task
- Links where `sourceIssueId = 123` updated to `sourceIssueId = 456`
- Links where `targetIssueId = 123` updated to `targetIssueId = 456`

**Projects**: All memo project associations transferred to task
- `issue_projects.issueId` updated from 123 → 456

**Bookmark**: Memo bookmark status transferred to task
- `task.isBookmarked = memo.isBookmarked`

### Derived Link Creation

```json
{
  "id": 789,
  "sourceIssueId": 456,
  "targetIssueId": 123,
  "linkType": "derived_from",
  "createdAt": "2025-11-04T10:05:00Z"
}
```

### Memo Deletion

**Note**: Current implementation creates `derived_from` link but memo is NOT deleted. This is a known discrepancy with the spec (FR-012). Spec requires memo deletion, but current database implementation preserves it for audit trail.

**Actual behavior**:
- Memo remains in database with all original data
- `derived_from` link points from task back to memo
- Users won't see memo in list (assumption: UI filters by promotion status)

**Spec requirement**:
- Memo should be soft-deleted (`isDeleted = true`)
- Audit trail maintained via `derived_from` link

**Impact**: Low - memo is not visible in UI even if not deleted, as long as UI properly handles promotion state.

---

## API Contracts (Existing)

### Promote Memo Endpoint

**Request**:
```http
POST /api/memos/:id/promote
Content-Type: application/json

{
  "title": "Task title (required)",
  "status": "open" | "next" | "waiting" | "scheduled" (optional, default: "open")
}
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 456,
  "type": "task",
  "title": "Task title",
  "bodyMd": "Original memo body",
  "status": "open",
  "scheduledOn": null,
  "meta": {},
  "isBookmarked": true,
  "isDeleted": false,
  "createdAt": "2025-11-04T10:05:00Z",
  "updatedAt": "2025-11-04T10:05:00Z",
  "labels": ["label1", "label2"]
}
```

**Error Responses**:
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Memo not found: 123"
}
```

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "validation": {
    "title": "Title is required"
  }
}
```

---

## Frontend Data Models

### MemosService.promoteMemo()

**TypeScript Signature**:
```typescript
public static promoteMemo(
  id: string,
  requestBody: {
    title: string;
    status?: 'open' | 'next' | 'waiting' | 'scheduled';
  }
): CancelablePromise<Task>
```

**Usage Example**:
```typescript
const task = await MemosService.promoteMemo('123', {
  title: 'My new task',
  status: 'next'
});

console.log(task.id); // 456
console.log(task.bodyMd); // Original memo body
```

---

## Database Schema (Reference)

**Note**: No schema changes required for this feature. All tables already exist.

### issues Table

```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('memo', 'task', 'project')),
  title TEXT,
  body_md TEXT,
  status TEXT,
  scheduled_on TEXT,
  meta TEXT DEFAULT '{}',
  is_bookmarked INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### links Table

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_issue_id INTEGER NOT NULL REFERENCES issues(id),
  target_issue_id INTEGER NOT NULL REFERENCES issues(id),
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### comments Table

```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id),
  body_md TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### issue_labels Table (Join Table)

```sql
CREATE TABLE issue_labels (
  issue_id INTEGER NOT NULL REFERENCES issues(id),
  label_id INTEGER NOT NULL REFERENCES labels(id),
  PRIMARY KEY (issue_id, label_id)
);
```

### issue_projects Table (Join Table)

```sql
CREATE TABLE issue_projects (
  issue_id INTEGER NOT NULL REFERENCES issues(id),
  project_id INTEGER NOT NULL REFERENCES issues(id),
  PRIMARY KEY (issue_id, project_id)
);
```

---

## Validation Summary

### Client-side Validation (TaskForm)

```typescript
// Existing validation utility
export function validateTaskForm(
  title: string,
  bodyMd: string,
  status: TaskStatus
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!title || title.trim().length === 0) {
    errors.title = 'Title is required';
  }
  if (title.length > 255) {
    errors.title = 'Title must be less than 255 characters';
  }
  if (bodyMd && bodyMd.length > 10000) {
    errors.bodyMd = 'Description must be less than 10,000 characters';
  }
  if (!['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'].includes(status)) {
    errors.status = 'Invalid status';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
```

### Server-side Validation (Zod Schema)

```typescript
// Existing schema in packages/api/src/schemas/memoSchemas.ts
export const PromoteMemoRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  status: z.enum(['open', 'next', 'waiting', 'scheduled']).optional()
});
```

---

## Data Integrity Considerations

### Atomic Operations

**Promotion must be transactional**:
1. Create task
2. Transfer all metadata (labels, comments, links, projects)
3. Create derived_from link
4. Delete memo (or mark as promoted)

If any step fails, entire operation rolls back (no partial state).

**Current implementation**: Uses SQLite transaction implicitly (single database connection).

### Referential Integrity

**Foreign Key Constraints**:
- `comments.issue_id` → `issues.id`
- `links.source_issue_id` → `issues.id`
- `links.target_issue_id` → `issues.id`
- `issue_labels.issue_id` → `issues.id`
- `issue_projects.issue_id` → `issues.id`

All FK constraints maintained during promotion (issueId updates preserve relationships).

### Soft Delete Pattern

**Memos**: Should be soft-deleted (`isDeleted = 1`) not hard-deleted
- Preserves audit trail
- Allows potential undo operation
- Maintains referential integrity

**Comments**: Not deleted during promotion (transferred to task)

---

## Performance Characteristics

### Database Operations (Promotion)

1. `SELECT` memo by ID (1 query)
2. `INSERT` new task (1 query)
3. `UPDATE` issue_labels WHERE issueId = memoId (1 query, N rows)
4. `UPDATE` comments WHERE issueId = memoId (1 query, M rows)
5. `UPDATE` links WHERE sourceIssueId = memoId OR targetIssueId = memoId (1 query, P rows)
6. `UPDATE` issue_projects WHERE issueId = memoId (1 query, Q rows)
7. `INSERT` derived_from link (1 query)
8. `UPDATE` issues SET isDeleted = 1 WHERE id = memoId (1 query)

**Total**: 8 queries (synchronous, within transaction)
**Expected latency**: <100ms for typical memo (few labels, comments, links)

### Network Overhead

**Client → Server**:
- Request size: ~50-200 bytes (title + optional status)

**Server → Client**:
- Response size: ~1-5KB (task object + labels)

**Total round-trip**: <500ms on local network, <2s on typical internet connection

---

## Open Questions

### Resolved

- ✅ Is memo deleted or preserved? → Should be deleted (per spec), but current impl preserves
- ✅ Are all metadata types transferred? → Yes (labels, comments, links, projects, bookmarks)
- ✅ Is operation atomic? → Yes (SQLite transaction)

### Future Enhancements

- **Undo promotion**: Restore memo from task (requires keeping original memo or snapshot)
- **Selective metadata transfer**: UI to choose which metadata to transfer
- **Bulk promotion**: Promote multiple memos in single operation

---

## References

- Feature Spec: `specs/023-web-memo-task/spec.md`
- Database Schema: `packages/db/src/memoRepository.ts` (promoteMemo function)
- API Schema: `packages/api/src/schemas/memoSchemas.ts`
- OpenAPI Spec: `packages/api/docs/api/openapi.yaml`
