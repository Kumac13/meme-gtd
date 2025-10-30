# Research: Tasks Page URL State Synchronization

**Feature**: 021-tasks-status-url
**Date**: 2025-10-30
**Phase**: 0 - Outline & Research

## Research Goals

1. Determine best practices for React Router v7 `useSearchParams` usage
2. Identify URL parameter validation patterns for filter values
3. Research browser history management for filter state transitions
4. Evaluate testing strategies for URL-based state

## Findings

### 1. React Router v7 useSearchParams Pattern

**Decision**: Use `useSearchParams` hook with `setSearchParams` for all filter state updates

**Rationale**:
- React Router v7.9.4 is already a project dependency
- `useSearchParams` provides bidirectional URL sync (read on mount, write on change)
- Built-in browser history integration (supports back/forward navigation)
- Type-safe when combined with TypeScript parameter validation

**Implementation Pattern**:
```typescript
import { useSearchParams } from 'react-router-dom';

const [searchParams, setSearchParams] = useSearchParams();

// Read from URL on mount
const statusFilter = searchParams.get('status') || 'all';
const bookmarkFilter = searchParams.get('bookmarked') === 'true';

// Write to URL on filter change
const handleStatusChange = (newStatus: string) => {
  const params = new URLSearchParams(searchParams);
  if (newStatus === 'all') {
    params.delete('status'); // Clean URL for default state
  } else {
    params.set('status', newStatus);
  }
  setSearchParams(params);
};
```

**Alternatives Considered**:
- Manual `window.location.search` manipulation: Rejected due to no React integration, manual history management required
- Custom hook wrapping `useLocation` + `useNavigate`: Rejected as unnecessary abstraction, `useSearchParams` handles this
- Path-based routing (`/tasks/open`): Rejected to avoid route configuration changes, query params more flexible

### 2. URL Parameter Validation

**Decision**: Validate filter values against allowed enums, fallback to defaults for invalid values

**Rationale**:
- Prevents UI errors from manually edited URLs
- Graceful degradation improves user experience
- Satisfies FR-008 (handle invalid parameters gracefully)

**Validation Strategy**:
```typescript
const VALID_STATUSES = ['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'] as const;
type StatusFilter = typeof VALID_STATUSES[number] | 'all';

function getValidatedStatus(param: string | null): StatusFilter {
  if (!param) return 'all';
  return VALID_STATUSES.includes(param as any) ? param as StatusFilter : 'all';
}

const statusFilter = getValidatedStatus(searchParams.get('status'));
```

**Alternatives Considered**:
- No validation: Rejected due to potential runtime errors in UI components
- Strict validation with error messages: Rejected as overly complex for user-facing feature, silent fallback is friendlier
- Server-side validation: Not applicable (filters are client-side only)

### 3. Browser History Management

**Decision**: Use default `setSearchParams` behavior (creates new history entry per filter change)

**Rationale**:
- Satisfies FR-007 (maintain browser history entries)
- Each filter change is a distinct user action worth preserving in history
- Enables browser back/forward to navigate between filter states
- No performance concerns (URL updates are lightweight)

**History Behavior**:
- Each `setSearchParams` call → `history.pushState` (new entry)
- Browser back button → navigates to previous filter state
- Browser forward button → navigates to next filter state
- Page refresh → reads current URL params, preserves filter state

**Alternatives Considered**:
- `replace: true` option (replaces history instead of pushing): Rejected as it violates FR-007, users expect back button to work
- Debounced history updates: Rejected as unnecessary complexity, filter changes are discrete user actions
- Custom history stack: Rejected as React Router already provides this

### 4. Testing Strategy

**Decision**: Multi-layer testing approach (unit + E2E)

**Unit Tests** (Vitest + React Testing Library):
- URL parameter parsing (valid/invalid values)
- Filter state synchronization (URL → UI state)
- URL updates on filter change (UI action → URL)
- Default state handling (no params = 'all')
- Multiple parameter handling (`?status=open&bookmarked=true`)

**E2E Tests** (Playwright):
- Filter persistence across page refresh
- Browser back/forward button navigation
- Bookmark URL restoration
- Shared URL behavior (direct navigation to filtered view)

**Rationale**:
- Unit tests validate component logic in isolation
- E2E tests verify browser integration (history, bookmarks, URL sharing)
- Both required to satisfy all success criteria (SC-001 to SC-005)

**Alternatives Considered**:
- E2E only: Rejected as too slow for comprehensive coverage
- Unit only: Rejected as cannot verify browser history integration
- Integration tests: Rejected as Vitest + Playwright combination covers all scenarios

## Technical Unknowns Resolved

All NEEDS CLARIFICATION items from Technical Context have been resolved:
- ✅ URL state management: React Router v7 `useSearchParams`
- ✅ Parameter validation: Enum-based validation with default fallback
- ✅ History management: Default `setSearchParams` pushState behavior
- ✅ Testing approach: Vitest (unit) + Playwright (E2E)

## Dependencies & Constraints

**No new dependencies required**:
- React Router DOM 7.9.4 (already installed)
- Vitest 1.6.0 (already installed)
- Playwright 1.56.1 (already installed)

**Browser Compatibility**:
- `URLSearchParams` API: Supported in all modern browsers (Chrome 49+, Firefox 44+, Safari 10.1+, Edge 17+)
- React Router v7: Requires modern browser with ES6 support (matches existing app requirements)

**Performance Considerations**:
- URL updates are synchronous and lightweight (<1ms)
- No API calls triggered by filter changes (filtering already client-side)
- Easily meets SC-005 requirement (<100ms URL update)

## Next Steps

Proceed to Phase 1: Design & Contracts
- Create data-model.md (filter state shape)
- Generate contracts/ (URL parameter schemas)
- Create quickstart.md (developer guide)
