# Data Model: Label and Status Search

**Feature**: 024-tasks-memos-label
**Date**: 2025-11-04
**Phase**: 1 (Design & Contracts)

## Overview

This feature does **not require any database schema changes**. It leverages the existing data model and adds new query interfaces for filtering. This document describes the existing entities and their relationships, plus the new filter interfaces.

---

## Existing Entities

### Entity: Issue

The base entity for both tasks and memos (polymorphic type).

**Table**: `issues`

**Fields**:
- `id` (INTEGER PRIMARY KEY) - Unique identifier
- `type` (TEXT NOT NULL) - Discriminator: 'task' or 'memo'
- `title` (TEXT) - Task title (NULL for memos)
- `body_md` (TEXT NOT NULL) - Markdown content
- `status` (TEXT) - Task status: 'open', 'next', 'waiting', 'scheduled', 'done', 'canceled' (NULL for memos)
- `scheduled_on` (TEXT) - ISO date for scheduled tasks (NULL otherwise)
- `meta` (TEXT) - JSON metadata
- `created_at` (TEXT NOT NULL) - ISO timestamp (default: now)
- `updated_at` (TEXT NOT NULL) - ISO timestamp (default: now)
- `is_bookmarked` (INTEGER NOT NULL) - Boolean flag (0 or 1)
- `is_deleted` (INTEGER NOT NULL) - Soft delete flag (0 or 1)

**Validation Rules**:
- `type` must be 'task' or 'memo'
- `status` must be one of the valid status values (enforced in application layer)
- `is_bookmarked` and `is_deleted` are 0 or 1 (SQLite boolean representation)

**Relationships**:
- Many-to-many with `Label` through `IssueLabel` join table
- One-to-many with `IssueLabel` (an issue can have multiple labels)

**State Transitions** (for tasks only):
```
open → next → waiting → done
     → scheduled → done
     → canceled
```

---

### Entity: Label

Shared categorization tags that can be applied to both tasks and memos.

**Table**: `labels`

**Fields**:
- `id` (INTEGER PRIMARY KEY) - Unique identifier
- `name` (TEXT NOT NULL UNIQUE) - Label name (case-insensitive, unique)
- `description` (TEXT) - Optional label description
- `created_at` (TEXT NOT NULL) - ISO timestamp (default: now)

**Validation Rules**:
- `name` must be unique (enforced by UNIQUE constraint)
- `name` is case-insensitive (SQLite COLLATE NOCASE)
- `name` cannot be empty

**Relationships**:
- Many-to-many with `Issue` through `IssueLabel` join table

**Indexing**:
- Primary key index on `id`
- Unique index on `name` (COLLATE NOCASE)

---

### Entity: IssueLabel

Join table for the many-to-many relationship between issues and labels.

**Table**: `issue_labels`

**Fields**:
- `issue_id` (INTEGER NOT NULL) - Foreign key to `issues.id`
- `label_id` (INTEGER NOT NULL) - Foreign key to `labels.id`
- `assigned_at` (TEXT NOT NULL) - ISO timestamp when label was attached

**Validation Rules**:
- Composite primary key on `(issue_id, label_id)`
- Foreign key constraints with CASCADE on DELETE
- Cannot assign same label to same issue twice (enforced by PRIMARY KEY)

**Relationships**:
- Many-to-one with `Issue` (issue_id → issues.id)
- Many-to-one with `Label` (label_id → labels.id)

**Indexing**:
- Composite primary key index on `(issue_id, label_id)`
- Implicit index on `issue_id` (from PRIMARY KEY)
- Additional index on `label_id` for reverse lookups (from FOREIGN KEY)

---

## Entity Relationships Diagram

```
┌─────────────────────┐
│      Issue          │
│  (tasks + memos)    │
├─────────────────────┤
│ id (PK)             │
│ type                │──── 'task' or 'memo'
│ title               │
│ body_md             │
│ status              │──── tasks only
│ scheduled_on        │
│ meta                │
│ created_at          │
│ updated_at          │
│ is_bookmarked       │
│ is_deleted          │
└──────────┬──────────┘
           │
           │ 1:N
           │
           ▼
┌─────────────────────┐         ┌─────────────────────┐
│    IssueLabel       │   N:1   │       Label         │
│   (join table)      │─────────│                     │
├─────────────────────┤         ├─────────────────────┤
│ issue_id (FK, PK)   │         │ id (PK)             │
│ label_id (FK, PK)   │         │ name (UNIQUE)       │
│ assigned_at         │         │ description         │
└─────────────────────┘         │ created_at          │
                                └─────────────────────┘
```

---

## New Filter Interfaces

These interfaces define how filtering parameters are passed through the application layers.

### Interface: ListTaskFilters

**Purpose**: Defines filter options for querying tasks

**Location**: `packages/db/src/taskRepository.ts` (existing, will be extended)

