# Data Model: mgtd task

**Feature**: 005-docs-mgtd-task
**Date**: 2025-10-14

## Overview

The task data model extends the existing `issues` table schema, using type discrimination (`type='task'`) to differentiate tasks from memos. Tasks represent actionable items in the GTD workflow with status tracking, scheduled dates, and state transition semantics. All supporting entities (labels, comments, projects, links) are shared with memos through polymorphic relationships.

## Core Entity: Task

### Schema

Tasks are stored in the `issues` table (existing schema, defined in schema/001_init.sql):

```sql
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('memo', 'task')),
  title TEXT,
  body_md TEXT NOT NULL,
  status TEXT CHECK(status IN ('open', 'next', 'waiting', 'scheduled', 'done', 'canceled')),
  scheduled_on TEXT,  -- ISO 8601 date (YYYY-MM-DD)
  meta TEXT DEFAULT '{}',  -- JSON for extensibility
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_bookmarked INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0
);
```

### Task-Specific Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `type` | TEXT | `'task'` | Fixed discriminator for task records |
| `title` | TEXT | NOT NULL | Task title (required, distinguishes from memo where title is NULL) |
| `status` | TEXT | Enum: `open`, `next`, `waiting`, `scheduled`, `done`, `canceled` | Current workflow phase |
| `scheduled_on` | TEXT | Optional, ISO 8601 date | Target date for scheduled tasks |

### Shared Fields (with Memo)

| Field | Type | Description |
|-------|------|-------------|
| `id` | INTEGER | Shared ID sequence across memos and tasks |
| `body_md` | TEXT | Markdown content (description, notes) |
| `meta` | TEXT | JSON blob for future extensibility |
| `created_at` | TEXT | ISO 8601 timestamp |
| `updated_at` | TEXT | ISO 8601 timestamp |
| `is_bookmarked` | INTEGER | Boolean flag (0/1) |
| `is_deleted` | INTEGER | Boolean flag for logical deletion (0/1) |

### TypeScript Type Definition

```typescript
export interface Task {
  id: number;
  type: 'task';
  title: string;  // Required (NOT NULL in DB)
  bodyMd: string;
  status: 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';
  scheduledOn: string | null;  // ISO 8601 date string (YYYY-MM-DD)
  meta: Record<string, any> | null;
  createdAt: string;  // ISO 8601 timestamp
  updatedAt: string;  // ISO 8601 timestamp
  isBookmarked: boolean;
  isDeleted: boolean;
}
```

## Status State Machine

```
         create
           ↓
        [open] ←──────── reopen
           ↓
    ┌──────┼──────┐
    ↓      ↓      ↓
 [next] [waiting] [scheduled]
    ↓      ↓      ↓
    └──────┼──────┘
           ↓
      close/cancel
           ↓
      [done/canceled]
```

### State Definitions

- **open**: Initial state after creation or reopening, in Inbox
- **next**: Queued for immediate action (Next Actions list)
- **waiting**: Blocked on external dependency (Waiting For list)
- **scheduled**: Time-specific action with `scheduled_on` date set
- **done**: Completed successfully (terminal state, but can reopen)
- **canceled**: Abandoned or no longer relevant (terminal state, but can reopen)

### Transition Rules

- Any non-terminal state can transition to `done` or `canceled`
- Terminal states (`done`, `canceled`) can transition back to `open` via `reopen`
- `reopen` always resets to `open` (not previous state)
- `scheduled` state should have `scheduled_on` populated (enforced at service layer, not DB constraint)

## Relationships

### Task → Labels (Many-to-Many)

```sql
CREATE TABLE labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE issue_labels (
  issue_id INTEGER NOT NULL,
  label_id INTEGER NOT NULL,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (issue_id, label_id),
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
```

**Notes**:
- Labels are shared between memos and tasks (no type-specific labels)
- `issue_labels.issue_id` can reference either memo or task
- Cascade delete: Removing issue removes label associations

### Task → Comments (One-to-Many)

```sql
CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
);

CREATE TABLE comment_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  body_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);
```

**Notes**:
- Comments polymorphic: Can attach to memo or task
- `comment_revisions` tracks edit history
- Used for documenting task progress, blockers, state transition reasons

