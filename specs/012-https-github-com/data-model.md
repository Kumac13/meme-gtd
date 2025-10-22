# Data Model: Comment Count Field Addition

**Feature**: Add Comment Count to API List Responses
**Date**: 2025-10-21
**Phase**: 1 (Design)

## Overview

This document defines the data model changes required to add comment count functionality to memo and task list responses.

## Entity Changes

### Memo Entity (Enhanced)

**Location**: Returned by `GET /api/memos`

**Current Structure**:
```typescript
{
  id: number;              // Unique identifier
  type: 'memo';           // Issue type discriminator
  title: null;            // Always null for memos
  bodyMd: string;         // Markdown content
  status: null;           // Always null for memos
  scheduledOn: null;      // Always null for memos
  meta: object;           // Metadata dictionary
  isBookmarked: boolean;  // Bookmark status
  isDeleted: boolean;     // Soft delete flag
  createdAt: string;      // ISO 8601 timestamp
  updatedAt: string;      // ISO 8601 timestamp
  labels: string[];       // Array of label names
}
```

**Enhanced Structure** (new field in bold):
```typescript
{
  id: number;
  type: 'memo';
  title: null;
  bodyMd: string;
  status: null;
  scheduledOn: null;
  meta: object;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  commentCount: number;   // ✨ NEW: Number of non-deleted comments
}
```

**Field Specification: commentCount**
- **Type**: Non-negative integer
- **Constraint**: `commentCount >= 0`
- **Required**: Yes (always present in list responses)
- **Calculation**: `COUNT(comments WHERE issue_id = memo.id AND is_deleted = 0)`
- **Default**: 0 (when no comments exist)

### Task Entity (Enhanced)

**Location**: Returned by `GET /api/tasks`

**Current Structure**:
```typescript
{
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
  scheduledOn: string | null;  // YYYY-MM-DD format
  meta: object;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}
```

**Enhanced Structure** (new field in bold):
```typescript
{
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
  scheduledOn: string | null;
  meta: object;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  commentCount: number;   // ✨ NEW: Number of non-deleted comments
}
```

**Field Specification: commentCount**
- **Type**: Non-negative integer
- **Constraint**: `commentCount >= 0`
- **Required**: Yes (always present in list responses)
- **Calculation**: `COUNT(comments WHERE issue_id = task.id AND is_deleted = 0)`
- **Default**: 0 (when no comments exist)

### Comment Entity (No Changes)

**Location**: `comments` database table

The comment entity itself requires no changes. It is used only for aggregation:

```sql
CREATE TABLE comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id INTEGER NOT NULL,
    body_md TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,  -- Used in aggregation
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);
```

## Data Flow

### Layer 1: Database Repository

**Input**: Filter parameters (status, bookmark, search, etc.)

**Processing**:
```sql
-- Example for memos
SELECT i.*,
  (SELECT COUNT(*)
   FROM comments
   WHERE issue_id = i.id AND is_deleted = 0) as comment_count
FROM issues i
WHERE i.type = 'memo' AND i.is_deleted = 0
ORDER BY i.updated_at DESC
```

**Output**: Array of memo/task records with `comment_count` field

**Files Modified**:
- `packages/db/src/memoRepository.ts` → `listMemos()`
- `packages/db/src/taskRepository.ts` → `listTasks()`

### Layer 2: Core Service

**Input**: Filter parameters

**Processing**:
```typescript
// Current pattern (labels are added)
const memos = listMemos(this.db, filters);
return memos.map(memo => ({
  ...memo,
  labels: listMemoLabels(this.db, memo.id)
}));

// New pattern (commentCount propagated from repository)
// No changes needed - repository already includes commentCount
```

**Output**: Array of memos/tasks with labels AND commentCount

**Files Modified**:
- `packages/core/src/index.ts` → `MemoService.list()`, `TaskService.list()` (no code changes, type updates only)

### Layer 3: API Handler

**Input**: HTTP request with query parameters

**Processing**:
```typescript
const memoService = new MemoService({ db: request.server.db });
const memos = memoService.list(filters);
return reply.status(200).send(memos);
```

**Output**: JSON array with commentCount field

**Files Modified**:
- No handler changes needed
- `packages/api/src/schemas/memoSchemas.ts` → Update `MemoSchema`
- `packages/api/src/schemas/taskSchemas.ts` → Update `TaskSchema`

## Type System Updates

### Database Layer Types

```typescript
// packages/db/src/memoRepository.ts
const memoRowToMemo = (row: any): Memo => ({
  id: row.id,
  type: 'memo',
  title: null,
  bodyMd: row.body_md,
  status: null,
  scheduledOn: null,
  meta: row.meta ? JSON.parse(row.meta) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isBookmarked: toBoolean(row.is_bookmarked),
  isDeleted: toBoolean(row.is_deleted),
  commentCount: row.comment_count ?? 0  // ✨ NEW
});
```

### Shared Types

