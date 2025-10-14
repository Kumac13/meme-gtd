# Data Model: Bookmark Functionality

**Feature**: 002-memo-bookmark-functionality
**Date**: 2025-10-14

---

## Overview

This feature utilizes the existing `is_bookmarked` field in the `issues` table. No schema changes are required - only new repository methods and CLI commands to manipulate this field.

---

## Affected Entities

### issues (Existing Table)

**No schema changes required.** The `is_bookmarked` field already exists.

| Column | Type | Constraints | Description | Changes |
|--------|------|-------------|-------------|---------|
| id | INTEGER | PRIMARY KEY | Unique identifier | No change |
| type | TEXT | NOT NULL, CHECK(type IN ('memo','task')) | Record type | No change |
| title | TEXT | NULL for memo, NOT NULL for task | Title (task only) | No change |
| body_md | TEXT | NOT NULL | Markdown body content | No change |
| status | TEXT | NULL for memo, enum for task | Task status | No change |
| scheduled_on | TEXT | NULL | Scheduled date (ISO 8601) | No change |
| meta | TEXT | NULL | JSON metadata | No change |
| created_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp | No change |
| updated_at | TEXT | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last update timestamp | **Updated on bookmark change** |
| is_bookmarked | INTEGER | NOT NULL, DEFAULT 0 | Bookmark flag (0=false, 1=true) | **Modified by bookmark operations** |
| is_deleted | INTEGER | NOT NULL, DEFAULT 0 | Soft delete flag | No change |

**Existing Indexes** (no changes):
- `idx_issues_type` on `type`
- `idx_issues_created_at` on `created_at`
- `idx_issues_updated_at` on `updated_at`

**New Query Pattern**:
```sql
-- Filter bookmarked memos
SELECT * FROM issues
WHERE type = 'memo'
  AND is_bookmarked = 1
  AND is_deleted = 0
ORDER BY updated_at DESC;

-- Filter bookmarked tasks
SELECT * FROM issues
WHERE type = 'task'
  AND is_bookmarked = 1
  AND is_deleted = 0
ORDER BY updated_at DESC;
```

**Performance Considerations**:
- No new index needed - `is_bookmarked` queries are infrequent and combined with existing indexed columns (`type`, `updated_at`)
- Bookmark filtering adds minimal overhead to existing queries
- Expected bookmark count is low (<5% of total records), full table scan acceptable for single-user SQLite

---

## State Transitions

### Bookmark State Machine

```
┌─────────────┐
│  Unbookmarked │
│ (is_bookmarked = 0) │
└─────┬───────┘
      │
      │ mgtd memo/task bookmark <id>
      │
      ▼
┌─────────────┐
│  Bookmarked   │
│ (is_bookmarked = 1) │
└─────┬───────┘
      │
      │ mgtd memo/task unbookmark <id>
      │
      ▼
┌─────────────┐
│  Unbookmarked │
│ (is_bookmarked = 0) │
└─────────────┘
```

**Transitions**:
- **bookmark**: Sets `is_bookmarked = 1`, updates `updated_at`
- **unbookmark**: Sets `is_bookmarked = 0`, updates `updated_at`
- **Both operations are idempotent**: Repeating the same operation succeeds without error

**Special Case - Memo Promotion**:
```
┌─────────────────┐                ┌─────────────────┐
│  Bookmarked Memo│                │ Bookmarked Task │
│  (type=memo)    │ ─promote()─→   │  (type=task)    │
│  is_bookmarked=1│                │  is_bookmarked=1│
└─────────────────┘                └─────────────────┘
       │                                    │
       └────── derived_from link ───────────┘
```

When a bookmarked memo is promoted to a task, the new task inherits `is_bookmarked = 1`.

---

## Validation Rules

### Bookmark Operations

1. **ID Validation**:
   - Target ID must exist in issues table
   - Target record must not be soft-deleted (`is_deleted = 0`)
   - Target record type must match command context (memo commands → `type='memo'`, task commands → `type='task'`)

2. **Type Safety**:
   - `mgtd memo bookmark 45` → ERROR if ID 45 is a task
   - `mgtd task bookmark 12` → ERROR if ID 12 is a memo
   - Error message: "Error: Issue #<id> is not a <expected_type>"

3. **Idempotency**:
   - Bookmarking an already-bookmarked item → SUCCESS (no-op)
   - Unbookmarking a non-bookmarked item → SUCCESS (no-op)
   - No error or warning messages for idempotent operations

4. **State Preservation**:
   - Deleting a bookmarked item preserves `is_bookmarked = 1` (for potential undelete)
   - Promoting a bookmarked memo copies `is_bookmarked` to new task

---

## Repository Interface

### New Methods

#### memoRepository.setBookmark()

```typescript
/**
 * Sets the bookmark status for a memo.
 *
 * @param db - SQLite database connection
 * @param id - Memo ID
 * @param isBookmarked - true to bookmark, false to unbookmark
 * @throws Error if ID does not exist or is not a memo
 * @returns void
 */
export function setBookmark(
  db: Database,
  id: number,
  isBookmarked: boolean
): void;
```

