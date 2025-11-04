# Quickstart: Web UI Memo-to-Task Promotion

**Feature**: 023-web-memo-task
**Date**: 2025-11-04
**For**: Developers implementing this feature

## Overview

This guide provides step-by-step instructions for implementing the Web UI memo-to-task promotion feature. Follow the order below to ensure dependencies are properly handled.

## Prerequisites

Before starting implementation:

- [x] Feature specification reviewed (`spec.md`)
- [x] Research completed (`research.md`)
- [x] Data model understood (`data-model.md`)
- [x] API contract reviewed (`contracts/promote-memo.yaml`)
- [ ] Development environment set up (Node.js 22+, pnpm)
- [ ] Test database initialized (`pnpm mgtd:test init -d $PWD/test-data/test.db -f`)

## Implementation Order

### Phase 1: TaskForm Enhancement (30 min)

**File**: `packages/web/src/components/TaskForm.tsx`

**Changes**:
1. Add `fromMemoId?: number` to `TaskFormProps` interface
2. Import `MemosService` from `'../api/services/MemosService'`
3. Modify `handleSubmit` to detect promotion mode and call `MemosService.promoteMemo()`
4. Conditionally show status dropdown when `fromMemoId` is present

**Key Code**:
```typescript
// Add prop
interface TaskFormProps {
  // ... existing props
  fromMemoId?: number;
}

// In handleSubmit
if (mode === 'create' && fromMemoId) {
  // Promotion flow
  const response = await MemosService.promoteMemo(
    fromMemoId.toString(),
    { title, status }
  );
  navigate(`/tasks/${response.id}`);
} else if (mode === 'create') {
  // Normal create flow
  // ... existing code
}

// Show status dropdown
{(mode === 'edit' || fromMemoId) && (
  <div>
    <label>Status</label>
    <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
      {/* options */}
    </select>
  </div>
)}
```

**Test**:
```bash
# Unit test: TaskForm calls promoteMemo with correct args
pnpm --filter meme-gtd-web test
```

---

### Phase 2: TaskNew Page Enhancement (45 min)

**File**: `packages/web/src/pages/TaskNew.tsx`

**Changes**:
1. Parse `fromMemo` query parameter using `useSearchParams()`
2. Add state for memo data and loading
3. Fetch memo when `fromMemo` is present
4. Pass memo data to `TaskForm` as initial props
5. Add loading state UI

**Key Code**:
```typescript
import { useSearchParams } from 'react-router-dom';
import { MemosService } from '../api/services/MemosService';

export default function TaskNew() {
  const [searchParams] = useSearchParams();
  const fromMemoId = searchParams.get('fromMemo');

  const [memo, setMemo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (fromMemoId) {
      async function fetchMemo() {
        try {
          setLoading(true);
          const data = await MemosService.getMemo(fromMemoId);
          setMemo(data);
        } catch (err) {
          setError(err.message);
        } finally {
          setLoading(false);
        }
      }
      fetchMemo();
    }
  }, [fromMemoId]);

  if (loading) return <LoadingState message="Loading memo..." />;
  if (error) return <ErrorState error={error} />;

  return (
    <div>
      <h1>
        {memo ? 'Promote Memo to Task' : 'Create New Task'}
      </h1>
      <TaskForm
        mode="create"
        initialBodyMd={memo?.bodyMd}
        fromMemoId={memo?.id}
      />
    </div>
  );
}
```

**Test**:
```bash
# Unit test: TaskNew fetches memo and passes props correctly
pnpm --filter meme-gtd-web test
```

---

### Phase 3: MemoDetail Button Addition (30 min)

**File**: `packages/web/src/pages/MemoDetail.tsx`

**Changes**:
1. Add "Promote to Task" button in header
2. Use `<Link>` to navigate to `/tasks/new?fromMemo={id}`
3. Style button consistently with existing actions

**Key Code**:
```typescript
import { Link } from 'react-router-dom';

// In the render, add button next to bookmark button
<div className="flex items-center space-x-2">
  <button onClick={handleBookmarkToggle}>
    {isBookmarked ? '🔖' : '☆'} Bookmark
  </button>

  <Link to={`/tasks/new?fromMemo=${id}`}>
    <button className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
      ⬆️ Promote to Task
    </button>
  </Link>
</div>
```

