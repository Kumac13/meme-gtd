# Data Model: Include Labels in API Responses

**Feature**: Include Labels in API Responses
**Date**: 2025-10-21
**Purpose**: Define data structures and relationships for label inclusion in API responses

## Overview

This feature does NOT introduce new data entities or database schema changes. It enhances existing API response models to include label information that already exists in the database.

## Existing Database Schema (No Changes)

### Tables (Already Exist)

**issues**
- `id`: INTEGER PRIMARY KEY
- `type`: TEXT ('memo' | 'task')
- `title`: TEXT (nullable for memos)
- `body_md`: TEXT
- `status`: TEXT (nullable for memos)
- `scheduled_on`: TEXT (nullable)
- `created_at`: TEXT
- `updated_at`: TEXT
- `is_bookmarked`: INTEGER (0|1)
- `is_deleted`: INTEGER (0|1)

**labels**
- `id`: INTEGER PRIMARY KEY
- `name`: TEXT UNIQUE
- `description`: TEXT (nullable)
- `created_at`: TEXT

**issue_labels** (junction table)
- `issue_id`: INTEGER (FK to issues.id)
- `label_id`: INTEGER (FK to labels.id)
- `assigned_at`: TEXT
- PRIMARY KEY (issue_id, label_id)

### Relationships

```
issues (1) ←→ (N) issue_labels (N) ←→ (1) labels
```

- One issue can have many labels (0..N)
- One label can be attached to many issues
- `issue_labels` table stores the many-to-many relationship

## Response Models (Changes)

### Memo Response (Modified)

**Before**:
```typescript
interface Memo {
  id: number;
  type: 'memo';
  title: null;
  bodyMd: string;
  status: null;
  scheduledOn: null;
  meta: Record<string, any>;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

**After**:
```typescript
interface Memo {
  id: number;
  type: 'memo';
  title: null;
  bodyMd: string;
  status: null;
  scheduledOn: null;
  meta: Record<string, any>;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  labels: string[];   // NEW: Array of label names
}
```

### Task Response (Modified)

**Before**:
```typescript
interface Task {
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: TaskStatus;  // 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled'
  scheduledOn: string | null;  // YYYY-MM-DD format
  meta: Record<string, any>;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

**After**:
```typescript
interface Task {
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: TaskStatus;  // 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled'
  scheduledOn: string | null;  // YYYY-MM-DD format
  meta: Record<string, any>;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  labels: string[];   // NEW: Array of label names
}
```

### Detail Responses (Modified)

**MemoDetail** (extends Memo):
```typescript
interface MemoDetail extends Memo {
  labels: string[];        // Now required (was optional in base)
  commentsCount?: number;  // Existing field
}
```

**TaskDetail** (extends Task):
```typescript
interface TaskDetail extends Task {
  labels: string[];        // Now required (was optional in base)
  commentsCount?: number;  // Existing field
}
```

## Field Specifications

### labels: string[]

**Type**: Array of strings
**Required**: Yes (always present, empty array if no labels)
**Description**: List of label names attached to this issue

**Rules**:
- Always an array (never null or undefined)
- Empty array `[]` when no labels attached
- Label names are unique within the array (no duplicates)
- Sorted alphabetically by label name
- Only includes non-deleted labels (`labels.is_deleted = 0`)
- Maximum length: Unlimited (but typically 0-10 labels per item)

**Example Values**:
```typescript
labels: []                           // No labels
labels: ["important"]                // Single label
labels: ["important", "urgent", "work"]  // Multiple labels (alphabetically sorted)
```

## Data Flow

### List Endpoints (GET /api/memos, GET /api/tasks)

```
1. Repository Layer (packages/db)
   └─> listMemos(db, filters) / listTasks(db, filters)
       Returns: Memo[] / Task[] (without labels)

2. Service Layer (packages/core)
   └─> For each item in results:
       ├─> listMemoLabels(db, item.id) / listTaskLabels(db, item.id)
       │   Returns: string[] (label names)
       └─> Merge labels into item object

3. API Handler (packages/api)
   └─> Service returns items with labels
   └─> Zod schema validates response
   └─> Returns JSON to client
```

### Detail Endpoints (GET /api/memos/:id, GET /api/tasks/:id)

```
1. Repository Layer (packages/db)
   └─> getMemo(db, id) / getTask(db, id)
       Returns: Memo / Task (without labels)

2. Service Layer (packages/core)
   └─> listMemoLabels(db, id) / listTaskLabels(db, id)
   │   Returns: string[] (label names)
   └─> Merge labels into item object

3. API Handler (packages/api)
   └─> Service returns item with labels
   └─> Zod schema validates response
   └─> Returns JSON to client
```

## Validation Rules

### API Schema Validation (Zod)

```typescript
// Memo/Task Schema addition
labels: z.array(z.string())
  .describe('Array of label names assigned to this memo/task')
```

**Validation**:
- Must be an array
- Each element must be a string
- No minimum/maximum length constraints
- Empty array is valid

### Data Integrity

- Labels returned are guaranteed to exist in `labels` table
- Labels are guaranteed not to be deleted (`is_deleted = 0`)
- Labels are deduplicated (no duplicate names in array)
- Labels are sorted alphabetically

## Performance Characteristics

### Query Complexity

**List Endpoints**:
- Base query: 1 SELECT from `issues` table
- Label queries: N additional SELECTs (N = number of items returned)
- Total: 1 + N queries

**Detail Endpoints**:
- Base query: 1 SELECT from `issues` table
- Label query: 1 SELECT with JOIN
- Total: 2 queries

### Memory Impact

**Per Item**:
- Typical: 0-5 labels × ~20 chars/label = ~100 bytes
- Maximum: ~50 labels × ~50 chars/label = ~2.5KB

**List of 100 items**:
- Additional memory: ~10KB (typical) to ~250KB (maximum)

### Optimization Opportunities (Future)

If performance becomes an issue:
- Option A: Single query with LEFT JOIN and GROUP_CONCAT
- Option B: Batch label fetching with IN clause
- Option C: Caching frequently accessed labels

Current scale does not require optimization.

## Migration Strategy

**Database**: No migration needed (no schema changes)
**API**: Additive change only (backward compatible)
**Client**: Existing clients ignore unknown fields
**Web UI**: Already prepared to consume labels field

## Testing Scenarios

### Data States

1. **No labels**: `labels: []`
2. **Single label**: `labels: ["important"]`
3. **Multiple labels**: `labels: ["bug", "urgent", "work"]`
4. **Deleted label**: Should NOT appear in `labels` array
5. **Duplicate assignment**: Should appear once in `labels` array

### Edge Cases

1. Item with 20+ labels
2. Label with special characters in name
3. Label name with Unicode characters
4. Item in database without any label associations
