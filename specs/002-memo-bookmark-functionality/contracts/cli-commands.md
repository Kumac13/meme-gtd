# CLI Command Contracts: Bookmark Functionality

**Feature**: 002-memo-bookmark-functionality
**Date**: 2025-10-14
**Purpose**: Define command signatures, inputs, outputs, and error behaviors for bookmark commands

---

## Command Reference

### memo bookmark

**Signature**:
```bash
mgtd memo bookmark <id> [--json]
```

**Description**: Mark a memo as bookmarked for quick access

**Arguments**:
- `<id>` (required): Memo ID (positive integer)

**Flags**:
- `-j, --json`: Output result as JSON

**Exit Codes**:
- `0`: Success
- `1`: Validation error (invalid ID, type mismatch, not found)
- `2`: Database error

**Behavior**:
- Sets `is_bookmarked = true` for the specified memo
- Idempotent: Succeeds even if already bookmarked
- Updates `updated_at` timestamp
- Type validation: Rejects if ID is a task

**Output (text)**:
```
Bookmarked memo #12
```

**Output (JSON)**:
```json
{
  "id": 12,
  "isBookmarked": true
}
```

**Error Cases**:

| Condition | Exit Code | Error Message |
|-----------|-----------|---------------|
| Missing ID argument | 1 | `Error: Missing required argument: id` |
| ID is not a number | 1 | `Error: Invalid ID format: must be a positive integer` |
| ID is negative or zero | 1 | `Error: Invalid ID: must be a positive integer` |
| ID does not exist | 1 | `Error: Memo #<id> not found` |
| ID is a task | 1 | `Error: Issue #<id> is not a memo` |
| ID is soft-deleted | 1 | `Error: Memo #<id> not found` |
| Database error | 2 | `Error: Database operation failed: <details>` |

**Examples**:
```bash
# Bookmark memo #12
$ mgtd memo bookmark 12
Bookmarked memo #12

# Bookmark with JSON output
$ mgtd memo bookmark 12 --json
{"id":12,"isBookmarked":true}

# Idempotent: bookmarking again succeeds
$ mgtd memo bookmark 12
Bookmarked memo #12

# Error: wrong type
$ mgtd memo bookmark 45
Error: Issue #45 is not a memo
```

---

### memo unbookmark

**Signature**:
```bash
mgtd memo unbookmark <id> [--json]
```

**Description**: Remove bookmark from a memo

**Arguments**:
- `<id>` (required): Memo ID (positive integer)

**Flags**:
- `-j, --json`: Output result as JSON

**Exit Codes**:
- `0`: Success
- `1`: Validation error
- `2`: Database error

**Behavior**:
- Sets `is_bookmarked = false` for the specified memo
- Idempotent: Succeeds even if not bookmarked
- Updates `updated_at` timestamp
- Type validation: Rejects if ID is a task

**Output (text)**:
```
Removed bookmark from memo #12
```

**Output (JSON)**:
```json
{
  "id": 12,
  "isBookmarked": false
}
```

**Error Cases**: Same as `memo bookmark`

**Examples**:
```bash
# Remove bookmark
$ mgtd memo unbookmark 12
Removed bookmark from memo #12

# Idempotent: unbookmarking again succeeds
$ mgtd memo unbookmark 12
Removed bookmark from memo #12
```

---

### memo list (modified)

**Signature**:
```bash
mgtd memo list [options]
```

**New Flag**:
- `--bookmarked`: Show only bookmarked memos

**Behavior Changes**:
- When `--bookmarked` is provided, filter to `is_bookmarked = true`
- Combine with other filters using AND logic
- Visual indicator: Display `★` prefix for bookmarked items in text output
- JSON output: Include `isBookmarked` field for all memos

**Output (text) - Without --bookmarked**:
```
  ID    Preview                        Updated        Labels
★ #12   Important design decision...   2 hours ago    urgent, design
  #13   Regular memo content...        1 day ago      inbox
★ #14   Critical bug to investigate    3 hours ago    bug
```

**Output (text) - With --bookmarked**:
```
  ID    Preview                        Updated        Labels
★ #12   Important design decision...   2 hours ago    urgent, design
★ #14   Critical bug to investigate    3 hours ago    bug
```

**Output (JSON)**:
```json
[
  {
    "id": 12,
    "body": "Important design decision...",
    "updatedAt": "2025-10-14T10:00:00Z",
    "labels": ["urgent", "design"],
    "isBookmarked": true
  },
  {
    "id": 13,
    "body": "Regular memo content...",
    "updatedAt": "2025-10-13T14:00:00Z",
    "labels": ["inbox"],
    "isBookmarked": false
  }
]
```

**Filter Combination Examples**:
```bash
# Show bookmarked memos with label "urgent"
$ mgtd memo list --bookmarked --label urgent

# Show bookmarked memos matching search term
$ mgtd memo list --bookmarked --search "design"

# SQL: WHERE is_bookmarked = 1 AND label = 'urgent' AND body MATCH 'design'
```

---

### task bookmark

**Signature**:
```bash
mgtd task bookmark <id> [--json]
```

**Description**: Mark a task as bookmarked for quick access

**Arguments**: Same as `memo bookmark`

**Flags**: Same as `memo bookmark`

**Exit Codes**: Same as `memo bookmark`