```typescript
// packages/shared/src/types.ts
export interface Memo {
  id: number;
  type: 'memo';
  title: null;
  bodyMd: string;
  status: null;
  scheduledOn: null;
  meta: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
  isDeleted: boolean;
  commentCount?: number;  // ✨ NEW - optional for compatibility
}

export interface Task {
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: TaskStatus;
  scheduledOn: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
  isDeleted: boolean;
  commentCount?: number;  // ✨ NEW - optional for compatibility
}
```

### API Layer Schemas (Zod)

```typescript
// packages/api/src/schemas/memoSchemas.ts
export const MemoSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('memo'),
  title: z.string().nullable(),
  bodyMd: z.string(),
  status: z.string().nullable(),
  scheduledOn: z.string().date().nullable(),
  meta: z.record(z.any()),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  labels: z.array(z.string()),
  commentCount: z.number().int().nonnegative()  // ✨ NEW - required in API
    .describe('Number of non-deleted comments on this memo')
});

// packages/api/src/schemas/taskSchemas.ts
export const TaskSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('task'),
  title: z.string(),
  bodyMd: z.string(),
  status: TaskStatusSchema,
  scheduledOn: z.string().date().nullable(),
  meta: z.record(z.any()),
  isBookmarked: z.boolean(),
  isDeleted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  labels: z.array(z.string()),
  commentCount: z.number().int().nonnegative()  // ✨ NEW - required in API
    .describe('Number of non-deleted comments on this task')
});
```

## Database Queries

### Standard List Query (without search)

**Before**:
```sql
SELECT * FROM issues
WHERE type = 'memo' AND is_deleted = 0
ORDER BY updated_at DESC
```

**After**:
```sql
SELECT i.*,
  (SELECT COUNT(*) FROM comments c
   WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
FROM issues i
WHERE i.type = 'memo' AND i.is_deleted = 0
ORDER BY i.updated_at DESC
```

### Full-Text Search Query

**Before**:
```sql
SELECT i.*
FROM issues i
JOIN issues_fts f ON f.issue_id = i.id
WHERE i.type = 'memo' AND i.is_deleted = 0 AND f.body_md MATCH @search
ORDER BY i.updated_at DESC
```

**After**:
```sql
SELECT i.*,
  (SELECT COUNT(*) FROM comments c
   WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
FROM issues i
JOIN issues_fts f ON f.issue_id = i.id
WHERE i.type = 'memo' AND i.is_deleted = 0 AND f.body_md MATCH @search
ORDER BY i.updated_at DESC
```

## Validation Rules

### Database Level
- Comment count derived from actual comment records
- Soft-deleted comments excluded (`is_deleted = 0`)
- Returns 0 for issues with no comments (via COUNT)

### Application Level (Zod)
- Type: integer
- Minimum value: 0
- Required in all list responses
- Description included for OpenAPI generation

### Business Rules
- Count includes only active (non-deleted) comments
- Count updates automatically when comments are added/deleted
- No caching or denormalization (computed on-demand)

## Edge Cases

| Scenario | Expected Behavior | Implementation |
|----------|-------------------|----------------|
| Issue with 0 comments | `commentCount: 0` | COUNT returns 0 for empty result |
| Issue with soft-deleted comments only | `commentCount: 0` | WHERE c.is_deleted = 0 filters them out |
| Issue with mix of active and deleted comments | Count only active | Same WHERE clause |
| Newly created issue | `commentCount: 0` | COUNT on empty set returns 0 |
| Comment added via API | Count increases automatically | No caching, always computed fresh |
| Comment soft-deleted | Count decreases automatically | Same as above |

## Performance Considerations

### Query Performance
- **Existing Index**: Foreign key on `comments.issue_id` provides index
- **Query Pattern**: Correlated subquery allows index usage per issue
- **Expected Impact**: < 10% increase in query time (per spec SC-003)

### Scalability
- **Current Scale**: Dozens to hundreds of issues, thousands of comments
- **Indexing**: FK index sufficient for current scale
- **Future**: Add explicit index if performance degrades:
  ```sql
  CREATE INDEX idx_comments_issue_active
  ON comments(issue_id) WHERE is_deleted = 0;
  ```

## Migration Notes

**Database Schema**: No migration required (computed field, not stored)

**API Version**: No version bump required (additive change, backward compatible)

**Deployment**: Zero-downtime deployment possible:
1. Deploy backend with new code
2. Existing API consumers ignore new field
3. Web UI starts using new field automatically

## Testing Validation

### Unit Tests (Database Layer)
- Query returns correct count for issues with N comments
- Query returns 0 for issues with no comments
- Query excludes soft-deleted comments
- Query works with all filter combinations

### Integration Tests (API Layer)
- GET /api/memos includes commentCount field
- GET /api/tasks includes commentCount field
- Field value matches actual comment count in database
- Schema validation passes with new field

### Performance Tests
- Measure query time before/after change
- Verify < 10% degradation
- Test with varying data sizes (10, 100, 1000 issues)
