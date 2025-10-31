# Data Model: Item Detail Back Navigation with Filter Preservation

**Feature**: 022-github
**Date**: 2025-10-31
**Status**: Complete

## Overview

This document defines the data structures and state management for preserving filter context when navigating between item list pages (tasks, memos, projects) and their detail pages.

## Core Entities

### 1. ReturnFilterContext

**Purpose**: Represents the filter state from a list page that should be restored when navigating back from a detail page.

**Structure**:
```typescript
interface ReturnFilterContext {
  itemType: ItemType;
  filters: FilterMap;
}

type ItemType = 'task' | 'memo' | 'project';
type FilterMap = Record<string, string>;
```

**Example**:
```typescript
// Task list with status filter
{
  itemType: 'task',
  filters: { status: 'open', bookmarked: 'true' }
}

// Memo list with bookmark filter only
{
  itemType: 'memo',
  filters: { bookmarked: 'true' }
}

// Project list (unfiltered)
{
  itemType: 'project',
  filters: {}
}
```

**Encoding**: URL-encoded query string format
- Example: `status=open&bookmarked=true` → `status%3Dopen%26bookmarked%3Dtrue`

**Validation Rules**:
- **Parameter name whitelist**: Only `status` and `bookmarked` allowed
- **Status values**: Must be in `VALID_STATUSES` array (open, next, waiting, scheduled, done, canceled)
- **Bookmarked values**: Only string `'true'` (presence) or omitted (absence)
- **Item-type-specific**: Tasks support both filters; memos/projects support bookmarked only

### 2. ItemListRoute

**Purpose**: Represents a list page with optional filter query parameters.

**Structure**:
```typescript
interface ItemListRoute {
  basePath: '/tasks/' | '/memos/' | '/projects/';
  filters: FilterMap;
}
```

**URL Examples**:
```
/tasks/?status=open                  # Task list filtered by status
/tasks/?status=open&bookmarked=true  # Task list with multiple filters
/memos/?bookmarked=true              # Memo list filtered by bookmark
/projects/                           # Project list (no filters)
```

**State Management**:
- Managed by React Router DOM's `useSearchParams` hook (existing from PR #65)
- Filter changes trigger URL updates
- URL updates trigger component re-renders

### 3. ItemDetailRoute

**Purpose**: Represents a detail page with optional return filter context.

**Structure**:
```typescript
interface ItemDetailRoute {
  basePath: '/tasks/:id' | '/memos/:id' | '/projects/:id';
  id: number;
  returnFilters?: string; // URL-encoded query string
}
```

**URL Examples**:
```
/tasks/123?returnFilters=status%3Dopen%26bookmarked%3Dtrue
/memos/456?returnFilters=bookmarked%3Dtrue
/projects/789  # No returnFilters (direct access)
```

**State Extraction**:
```typescript
const [searchParams] = useSearchParams();
const returnFiltersEncoded = searchParams.get('returnFilters');
const returnFilters = returnFiltersEncoded
  ? decodeReturnFilters(returnFiltersEncoded)
  : null;
```

## State Transitions

### Transition 1: List → Detail (Encoding)

**Trigger**: User clicks on an item in a filtered list

**Process**:
1. List component reads current filter state from `useSearchParams`
2. Encodes filters using `searchParams.toString()`
3. Appends `returnFilters` parameter to detail page URL
4. Navigates to detail page with encoded filters

**Code Example**:
```typescript
// In TasksList.tsx
const [searchParams] = useSearchParams();
const currentFilters = searchParams.toString(); // e.g., "status=open&bookmarked=true"

<Link to={`/tasks/${task.id}?returnFilters=${encodeURIComponent(currentFilters)}`}>
  {task.title}
</Link>
```

### Transition 2: Detail → List (Decoding)

**Trigger**: User clicks "Back to [items]" button on detail page

**Process**:
1. Detail component extracts `returnFilters` from URL
2. Decodes and validates filter parameters
3. Constructs list URL with restored filters
4. Navigates to list page

**Code Example**:
```typescript
// In TaskDetail.tsx
const [searchParams] = useSearchParams();
const returnFiltersEncoded = searchParams.get('returnFilters');

const backUrl = returnFiltersEncoded
  ? `/tasks/?${returnFiltersEncoded}` // Decode handled by browser
  : '/tasks/'; // Default for direct access

<Link to={backUrl}>← Back to tasks</Link>
```

### Transition 3: Direct Detail Access (Fallback)

**Trigger**: User directly accesses detail URL without `returnFilters`

**Process**:
1. Component detects missing `returnFilters` parameter
2. Back button uses default list URL (no filters)
3. No errors thrown (graceful degradation)

**Code Example**:
```typescript
// In ItemDetail.tsx
const backUrl = returnFilters
  ? `${basePath}?${returnFilters}`
  : basePath; // e.g., "/tasks/"
```

## Filter Type Definitions

### Task Filters

**Supported Parameters**:
- `status`: Enum of valid task statuses
- `bookmarked`: Boolean (string 'true' or omitted)

**Valid Status Values**:
```typescript
const VALID_STATUSES = [
  'open',
  'next',
  'waiting',
  'scheduled',
  'done',
  'canceled',
] as const;
```