**SQL Implementation**:
```sql
UPDATE issues
SET is_bookmarked = ?,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?
  AND type = 'memo'
  AND is_deleted = 0;

-- Check rows affected: if 0, throw error
```

**Error Cases**:
- ID doesn't exist → "Memo #<id> not found"
- ID is a task → "Issue #<id> is not a memo"
- ID is soft-deleted → "Memo #<id> not found" (treat as not found)

#### taskRepository.setBookmark()

```typescript
/**
 * Sets the bookmark status for a task.
 *
 * @param db - SQLite database connection
 * @param id - Task ID
 * @param isBookmarked - true to bookmark, false to unbookmark
 * @throws Error if ID does not exist or is not a task
 * @returns void
 */
export function setBookmark(
  db: Database,
  id: number,
  isBookmarked: boolean
): void;
```

**SQL Implementation**: Same as memoRepository but with `type = 'task'`

### Modified Methods

#### memoRepository.promote()

**Existing behavior**: Creates new task from memo, preserves labels, creates `derived_from` link

**New behavior**: Also copy `is_bookmarked` field

```typescript
// Modified promotion logic
const newTask = {
  type: 'task',
  title: options.title,
  body_md: memo.body_md,
  status: 'open',
  is_bookmarked: memo.is_bookmarked,  // NEW: Copy bookmark status
  // ... other fields
};
```

---

## Query Patterns

### List Bookmarked Memos

```sql
SELECT
  id,
  body_md,
  updated_at,
  is_bookmarked
FROM issues
WHERE type = 'memo'
  AND is_bookmarked = 1
  AND is_deleted = 0
ORDER BY updated_at DESC
LIMIT ?;
```

### List Bookmarked Memos with Label Filter

```sql
SELECT DISTINCT
  i.id,
  i.body_md,
  i.updated_at,
  i.is_bookmarked
FROM issues i
JOIN issue_labels il ON i.id = il.issue_id
JOIN labels l ON il.label_id = l.id
WHERE i.type = 'memo'
  AND i.is_bookmarked = 1
  AND i.is_deleted = 0
  AND l.name = ?
ORDER BY i.updated_at DESC
LIMIT ?;
```

### List All Memos (Including Bookmark Status)

```sql
SELECT
  id,
  body_md,
  updated_at,
  is_bookmarked
FROM issues
WHERE type = 'memo'
  AND is_deleted = 0
ORDER BY updated_at DESC
LIMIT ?;
```

**Note**: Existing list queries already return `is_bookmarked`, no changes needed.

---

## Database Migration

**Migration Required**: ❌ NO

The `is_bookmarked` field already exists in the schema (defined in `schema/001_init.sql`). No ALTER TABLE statements needed.

**Verification Query**:
```sql
-- Confirm field exists
PRAGMA table_info(issues);
-- Should show: is_bookmarked | INTEGER | 0 | 0 | 0
```

---

## Testing Considerations

### Unit Tests (Repository Layer)

1. **setBookmark() - Success Cases**:
   - Set bookmark on unbookmarked memo → verify `is_bookmarked = 1`
   - Set bookmark on already-bookmarked memo → verify no error (idempotent)
   - Unset bookmark on bookmarked memo → verify `is_bookmarked = 0`
   - Unset bookmark on already-unbookmarked memo → verify no error (idempotent)
   - Verify `updated_at` changes on bookmark operations

2. **setBookmark() - Error Cases**:
   - Non-existent ID → error
   - Wrong type (memo ID to task command) → error
   - Soft-deleted record → error

3. **promote() - Bookmark Preservation**:
   - Promote bookmarked memo → verify task has `is_bookmarked = 1`
   - Promote unbookmarked memo → verify task has `is_bookmarked = 0`

### Integration Tests (CLI Layer)

4. **bookmark/unbookmark Commands**:
   - `mgtd memo bookmark <id>` → success message
   - `mgtd memo unbookmark <id>` → success message
   - JSON output includes `isBookmarked: true/false`
   - Idempotency: repeat commands succeed

5. **list --bookmarked Filter**:
   - Create bookmarked and non-bookmarked memos
   - `mgtd memo list --bookmarked` → shows only bookmarked
   - Visual indicator (★) appears for bookmarked items
   - JSON output includes `isBookmarked: true`

6. **Filter Combination**:
   - `mgtd memo list --bookmarked --label urgent` → AND logic
   - Only memos matching both conditions appear

7. **Cross-Type Validation**:
   - `mgtd memo bookmark <task-id>` → type mismatch error
   - `mgtd task bookmark <memo-id>` → type mismatch error

---

## Summary

This feature requires:
- ✅ **No schema changes** (field already exists)
- ✅ **2 new repository methods**: `setBookmark()` in memoRepository and taskRepository
- ✅ **1 modified method**: `promote()` to preserve bookmark status
- ✅ **Query updates**: Add `WHERE is_bookmarked = 1` filter for bookmark listing
- ✅ **Validation**: Type checking and idempotency guarantees

The simplicity of this data model (single boolean field, no new tables) makes implementation straightforward and low-risk.