**Alternative**: If using `ItemDetail` component, check if it supports custom action buttons via props.

**Test**:
```bash
# Manual test: Navigate to memo detail, verify button appears
pnpm server:dev  # Start test server on port 3001
# Open http://localhost:3001/memos/<id>
# Click "Promote to Task" button
# Verify navigation to /tasks/new?fromMemo=<id>
```

---

### Phase 4: Integration Testing (60 min)

**File**: Create `packages/api/test/integration/promote-memo.test.ts`

**Test Cases** (from contract):
1. Successful promotion with minimal data
2. Successful promotion with custom status
3. Metadata transfer (labels, comments, bookmarks)
4. Validation errors (missing title, invalid status)
5. Not found error (memo doesn't exist)

**Example Test**:
```typescript
import { test } from 'node:test';
import assert from 'node:assert';
import { buildServer } from '../../src/index.js';

test('promote memo with minimal data', async () => {
  const app = await buildServer();

  // Create memo
  const memoRes = await app.inject({
    method: 'POST',
    url: '/api/memos',
    payload: { bodyMd: 'Test memo' }
  });
  const memo = JSON.parse(memoRes.body);

  // Promote to task
  const promoteRes = await app.inject({
    method: 'POST',
    url: `/api/memos/${memo.id}/promote`,
    payload: { title: 'Test task' }
  });

  assert.equal(promoteRes.statusCode, 200);
  const task = JSON.parse(promoteRes.body);
  assert.equal(task.title, 'Test task');
  assert.equal(task.bodyMd, 'Test memo');
  assert.equal(task.status, 'open');

  await app.close();
});
```

**Run Tests**:
```bash
pnpm --filter meme-gtd-api test
```

---

### Phase 5: E2E Testing (90 min)

**File**: Create `packages/web/tests/e2e/promote-memo.spec.ts`

**Test Flow**:
1. Create memo via API
2. Navigate to memo detail page
3. Click "Promote to Task" button
4. Verify form pre-populated with memo body
5. Fill in task title
6. Select status "next"
7. Submit form
8. Verify navigation to task detail page
9. Verify task has correct title, body, status
10. Verify memo no longer visible in memo list

**Example Test**:
```typescript
import { test, expect } from '@playwright/test';

test('promote memo to task flow', async ({ page }) => {
  // Setup: Create memo via API
  const memoRes = await page.request.post('http://localhost:3001/api/memos', {
    data: { bodyMd: 'Research React patterns' }
  });
  const memo = await memoRes.json();

  // Navigate to memo detail
  await page.goto(`http://localhost:3001/memos/${memo.id}`);

  // Click promote button
  await page.click('text=Promote to Task');

  // Verify redirected to task creation form
  await expect(page).toHaveURL(/\/tasks\/new\?fromMemo=/);

  // Verify body pre-populated
  const bodyField = page.locator('textarea#bodyMd');
  await expect(bodyField).toHaveValue('Research React patterns');

  // Fill in title
  await page.fill('input#title', 'Implement React patterns');

  // Select status
  await page.selectOption('select#status', 'next');

  // Submit form
  await page.click('button:has-text("Create Task")');

  // Verify navigation to task detail
  await expect(page).toHaveURL(/\/tasks\/\d+/);

  // Verify task content
  await expect(page.locator('h1')).toContainText('Implement React patterns');
  await expect(page.locator('.task-body')).toContainText('Research React patterns');
  await expect(page.locator('.task-status')).toContainText('next');
});
```

**Run E2E Tests**:
```bash
# Start test server
pnpm server:dev  # Port 3001

# In another terminal
pnpm --filter meme-gtd-web test:e2e
```

---

## Testing Checklist

Before marking feature complete:

- [ ] TaskForm unit tests pass
- [ ] TaskNew unit tests pass
- [ ] API integration tests pass (all contract test cases)
- [ ] E2E test passes (full promotion flow)
- [ ] Manual smoke test completed (see below)
- [ ] No console errors in browser
- [ ] No production database contamination (verify `~/.local/share/mgtd/issues.db` unchanged)

---

## Manual Smoke Test

**Setup**:
```bash
# Start test API server
pnpm server:dev  # Port 3001