**Examples**:
```
?status=open
?status=next&bookmarked=true
?bookmarked=true
```

### Memo Filters

**Supported Parameters**:
- `bookmarked`: Boolean (string 'true' or omitted)

**Examples**:
```
?bookmarked=true
(no filters = show all)
```

### Project Filters

**Supported Parameters**:
- `bookmarked`: Boolean (string 'true' or omitted)

**Examples**:
```
?bookmarked=true
(no filters = show all)
```

## Validation Rules

### Parameter Name Validation

**Whitelist**:
- `status` (tasks only)
- `bookmarked` (all item types)

**Rejection Logic**:
```typescript
function validateParameterNames(filters: FilterMap, itemType: ItemType): FilterMap {
  const allowedParams = itemType === 'task'
    ? ['status', 'bookmarked']
    : ['bookmarked'];

  return Object.entries(filters)
    .filter(([key]) => allowedParams.includes(key))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
}
```

### Parameter Value Validation

**Status Values** (tasks only):
```typescript
function validateStatus(value: string): string | null {
  return VALID_STATUSES.includes(value as any) ? value : null;
}
```

**Bookmarked Values** (all item types):
```typescript
function validateBookmarked(value: string): boolean {
  return value === 'true';
}
```

### Error Handling

**Invalid Parameter Detection**:
- Log error with parameter details (per FR-009)
- Silently remove invalid parameters
- Continue with valid parameters only
- If all parameters invalid, return empty filters (fallback to default list)

**Example**:
```typescript
// Input: ?status=invalid&bookmarked=true
// Valid: { bookmarked: 'true' }
// Invalid: status=invalid (logged, removed)
// Result: /tasks/?bookmarked=true
```

## URL Length Constraints

**Browser Limits**:
- Maximum URL length: ~2000 characters (IE/Edge limit)
- Typical filter combinations: <100 characters
- Safety margin: 500 character constraint (SC-004)

**Example Lengths**:
```
?status=open                         # 13 chars
?status=open&bookmarked=true         # 29 chars
?returnFilters=status%3Dopen%26...   # ~45 chars (encoded)
Full URL: /tasks/123?returnFilters=...  # ~65 chars total
```

**Overflow Handling**: No special handling needed (typical use cases well under limit)

## Performance Characteristics

**Operations per Navigation**:
1. Encoding: `searchParams.toString()` - <0.1ms
2. Decoding: `new URLSearchParams(encoded)` - <0.1ms
3. Validation: Parameter whitelist check - <0.5ms
4. Total overhead: <1ms (0.2% of 500ms budget)

**Memory Impact**: Negligible (small string operations)

**Scalability**: Linear with filter count (max 2 filters per type)

## Edge Cases

### Case 1: Invalid returnFilters Parameter

**Scenario**: Malformed or corrupted URL parameter

**Handling**:
```typescript
try {
  const decoded = new URLSearchParams(returnFiltersEncoded);
  return validateFilters(decoded, itemType);
} catch (error) {
  console.error('Invalid returnFilters parameter:', error);
  return {}; // Fallback to default list
}
```

### Case 2: Item-Type-Specific Filter on Wrong Type

**Scenario**: Task status filter in memo detail URL

**Handling**:
```typescript
// Memo detail receives ?returnFilters=status%3Dopen
// Validation removes 'status' (not in memo whitelist)
// Result: Empty filters → /memos/ (default)
```

### Case 3: Browser Back Button with Stale Filters

**Scenario**: User modifies filters, then uses browser back to old detail page

**Handling**:
- Detail page uses stored `returnFilters` from URL (unchanged)
- Consistent with GitHub behavior (back link doesn't auto-update)
- User sees original filtered view they came from

### Case 4: Shared Link with Return Filters

**Scenario**: User shares detail URL containing `returnFilters`

**Handling**:
- Recipient sees same filtered list when clicking back
- Enables collaborative workflows with preserved context
- No security issue (filters are read-only view parameters)

## Integration with Existing Code

### PR #65 Compatibility

**Existing Components**:
- `TasksList.tsx`: Already uses `useSearchParams` for filter state
- `urlFilterHelpers.ts`: Provides `validateStatus`, `validateBookmarked`
- `FilterBar.tsx`: Handles filter UI updates

**New Integration Points**:
- List components: Add `returnFilters` to item links
- Detail components: Extract and use `returnFilters` for back links
- New helper file: `navigationHelpers.ts` for shared logic

**No Breaking Changes**: Existing filter functionality unchanged (PR #65 tests pass)

## Summary

The data model uses standard web technologies (URLSearchParams, React Router) to encode and decode filter state in URLs. Key design principles:

1. **URL-based state**: No session storage or cookies needed
2. **Type-safe validation**: Whitelist approach prevents XSS
3. **Graceful degradation**: Invalid parameters silently removed, no errors
4. **Performance-conscious**: <1ms overhead per navigation
5. **PR #65 compatible**: Extends existing patterns without breaking changes

All entities and state transitions documented support the 9 functional requirements (FR-001 to FR-009) and 6 success criteria (SC-001 to SC-006) defined in the feature specification.
