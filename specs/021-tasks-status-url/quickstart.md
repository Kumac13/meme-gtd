# Quickstart Guide: Tasks Page URL State Synchronization

**Feature**: 021-tasks-status-url
**Audience**: Developers implementing this feature
**Estimated Time**: 2-3 hours

## Overview

This feature synchronizes task list filter state (status and bookmark filters) with URL query parameters, enabling bookmarking, sharing, and browser navigation support.

**What Changes**:
- Replace `useState` with `useSearchParams` in `TasksList.tsx`
- Add URL parameter validation functions
- Write unit and E2E tests

**What Doesn't Change**:
- Backend API (no changes)
- Database schema (no changes)
- FilterBar component (props stay the same)
- UI appearance (only behavior changes)

## Prerequisites

- Node.js 22+ installed
- pnpm 9.0.0 installed
- Familiarity with React Router v7
- Basic understanding of URLSearchParams API

## Step-by-Step Implementation

### 1. Set Up Development Environment

```bash
# Clone and checkout feature branch
git checkout 021-tasks-status-url

# Install dependencies (if needed)
pnpm install

# Start test API server (port 3001, test DB)
pnpm server:dev

# In another terminal, start web dev server
pnpm dev:web
```

**Verify setup**:
- Navigate to http://localhost:3001/tasks/
- Verify tasks are loading
- Verify status filter UI is working (even without URL sync yet)

---

### 2. Create Type Definitions and Helper Functions

**File**: `packages/web/src/utils/urlFilterHelpers.ts` (NEW)

Copy the implementation from `contracts/url-params.types.ts` to this file. This provides:
- `VALID_STATUSES` constant
- `StatusFilter` and `BookmarkFilter` types
- `validateStatus()` and `validateBookmarked()` functions
- `updateStatusParam()` and `updateBookmarkedParam()` helpers

**Why separate file?**
- Keeps validation logic reusable and testable
- Follows existing project structure (utils/ directory)
- Easier to unit test in isolation

---

### 3. Modify TasksList.tsx

**File**: `packages/web/src/pages/TasksList.tsx`

**Before (L36-37)**:
```typescript
const [statusFilter, setStatusFilter] = useState<string>('all');
const [bookmarkFilter, setBookmarkFilter] = useState(false);
```

**After**:
```typescript
import { useSearchParams } from 'react-router-dom';
import { validateStatus, validateBookmarked, updateStatusParam, updateBookmarkedParam } from '../utils/urlFilterHelpers';

// Inside component:
const [searchParams, setSearchParams] = useSearchParams();
const statusFilter = validateStatus(searchParams.get('status'));
const bookmarkFilter = validateBookmarked(searchParams.get('bookmarked'));

// Update handler functions (L94-95 area)
const handleStatusFilterChange = (newStatus: string) => {
  const params = updateStatusParam(searchParams, newStatus as StatusFilter);
  setSearchParams(params);
};

const handleBookmarkFilterChange = (newBookmarked: boolean) => {
  const params = updateBookmarkedParam(searchParams, newBookmarked);
  setSearchParams(params);
};
```

**Key Changes**:
1. Import `useSearchParams` from react-router-dom
2. Import helper functions from utils
3. Replace `useState` with URL parameter parsing
4. Update handlers to modify URL params instead of local state

**No changes needed to**:
- `useEffect` (L39-57) - still triggers on statusFilter change
- `filteredTasks` useMemo (L59-64) - still uses bookmarkFilter
- FilterBar props (L90-96) - still receives same values

---

### 4. Write Unit Tests

**File**: `packages/web/tests/unit/urlFilterHelpers.test.ts` (NEW)

