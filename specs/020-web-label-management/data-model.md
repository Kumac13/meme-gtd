# Data Model: Web UI Label Management

**Feature**: 020-web-label-management
**Date**: 2025-10-28
**Status**: Phase 1 Design

## Overview

This document describes the data model for the label management feature. The backend data model (database schema, entities) already exists and is complete. This document focuses on the **Web UI data flow** and state management for the new frontend components.

---

## Existing Backend Data Model (No Changes Required)

### Database Schema

#### Table: `labels`
```sql
CREATE TABLE IF NOT EXISTS labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

**Constraints**:
- `name`: UNIQUE (prevents duplicate label names)
- `id`: AUTO INCREMENT primary key

#### Table: `issue_labels` (Junction Table)
```sql
CREATE TABLE IF NOT EXISTS issue_labels (
    issue_id INTEGER NOT NULL,
    label_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (issue_id, label_id),
    FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
);
```

**Relationships**:
- **Many-to-many** relationship between issues (memos/tasks) and labels
- **CASCADE deletion**: Deleting a label removes all assignments
- **CASCADE deletion**: Deleting an issue removes all label assignments
- **Composite primary key**: Prevents duplicate assignments (issue_id + label_id)

### Existing API Entities

#### Label Entity (TypeScript)
```typescript
// packages/shared/src/index.ts
export interface Label {
  id: number;                    // Unique label ID
  name: string;                  // Label name (unique)
  description: string | null;    // Optional description
  createdAt: string;             // ISO 8601 timestamp
}
```

#### Memo/Task Entity with Labels
```typescript
export interface Memo {
  id: number;
  title: string;
  body: string;
  labels: string[];              // Array of label NAMES (not Label objects)
  // ... other fields
}

export interface Task {
  id: number;
  title: string;
  status: TaskStatus;
  labels: string[];              // Array of label NAMES (not Label objects)
  // ... other fields
}
```

**Important Note**: When fetching memos/tasks, labels are returned as an **array of strings (label names)**, not full Label objects. This is for efficiency in list views.

---

## New Frontend Data Model

### Component State Models

#### 1. LabelManagementModal State

```typescript
interface LabelManagementState {
  // Data from API
  allLabels: Label[];              // All available labels (from GET /api/labels)
  assignedLabelIds: Set<number>;   // Label IDs currently assigned to this item

  // UI state
  searchQuery: string;             // Search filter input
  mode: 'select' | 'create';       // Current mode (selection vs creation)

  // Async state
  loading: boolean;                // Initial data loading
  saving: boolean;                 // Label assignment in progress
  error: string | null;            // Error message to display

  // Computed (derived from allLabels + assignedLabelIds)
  filteredLabels: Label[];         // Labels matching search query (useMemo)
  recentLabels: Label[];           // Recently used labels (useMemo + localStorage)
}
```

**State Transitions**:
1. **Initial load**: `loading = true` → Fetch labels + item → `loading = false`
2. **Label toggle**: Optimistic update to `assignedLabelIds` → API call → Rollback on error
3. **Label creation**: `mode = 'create'` → Submit form → Add to `allLabels` → `mode = 'select'`
4. **Search**: Update `searchQuery` → Recompute `filteredLabels` (useMemo)

#### 2. RecentLabels Storage (localStorage)

```typescript
interface RecentLabelsStorage {
  labelIds: number[];              // Label IDs in order (most recent first)
  lastUsedAt: Record<number, string>;  // ISO timestamps for each label
}

// Example:
{
  labelIds: [42, 17, 99, 3, 8],
  lastUsedAt: {
    42: "2025-10-28T10:30:00.000Z",
    17: "2025-10-28T10:25:00.000Z",
    99: "2025-10-28T10:20:00.000Z",
    3: "2025-10-28T10:15:00.000Z",
    8: "2025-10-28T10:10:00.000Z"
  }
}
```

**Storage Key**: `mgtd:recentLabels`
**Max Size**: 5 labels (FIFO queue)
**Updates**: Immediate (synchronous) on label assignment

#### 3. LabelCreationForm State

```typescript
interface LabelCreationFormState {
  name: string;                    // Required label name
  description: string;             // Optional description

  // Validation
  nameError: string | null;        // "Name is required" or "Label already exists"
  descriptionError: string | null; // Character limit errors

  // Async
  submitting: boolean;             // Form submission in progress
  submitError: string | null;      // API error message
}
```

**Validation Rules**:
- **Name**: Required, max 100 characters, unique (validated on submit)
- **Description**: Optional, max 500 characters

---

## Data Flow Diagrams

### 1. Label Assignment Flow

```
User clicks checkbox in LabelManagementModal
    ↓
Optimistic Update: Toggle label in assignedLabelIds (Set)
    ↓
