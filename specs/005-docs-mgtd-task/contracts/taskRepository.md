# Contract: taskRepository

**Package**: meme-gtd-db
**File**: packages/db/src/taskRepository.ts

## Overview

The task repository provides CRUD operations and query functions for task entities, mirroring the structure of `memoRepository.ts`. All functions enforce type validation to prevent memo/task ID confusion.

## Type Definitions

```typescript
export interface CreateTaskInput {
  title: string;               // Required
  bodyMd: string;              // Required
  status?: TaskStatus;         // Default: 'open'
  scheduledOn?: string;        // ISO 8601 date (YYYY-MM-DD)
  labels?: string[];           // Label names
  projectIds?: number[];       // Project IDs
}

export interface UpdateTaskInput {
  id: number;
  title?: string;
  bodyMd?: string;
  status?: TaskStatus;
  scheduledOn?: string | null; // null clears scheduled date
  addLabels?: string[];
  removeLabels?: string[];
  projectIds?: number[];
}

export interface ListTaskFilters {
  status?: TaskStatus;         // Filter by single status
  label?: string;              // Filter by single label name
  search?: string;             // FTS5 full-text search
  limit?: number;              // Max results
  order?: 'asc' | 'desc';      // Sort by updated_at (default: desc)
  isBookmarked?: boolean;      // Filter bookmarked tasks
}

export type TaskStatus = 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
```

## Functions

### createTask

```typescript
export const createTask = (db: Database.Database, input: CreateTaskInput): Task
```

**Description**: Creates new task record with `type='task'`.

**Parameters**:
- `db`: SQLite database connection
- `input`: Task creation parameters

**Returns**: Created `Task` object

**Behavior**:
1. Insert into `issues` table with `type='task'`, `title`, `bodyMd`, `status` (default 'open')
2. Set `created_at` and `updated_at` to current timestamp
3. If `input.labels` provided, call `attachLabels()` helper
4. If `input.projectIds` provided, call `attachProjects()` helper
5. Return task record via `getTask()`

**Errors**:
- Throws if `title` is empty string

**Example**:
```typescript
const task = createTask(db, {
  title: 'Buy groceries',
  bodyMd: 'Milk, eggs, bread',
  status: 'open',
  labels: ['personal', 'shopping']
});
// => { id: 42, type: 'task', title: 'Buy groceries', ... }
```

---

### getTask

```typescript
export const getTask = (db: Database.Database, id: number): Task
```

**Description**: Retrieves single task by ID with type validation.

**Parameters**:
- `db`: SQLite database connection
- `id`: Task ID

**Returns**: `Task` object

**Behavior**:
1. Query `SELECT * FROM issues WHERE id = ? AND type = 'task' AND is_deleted = 0`
2. If not found, throw error
3. Convert database row to `Task` object

**Errors**:
- Throws `"Task not found: {id}"` if ID doesn't exist or is deleted
- Throws `"ID refers to different type (memo)"` if ID is memo

**Example**:
```typescript
const task = getTask(db, 42);
// => { id: 42, type: 'task', title: 'Buy groceries', ... }

getTask(db, 999);  // throws "Task not found: 999"
getTask(db, 10);   // throws "ID refers to different type (memo)" if 10 is memo
```

---

### listTasks

```typescript
export const listTasks = (db: Database.Database, filters: ListTaskFilters = {}): Task[]
```

**Description**: Queries tasks with optional filtering, sorting, and pagination.

**Parameters**:
- `db`: SQLite database connection
- `filters`: Query filters (all optional)

**Returns**: Array of `Task` objects

**Behavior**:
1. Build WHERE clause: `type = 'task'` AND `is_deleted = 0`
2. If `filters.status`, add `status = ?`
3. If `filters.label`, add JOIN on `issue_labels` + `labels` tables
4. If `filters.isBookmarked`, add `is_bookmarked = ?`
5. If `filters.search`, use FTS5 query on `issues_fts` table
6. ORDER BY `updated_at` (ASC/DESC based on `filters.order`)
7. If `filters.limit`, add `LIMIT ?`
8. Return array of tasks

