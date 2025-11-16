# Data Model: Add "inbox" and "someday" Task Statuses

**Feature**: 027-task-status-someday-inbox
**Date**: 2025-11-17

## Overview

This feature extends the existing `TaskStatus` type from 6 enumerated values to 8 values. No database schema changes are required; all modifications are at the application layer (TypeScript types and Zod validation schemas).

---

## Entity: TaskStatus (Type Extension)

### Current Definition

**File**: `packages/shared/src/index.ts`

```typescript
export type TaskStatus =
  | 'open'
  | 'next'
  | 'waiting'
  | 'scheduled'
  | 'done'
  | 'canceled';
```

### Updated Definition

```typescript
export type TaskStatus =
  | 'inbox'     // NEW: Unprocessed captured task
  | 'open'      // General backlog
  | 'next'      // Prioritized next action
  | 'waiting'   // Blocked/delegated
  | 'scheduled' // Time-specific
  | 'someday'   // NEW: Deferred non-actionable idea
  | 'done'      // Completed
  | 'canceled'; // Abandoned
```

### Semantic Definitions

| Status | GTD Phase | Description | Example Use Case |
|--------|-----------|-------------|------------------|
| `inbox` | Capture | Newly created task that hasn't been triaged yet. Requires review to determine priority and next action. | User captures "Research competitors" during brainstorming session |
| `open` | Organize | Task has been reviewed but not yet prioritized as next action. In backlog awaiting scheduling. | "Update documentation" is on the list but not urgent |
| `next` | Engage | High-priority task ready to be worked on immediately. Part of active next actions list. | "Fix critical bug in payment flow" |
| `waiting` | Organize | Task is blocked waiting for external input or delegated to someone else. | "Review legal contract" waiting for legal team |
| `scheduled` | Organize | Task has a specific date/time commitment. Typically used with `scheduledOn` field. | "Team meeting on Friday" with scheduledOn=2025-11-21 |
| `someday` | Organize | Non-actionable idea or task deferred to future review. Not part of active lists. | "Learn Rust" - interesting but not current priority |
| `done` | Complete | Task has been completed successfully. | "Deploy v2.0 to production" |
| `canceled` | Complete | Task was abandoned or no longer relevant. | "Build mobile app" after deciding on web-only strategy |

### Validation Rules

**TypeScript Compile-Time**:
- Type-safe union ensures only valid string literals are accepted
- IDE autocomplete shows all 8 valid values
- Compiler error on invalid assignment

**Zod Runtime Validation**:
- API endpoints validate incoming status values against enum
- Invalid values return 400 Bad Request with clear error message
- Enum order follows GTD workflow sequence for documentation purposes

---

## Entity: Task (No Changes)

### Schema

**Database**: `issues` table in SQLite
**File**: `packages/db/src/models/task.ts`

```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('memo', 'task')),
  title TEXT,           -- Required for tasks, null for memos
  body_md TEXT NOT NULL,
  status TEXT,          -- Validated at application layer (accepts 'inbox', 'someday', etc.)
  scheduled_on TEXT,    -- ISO 8601 date string (YYYY-MM-DD)
  meta TEXT,            -- JSON metadata
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Key Points**:
- `status` column is TEXT (no CHECK constraint)
- Application-layer Zod schemas enforce valid TaskStatus values
- Existing rows with `status='open'` remain valid (FR-018)

### TypeScript Interface

**File**: `packages/shared/src/index.ts`

```typescript
export interface Task extends IssueBase {
  type: 'task';
  title: string;          // Required (not null)
  status: TaskStatus;     // Required, validated enum
  scheduledOn: string | null;  // Optional ISO date
  commentCount?: number;  // Populated by API for list views
  preview?: string;       // Populated by API for search results
}
```

**No Changes Required**: Interface already uses `TaskStatus` type, which is extended.

---

## Entity: Memo (No Changes)

### Promotion to Task

**Current Behavior**: Promoting a memo to a task creates a new task record

**Updated Behavior** (FR-015):
- Default status for promoted tasks: `'inbox'` (was `'open'`)
- User can override during promotion to select: `inbox`, `open`, `next`, `waiting`, `scheduled`
- Statuses `done`, `canceled`, `someday` not typically selected during promotion (but not prevented by FR-013)

**Implementation**:
- `packages/core/src/memo.ts` or similar: Update `promoteMemoToTask()` to default status='inbox'
- `packages/web/src/components/TaskForm.tsx`: Update `validStatuses` array and default value

---

## State Transitions

### Transition Rules

**No Workflow Restrictions** (FR-013):
- Any status can transition to any other status
- Examples:
  - `inbox` → `done` (directly complete without triage)
  - `someday` → `next` (activate deferred idea)
  - `waiting` → `canceled` (abandon blocked task)

**Rationale**:
- GTD is flexible; users may complete tasks without following strict workflow
- Enforcing transitions adds complexity without clear benefit
- Users are trusted to use statuses appropriately

### Typical Workflow (Non-Enforced)

```
┌──────────────────────────────────────────────────────────────┐
│                     CAPTURE & PROCESS                         │
└──────────────────────────────────────────────────────────────┘
          │
          ├─► inbox ──┬─► open ──┬─► next ──┬─► done
          │           │          │          │
          │           │          │          └─► canceled
          │           │          │
          │           │          └─► waiting ──┬─► next
          │           │                        └─► canceled
          │           │
          │           └─► scheduled ──┬─► done
          │                           └─► canceled
          │
          └─► someday ──┬─► next
                        └─► canceled

