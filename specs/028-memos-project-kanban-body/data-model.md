# Data Model: Markdown-Rendered First Line Display for Memos

**Feature**: 028-memos-project-kanban-body
**Date**: 2025-11-17

## Overview

This feature does **NOT introduce new database entities**. It modifies existing API response types to include `bodyMd` field for kanban views.

---

## Existing Database Schema

### `issues` Table (SQLite)

**Already exists** - no schema changes needed

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Issue ID |
| `type` | TEXT | NOT NULL | 'task' or 'memo' |
| `title` | TEXT | NULL | Task title (usually NULL for memos) |
| `body_md` | TEXT | NOT NULL | Markdown body content |
| `status` | TEXT | NULL | Issue status |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Relevant Query** (existing):
```sql
SELECT id, type, title, body_md, status FROM issues WHERE type = 'memo';
```

### `project_items` Table (SQLite)

**Already exists** - no schema changes needed

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Project item ID |
| `project_id` | INTEGER | FOREIGN KEY | References `projects(id)` |
| `issue_id` | INTEGER | FOREIGN KEY | References `issues(id)` |
| `position` | REAL | NOT NULL | Fractional position for ordering |
| `view_meta` | TEXT | NULL | JSON: `{"column": "inbox"}` |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `updated_at` | TEXT | NOT NULL | ISO 8601 timestamp |

**Relevant Query** (MODIFIED in this feature):
```sql
-- BEFORE (missing body_md)
SELECT
  pi.*,
  i.id as issue_id,
  i.type as issue_type,
  i.title as issue_title,
  i.status as issue_status
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ?;

-- AFTER (adds body_md)
SELECT
  pi.*,
  i.id as issue_id,
  i.type as issue_type,
  i.title as issue_title,
  i.body_md as issue_body_md,  -- ✏️ ADD THIS LINE
  i.status as issue_status
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ?;
```

---

## TypeScript Type Definitions

### Modified Types

#### `ProjectItemWithIssue` (packages/shared/src/types/project.ts)

**BEFORE**:
```typescript
export interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
    status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | null;
  };
}
```

**AFTER**:
```typescript
export interface ProjectItemWithIssue extends ProjectItem {
  issue: {
    id: number;
    type: 'task' | 'memo';
    title: string;
    bodyMd: string;  // ✏️ ADD THIS FIELD
    status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled' | null;
  };
}
```

**Rationale**:
- Kanban cards need `bodyMd` to display memo content
- Database already has `body_md` column (TEXT NOT NULL)
- Makes field non-nullable since DB enforces NOT NULL

**Impact**:
- TypeScript compiler will require `bodyMd` in all kanban API responses
- Type-safe access in `KanbanCard` component: `item.issue.bodyMd`

---

### Unchanged Types

#### `Memo` Type (packages/shared/src/types/issue.ts)

**No changes needed** - already has `bodyMd`

```typescript
export interface Memo {
  id: number;
  type: 'memo';
  title: string | null;
  bodyMd: string;  // ✅ Already exists
  // ... other fields
}
```

**Used in**: `/memos` list view (ItemList component)

#### `Task` Type

**No changes needed** - tasks use `title` field, not `bodyMd` in kanban

---

## API Response Changes

### GET `/api/projects/:id` Response

**Endpoint**: Returns project detail with all items

**Response Type**: `ProjectDetail`

**BEFORE** (example JSON):
```json
{
  "id": 4,
  "name": "お金を可視化する",
  "items": [
    {
      "id": 123,
      "projectId": 4,
      "issueId": 24,
      "position": 1.0,
      "issue": {
        "id": 24,
        "type": "memo",
        "title": "",
        "status": null
      }
    }
  ]
}
```

**AFTER** (example JSON):
```json
{
  "id": 4,
  "name": "お金を可視化する",
  "items": [
    {
      "id": 123,
      "projectId": 4,
      "issueId": 24,
      "position": 1.0,
      "issue": {
        "id": 24,
        "type": "memo",
        "title": "",
        "bodyMd": "# お金について\n## Rule - Suica...",  // ✏️ ADDED
        "status": null
      }
    }
  ]
}
```

**Change**: Adds `bodyMd` field to `issue` object in each project item

---

## Data Flow

### List View (`/memos`)

```
Database (issues table)
  ↓ SELECT id, type, title, body_md, ... WHERE type = 'memo'
Repository (issueRepository.ts)
  ↓ Returns Memo[]
API (GET /api/memos)
  ↓ JSON: [{id, type, title, bodyMd, ...}]
Frontend (ItemList.tsx)
  ↓ item.bodyMd
extractFirstLine(item.bodyMd)
  ↓ "# お金について" → "# お金について"
InlineMarkdownRenderer
  ↓ Renders: <strong className="...">お金について</strong>
```

**No changes to this flow** - already has `bodyMd`

---

### Kanban View (`/project/:id/kanban`)

```
Database (project_items JOIN issues)
  ↓ SELECT pi.*, i.body_md as issue_body_md, ... WHERE pi.project_id = ?
Repository (projectItemRepository.ts)
  ↓ Maps to ProjectItemWithIssue[] ✏️ NOW INCLUDES bodyMd
API (GET /api/projects/:id)
  ↓ JSON: {items: [{issue: {bodyMd: "..."}}]}
Frontend (KanbanCard.tsx)
  ↓ item.issue.bodyMd ✏️ NEW ACCESS
extractFirstLine(item.issue.bodyMd, 80)
  ↓ Truncates to 80 chars
InlineMarkdownRenderer
  ↓ Renders inline formatted text
```

**Changes**:
- Repository adds `body_md` to SELECT
- Type definition adds `bodyMd` field
- Component uses `bodyMd` instead of `title`

---

## Validation Rules

### Frontend Validation

**Empty Body Handling**:
```typescript
// Before rendering, check for empty/whitespace
if (!item.bodyMd || !item.bodyMd.trim()) {
  return <span className="text-gray-500">Memo #{item.id}</span>;
}
```

**First Line Extraction**:
```typescript
function extractFirstLine(markdown: string, maxLength?: number): string {
  const firstLine = markdown.split('\n')[0] || '';  // Empty string if no content
  if (maxLength && firstLine.length > maxLength) {
    return firstLine.slice(0, maxLength).trim() + '...';
  }
  return firstLine;
}
```

**Constraints**:
- Max length for list view: 150 characters
- Max length for kanban view: 80 characters
- Truncation adds `...` ellipsis

### Backend Validation

**No new validation needed** - `body_md` column already has constraints:
- `TEXT NOT NULL` - cannot be null (enforced by database)
- Default empty string `''` for new memos

---

## State Management

**No state changes needed** - this feature is display-only

- Data fetched via existing API calls
- No new mutations/updates
- No local state for markdown rendering (stateless component)

---

## Migration

**No database migration needed**

- `body_md` column already exists in `issues` table
- All existing memos have `body_md` values (TEXT NOT NULL enforced)
- Type changes are frontend-only (no runtime migration)

---

## Summary

**Database Changes**: None (uses existing schema)
**Type Changes**: Add `bodyMd: string` to `ProjectItemWithIssue.issue`
**API Changes**: Add `body_md` to SELECT in kanban query
**Data Flow**: Memo list unchanged, kanban now includes `bodyMd`
**Validation**: Frontend checks for empty, truncates long lines
**Migration**: Not required