**Current Fields**:
```typescript
export interface ListTaskFilters {
  status?: TaskStatus;           // Filter by task status
  label?: string;                 // Filter by single label
  search?: string;                // Full-text search
  limit?: number;                 // Maximum results
  order?: 'asc' | 'desc';        // Sort direction
  isBookmarked?: boolean;         // Bookmark filter
}
```

**New Fields** (to be added):
```typescript
export interface ListTaskFilters {
  status?: TaskStatus;           // Filter by task status (existing)
  labels?: string[];             // ⭐ NEW: Filter by multiple labels (OR logic)
  label?: string;                // ⚠️ DEPRECATED: Use labels[] instead (kept for backward compatibility)
  search?: string;               // Full-text search (existing)
  limit?: number;                // Maximum results (existing)
  order?: 'asc' | 'desc';        // Sort direction (existing)
  isBookmarked?: boolean;        // Bookmark filter (existing)
}
```

**Validation Rules**:
- `labels` array is optional (empty array means no filtering)
- `label` is maintained for backward compatibility (single string)
- If both `label` and `labels` provided, merge them
- `status` must be valid TaskStatus enum value
- `limit` must be positive integer
- `order` must be 'asc' or 'desc'

**Usage Example**:
```typescript
// Single label (backward compatible)
const filters: ListTaskFilters = { label: 'bug' };

// Multiple labels (new)
const filters: ListTaskFilters = { labels: ['bug', 'enhancement'] };

// Combined filters
const filters: ListTaskFilters = {
  labels: ['bug', 'enhancement'],
  status: 'open',
  isBookmarked: true
};
```

---

### Interface: ListMemoFilters

**Purpose**: Defines filter options for querying memos

**Location**: `packages/db/src/memoRepository.ts` (existing, will be extended)

**Current Fields**:
```typescript
export interface ListMemoFilters {
  label?: string;                 // Filter by single label
  search?: string;                // Full-text search
  limit?: number;                 // Maximum results
  order?: 'asc' | 'desc';        // Sort direction
  isBookmarked?: boolean;         // Bookmark filter
}
```

**New Fields** (to be added):
```typescript
export interface ListMemoFilters {
  labels?: string[];             // ⭐ NEW: Filter by multiple labels (OR logic)
  label?: string;                // ⚠️ DEPRECATED: Use labels[] instead (kept for backward compatibility)
  search?: string;               // Full-text search (existing)
  limit?: number;                // Maximum results (existing)
  order?: 'asc' | 'desc';        // Sort direction (existing)
  isBookmarked?: boolean;        // Bookmark filter (existing)
}
```

