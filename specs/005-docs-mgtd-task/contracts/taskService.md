# Contract: TaskService

**Package**: meme-gtd-core
**File**: packages/core/src/index.ts (add TaskService export alongside MemoService)

## Overview

The TaskService provides business logic layer for task operations, wrapping taskRepository functions with database connection management. It mirrors the structure of MemoService, ensuring consistency across the codebase.

## Class Definition

```typescript
export interface TaskServiceOptions {
  config: MgtdConfig;  // Contains dbPath and other settings
}

export class TaskService {
  private readonly db: Database.Database;

  constructor(options: TaskServiceOptions);

  // CRUD operations
  public create(input: CreateTaskInput): Task;
  public list(filters: ListTaskFilters): Task[];
  public show(id: number): Task;
  public edit(input: UpdateTaskInput): Task;
  public remove(id: number): void;

  // State transitions
  public close(id: number, comment?: string): Task;
  public cancel(id: number, comment?: string): Task;
  public reopen(id: number): Task;

  // Comments
  public addComment(taskId: number, bodyMd: string): Comment;
  public updateComment(commentId: number, bodyMd: string): Comment;
  public deleteComment(commentId: number): void;
  public listComments(taskId: number): Comment[];

  // Labels
  public listLabels(taskId: number): string[];
  public setLabels(taskId: number, labels: string[]): void;

  // Bookmarks
  public setBookmark(id: number, isBookmarked: boolean): void;
}
```

## Constructor

```typescript
constructor(options: TaskServiceOptions)
```

**Behavior**:
1. Store options in private field
2. Call `ensureDatabase(options.config)` to get SQLite connection
3. Store database connection in private field

**Example**:
```typescript
const service = new TaskService({ config });
```

---

## Methods

### create

```typescript
public create(input: CreateTaskInput): Task
```

**Description**: Creates new task.

**Parameters**:
- `input`: Task creation parameters (title, bodyMd, status, scheduledOn, labels, projectIds)

**Returns**: Created `Task` object

**Delegates to**: `createTask(this.db, input)` from taskRepository

**Example**:
```typescript
const task = service.create({
  title: 'Buy groceries',
  bodyMd: 'Milk, eggs, bread',
  status: 'open',
  labels: ['personal']
});
```

---

### list

```typescript
public list(filters: ListTaskFilters = {}): Task[]
```

**Description**: Queries tasks with filters.

**Parameters**:
- `filters`: Query options (status, label, search, limit, order, isBookmarked)

**Returns**: Array of `Task` objects

**Delegates to**: `listTasks(this.db, filters)` from taskRepository

**Example**:
```typescript
const nextTasks = service.list({ status: 'next', limit: 10 });
const searchResults = service.list({ search: 'grocery' });
```

---

### show

```typescript
public show(id: number): Task
```

**Description**: Retrieves single task by ID.

**Parameters**:
- `id`: Task ID

**Returns**: `Task` object

**Delegates to**: `getTask(this.db, id)` from taskRepository

**Errors**: Propagates repository errors (Task not found, type mismatch)

**Example**:
```typescript
const task = service.show(42);
```

---

### edit

```typescript
public edit(input: UpdateTaskInput): Task
```

**Description**: Updates task properties.

**Parameters**:
- `input`: Update parameters (id, title, bodyMd, status, scheduledOn, addLabels, removeLabels, projectIds)

**Returns**: Updated `Task` object

**Delegates to**: `updateTask(this.db, input)` from taskRepository

**Example**:
```typescript
const updated = service.edit({
  id: 42,
  status: 'next',
  addLabels: ['urgent']
});
```

---

### remove

```typescript
public remove(id: number): void
```

**Description**: Logical deletion of task.

**Parameters**:
- `id`: Task ID

**Returns**: void

**Delegates to**: `deleteTask(this.db, id)` from taskRepository

**Example**:
```typescript
service.remove(42);
```

---

### close

```typescript
public close(id: number, comment?: string): Task
```

**Description**: Sets task status to 'done', optionally adds comment.

**Parameters**:
- `id`: Task ID
- `comment`: Optional comment explaining closure

**Returns**: Updated `Task` object

**Behavior**:
1. Call `setTaskStatus(this.db, id, 'done')`
2. If `comment` provided, call `addComment(this.db, id, comment)`
3. Return updated task

**Example**:
```typescript
service.close(42, 'Completed successfully');
service.close(43);  // Close without comment
```

---

### cancel

```typescript
public cancel(id: number, comment?: string): Task
```

**Description**: Sets task status to 'canceled', optionally adds comment.

**Parameters**:
- `id`: Task ID
- `comment`: Optional comment explaining cancellation

**Returns**: Updated `Task` object

**Behavior**:
1. Call `setTaskStatus(this.db, id, 'canceled')`
2. If `comment` provided, call `addComment(this.db, id, comment)`
3. Return updated task

**Example**:
```typescript
service.cancel(42, 'No longer needed');
```

---

### reopen

```typescript
public reopen(id: number): Task
```

**Description**: Resets task status to 'open' (reopens closed/canceled tasks).

**Parameters**:
- `id`: Task ID

**Returns**: Updated `Task` object

**Behavior**:
1. Call `setTaskStatus(this.db, id, 'open')`
2. Return updated task

**Example**:
```typescript
service.reopen(42);  // Reopens previously closed task
```

---

### Comment Methods

```typescript
public addComment(taskId: number, bodyMd: string): Comment
public updateComment(commentId: number, bodyMd: string): Comment
public deleteComment(commentId: number): void
public listComments(taskId: number): Comment[]
```

**Description**: Manage task comments (add, edit, delete, list).

**Delegates to**: Corresponding functions from taskRepository

**Examples**:
```typescript
const comment = service.addComment(42, 'Started work');
service.updateComment(101, 'Updated note');
service.deleteComment(101);
const comments = service.listComments(42);
```

---

### Label Methods

```typescript
public listLabels(taskId: number): string[]
public setLabels(taskId: number, labels: string[]): void
```

**Description**: Manage task labels (list, replace all).

**Delegates to**: `listTaskLabels()` and `setTaskLabels()` from taskRepository

**Examples**:
```typescript
const labels = service.listLabels(42);  // ['urgent', 'backend']
service.setLabels(42, ['urgent', 'frontend']);  // Replaces all labels
```

---

### Bookmark Methods

```typescript
public setBookmark(id: number, isBookmarked: boolean): void
```

**Description**: Sets or clears bookmark flag.

**Delegates to**: `setBookmark(this.db, id, isBookmarked)` from taskRepository

**Examples**:
```typescript
service.setBookmark(42, true);   // Bookmark
service.setBookmark(42, false);  // Unbookmark
```

---

## Error Handling

TaskService propagates errors from repository layer without modification:
- `"Task not found: {id}"`
- `"ID refers to different type (memo)"`
- `"Comment not found: {id}"`
- Database errors (connection, constraint violations, etc.)

CLI layer is responsible for catching errors and formatting user-friendly messages.

## Usage Example

```typescript
import { loadConfig } from 'meme-gtd-config';
import { TaskService } from 'meme-gtd-core';

const { config } = await loadConfig({ createIfMissing: true });
const service = new TaskService({ config });

// Create task
const task = service.create({
  title: 'Buy groceries',
  bodyMd: 'Milk, eggs, bread',
  labels: ['personal', 'shopping']
});

// List next actions
const nextTasks = service.list({ status: 'next' });

// Close task with comment
service.close(task.id, 'Completed at store');

// View task details
const updated = service.show(task.id);
console.log(updated);  // { id: 1, status: 'done', ... }
```
