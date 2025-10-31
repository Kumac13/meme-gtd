# Developer Quickstart: Item Detail Back Navigation with Filter Preservation

**Feature**: 022-github
**Date**: 2025-10-31

## Overview

This guide helps developers test, debug, and extend the filter preservation feature for item detail navigation.

## Testing the Feature

### Manual Test Scenarios

#### Scenario 1: Basic Filter Preservation (Tasks)

1. **Start test environment**:
   ```bash
   pnpm server:dev  # Starts on port 3001 (test DB)
   # Open http://localhost:3001/tasks/ in browser
   ```

2. **Apply status filter**:
   - Click "Open" filter in FilterBar
   - Verify URL updates to `/tasks/?status=open`

3. **Navigate to task detail**:
   - Click on any task in the list
   - Verify URL includes `returnFilters` parameter:
     ```
     /tasks/123?returnFilters=status%3Dopen
     ```

4. **Navigate back**:
   - Click "← Back to tasks" link
   - Verify URL returns to `/tasks/?status=open` (filter preserved)
   - Verify filtered list is displayed

#### Scenario 2: Multiple Filters (Tasks)

1. Apply status filter: `/tasks/?status=next`
2. Apply bookmark filter: `/tasks/?status=next&bookmarked=true`
3. Click on a task
4. Verify URL: `/tasks/123?returnFilters=status%3Dnext%26bookmarked%3Dtrue`
5. Click back
6. Verify both filters preserved: `/tasks/?status=next&bookmarked=true`

#### Scenario 3: Bookmarked Filter Only (Memos)

1. Navigate to `/memos/`
2. Enable bookmark filter: `/memos/?bookmarked=true`
3. Click on a memo
4. Verify URL: `/memos/456?returnFilters=bookmarked%3Dtrue`
5. Click back
6. Verify filter preserved: `/memos/?bookmarked=true`

#### Scenario 4: Direct Access (No Filters)

1. Directly enter URL: `http://localhost:3001/tasks/123`
2. Verify no `returnFilters` parameter in URL
3. Click "← Back to tasks"
4. Verify navigation to default list: `/tasks/` (no filters)

#### Scenario 5: Browser Back Button

1. Start at filtered list: `/tasks/?status=open`
2. Click on task → `/tasks/123?returnFilters=...`
3. Use browser back button
4. Verify return to `/tasks/?status=open` (filter preserved)
5. Use browser forward button
6. Verify return to `/tasks/123?returnFilters=...`

### Browser DevTools Inspection

**Inspect URL Parameters**:
```javascript
// In browser console
const params = new URLSearchParams(window.location.search);
console.log('Return filters:', params.get('returnFilters'));
console.log('Decoded:', decodeURIComponent(params.get('returnFilters') || ''));
```

**Inspect React Component State**:
```javascript
// In React DevTools
// Select ItemDetail component
// Check props: returnFilters, basePath
// Verify correct values passed from page component
```

**Verify Performance**:
```javascript
// In browser console
performance.mark('nav-start');
// Click back button
performance.mark('nav-end');
performance.measure('navigation', 'nav-start', 'nav-end');
console.log(performance.getEntriesByName('navigation')[0].duration);
// Should be < 500ms (SC-005)
```

### Edge Case Testing

#### Test 1: Invalid returnFilters Parameter

1. Manually craft invalid URL:
   ```
   http://localhost:3001/tasks/123?returnFilters=invalid%20data
   ```
2. Click "← Back to tasks"
3. **Expected**: Navigation to `/tasks/` (default, no error)
4. **Verify**: Browser console shows error log (FR-009)

#### Test 2: XSS Attempt in Filters

1. Manually craft malicious URL:
   ```
   http://localhost:3001/tasks/123?returnFilters=status%3D%3Cscript%3Ealert(1)%3C%2Fscript%3E
   ```
2. Click back button
3. **Expected**: Script not executed, navigation to default list
4. **Verify**: Console shows validation failure log

#### Test 3: Long Filter Combinations

1. Create URL with maximum filters:
   ```
   /tasks/?status=scheduled&bookmarked=true
   ```
2. Navigate to detail
3. **Verify**: URL length < 500 characters (SC-004)
4. **Verify**: Back navigation works correctly