**Validation Rules**:
- Same as `ListTaskFilters` but without `status` (memos don't have status)
- `labels` array is optional
- `label` maintained for backward compatibility

**Usage Example**:
```typescript
// Single label (backward compatible)
const filters: ListMemoFilters = { label: 'idea' };

// Multiple labels (new)
const filters: ListMemoFilters = { labels: ['idea', 'meeting-notes'] };
```

---

### Interface: ParsedSearchQuery

**Purpose**: Structured representation of parsed Web UI search input

**Location**: `packages/web/src/utils/queryParser.ts` (new file)

**Fields**:
```typescript
export interface ParsedSearchQuery {
  labels?: string[];      // Parsed from label:value or label:v1,v2
  status?: string;        // Parsed from status:value (tasks only)
  rawQuery?: string;      // Original query string (for display)
}
```

**Validation Rules**:
- `labels` is undefined if no label: syntax found (not empty array)
- `status` is undefined if no status: syntax found
- `rawQuery` preserves original input for error messages

**Parsing Logic**:
```typescript
function parseSearchQuery(query: string): ParsedSearchQuery {
  // Pattern: key:value or key:"quoted value"
  const regex = /(\w+):(?:"([^"]+)"|([^:\s]+))/g;

  const result: ParsedSearchQuery = { rawQuery: query };
  let match;

  while ((match = regex.exec(query)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2] || match[3];

    if (key === 'label') {
      // Split comma-separated values
      result.labels = value.split(',').map(v => v.trim());
    } else if (key === 'status') {
      result.status = value.trim();
    }
  }

  return result;
}
```

**Example Inputs/Outputs**:
```typescript
parseSearchQuery('label:bug')
// → { labels: ['bug'], rawQuery: 'label:bug' }

parseSearchQuery('label:bug,enhancement status:open')
// → { labels: ['bug', 'enhancement'], status: 'open', rawQuery: '...' }

parseSearchQuery('label:"needs review"')
// → { labels: ['needs review'], rawQuery: 'label:"needs review"' }

parseSearchQuery('')
// → { rawQuery: '' }
```

---

## Query Patterns

### Pattern 1: Filter by Single Label

**SQL Query**:
```sql
SELECT * FROM issues
WHERE type = 'task'
  AND is_deleted = 0
  AND id IN (
    SELECT issue_id
    FROM issue_labels il
    JOIN labels l ON l.id = il.label_id
    WHERE l.name = @label COLLATE NOCASE
  )
ORDER BY updated_at DESC;
```

**Performance**:
- Uses index on `labels.name` (UNIQUE)
- Uses index on `issue_labels.issue_id` (PRIMARY KEY)
- Estimated: ~5ms for 1000 tasks

---

### Pattern 2: Filter by Multiple Labels (OR Logic)

**SQL Query**:
```sql
SELECT * FROM issues
WHERE type = 'task'
  AND is_deleted = 0
  AND id IN (
    SELECT issue_id
    FROM issue_labels il
    JOIN labels l ON l.id = il.label_id
    WHERE l.name IN (@label1, @label2, @label3) COLLATE NOCASE
  )
ORDER BY updated_at DESC;
```

**Performance**:
- Same index usage as single label
- IN clause is efficient for <100 values
- Estimated: ~10ms for 1000 tasks with 3 labels

---

### Pattern 3: Combine Label and Status Filters (AND Logic)

**SQL Query**:
```sql
SELECT * FROM issues
WHERE type = 'task'
  AND is_deleted = 0
  AND status = @status
  AND id IN (
    SELECT issue_id
    FROM issue_labels il
    JOIN labels l ON l.id = il.label_id
    WHERE l.name IN (@label1, @label2)
  )
ORDER BY updated_at DESC;
```

**Performance**:
- Two filter conditions in WHERE clause (AND logic)
- Status filter is fast (indexed column)
- Estimated: ~15ms for 1000 tasks

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Web UI                              │
├─────────────────────────────────────────────────────────────┤
│  User types: "label:bug,enhancement status:open"            │
│            ↓                                                 │
│  queryParser.parseSearchQuery(query)                        │
│            ↓                                                 │
│  { labels: ['bug', 'enhancement'], status: 'open' }         │
│            ↓                                                 │
│  useUrlFilters() → updates URL search params                │
│            ↓                                                 │
│  fetch(`/api/tasks?label=bug,enhancement&status=open`)      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      REST API (Fastify)                     │
├─────────────────────────────────────────────────────────────┤
│  GET /api/tasks?label=bug,enhancement&status=open           │
│            ↓                                                 │
│  Zod validation: TaskQuerySchema                            │
│            ↓                                                 │
│  { label: 'bug,enhancement', status: 'open' }               │
│            ↓                                                 │
│  Handler splits comma: ['bug', 'enhancement']               │
│            ↓                                                 │
│  taskService.list({ labels: [...], status: 'open' })        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer (Core)                      │
├─────────────────────────────────────────────────────────────┤
│  TaskService.list(filters)                                  │
│            ↓                                                 │
│  listTasks(db, filters)  // Pass through to repository      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                Database Layer (Repository)                  │
├─────────────────────────────────────────────────────────────┤
│  listTasks(db, { labels: [...], status: 'open' })          │
│            ↓                                                 │
│  Build SQL with IN clause for labels                        │
│  Add WHERE status = 'open'                                  │
│            ↓                                                 │
│  Execute query with parameterized bindings                  │
│            ↓                                                 │
│  Return Issue[] with attached labels                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Type Definitions

### TypeScript Types (Shared Package)

**Location**: `packages/shared/src/types.ts`

```typescript
// Task status enum
export type TaskStatus = 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';

// Issue type discriminator
export type IssueType = 'task' | 'memo';

// Base Issue interface
export interface Issue {
  id: number;
  type: IssueType;
  title: string | null;
  body_md: string;
  status: TaskStatus | null;
  scheduled_on: string | null;
  meta: string | null;
  created_at: string;
  updated_at: string;
  is_bookmarked: boolean;
  is_deleted: boolean;
}

// Task with labels
export interface Task extends Issue {
  type: 'task';
  status: TaskStatus;
  labels: Label[];  // Attached labels
}

// Memo with labels
export interface Memo extends Issue {
  type: 'memo';
  status: null;
  labels: Label[];  // Attached labels
}

// Label
export interface Label {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}
```

---

## Summary of Changes

### ✅ No Database Schema Changes Required

The existing schema already supports all required functionality:
- Labels table exists
- Issue-labels join table exists
- Indexes are in place
- Case-insensitive name matching configured

### ✅ Interface Extensions Only

Changes are limited to application layer:
1. **Database layer**: Extend filter interfaces to accept `labels[]` array
2. **API layer**: Add query parameter parsing for comma-separated labels
3. **Web layer**: Add query parser and search input component
4. **CLI layer**: Parse comma-separated flag values

### ✅ Backward Compatibility Maintained

- Old `label: string` field remains for single-label filtering
- New `labels: string[]` field for multi-label filtering
- If both provided, merge them (union of filters)
- Existing API clients continue working (optional query params)

---

## Next Steps

- ✅ Data model documented (existing schema, no changes)
- ⏭️ Generate API contracts (OpenAPI spec updates)
- ⏭️ Generate quickstart guide for developers
- ⏭️ Update agent context with implementation details