**Errors**: None (returns empty array if no matches)

**Example**:
```typescript
listTasks(db, { status: 'next', limit: 10 });
// => [{ id: 42, status: 'next', ... }, { id: 43, status: 'next', ... }]

listTasks(db, { search: 'grocery', order: 'asc' });
// => [{ id: 42, title: 'Buy groceries', ... }]

listTasks(db, { label: 'urgent', isBookmarked: true });
// => Tasks with label 'urgent' AND bookmarked
```

---

### updateTask

```typescript
export const updateTask = (db: Database.Database, input: UpdateTaskInput): Task
```

**Description**: Updates task fields (title, body, status, scheduled_on, labels).

**Parameters**:
- `db`: SQLite database connection
- `input`: Update parameters (all fields optional except `id`)

**Returns**: Updated `Task` object

**Behavior**:
1. Call `getTask()` to validate task exists and is correct type
2. Build UPDATE SET clause for provided fields (title, bodyMd, status, scheduledOn)
3. Set `updated_at` to current timestamp
4. Execute UPDATE query
5. If `input.addLabels`, call `attachLabels()`
6. If `input.removeLabels`, call `detachLabels()`
7. If `input.projectIds`, call `resetProjects()`
8. Return updated task via `getTask()`

**Errors**:
- Throws `"Task not found"` if ID invalid
- Throws `"ID refers to different type"` if memo ID provided
- Throws if `title` is empty string

**Example**:
```typescript
updateTask(db, { id: 42, status: 'done', addLabels: ['completed'] });
// => { id: 42, status: 'done', labels: [..., 'completed'], updatedAt: '2025-10-14...' }

updateTask(db, { id: 42, scheduledOn: null });  // Clears scheduled date
// => { id: 42, scheduledOn: null, ... }
```

---

### deleteTask

```typescript
export const deleteTask = (db: Database.Database, id: number): void
```

**Description**: Logical deletion (sets `is_deleted = 1`).

**Parameters**:
- `db`: SQLite database connection
- `id`: Task ID

**Returns**: void

**Behavior**:
1. Execute `UPDATE issues SET is_deleted = 1, updated_at = ? WHERE id = ? AND type = 'task'`
2. If no rows affected, throw error

**Errors**:
- Throws `"Task not found: {id}"` if ID invalid or already deleted

**Example**:
```typescript
deleteTask(db, 42);  // Task 42 marked as deleted
deleteTask(db, 999); // throws "Task not found: 999"
```

---

### setTaskStatus

```typescript
export const setTaskStatus = (
  db: Database.Database,
  id: number,
  status: TaskStatus
): Task
```

**Description**: Updates task status (used by close/cancel/reopen commands).

**Parameters**:
- `db`: SQLite database connection
- `id`: Task ID
- `status`: New status value

**Returns**: Updated `Task` object

**Behavior**:
1. Call `getTask()` to validate
2. Execute `UPDATE issues SET status = ?, updated_at = ? WHERE id = ?`
3. Return updated task

**Errors**:
- Throws `"Task not found"` or `"ID refers to different type"`
- Throws if `status` not in valid enum (caller should validate)

**Example**:
```typescript
setTaskStatus(db, 42, 'done');
// => { id: 42, status: 'done', updatedAt: '...' }

setTaskStatus(db, 42, 'open');  // Reopen completed task
```

---

### setBookmark

```typescript
export const setBookmark = (
  db: Database.Database,
  id: number,
  isBookmarked: boolean
): void
```

**Description**: Sets or clears bookmark flag on task.

**Parameters**:
- `db`: SQLite database connection
- `id`: Task ID
- `isBookmarked`: true to bookmark, false to unbookmark

**Returns**: void