**Behavior**: Same as `memo bookmark`, but operates on tasks (`type='task'`)

**Output (text)**:
```
Bookmarked task #45
```

**Output (JSON)**:
```json
{
  "id": 45,
  "isBookmarked": true
}
```

**Error Cases**:

| Condition | Exit Code | Error Message |
|-----------|-----------|---------------|
| ID is a memo | 1 | `Error: Issue #<id> is not a task` |
| (other errors same as memo bookmark) | | |

**Examples**:
```bash
$ mgtd task bookmark 45
Bookmarked task #45

$ mgtd task bookmark 12
Error: Issue #12 is not a task
```

---

### task unbookmark

**Signature**:
```bash
mgtd task unbookmark <id> [--json]
```

**Description**: Remove bookmark from a task

**Behavior**: Same as `memo unbookmark`, but operates on tasks

**Output (text)**:
```
Removed bookmark from task #45
```

**Output (JSON)**:
```json
{
  "id": 45,
  "isBookmarked": false
}
```

---

### task list (modified)

**Signature**:
```bash
mgtd task list [options]
```

**New Flag**:
- `--bookmarked`: Show only bookmarked tasks

**Behavior**: Same as `memo list --bookmarked`, but for tasks

**Output Format**: Same structure as `memo list`, with task-specific fields (title, status)

**Examples**:
```bash
# Show all bookmarked tasks
$ mgtd task list --bookmarked

# Show bookmarked tasks with status "next"
$ mgtd task list --bookmarked --status next
```

---

## Integration Points

### memo promote (behavior change)

**Existing Command**: `mgtd memo promote <id> [options]`

**New Behavior**: Preserve bookmark status when promoting

**Implementation**:
```typescript
// When creating new task from memo
const newTask = {
  // ... existing fields
  is_bookmarked: sourceMemo.is_bookmarked  // NEW: copy bookmark status
};
```

**User-Visible Change**: None (transparent preservation)

**Verification**:
```bash
# Bookmark a memo
$ mgtd memo bookmark 12

# Promote to task
$ mgtd memo promote 12 --title "Follow up on design"

# Verify task is bookmarked
$ mgtd task list --bookmarked --json
[{"id":46,"title":"Follow up on design","isBookmarked":true}]
```

---

## Validation Rules

### ID Validation (All Commands)

1. **Format Check**:
   - Must be provided as positional argument
   - Must parse as integer
   - Must be positive (>= 1)

2. **Existence Check**:
   - Must exist in `issues` table
   - Must not be soft-deleted (`is_deleted = 0`)

3. **Type Check**:
   - For `memo *` commands: `type = 'memo'`
   - For `task *` commands: `type = 'task'`

### Filter Validation (list commands)

4. **--bookmarked Flag**:
   - Boolean flag (no value)
   - Combines with other filters using AND
   - No validation errors (presence = filter on)

---

## Error Handling Strategy

### Idempotency Guarantees

- Bookmarking an already-bookmarked item: **SUCCESS** (no error, no warning)
- Unbookmarking a non-bookmarked item: **SUCCESS** (no error, no warning)

**Rationale**: Matches Unix philosophy (e.g., `mkdir -p`), simplifies scripting

### Type Mismatch Errors

- Clear error messages specify the issue: "Issue #X is not a memo/task"
- Exit code 1 (validation error, not system error)
- User can correct by using the right command

### Not Found Errors

- Treat soft-deleted as not found (don't expose deletion state)
- Single error message: "Memo #X not found" (don't distinguish "deleted" vs "never existed")

---

## Testing Contracts

### Test Scenarios (Integration Tests)

1. **Happy Path**:
   - Create memo → bookmark → verify success
   - Create task → bookmark → verify success
   - List with `--bookmarked` → verify filtered correctly

2. **Idempotency**:
   - Bookmark twice → both succeed
   - Unbookmark twice → both succeed

3. **Type Validation**:
   - `memo bookmark <task-id>` → error
   - `task bookmark <memo-id>` → error

4. **Filter Combination**:
   - `--bookmarked --label X` → AND logic verified
   - `--bookmarked --search Y` → AND logic verified

5. **Promotion Preservation**:
   - Bookmark memo → promote → verify task is bookmarked
   - Promote unbookmarked memo → verify task is not bookmarked

6. **JSON Output**:
   - All commands with `--json` → valid JSON, correct schema
   - `isBookmarked` field present in all outputs

7. **Visual Indicators**:
   - Bookmarked items show `★` in text lists
   - Non-bookmarked items show space (no indicator)

### Expected Test Count

- **Repository tests**: ~8 (setBookmark success/error cases, promote preservation)
- **CLI integration tests**: ~15 (all scenarios above across memo/task)
- **Total**: ~23 tests

---

## Summary

This contract defines:
- ✅ 4 new commands (`memo bookmark`, `memo unbookmark`, `task bookmark`, `task unbookmark`)
- ✅ 2 modified commands (`memo list`, `task list` with `--bookmarked` flag)
- ✅ 1 behavior change (`memo promote` preserves bookmark status)
- ✅ Clear error messages and exit codes
- ✅ Idempotency guarantees
- ✅ JSON output schemas
- ✅ Visual indicators (★ for bookmarked items)

All commands follow GitHub CLI patterns and existing mgtd conventions.
