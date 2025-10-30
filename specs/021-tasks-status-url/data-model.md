# Data Model: Tasks Page URL State Synchronization

**Feature**: 021-tasks-status-url
**Date**: 2025-10-30
**Phase**: 1 - Design & Contracts

## Overview

This feature uses URL query parameters as the source of truth for filter state. No database schema changes are required since filters are purely client-side UI state.

## URL Parameter Schema

### Query Parameter: `status`

**Type**: String (enum)
**Required**: No
**Default**: `'all'` (when parameter is absent)
**Valid Values**: `'open'`, `'next'`, `'waiting'`, `'scheduled'`, `'done'`, `'canceled'`
**Invalid Value Behavior**: Fallback to `'all'`

**Examples**:
- `/tasks/` → status = 'all'
- `/tasks/?status=open` → status = 'open'
- `/tasks/?status=invalid` → status = 'all' (graceful fallback)

**Validation Rule**:
```typescript
const VALID_STATUSES = ['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'] as const;
type StatusFilter = typeof VALID_STATUSES[number] | 'all';

function validateStatus(value: string | null): StatusFilter {
  if (!value) return 'all';
  return VALID_STATUSES.includes(value as any) ? value as StatusFilter : 'all';
}
```

**State Transition**:
- User clicks filter → `setSearchParams` with new status
- Browser loads URL → parse `status` param → apply filter
- User selects "All" → delete `status` param (clean URL)

---

### Query Parameter: `bookmarked`

**Type**: String (boolean representation)
**Required**: No
**Default**: `false` (when parameter is absent)
**Valid Values**: `'true'` (enabled), absent (disabled)
**Invalid Value Behavior**: Any value other than `'true'` treated as `false`

**Examples**:
- `/tasks/` → bookmarked = false
- `/tasks/?bookmarked=true` → bookmarked = true
- `/tasks/?bookmarked=false` → bookmarked = false (parameter should be deleted instead)
- `/tasks/?bookmarked=yes` → bookmarked = false (invalid value)

**Validation Rule**:
```typescript
function validateBookmarked(value: string | null): boolean {
  return value === 'true';
}
```

**State Transition**:
- User enables bookmark filter → `setSearchParams` with `bookmarked=true`
- User disables bookmark filter → delete `bookmarked` param
- Browser loads URL → parse `bookmarked` param → apply filter

---

## Combined Parameter Handling

**Multiple Filters**:
```
/tasks/?status=open&bookmarked=true
```
- Both filters applied simultaneously
- Order of parameters does not matter
- Each filter is independent (can be changed separately)

**Parameter Preservation**:
- When updating `status`, preserve `bookmarked` state
- When updating `bookmarked`, preserve `status` state
- Implementation uses `new URLSearchParams(searchParams)` to clone existing params before modification

**Empty State**:
```
/tasks/
```
- No query parameters → default state (all tasks, not bookmarked)
- Represents the canonical "All" view

---

## Client-Side State Shape

### Current Implementation (packages/web/src/pages/TasksList.tsx:36-37)
```typescript
const [statusFilter, setStatusFilter] = useState<string>('all');
const [bookmarkFilter, setBookmarkFilter] = useState(false);
```

### Proposed Implementation
```typescript
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();
const statusFilter = validateStatus(searchParams.get('status'));
const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));
```

**Key Differences**:
- No local `useState` needed for filter values
- URL becomes single source of truth
- `searchParams` automatically updates when URL changes (back/forward buttons)

---

## Entity Relationships

### URL State → UI Components

```
URLSearchParams
    ↓
statusFilter (derived) ──→ FilterBar component (props.statusFilter)
    ↓
bookmarkFilter (derived) ──→ FilterBar component (props.bookmarkFilter)
    ↓
filteredTasks (computed) ──→ ItemList component (props.items)
```

**Data Flow**:
1. URL query params (source of truth)
2. Derived filter values (validated from URL)
3. UI components render based on filter values
4. User interaction → update URL params → cycle repeats

### Filter State → API Calls

```
statusFilter ──→ TasksService.listTasks(status?)
                      ↓
                 Backend API call
                      ↓
                 tasks[] (unfiltered by bookmark)
                      ↓
bookmarkFilter ──→ Client-side filtering (useMemo)
                      ↓
                 filteredTasks[]
```

**Important**: Bookmark filtering is client-side only (no URL changes trigger new API calls for bookmark filter).

---

## Validation Rules Summary

| Parameter  | Type    | Required | Default | Valid Values                          | Invalid Behavior        |
|------------|---------|----------|---------|---------------------------------------|------------------------|
| status     | string  | No       | 'all'   | open, next, waiting, scheduled, done, canceled | Fallback to 'all'     |
| bookmarked | boolean | No       | false   | 'true' (enabled), absent (disabled)   | Treated as false       |

---

## Migration Notes

**Backward Compatibility**:
- Existing `/tasks/` routes continue to work (default state)
- No breaking changes to routing configuration
- Old behavior (local state) fully replaced by new behavior (URL state)

**User Impact**:
- Existing users will see no difference on first load
- New capability (bookmarking, sharing) immediately available
- No data migration required (no persistent state)

---

## Testing Data Model

### Test Cases for URL Parameter Parsing

| Input URL                           | Expected statusFilter | Expected bookmarkFilter | Notes                        |
|-------------------------------------|----------------------|-------------------------|------------------------------|
| `/tasks/`                           | 'all'                | false                   | Default state                |
| `/tasks/?status=open`               | 'open'               | false                   | Status filter only           |
| `/tasks/?bookmarked=true`           | 'all'                | true                    | Bookmark filter only         |
| `/tasks/?status=done&bookmarked=true` | 'done'             | true                    | Both filters                 |
| `/tasks/?status=invalid`            | 'all'                | false                   | Invalid status → fallback    |
| `/tasks/?bookmarked=yes`            | 'all'                | false                   | Invalid boolean → false      |
| `/tasks/?status=open&status=done`   | 'open'               | false                   | Duplicate param (first wins) |

### Test Cases for URL Generation

| User Action                  | Input State                     | Expected URL                           |
|------------------------------|---------------------------------|----------------------------------------|
| Select "Open" filter         | /tasks/                         | /tasks/?status=open                    |
| Select "All" filter          | /tasks/?status=done             | /tasks/                                |
| Enable bookmark filter       | /tasks/?status=open             | /tasks/?status=open&bookmarked=true    |
| Disable bookmark filter      | /tasks/?status=open&bookmarked=true | /tasks/?status=open               |
| Change status while bookmarked | /tasks/?status=open&bookmarked=true | /tasks/?status=done&bookmarked=true |