**Behavior**:
1. Execute `UPDATE issues SET is_bookmarked = ?, updated_at = ? WHERE id = ? AND type = 'task'`
2. If no rows affected, check if ID is memo (different error message)
3. Idempotent: No error if already bookmarked/unbookmarked

**Errors**:
- Throws `"Task #<id> not found"` if ID invalid
- Throws `"Issue #<id> is not a task"` if memo ID provided

**Example**:
```typescript
setBookmark(db, 42, true);   // Bookmark task
setBookmark(db, 42, true);   // No error (idempotent)
setBookmark(db, 42, false);  // Unbookmark
```

---

## Comment Functions

### addComment

```typescript
export const addComment = (
  db: Database.Database,
  taskId: number,
  bodyMd: string
): Comment
```

**Description**: Adds comment to task.

**Parameters**:
- `db`: SQLite database connection
- `taskId`: Task ID
- `bodyMd`: Comment content (Markdown)

**Returns**: Created `Comment` object

**Behavior**:
1. Validate task exists via `getTask()`
2. Insert into `comments` table with `issue_id = taskId`
3. Return comment record

**Errors**:
- Throws if task not found or is memo

---

### updateComment

```typescript
export const updateComment = (
  db: Database.Database,
  commentId: number,
  bodyMd: string
): Comment
```

**Description**: Updates comment body, saves revision history.

**Parameters**:
- `db`: SQLite database connection
- `commentId`: Comment ID
- `bodyMd`: New comment content

**Returns**: Updated `Comment` object

**Behavior**:
1. Fetch existing comment
2. Insert old body into `comment_revisions`
3. Update `comments.body_md` and `updated_at`
4. Return updated comment

**Errors**:
- Throws `"Comment not found"` if invalid ID

---

### deleteComment

```typescript
export const deleteComment = (db: Database.Database, commentId: number): void
```

**Description**: Logical deletion of comment.

**Parameters**:
- `db`: SQLite database connection
- `commentId`: Comment ID

**Returns**: void

**Behavior**:
1. Execute `UPDATE comments SET is_deleted = 1, updated_at = ? WHERE id = ?`

**Errors**:
- Throws `"Comment not found"` if invalid ID

---

### listComments

```typescript
export const listComments = (db: Database.Database, taskId: number): Comment[]
```

**Description**: Lists all comments for task.

**Parameters**:
- `db`: SQLite database connection
- `taskId`: Task ID

**Returns**: Array of `Comment` objects (oldest first)

**Behavior**:
1. Query `SELECT * FROM comments WHERE issue_id = ? AND is_deleted = 0 ORDER BY created_at ASC`
2. Return comment array

---

## Label Functions

### listTaskLabels

```typescript
export const listTaskLabels = (db: Database.Database, taskId: number): string[]
```

**Description**: Returns label names attached to task.

**Parameters**:
- `db`: SQLite database connection
- `taskId`: Task ID

**Returns**: Array of label names (alphabetically sorted)

---

### setTaskLabels

```typescript
export const setTaskLabels = (
  db: Database.Database,
  taskId: number,
  labels: string[]
): void
```

**Description**: Replaces all task labels (used by `task label set`).

**Parameters**:
- `db`: SQLite database connection
- `taskId`: Task ID
- `labels`: New label set

**Behavior**:
1. Delete all existing label associations for task
2. Attach new labels via `attachLabels()` helper

---

## Shared Helper Functions

These functions are reused from `memoRepository.ts` (may be extracted to common module):

```typescript
const attachLabels = (db: Database, issueId: number, labels: string[]): void;
const detachLabels = (db: Database, issueId: number, labels: string[]): void;
const attachProjects = (db: Database, issueId: number, projectIds: number[]): void;
const resetProjects = (db: Database, issueId: number, projectIds: number[]): void;
```

## Internal Helpers

```typescript
const taskRowToTask = (row: any): Task;
// Converts database row to Task object (handles type coercion, JSON parsing)

const commentRowToComment = (row: any): Comment;
// Converts database row to Comment object
```
