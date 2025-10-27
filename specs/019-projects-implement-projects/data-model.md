# Data Model: Project Detail Views

**Feature**: 019-projects-implement-projects
**Created**: 2025-10-27

## Overview

This document defines the data structures and relationships for the Project Detail Page feature. All entities and types are already implemented in the backend (Feature #19) - this feature focuses on frontend consumption and visualization.

## Core Entities

### Project

Container for related tasks and memos with configurable view settings.

**Fields**:
- `id`: number (unique identifier)
- `name`: string (project title)
- `description`: string | null (optional project description)
- `viewMeta`: ViewMeta (view configuration)
- `createdAt`: string (ISO 8601 timestamp)

**Source**: `/packages/shared/src/types/project.ts`

**Relationships**:
- Has many `ProjectItem` (through project_items table)
- Each ProjectItem references an Issue (task or memo)

**Validation Rules**:
- `name`: Required, 1-255 characters, must be unique
- `description`: Optional, any length
- `viewMeta`: Must contain valid ViewMeta structure

### ViewMeta

Configuration for how project items are displayed.

**Fields**:
- `viewType`: 'board' | 'table' (display mode)
- `columns`: string[] | undefined (board columns, only present if viewType='board')

**Usage**:
- `viewType='board'` → Show Kanban board with columns
- `viewType='table'` → Show list/table view
- `columns` defines column names in Kanban view (e.g., ["Open", "In Progress", "Done"])

**Example**:
```json
{
  "viewType": "board",
  "columns": ["Open", "Next", "Waiting", "Done"]
}
```

### ProjectItem

Association between a Project and an Issue (task/memo).

**Fields**:
- `id`: number (unique identifier)
- `projectId`: number (foreign key to projects table)
- `issueId`: number (foreign key to issues table)
- `position`: number (fractional positioning for ordering, e.g., 1.0, 1.5, 2.0)
- `viewMeta`: { column?: string } | null (item-specific view metadata)
- `createdAt`: string (ISO 8601 timestamp)
- `updatedAt`: string (ISO 8601 timestamp)

**Source**: `/packages/shared/src/types/project.ts`

**Relationships**:
- Belongs to one `Project`
- References one `Issue` (task or memo)

**Validation Rules**:
- `projectId`: Must exist in projects table
- `issueId`: Must exist in issues table
- `position`: Any number (fractional for flexible ordering)
- `viewMeta.column`: Must match one of project.viewMeta.columns (if present)

**Position Logic**:
- Items within same column ordered by position (ascending)
- Fractional positions allow insertion without reordering all items
- Example: Insert between 1.0 and 2.0 → use 1.5

### ProjectItemWithIssue

Extended ProjectItem that includes issue information for display.

**Fields**:
- All fields from `ProjectItem`
- `issue`: IssueInfo (embedded issue details)

**IssueInfo Structure**:
- `id`: number
- `type`: 'task' | 'memo'
- `title`: string (task title or memo preview)

**Source**: `/packages/shared/src/types/project.ts`

**Usage**:
- Returned by `GET /api/projects/:id`
- Used for rendering cards in Kanban view
- Used for rendering rows in List view

**Example**:
```json
{
  "id": 1,
  "projectId": 5,
  "issueId": 33,
  "position": 1.0,
  "viewMeta": { "column": "Open" },
  "createdAt": "2025-10-27T10:00:00Z",
  "updatedAt": "2025-10-27T10:00:00Z",
  "issue": {
    "id": 33,
    "type": "task",
    "title": "Implement user authentication"
  }
}
```

### ProjectDetail

Complete project data including all associated items.

**Fields**:
- All fields from `Project`
- `items`: ProjectItemWithIssue[] (array of items with issue info)

**Source**: `/packages/shared/src/types/project.ts`

**Usage**:
- Returned by `GET /api/projects/:id`
- Single API call provides all data needed for both views

**Example**:
```json
{
  "id": 5,
  "name": "Q1 2025 Goals",
  "description": "High priority items for Q1",
  "viewMeta": {
    "viewType": "board",
    "columns": ["Open", "In Progress", "Done"]
  },
  "createdAt": "2025-01-01T00:00:00Z",
  "items": [
    {
      "id": 1,
      "projectId": 5,
      "issueId": 33,
      "position": 1.0,
      "viewMeta": { "column": "Open" },
      "createdAt": "2025-01-02T00:00:00Z",
      "updatedAt": "2025-01-02T00:00:00Z",
      "issue": {
        "id": 33,
        "type": "task",
        "title": "Implement authentication"
      }
    }
  ]
}
```

## State Transitions

### Item Movement (Drag-and-Drop)

**Trigger**: User drags card from one column to another

**State Flow**:
1. **Initial State**: Item in column A with `viewMeta.column = "A"`, `position = 1.0`
2. **User Action**: Drag to column B, drop between items at positions 2.0 and 3.0
3. **Optimistic Update**: Immediately update UI to show item in column B at position 2.5
4. **API Call**: `PATCH /api/projects/:id/items/:issueId` with body `{ column: "B", position: 2.5 }`
5. **Success**: Keep optimistic update (no change needed)
6. **Failure**: Revert item to original column A, position 1.0, show error message

**Validation Rules**:
- Target column must exist in project.viewMeta.columns
- New position must be a valid number
- Item must exist in project

### View Switching

**Trigger**: User clicks view tab (Kanban ↔ List)

**State Flow**:
1. **Initial State**: URL = `/projects/:id/kanban`, viewing Kanban board
2. **User Action**: Click "List" tab
3. **URL Update**: Navigate to `/projects/:id/list`
4. **Component Re-render**: React Router mounts ListView component
5. **Data Reuse**: No API call needed (data already loaded in parent)

**No Validation Needed**: View is client-side only

### Column Assignment

**Initial Assignment** (when adding item to project):
- If project.viewMeta.viewType === 'board':
  - User selects column during add operation
  - Or defaults to first column in project.viewMeta.columns
- If project.viewMeta.viewType === 'table':
  - No column assignment (viewMeta.column remains null)

**Modification** (drag-and-drop):
- Only allowed if project.viewMeta.viewType === 'board'
- Target column must be in project.viewMeta.columns

## Data Flow

### Page Load

```
User navigates to /projects/5/kanban
  ↓
ProjectDetail component mounts
  ↓
useEffect: fetch project data
  ↓
API: GET /api/projects/5
  ↓
Response: ProjectDetail with items
  ↓
State: setProject(response)
  ↓
Render: KanbanBoard with project.items
  ↓
Group items by viewMeta.column
  ↓
Render: KanbanColumn for each column
  ↓
Render: KanbanCard for each item in column
```

### Drag-and-Drop

```
User drags card from "Open" to "Done"
  ↓
onDragEnd handler receives { active, over }
  ↓
Calculate: new column, new position
  ↓
Optimistic update: move item in local state
  ↓
UI re-renders with item in new position
  ↓
API: PATCH /api/projects/5/items/33
     Body: { column: "Done", position: 2.5 }
  ↓
Success: Do nothing (already updated)
  ↓
Failure: Revert local state, show error
```

### View Switch

```
User clicks "List" tab
  ↓
React Router: navigate('/projects/5/list')
  ↓
URL changes to /projects/5/list
  ↓
ProjectDetail re-renders with different view param
  ↓
Conditional render: ListView instead of KanbanBoard
  ↓
ListView receives same project.items
  ↓
Renders items in table/list format
```

## Frontend State Management

### Component State

**ProjectDetail.tsx** (parent component):
- `project`: ProjectDetail | null
- `loading`: boolean
- `error`: string | null

**KanbanBoard.tsx** (Kanban view):
- `activeId`: string | null (currently dragging item)
- `overId`: string | null (current drop target)
- `itemsByColumn`: Record<string, ProjectItemWithIssue[]> (grouped items)

**ListView.tsx** (List view):
- `sortBy`: string (sort field)
- `filterBy`: string (filter criteria)

### No Global State

This feature does not use global state management (Redux, Zustand, etc.). All state is component-local or derived from URL parameters.

## Derived Data

### Items Grouped by Column

**Input**: `project.items: ProjectItemWithIssue[]`

**Output**: `Record<string, ProjectItemWithIssue[]>`

**Logic**:
```typescript
const itemsByColumn = useMemo(() => {
  const columns = project.viewMeta.columns || [];
  const grouped = columns.reduce((acc, column) => {
    acc[column] = project.items
      .filter(item => item.viewMeta?.column === column)
      .sort((a, b) => a.position - b.position);
    return acc;
  }, {} as Record<string, ProjectItemWithIssue[]>);

  // Add unassigned items to "Unassigned" column
  const unassigned = project.items.filter(
    item => !item.viewMeta?.column || !columns.includes(item.viewMeta.column)
  );
  if (unassigned.length > 0) {
    grouped['Unassigned'] = unassigned;
  }

  return grouped;
}, [project.items, project.viewMeta.columns]);
```

### Item Count per Column

**Input**: `itemsByColumn: Record<string, ProjectItemWithIssue[]>`

**Output**: `Record<string, number>`

**Logic**:
```typescript
const counts = Object.entries(itemsByColumn).reduce((acc, [column, items]) => {
  acc[column] = items.length;
  return acc;
}, {} as Record<string, number>);
```

## Edge Cases

### Empty Project
- **Scenario**: Project has no items
- **Handling**: Show EmptyState component with message "No items in project"

### Unassigned Items
- **Scenario**: Item has no viewMeta.column or column doesn't exist in project columns
- **Handling**: Place in "Unassigned" column (virtual column, always rendered last)

### Invalid Column Reference
- **Scenario**: Item.viewMeta.column references column not in project.viewMeta.columns
- **Handling**: Treat as unassigned, place in "Unassigned" column

### Concurrent Updates
- **Scenario**: Two users drag same item simultaneously
- **Handling**: Last write wins (backend), frontend refetches on error

### Large Item Count
- **Scenario**: Project has >100 items
- **Handling**: Performance consideration (see research.md), may need virtual scrolling

## Backend Contract

All backend APIs are already implemented. This section documents the contract for reference.

### GET /api/projects/:id

**Response**: ProjectDetail

**Status Codes**:
- 200: Success
- 404: Project not found
- 500: Server error

### PATCH /api/projects/:id/items/:issueId

**Request Body**:
```json
{
  "column": "Done",
  "position": 2.5
}
```

**Response**: ProjectItem

**Status Codes**:
- 200: Success
- 400: Invalid request (e.g., column doesn't exist)
- 404: Project or item not found
- 500: Server error

## Type Definitions Reference

All types are defined in `/packages/shared/src/types/project.ts` and exported from `/packages/shared/src/index.ts`.

Frontend imports:
```typescript
import type { Project, ProjectItem, ProjectItemWithIssue, ProjectDetail, ViewMeta } from 'meme-gtd-shared';
```

**Note**: Frontend `/packages/web/src/types/project.ts` needs to be updated to re-export shared types (see research.md).
