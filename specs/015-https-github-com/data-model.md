# Data Model: Project Management

**Feature**: Project Management CLI Commands and API
**Date**: 2025-10-24

## Overview

Project management uses two existing database tables: `projects` and `project_items`. No schema changes are required - tables are already implemented in `schema/001_init.sql`.

## Entities

### 1. Project

**Purpose**: Container for organizing related tasks and memos.

**Attributes**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique project identifier |
| `name` | TEXT | NOT NULL, UNIQUE | Project name (must be unique across system) |
| `description` | TEXT | NULL | Optional project description |
| `view_meta` | TEXT | NULL | JSON string containing view configuration |
| `created_at` | TEXT | NOT NULL, DEFAULT now() | ISO 8601 timestamp of creation |

**View Meta Structure**:
```json
// Board view
{
  "viewType": "board",
  "columns": ["To Do", "In Progress", "Done"]
}

// Table view
{
  "viewType": "table"
}
```

**Relationships**:
- One project has many project_items (one-to-many)
- Projects do not directly reference issues (relationship is through project_items)

**Constraints**:
- `UNIQUE(name)`: Project names must be unique
- Deletion cascades to project_items

### 2. Project Item

**Purpose**: Association between a project and an issue (task or memo).

**Attributes**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique project item identifier |
| `project_id` | INTEGER | NOT NULL, FOREIGN KEY(projects.id) | Reference to parent project |
| `issue_id` | INTEGER | NOT NULL, FOREIGN KEY(issues.id) | Reference to associated issue (task/memo) |
| `position` | REAL | NOT NULL | Ordering position (fractional for flexible insertion) |
| `view_meta` | TEXT | NULL | JSON string for item-specific UI state |
| `created_at` | TEXT | NOT NULL, DEFAULT now() | ISO 8601 timestamp of creation |
| `updated_at` | TEXT | NOT NULL, DEFAULT now() | ISO 8601 timestamp of last update |

**View Meta Structure**:
```json
{
  "column": "In Progress"  // Board view column assignment
}
```

**Relationships**:
- Many project_items belong to one project (many-to-one)
- Many project_items reference one issue (many-to-one)
- One issue can appear in multiple projects (many-to-many through project_items)

**Constraints**:
- `FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE`
- `FOREIGN KEY(issue_id) REFERENCES issues(id) ON DELETE CASCADE`
- `UNIQUE(project_id, issue_id)`: Same issue cannot appear twice in same project
- Deletion of project → cascades to all project_items
- Deletion of issue → cascades to all project_items

**Position Field Design**:
- Type: REAL (floating point) for fractional positioning
- Default: `MAX(position) + 1.0` for new items
- Insertion: Use fractional values (e.g., 1.5 between 1.0 and 2.0)
- No automatic rebalancing (sparse positions are acceptable)

## TypeScript Types

```typescript
// packages/shared/src/types/project.ts

export type ViewType = 'board' | 'table';

export interface ViewMeta {
  viewType: ViewType;
  columns?: string[];  // Only for board view
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  viewMeta: ViewMeta;
  createdAt: string;  // ISO 8601
}

export interface ProjectItem {
  id: number;
  projectId: number;
  issueId: number;
  position: number;
  viewMeta: {
    column?: string;
  } | null;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

export interface ProjectDetail extends Project {
  items: ProjectItemWithIssue[];
}

export interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}
```

## Database Schema (Reference)

```sql
-- Already implemented in schema/001_init.sql (lines 70-88)

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    view_meta TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS project_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    issue_id INTEGER NOT NULL,
    position REAL NOT NULL,
    view_meta TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    UNIQUE (project_id, issue_id)
);
```

## Data Flow

### Create Project
```
User Input → CLI/API → ProjectService.create()
  → projectRepository.createProject()
  → INSERT INTO projects
  → Return Project
```

### Add Issue to Project
```
User Input → CLI/API → ProjectService.addItem()
  → Validate issue exists
  → Calculate position (MAX + 1.0)
  → projectItemRepository.createProjectItem()
  → INSERT INTO project_items
  → Return ProjectItem
```

### View Project with Items
```
User Request → CLI/API → ProjectService.getById()
  → projectRepository.getProjectById() → SELECT project
  → projectItemRepository.listProjectItems() → SELECT items + JOIN issues
  → Combine into ProjectDetail
  → Return with nested items
```

### Delete Project
```
User Request → CLI/API → ProjectService.delete()
  → projectRepository.deleteProject()
  → DELETE FROM projects (CASCADE to project_items)
```

## Validation Rules

### Project Level
1. Name is required (non-empty string)
2. Name must be unique across all projects
3. view_meta must be valid JSON (if provided)
4. viewType must be 'board' or 'table'

### Project Item Level
1. project_id must reference existing project
2. issue_id must reference existing issue (not deleted)
3. Same issue cannot be added to project twice (UNIQUE constraint)
4. position must be a positive number
5. column (in view_meta) is free-text (no validation)

## Query Patterns

### List Projects (Ordered by Creation)
```sql
SELECT * FROM projects ORDER BY created_at DESC
```

### Get Project with Items
```sql
-- Project
SELECT * FROM projects WHERE id = ?

-- Items with issue info
SELECT
  pi.*,
  i.id as issue_id,
  i.type as issue_type,
  COALESCE(i.title, SUBSTR(i.body_md, 1, 100)) as issue_title
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ? AND i.is_deleted = 0
ORDER BY pi.position ASC
```

### Calculate Next Position
```sql
SELECT COALESCE(MAX(position), 0) + 1.0
FROM project_items
WHERE project_id = ?
```

### Move Item to Position
```sql
UPDATE project_items
SET position = ?, updated_at = ?, view_meta = ?
WHERE id = ?
```

### Remove Item from Project
```sql
DELETE FROM project_items
WHERE project_id = ? AND issue_id = ?
```

## Performance Considerations

- Index on `projects.name` (UNIQUE constraint creates index automatically)
- Index on `project_items(project_id)` for efficient project queries
- Index on `project_items(issue_id)` for efficient issue queries
- Batch queries: Fetch all project items + issues in single JOIN query
- Position rebalancing: Not needed (fractional positions prevent overflow)

## Migration Notes

**No migration required** - Tables already exist in production database. Implementation only adds service/repository/CLI/API layers on top of existing schema.