Legend:
- inbox: Captured, not yet triaged
- open: Triaged, in backlog
- next: Active next action
- waiting: Blocked/delegated
- scheduled: Time-specific commitment
- someday: Deferred idea
- done: Completed
- canceled: Abandoned
```

**Note**: Arrows represent common transitions, but all transitions are technically allowed.

---

## API Request/Response Models

### Zod Schema Updates

**File**: `packages/api/src/schemas/taskSchemas.ts`

```typescript
// BEFORE
export const TaskStatusSchema = z.enum([
  'open', 'next', 'waiting', 'scheduled', 'done', 'canceled'
]);

// AFTER (FR-017: GTD workflow order)
export const TaskStatusSchema = z.enum([
  'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'
]);
```

### CreateTaskRequest

```typescript
export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1, 'Task title is required'),
  bodyMd: z.string().optional(),
  status: TaskStatusSchema.optional(),  // Defaults to 'open' if not provided (FR-014)
  scheduledOn: z.string().date().optional(),
});
```

**Validation Behavior**:
- If `status` is provided, must be one of 8 valid values
- If `status` is omitted, defaults to `'open'` (existing behavior preserved)
- If `status='inbox'` or `status='someday'`, accepted without error

### UpdateTaskRequest

```typescript
export const UpdateTaskRequestSchema = z.object({
  title: z.string().min(1).optional(),
  bodyMd: z.string().optional(),
  status: TaskStatusSchema.optional(),  // Can update to any valid status (FR-013)
  scheduledOn: z.string().date().nullish(),
});
```

**Validation Behavior**:
- Accepts `'inbox'` and `'someday'` as valid status updates
- No transition restrictions enforced

### TaskQuery (List/Filter)

```typescript
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),  // Filter by status (FR-005, FR-006)
  bookmarked: z.enum(['true', 'false']).optional(),
  label: z.string().optional(),
  search: z.string().optional(),
});
```

**Filtering Behavior**:
- `GET /api/tasks?status=inbox` returns only tasks with `status='inbox'` (FR-005)
- `GET /api/tasks?status=someday` returns only tasks with `status='someday'` (FR-006)

---

## Indexes and Performance

**No Changes Required**:
- Existing index on `status` column (if present) continues to work
- SQLite query planner handles filtering on TEXT column efficiently
- No performance degradation expected (status is indexed in most installations)

---

## Data Migration

**No Migration Required** (FR-018):
- Existing tasks with `status='open'` remain unchanged
- Application code handles both old and new status values transparently
- Users can manually update old tasks to `'inbox'` if desired, but no automatic migration

**Future Cleanup** (Optional):
- After feature adoption, users may choose to audit and reclassify old `'open'` tasks
- This is a manual process, not part of this feature's scope

---

## Testing Considerations

### Schema Validation Tests

**File**: `packages/api/test/schemas.test.ts`

```typescript
describe('TaskStatusSchema', () => {
  it('accepts inbox status', () => {
    expect(TaskStatusSchema.parse('inbox')).toBe('inbox');
  });

  it('accepts someday status', () => {
    expect(TaskStatusSchema.parse('someday')).toBe('someday');
  });

  it('rejects invalid status', () => {
    expect(() => TaskStatusSchema.parse('invalid')).toThrow();
  });
});
```

### API Integration Tests

**File**: `packages/api/test/task.test.ts`

```typescript
describe('POST /api/tasks', () => {
  it('creates task with inbox status', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test', status: 'inbox' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('inbox');
  });
});

describe('GET /api/tasks', () => {
  it('filters tasks by inbox status', async () => {
    const response = await request(app).get('/api/tasks?status=inbox');
    expect(response.status).toBe(200);
    expect(response.body.every(t => t.status === 'inbox')).toBe(true);
  });
});
```

---

## Summary

| Entity | Modification Type | Files Affected | Migration Required |
|--------|-------------------|----------------|-------------------|
| `TaskStatus` | Type extension | `packages/shared/src/index.ts` | No |
| `TaskStatusSchema` | Enum extension | `packages/api/src/schemas/taskSchemas.ts` | No |
| `Task` | No change | N/A | No |
| `issues` table | No change | N/A | No |

**Key Decisions**:
1. **Application-layer validation**: No database CHECK constraints; validation via Zod schemas
2. **Backward compatibility**: Existing `'open'` tasks preserved; new defaults only apply to new tasks
3. **No workflow enforcement**: All status transitions allowed per FR-013
4. **Memo promotion default**: Changed from `'open'` to `'inbox'` per FR-015