# Create test memo (or use existing)
pnpm mgtd:test memo create --body "Manual test memo"
```

**Test Steps**:
1. Open browser: http://localhost:3001
2. Navigate to "Memos" page
3. Click on a memo to view details
4. Verify "Promote to Task" button appears in header
5. Click "Promote to Task"
6. Verify redirected to task creation form
7. Verify form shows "Promote Memo to Task" heading
8. Verify memo body pre-filled in description field
9. Verify status dropdown visible (not normally shown in create mode)
10. Enter task title: "Promoted task title"
11. Select status: "next"
12. Click "Create Task" button
13. Verify redirected to task detail page
14. Verify task has correct title and body
15. Verify task has status "next"
16. Navigate back to "Memos" page
17. Verify promoted memo no longer in list

**Expected Result**: All steps pass, no errors in browser console

---

## Troubleshooting

### Issue: "Memo not found" error

**Cause**: Trying to promote non-existent memo or using wrong environment

**Solution**:
- Verify using test environment (port 3001, not 3000)
- Check memo ID is correct
- Verify memo exists: `pnpm mgtd:test memo list --json`

### Issue: Form not pre-populated

**Cause**: Memo data not fetching or props not passed correctly

**Solution**:
- Check browser Network tab for API call to `/api/memos/:id`
- Verify `fromMemo` query param present in URL
- Add `console.log(memo)` in TaskNew before passing to TaskForm
- Check TaskForm receives `initialBodyMd` prop

### Issue: Status dropdown not showing

**Cause**: Conditional rendering logic incorrect

**Solution**:
- Verify `fromMemoId` prop passed to TaskForm
- Check condition: `mode === 'edit' || fromMemoId`
- Inspect React DevTools to verify prop values

### Issue: Promotion fails with 400 error

**Cause**: Validation error (missing title or invalid status)

**Solution**:
- Check browser console for error details
- Verify title is non-empty
- Verify status is one of: open, next, waiting, scheduled
- Check TaskForm validation logic

### Issue: Production database modified

**Cause**: Used wrong server or CLI command

**Solution**:
- STOP immediately
- Check `~/.local/share/mgtd/issues.db` file size
- If changed, restore from backup (if available)
- Always use `pnpm server:dev` (port 3001) and `pnpm mgtd:test`

---

## Performance Validation

**Target Metrics** (from spec):
- Promotion completes within 2 seconds
- UI navigation within 200ms
- Form pre-population instant (< 50ms)

**Measurement**:
```bash
# Use browser DevTools Performance tab
# Record promotion flow:
# 1. Click "Promote" button → start timer
# 2. Task detail page loads → stop timer
# Total time should be < 2 seconds
```

**API Latency**:
```bash
# Test API endpoint directly
time curl -X POST http://localhost:3001/api/memos/123/promote \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","status":"next"}'

# Expected: < 500ms for typical memo
```

---

## Deployment Checklist

Before merging to main:

- [ ] All tests passing (unit + integration + E2E)
- [ ] Code reviewed by peer
- [ ] Performance targets met
- [ ] No production database contamination
- [ ] Documentation updated (if needed)
- [ ] CHANGELOG.md updated with feature description
- [ ] Version bumped (minor: 0.9.0 → 0.10.0)

---

## References

- Feature Spec: `spec.md`
- Research: `research.md`
- Data Model: `data-model.md`
- API Contract: `contracts/promote-memo.yaml`
- Existing Patterns: `packages/web/src/pages/TaskEdit.tsx`

---

## Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| TaskForm Enhancement | 30 min | P1 |
| TaskNew Enhancement | 45 min | P1 |
| MemoDetail Button | 30 min | P1 |
| Integration Tests | 60 min | P2 |
| E2E Tests | 90 min | P2 |
| Manual Testing | 30 min | P2 |
| **Total** | **4.5 hours** | |

**Note**: Timeline assumes familiarity with codebase and React Router patterns.

---

## Next Steps

After implementation complete:

1. Run `/speckit.tasks` to generate detailed task breakdown
2. Execute tasks in dependency order
3. Create PR with changes
4. Link PR to issue #66
5. Request code review