API Call: POST /api/issues/:issueId/labels (assign)
     or   DELETE /api/issues/:issueId/labels/:labelId (remove)
    ↓
Success:
  - Add label to recent labels (localStorage)
  - Notify parent component (onLabelsChanged callback)
  - Parent refreshes item data
    ↓
Error:
  - Rollback optimistic update
  - Display error message in modal
  - User can retry
```

**Optimistic Update Example**:
```typescript
// Before API call
assignedLabelIds: Set {1, 2, 3}

// User toggles label 4 (assign)
assignedLabelIds: Set {1, 2, 3, 4}  // Immediate UI update

// API call fails
assignedLabelIds: Set {1, 2, 3}     // Rollback
```

### 2. Label Creation Flow

```
User clicks "Create new label"
    ↓
mode: 'select' → 'create'
    ↓
User enters name and description
    ↓
User submits form
    ↓
Validation: Check name is non-empty
    ↓
API Call: POST /api/labels
    ↓
Success:
  - Add new label to allLabels array
  - mode: 'create' → 'select'
  - Optionally: Auto-assign new label to current item
    ↓
Error (409 duplicate):
  - Display error: "Label already exists"
  - User can modify name and retry
```

### 3. Recent Labels Flow

```
User assigns label to item
    ↓
addRecentLabel(labelId) called
    ↓
localStorage update:
  - Remove labelId from array if exists (deduplication)
  - Add labelId to front of array
  - Keep max 5 labels (FIFO)
  - Update timestamp
    ↓
Modal displays recent section at top
    ↓
User opens modal on next item
    ↓
getRecentLabels() called
    ↓
Recent labels displayed first (no search needed)
```

**Recent Labels Algorithm**:
```typescript
// Add to recent (FIFO with deduplication)
const filtered = prev.labelIds.filter(id => id !== newLabelId);
const newLabelIds = [newLabelId, ...filtered].slice(0, 5);

// Retrieve recent labels (filtered by existence)
const recentIds = storage.labelIds.filter(id =>
  allLabels.some(label => label.id === id)
);
const recentLabels = recentIds
  .map(id => allLabels.find(label => label.id === id))
  .filter(label => label !== undefined);
```

---

## Validation Rules

### Label Entity Validation

#### Label Name
- **Required**: Yes
- **Type**: String
- **Min length**: 1 character
- **Max length**: 100 characters (estimated, not in spec - should match DB schema)
- **Uniqueness**: Must be unique (enforced by database)
- **Case sensitivity**: Case-sensitive ("Bug" and "bug" are different labels per spec)
- **Special characters**: Allowed (no restrictions specified)
- **Whitespace**: Leading/trailing whitespace should be trimmed

#### Label Description
- **Required**: No
- **Type**: String | null
- **Max length**: 500 characters (estimated, not in spec)

### Label Assignment Validation

#### Idempotency
- Assigning a label that's already assigned: **No-op** (idempotent operation)
- Removing a label that's not assigned: **404 error** (or could be idempotent)

#### Constraints
- Cannot assign non-existent label: **404 error**
- Cannot assign label to non-existent item: **404 error**

---

## State Transitions

### LabelManagementModal Lifecycle

```
[CLOSED]
    │
    │ User clicks "Manage Labels"
    ↓
[LOADING]
    │ Fetch: GET /api/labels
    │ Fetch: GET /api/memos/:id or GET /api/tasks/:id
    ↓
[SELECT MODE]
    │
    ├─→ User clicks "Create new label"
    │   │
    │   ↓
    │   [CREATE MODE]
    │   │
    │   ├─→ User clicks "Cancel"
    │   │   ↓
    │   │   [SELECT MODE]
    │   │
    │   └─→ User submits form
    │       │ API: POST /api/labels
    │       ↓
    │       [SELECT MODE] (with new label in list)
    │
    ├─→ User toggles label checkbox
    │   │ API: POST or DELETE /api/issues/:id/labels/:labelId
    │   ↓
    │   [SELECT MODE] (optimistic update)
    │
    ├─→ User types in search box
    │   ↓
    │   [SELECT MODE] (filtered list)
    │
    └─→ User clicks "Done"
        ↓
        [CLOSED]
```

### Error States

```
[ANY STATE]
    │
    │ API call fails
    ↓
[ERROR STATE]
    │ Display error banner
    │ User can retry or dismiss
    ↓
[PREVIOUS STATE] (rollback if needed)
```

---

## API Integration Patterns

### Fetching Labels

```typescript
// GET /api/labels → Label[]
const allLabels = await LabelsService.listLabels();
// Returns: [{ id: 1, name: "bug", description: null, createdAt: "..." }, ...]
```

### Fetching Item with Labels

```typescript
// GET /api/memos/:id → Memo
const memo = await MemosService.getMemo(itemId);
// memo.labels = ["bug", "urgent", "feature"]  // Array of label NAMES