#### Test 4: Cross-Item-Type Filter Leak

1. Start at `/tasks/?status=open`
2. Navigate to memo detail (simulate bug):
   ```
   /memos/456?returnFilters=status%3Dopen
   ```
3. Click back
4. **Expected**: Status filter removed (memos don't support it)
5. **Expected**: Navigation to `/memos/` (default)

## Adding Filter Support to New Item Types

### Step-by-Step Guide

#### 1. Define Filter Types

Update `packages/web/src/utils/urlFilterHelpers.ts`:

```typescript
// Add new valid values for your item type
export const VALID_NEW_ITEM_STATUSES = [
  'draft',
  'published',
  'archived',
] as const;

export type NewItemStatusFilter = typeof VALID_NEW_ITEM_STATUSES[number] | 'all';
```

#### 2. Add Validation Functions

```typescript
export function validateNewItemStatus(value: string | null): NewItemStatusFilter {
  if (!value) return 'all';
  return VALID_NEW_ITEM_STATUSES.includes(value as any)
    ? (value as NewItemStatusFilter)
    : 'all';
}
```

#### 3. Update List Page Component

In `packages/web/src/pages/NewItemList.tsx`:

```typescript
import { useSearchParams } from 'react-router-dom';

function NewItemList() {
  const [searchParams] = useSearchParams();
  const statusFilter = validateNewItemStatus(searchParams.get('status'));

  // Pass current filters to ItemList
  <ItemList
    items={filteredItems}
    itemType="newitem"
    basePath="/newitems"
    currentFilters={searchParams}  // ADD THIS
    onDelete={handleDelete}
  />
}
```

#### 4. Update Detail Page Component

In `packages/web/src/pages/NewItemDetail.tsx`:

```typescript
import { useSearchParams } from 'react-router-dom';

function NewItemDetail() {
  const [searchParams] = useSearchParams();
  const returnFiltersEncoded = searchParams.get('returnFilters');  // ADD THIS

  return (
    <ItemDetail
      item={item}
      itemType="newitem"
      basePath="/newitems"
      returnFilters={returnFiltersEncoded}  // ADD THIS
      onDelete={handleDelete}
      // ... other props
    />
  );
}
```

#### 5. Update navigationHelpers Whitelist

In `packages/web/src/utils/navigationHelpers.ts`:

```typescript
function getValidFilterParams(itemType: ItemType): string[] {
  switch (itemType) {
    case 'task':
      return ['status', 'bookmarked'];
    case 'memo':
    case 'project':
      return ['bookmarked'];
    case 'newitem':  // ADD THIS
      return ['status', 'bookmarked'];  // Adjust as needed
    default:
      return [];
  }
}
```

### Filter Support Checklist

- [ ] Added filter type definitions to `urlFilterHelpers.ts`
- [ ] Implemented validation functions with whitelist
- [ ] Updated list page to pass `currentFilters` to ItemList
- [ ] Updated detail page to extract and pass `returnFilters`
- [ ] Added item type to `navigationHelpers` whitelist
- [ ] Wrote unit tests for new filter validation
- [ ] Tested all filter combinations manually
- [ ] Verified edge cases (invalid filters, XSS attempts)
- [ ] Measured navigation performance (<500ms)
- [ ] Updated this quickstart guide

## Debugging Navigation Issues

### Common Issues and Solutions

#### Issue 1: Filters Not Preserved

**Symptoms**: Back button navigates to unfiltered list

**Check**:
1. Verify list component passes `currentFilters` prop:
   ```typescript
   <ItemList currentFilters={searchParams} ... />
   ```
2. Verify ItemList component uses `currentFilters` in links:
   ```typescript
   const detailUrl = createItemDetailUrl({
     basePath,
     itemId: item.id,
     currentFilters,  // Must be present
   });
   ```
3. Check browser DevTools: Does detail URL contain `returnFilters` param?

**Solution**: Add missing prop passing

#### Issue 2: "Invalid returnFilters" Console Errors

**Symptoms**: Console shows validation errors, falls back to default list

**Check**:
1. Inspect URL parameter value (browser DevTools)
2. Verify encoding is valid URL-encoded string
3. Check if parameter names are whitelisted

**Solution**: Use `encodeURIComponent()` for encoding, verify whitelist includes parameter names

#### Issue 3: XSS Validation Blocking Valid Filters

**Symptoms**: Legitimate filters rejected, navigation to default list

**Check**:
1. Review validation rules in `navigationHelpers.ts`
2. Verify filter values match whitelist patterns
3. Check console for specific validation failure

**Solution**: Adjust validation rules if too restrictive, or fix filter value format

#### Issue 4: Performance >500ms

**Symptoms**: Slow navigation, fails SC-005

**Check**:
1. Measure with browser Performance API:
   ```javascript
   performance.measure('navigation', 'nav-start', 'nav-end');
   ```
2. Check network tab for unexpected API calls
3. Profile with React DevTools

**Solution**: Typically not filter-related (<1ms overhead). Check for other performance issues.

### Logging Strategy for returnFilters Errors

**Per FR-009**, log error cases for troubleshooting:

```typescript
// In navigationHelpers.ts
export function decodeReturnFilters(encoded: string, itemType: ItemType): DecodedReturnFilters {
  try {
    const decoded = new URLSearchParams(encoded);
    const validated = validateFilters(decoded, itemType);

    if (!validated.valid) {
      console.error('[ReturnFilters] Validation failed:', {
        itemType,
        encoded,
        error: validated.error,
        timestamp: new Date().toISOString(),
      });
    }

    return validated;
  } catch (error) {
    console.error('[ReturnFilters] Decoding failed:', {
      itemType,
      encoded,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });

    return { success: false, filters: {}, error: 'Decoding failed' };
  }
}
```

**Log Format**:
- Prefix: `[ReturnFilters]` for easy filtering
- Include: `itemType`, `encoded` value, `error` message, `timestamp`
- No sensitive data in logs (filters are UI state only)

### Debugging Tools

**Browser Extensions**:
- React DevTools: Inspect component props and state
- Redux DevTools: Not used (URL-based state only)

**VS Code Extensions**:
- Error Lens: Inline TypeScript errors
- ESLint: Catch validation issues

**Test Commands**:
```bash
# Run unit tests
pnpm --filter meme-gtd-web test

# Run with coverage
pnpm --filter meme-gtd-web test -- --coverage

# Run specific test file
pnpm --filter meme-gtd-web test navigationHelpers.test.ts
```

## Performance Benchmarking

### Measuring Navigation Time

**Manual Measurement**:
```javascript
// In browser console before navigation
const measure = () => {
  const start = performance.now();
  // Click back button manually
  setTimeout(() => {
    const end = performance.now();
    console.log(`Navigation time: ${end - start}ms`);
  }, 600); // Wait for page render
};
measure();
```

**Automated Measurement** (for CI):
```typescript
// In e2e test (Playwright/Cypress)
test('navigation performance', async ({ page }) => {
  await page.goto('http://localhost:3001/tasks/?status=open');
  await page.click('text=Task #1');

  const startTime = Date.now();
  await page.click('text=← Back to tasks');
  await page.waitForURL('**/tasks/?status=open');
  const endTime = Date.now();

  expect(endTime - startTime).toBeLessThan(500); // SC-005
});
```

### Performance Goals (SC-005)

- **Target**: < 500ms (from click to fully rendered filtered list)
- **Components**:
  - URL parameter decoding: <1ms
  - Component re-render: ~50-100ms
  - Network (none): 0ms
  - Total typical: ~100-150ms (well under budget)

## Summary

This quickstart provides:
- **Manual testing scenarios** for all user stories (P1, P2, P3)
- **Edge case testing** for validation and security (FR-005, FR-009)
- **Extension guide** for new item types with checklist
- **Debugging strategies** for common issues
- **Performance measurement** techniques (SC-005)

For detailed technical documentation:
- See `data-model.md` for entity definitions
- See `research.md` for implementation decisions
- See `contracts/return-filters.types.ts` for TypeScript types

For testing against production:
```bash
# Use test environment (port 3001)
pnpm server:dev

# NOT production (port 3000)
# pnpm server:start  # NEVER use for testing
```

**Next Steps**: After testing locally, run `/speckit.tasks` to generate implementation task list.