Test coverage:
- `validateStatus()` with valid, invalid, and null inputs
- `validateBookmarked()` with 'true', 'false', and null inputs
- `updateStatusParam()` for all transitions (all→open, open→done, done→all)
- `updateBookmarkedParam()` for enable/disable transitions
- Parameter preservation (updating status doesn't remove bookmarked)

**Example test**:
```typescript
import { describe, it, expect } from 'vitest';
import { validateStatus, updateStatusParam } from '../../src/utils/urlFilterHelpers';

describe('validateStatus', () => {
  it('returns "all" for null input', () => {
    expect(validateStatus(null)).toBe('all');
  });

  it('returns valid status unchanged', () => {
    expect(validateStatus('open')).toBe('open');
    expect(validateStatus('done')).toBe('done');
  });

  it('returns "all" for invalid status', () => {
    expect(validateStatus('invalid')).toBe('all');
  });
});

describe('updateStatusParam', () => {
  it('removes status param when set to "all"', () => {
    const params = new URLSearchParams('status=open');
    const updated = updateStatusParam(params, 'all');
    expect(updated.has('status')).toBe(false);
  });

  it('preserves other parameters', () => {
    const params = new URLSearchParams('status=open&bookmarked=true');
    const updated = updateStatusParam(params, 'done');
    expect(updated.get('status')).toBe('done');
    expect(updated.get('bookmarked')).toBe('true');
  });
});
```

**Run unit tests**:
```bash
pnpm --filter meme-gtd-web test
```

---

### 5. Write E2E Tests

**File**: `packages/web/tests/e2e/tasks-filters.spec.ts` (NEW)

Test scenarios:
1. Filter persistence across page refresh
2. Browser back button navigation
3. Bookmark URL restoration (open in new tab)
4. Direct URL navigation (`/tasks/?status=done`)
5. Invalid URL parameter handling

**Example test**:
```typescript
import { test, expect } from '@playwright/test';

test('filter state persists across page refresh', async ({ page }) => {
  await page.goto('http://localhost:3001/tasks/');

  // Apply "Open" filter
  await page.click('button:has-text("Open")');

  // Verify URL updated
  await expect(page).toHaveURL(/status=open/);

  // Refresh page
  await page.reload();

  // Verify filter still applied
  await expect(page).toHaveURL(/status=open/);
  await expect(page.locator('button:has-text("Open")')).toHaveClass(/active/);
});

test('browser back button restores previous filter', async ({ page }) => {
  await page.goto('http://localhost:3001/tasks/');

  // Apply filters: All → Open → Done
  await page.click('button:has-text("Open")');
  await expect(page).toHaveURL(/status=open/);

  await page.click('button:has-text("Done")');
  await expect(page).toHaveURL(/status=done/);

  // Press back button
  await page.goBack();

  // Verify returned to Open filter
  await expect(page).toHaveURL(/status=open/);
  await expect(page.locator('button:has-text("Open")')).toHaveClass(/active/);
});
```

**Run E2E tests**:
```bash
# Make sure test server is running (pnpm server:dev)
pnpm --filter meme-gtd-web test:e2e
```

---

### 6. Manual Testing Checklist

**Basic Functionality**:
- [ ] Clicking status filters updates URL
- [ ] Toggling bookmark filter updates URL
- [ ] Page refresh maintains filter state
- [ ] Clearing filters returns URL to `/tasks/`

**Browser Navigation**:
- [ ] Back button navigates to previous filter state
- [ ] Forward button navigates to next filter state
- [ ] History entries created for each filter change

**URL Sharing**:
- [ ] Copying URL with filters applied works
- [ ] Opening copied URL in new tab restores filters
- [ ] Opening URL in incognito mode restores filters

**Edge Cases**:
- [ ] Invalid status in URL defaults to "All"
- [ ] Invalid bookmarked value defaults to false
- [ ] Multiple status params (only first is used)
- [ ] Switching between filters preserves other filter state

---

## Testing Against Test Environment

**IMPORTANT**: Always use test environment for verification.

```bash
# Test API server (port 3001, test-data/test.db)
pnpm server:dev

# Access test Web UI
http://localhost:3001/tasks/

# Test CLI (if needed)
pnpm mgtd:test task list
```

**Never use**:
- ❌ http://localhost:3000 (production API server)
- ❌ `mgtd` command directly (uses production DB)

---

## Performance Validation

**Success Criteria SC-005**: Filter state changes update URL within 100ms

**How to measure**:
```javascript
// In browser DevTools console
const start = performance.now();
// Click a filter button
const end = performance.now();
console.log(`URL update took ${end - start}ms`);
```

**Expected**: <10ms (well under 100ms requirement)

---

## Troubleshooting

### Issue: URL not updating when filter changes

**Cause**: `setSearchParams` not being called
**Fix**: Verify handler functions are using `setSearchParams(params)`, not `setState`

### Issue: Page refreshes don't preserve filters

**Cause**: Reading from local state instead of URL params
**Fix**: Ensure `statusFilter` and `bookmarkFilter` are derived from `searchParams.get()`, not `useState`

### Issue: Back button doesn't work

**Cause**: Using `setSearchParams(params, { replace: true })`
**Fix**: Remove `replace: true` option - each filter change should create a new history entry

### Issue: Tests failing with "useSearchParams is not a function"

**Cause**: Component not wrapped in Router for tests
**Fix**: Wrap test component in `<MemoryRouter>` from react-router-dom

---

## Next Steps

After completing implementation:

1. Run full test suite: `pnpm test`
2. Verify no TypeScript errors: `pnpm build:web`
3. Commit changes (2 commits recommended):
   - Commit 1: Implementation + tests
   - Commit 2: Version bump (if applicable)
4. Create PR (see CLAUDE.md for PR guidelines)

---

## Related Documentation

- [spec.md](./spec.md) - Feature specification
- [data-model.md](./data-model.md) - URL parameter schema
- [research.md](./research.md) - Technical decisions and alternatives
- [contracts/url-params.types.ts](./contracts/url-params.types.ts) - Type definitions