// Convert names to IDs for state
const assignedLabelIds = new Set(
  memo.labels
    .map(name => allLabels.find(l => l.name === name)?.id)
    .filter((id): id is number => id !== undefined)
);
```

**Important**: Labels on memos/tasks are returned as **names (strings)**, not IDs. The UI must map names → IDs for state management.

### Assigning Label

```typescript
// POST /api/issues/:issueId/labels
await LabelsService.assignLabelToIssue(String(itemId), { labelId });
// Returns: { success: boolean }
```

### Removing Label (NEW ENDPOINT)

```typescript
// DELETE /api/issues/:issueId/labels/:labelId
await LabelsService.removeLabelFromIssue(itemId, labelId);
// Returns: 204 No Content
```

**Note**: This endpoint does not exist yet and must be implemented in Phase 2.

### Creating Label

```typescript
// POST /api/labels
const newLabel = await LabelsService.createLabel({
  name: "documentation",
  description: "Related to docs"
});
// Returns: { id: 10, name: "documentation", description: "Related to docs", createdAt: "..." }
```

**Error Handling**:
- **409 Conflict**: Label name already exists
- **400 Bad Request**: Invalid input (empty name, etc.)

---

## Performance Considerations

### Data Fetching Strategy

**Parallel Requests**: Fetch labels and item simultaneously
```typescript
const [labels, item] = await Promise.all([
  LabelsService.listLabels(),
  itemType === 'memo' ? MemosService.getMemo(itemId) : TasksService.getTask(itemId)
]);
```

**Caching**: Consider caching labels list if modal is opened multiple times in a session
- **Option 1**: Cache in component state (parent component)
- **Option 2**: Use React Query or SWR (not currently in project)
- **Decision**: No caching for MVP (labels change infrequently, fetch is fast)

### Filtering Performance

**Client-Side Filtering**: Acceptable for <100 labels
- Time complexity: O(n) where n = number of labels
- Typical performance: <1ms for 100 labels
- useMemo prevents unnecessary recalculation

**Threshold for Server-Side Filtering**: >500 labels (not expected per spec)

### localStorage Performance

**Write frequency**: Only on label assignment (infrequent operation)
**Write size**: ~200 bytes (5 label IDs + timestamps)
**Read frequency**: Once per modal open
**Performance impact**: Negligible (<1ms)

---

## Consistency Guarantees

### Optimistic Updates with Rollback

**Guarantee**: UI always reflects either the last known server state OR an optimistic prediction of the next state.

**Implementation**:
1. **Before API call**: Update local state optimistically
2. **On success**: State already matches server (no-op)
3. **On failure**: Rollback to previous state
4. **On parent refresh**: Fetch fresh data from server (source of truth)

**Race Conditions**: Prevented by sequential operations
- User can toggle multiple labels, but each API call completes before the next
- Parent refresh happens after all pending operations complete

### Label Name vs ID Consistency

**Challenge**: API returns label names in memo/task responses, but UI works with label IDs.

**Solution**: Always maintain the full `allLabels` array in state for name↔ID mapping:
```typescript
// Name → ID
const labelId = allLabels.find(l => l.name === "bug")?.id;

// ID → Name
const labelName = allLabels.find(l => l.id === 42)?.name;
```

**Edge Case**: Label is renamed after modal opens
- **Impact**: Minimal (labels don't support rename in this feature)
- **Mitigation**: Parent refresh after modal closes fetches updated data

### Deleted Labels

**Challenge**: User has label in recent list, but label is deleted globally.

**Solution**: Filter non-existent labels when displaying recent list:
```typescript
const recentIds = storage.labelIds.filter(id =>
  allLabels.some(label => label.id === id)
);
```

---

## Data Model Summary

### Existing Backend (No Changes)
- ✅ Database schema: `labels` and `issue_labels` tables
- ✅ API entities: `Label` interface
- ✅ Label assignment: Many-to-many relationship
- ✅ Cascade deletion: Deleting label removes all assignments

### New Frontend Models
- ✨ `LabelManagementState`: Modal component state
- ✨ `RecentLabelsStorage`: localStorage schema
- ✨ `LabelCreationFormState`: Form component state

### New Backend Requirements
- ⚠️ **Missing endpoint**: DELETE /api/issues/:issueId/labels/:labelId
  - Required for removing single label without full replacement
  - See contracts/ directory for API specification

---

## Next Steps

1. ✅ Data model defined
2. ⏭️ Generate API contracts for new DELETE endpoint
3. ⏭️ Generate quickstart.md for developer onboarding
4. ⏭️ Update agent context with technology choices

---

**Document Version**: 1.0
**Date**: 2025-10-28
**Related Documents**:
- Feature spec: `spec.md`
- Implementation plan: `plan.md`
- Research findings: `research.md`
- API contracts: `contracts/` (to be generated)