### Task → Links (Many-to-Many, Directed)

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_issue_id INTEGER NOT NULL,
  target_issue_id INTEGER NOT NULL,
  link_type TEXT NOT NULL CHECK(link_type IN ('parent', 'child', 'relates', 'derived_from')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (target_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  UNIQUE(source_issue_id, target_issue_id, link_type)
);
```

**Link Types**:
- `derived_from`: Task created from memo via `memo promote` (task → memo)
- `parent`: Task is parent of sub-task (parent → child)
- `child`: Task is sub-task of parent (child → parent)
- `relates`: Generic association between tasks

**Example**: Task #42 `derived_from` Memo #15 means task was promoted from that memo.

### Task → Projects (Many-to-Many)

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  view_type TEXT DEFAULT 'list',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE project_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  issue_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  view_meta TEXT DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  UNIQUE(project_id, issue_id)
);
```

**Notes**:
- Projects organize tasks (and memos) into groups
- `position` defines ordering within project view
- `view_meta` stores project-specific display settings (JSON)

## Indexes for Performance

Existing indexes from schema/001_init.sql (relevant to tasks):

```sql
CREATE INDEX idx_issues_type ON issues(type);
CREATE INDEX idx_issues_updated_at ON issues(updated_at);
CREATE INDEX idx_issue_labels_issue_id ON issue_labels(issue_id);
CREATE INDEX idx_issue_labels_label_id ON issue_labels(label_id);
CREATE INDEX idx_comments_issue_id ON comments(issue_id);
CREATE INDEX idx_links_source ON links(source_issue_id);
CREATE INDEX idx_links_target ON links(target_issue_id);
CREATE INDEX idx_project_items_project_id ON project_items(project_id);
CREATE INDEX idx_project_items_issue_id ON project_items(issue_id);
```

**Recommended Additional Index** (add during implementation if not present):

```sql
CREATE INDEX IF NOT EXISTS idx_issues_type_status_deleted
  ON issues(type, status, is_deleted);
```

**Rationale**: Optimizes `task list --status <value>` queries (filters by type='task', status, is_deleted=0 frequently).

## Full-Text Search

```sql
CREATE VIRTUAL TABLE issues_fts USING fts5(
  issue_id UNINDEXED,
  body_md,
  content=issues,
  content_rowid=id
);

-- Triggers to maintain FTS index (already present in schema)
CREATE TRIGGER issues_fts_insert AFTER INSERT ON issues BEGIN
  INSERT INTO issues_fts(rowid, issue_id, body_md) VALUES (new.id, new.id, new.body_md);
END;

CREATE TRIGGER issues_fts_update AFTER UPDATE ON issues BEGIN
  UPDATE issues_fts SET body_md = new.body_md WHERE rowid = old.id;
END;

CREATE TRIGGER issues_fts_delete AFTER DELETE ON issues BEGIN
  DELETE FROM issues_fts WHERE rowid = old.id;
END;
```

**Usage**:
- `mgtd task list --search "keyword"` → Query `WHERE f.body_md MATCH 'keyword' AND i.type = 'task'`
- FTS5 also indexes task titles (stored in `body_md` for search purposes)

## Validation Rules

### Repository Layer

1. **Type Validation**: Every `getTask()`, `updateTask()`, `deleteTask()` must check `type='task'`
   - Query: `SELECT type FROM issues WHERE id = ? AND is_deleted = 0`
   - Error if `type != 'task'`: `"ID refers to different type (memo)"`

2. **Status Enum Validation**: CLI validates before passing to repository
   - Allowed: `open`, `next`, `waiting`, `scheduled`, `done`, `canceled`
   - Error on invalid: `"Invalid status. Allowed: open, next, waiting, scheduled, done, canceled"`

3. **Date Format Validation**: ISO 8601 date (YYYY-MM-DD)
   - Regex: `/^\d{4}-\d{2}-\d{2}$/`
   - Valid date check: `new Date(input).toString() !== 'Invalid Date'`
   - Error: `"Invalid date format. Use YYYY-MM-DD"`

4. **Title Required**: Tasks must have non-empty title
   - Check: `title.trim().length > 0`
   - Error: `"Task title cannot be empty"`

### Business Rules

- **Scheduled Date**: If `status = 'scheduled'`, `scheduled_on` should be set (soft recommendation, not enforced by DB)
- **Terminal States**: `done` and `canceled` are terminal but can be reopened
- **Logical Deletion**: Deleted tasks (`is_deleted = 1`) excluded from all list operations

## Example Records

### Task Record (Open)

```json
{
  "id": 42,
  "type": "task",
  "title": "Buy groceries",
  "bodyMd": "Milk, eggs, bread, coffee",
  "status": "open",
  "scheduledOn": null,
  "meta": {},
  "createdAt": "2025-10-14T10:30:00.000Z",
  "updatedAt": "2025-10-14T10:30:00.000Z",
  "isBookmarked": false,
  "isDeleted": false
}
```

### Task Record (Scheduled)

```json
{
  "id": 43,
  "type": "task",
  "title": "Team meeting",
  "bodyMd": "Discuss Q4 roadmap",
  "status": "scheduled",
  "scheduledOn": "2025-10-20",
  "meta": {},
  "createdAt": "2025-10-14T11:00:00.000Z",
  "updatedAt": "2025-10-14T11:00:00.000Z",
  "isBookmarked": true,
  "isDeleted": false
}
```

### Task with Labels and Comments

```json
{
  "task": {
    "id": 44,
    "type": "task",
    "title": "Fix auth bug",
    "bodyMd": "Users can't log in with GitHub OAuth",
    "status": "next",
    "scheduledOn": null,
    "meta": {},
    "createdAt": "2025-10-14T09:00:00.000Z",
    "updatedAt": "2025-10-14T14:00:00.000Z",
    "isBookmarked": false,
    "isDeleted": false
  },
  "labels": ["urgent", "backend", "bug"],
  "comments": [
    {
      "id": 101,
      "issueId": 44,
      "bodyMd": "Started investigation",
      "createdAt": "2025-10-14T10:00:00.000Z",
      "updatedAt": "2025-10-14T10:00:00.000Z",
      "isDeleted": false
    }
  ]
}
```

## Migration Notes

**No database migrations required** for this feature:
- `issues` table already supports `type='task'` via CHECK constraint
- All columns (title, status, scheduled_on) already exist
- Shared tables (labels, comments, projects, links, issues_fts) require no changes

Implementation only adds:
- Application-level type definitions (TypeScript Task interface)
- Repository functions (taskRepository.ts)
- Service layer (TaskService)
- CLI commands (packages/cli/src/commands/task/*)
