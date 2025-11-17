# Developer Quickstart: Add "inbox" and "someday" Task Statuses

**Feature**: 027-task-status-someday-inbox
**Branch**: `027-task-status-someday-inbox`
**Date**: 2025-11-17

## Overview

This guide helps developers implement the new task statuses `inbox` and `someday` across the meme-gtd monorepo. The implementation touches 4 main layers: shared types, database/core logic, API, CLI, and Web UI.

**Estimated Time**: 2-3 hours (including testing)

---

## Prerequisites

**Development Environment**:
- Node.js 22+
- pnpm 9.0.0
- SQLite (via better-sqlite3)

**Repository Setup**:
```bash
git checkout 027-task-status-someday-inbox
pnpm install
pnpm build
```

**Test Environment**:
```bash
# Initialize test database
pnpm mgtd:test init -d $PWD/test-data/test.db -f

# Start test API server (port 3001)
pnpm server:dev
```

---

## Implementation Steps

### Step 1: Update Shared Types (5 min)

**File**: `packages/shared/src/index.ts`

**Change**:
```typescript
// BEFORE
export type TaskStatus =
  | 'open'
  | 'next'
  | 'waiting'
  | 'scheduled'
  | 'done'
  | 'canceled';

// AFTER (add inbox and someday)
export type TaskStatus =
  | 'inbox'     // NEW
  | 'open'
  | 'next'
  | 'waiting'
  | 'scheduled'
  | 'someday'   // NEW
  | 'done'
  | 'canceled';
```

**Verify**:
```bash
# Rebuild shared package
pnpm --filter meme-gtd-shared build

# Check for type errors in dependent packages
pnpm build
```

---

### Step 2: Update API Zod Schemas (10 min)

**File**: `packages/api/src/schemas/taskSchemas.ts`

**Change**:
```typescript
// BEFORE (line 6)
export const TaskStatusSchema = z.enum([
  'open', 'next', 'waiting', 'scheduled', 'done', 'canceled'
]);

// AFTER (add inbox and someday in GTD workflow order)
export const TaskStatusSchema = z.enum([
  'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'
]);
```

**Verify**:
```bash
# Rebuild API package
pnpm --filter meme-gtd-api build

# Run API schema tests (if they exist)
pnpm --filter meme-gtd-api test
```

**Test**:
```bash
# Start dev server
pnpm server:dev

# Test inbox status creation
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test inbox", "status": "inbox"}'

# Expected: 201 Created with {"id": 1, "status": "inbox", ...}

# Test someday status creation
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test someday", "status": "someday"}'

# Expected: 201 Created with {"id": 2, "status": "someday", ...}

# Test filtering by inbox
curl http://localhost:3001/api/tasks?status=inbox

# Expected: 200 OK with array containing task #1
```

---

### Step 3: Regenerate OpenAPI Specification (5 min)

**File**: `packages/api/docs/api/openapi.yaml` (auto-generated)

**Command**:
```bash
# Regenerate OpenAPI from Zod schemas
pnpm --filter meme-gtd-api openapi:generate

# Validate syntax
pnpm --filter meme-gtd-api openapi:validate

# Bundle (if needed)
pnpm --filter meme-gtd-api openapi:bundle
```

**Verify**:
```bash
# Check that status enums now include inbox and someday
grep -A 8 "status:" packages/api/docs/api/openapi.yaml | grep "inbox"
grep -A 8 "status:" packages/api/docs/api/openapi.yaml | grep "someday"
```

**Expected**: Both searches should return multiple matches showing `inbox` and `someday` in enum arrays.

---

### Step 4: Update CLI Commands (15 min)

#### 4.1 Update `task create` command

**File**: `packages/cli/src/commands/task/create.ts`

**Changes**:
```typescript
// Line 13 (description)
static description =
  'Create a task record with title and body. Tasks support status tracking (inbox/open/next/waiting/scheduled/someday/done/canceled).';

// Line 46 (status flag options)
status: Flags.string({
  char: 's',
  summary: 'Initial status',
  description: 'Set task status (inbox, open, next, waiting, scheduled, someday, done, canceled). Default: open',
  options: ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'],  // ADD inbox, someday
  default: 'open'
}),
```

#### 4.2 Update `task edit` command

**File**: `packages/cli/src/commands/task/edit.ts`

**Changes**: Similar to `create.ts`, add `'inbox'` and `'someday'` to status options array.

#### 4.3 Update `task list` command

**File**: `packages/cli/src/commands/task/list.ts`

**Changes**: Add `'inbox'` and `'someday'` to status filter options.

**Verify**:
```bash
# Rebuild CLI
pnpm --filter meme-gtd-cli build

# Test CLI help shows new statuses
pnpm mgtd:test task create --help | grep inbox
pnpm mgtd:test task create --help | grep someday

# Test creating task with inbox status
pnpm mgtd:test task create -t "Test inbox task" --status inbox --no-editor

# Test listing inbox tasks
pnpm mgtd:test task list --status inbox --json
```

---

### Step 5: Update Web UI Components (20 min)

#### 5.1 Update TaskForm component

**File**: `packages/web/src/components/TaskForm.tsx`

**Changes**:

```typescript
// Line 9 (type definition)
type TaskStatus = 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';

// Line 54-55 (memo promotion default - CRITICAL CHANGE per FR-015)
const validStatuses = ['inbox', 'open', 'next', 'waiting', 'scheduled'] as const;
const promotionStatus = validStatuses.includes(status as any)
  ? status as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled'
  : 'inbox';  // Changed default from 'open' to 'inbox'

// Lines 158-174 (status dropdown - add options in GTD workflow order)
<select
  id="status"
  value={status}
  onChange={(e) => setStatus(e.target.value as TaskStatus)}
  className="..."
>
  <option value="inbox">Inbox</option>         {/* NEW */}
  <option value="open">Open</option>
  <option value="next">Next</option>
  <option value="waiting">Waiting</option>
  <option value="scheduled">Scheduled</option>
  <option value="someday">Someday</option>     {/* NEW */}
  {mode === 'edit' && (
    <>
      <option value="done">Done</option>
      <option value="canceled">Canceled</option>
    </>
  )}
</select>
```

#### 5.2 Update validation utilities (if needed)

**File**: `packages/web/src/utils/validation.ts`

**Changes**: If `validateTaskForm` checks status values, ensure `'inbox'` and `'someday'` are included.

#### 5.3 Regenerate API client types

**Command**:
```bash
# Regenerate TypeScript API client from updated OpenAPI spec
pnpm --filter meme-gtd-web generate:api
```

**Verify**:
```bash
# Rebuild Web package
pnpm --filter meme-gtd-web build

# Start dev server
pnpm dev:web

# Manual browser testing:
# 1. Navigate to http://localhost:5173/tasks/new
# 2. Verify status dropdown includes "Inbox" and "Someday"
# 3. Create task with status "Inbox"
# 4. Navigate to http://localhost:5173/tasks?status=inbox
# 5. Verify task appears in filtered list
```

---

### Step 6: Update Memo Promotion Logic (10 min)

**File**: `packages/core/src/memo.ts` or `packages/api/src/routes/memo.ts`

**Action**: Locate the `promoteMemoToTask` function and ensure default status is `'inbox'`.

**Example Change**:
```typescript
// BEFORE
async function promoteMemoToTask(memoId: number, title: string, status: TaskStatus = 'open') {
  // ...
}

// AFTER
async function promoteMemoToTask(memoId: number, title: string, status: TaskStatus = 'inbox') {
  // ...
}
```

**Verify**:
```bash
# Test memo promotion via API
curl -X POST http://localhost:3001/api/memos/1/promote \
  -H "Content-Type: application/json" \
  -d '{"title": "Promoted task"}'

# Expected: Response should have "status": "inbox"
```

---

### Step 7: Add Tests (30 min)

#### 7.1 API Integration Tests

**File**: `packages/api/test/task.test.ts`

**Add Tests**:
```typescript
describe('POST /api/tasks', () => {
  it('creates task with inbox status', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Inbox task', status: 'inbox' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('inbox');
  });

  it('creates task with someday status', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Someday task', status: 'someday' });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('someday');
  });
});

describe('GET /api/tasks', () => {
  it('filters tasks by inbox status', async () => {
    await request(app).post('/api/tasks').send({ title: 'Task 1', status: 'inbox' });
    await request(app).post('/api/tasks').send({ title: 'Task 2', status: 'open' });

    const response = await request(app).get('/api/tasks?status=inbox');
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].status).toBe('inbox');
  });

  it('filters tasks by someday status', async () => {
    await request(app).post('/api/tasks').send({ title: 'Task 1', status: 'someday' });
    await request(app).post('/api/tasks').send({ title: 'Task 2', status: 'open' });

    const response = await request(app).get('/api/tasks?status=someday');
    expect(response.status).toBe(200);
    expect(response.body.length).toBe(1);
    expect(response.body[0].status).toBe('someday');
  });
});

describe('POST /api/memos/:id/promote', () => {
  it('defaults to inbox status when promoting memo', async () => {
    const memo = await request(app).post('/api/memos').send({ bodyMd: 'Test memo' });
    const response = await request(app)
      .post(`/api/memos/${memo.body.id}/promote`)
      .send({ title: 'Promoted task' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('inbox');
  });
});
```

**Run Tests**:
```bash
pnpm --filter meme-gtd-api test
```

#### 7.2 CLI Integration Tests

**File**: `packages/cli/test/task.test.ts` (if exists, otherwise create)

**Add Tests**: Similar to API tests but using CLI command execution.

#### 7.3 E2E Web UI Tests

**File**: `packages/web/tests/task-status.spec.ts`

**Add Tests**:
```typescript
import { test, expect } from '@playwright/test';

test('status dropdown includes inbox and someday', async ({ page }) => {
  await page.goto('http://localhost:3001/tasks/new');
  const statusSelect = page.locator('select#status');
  const options = await statusSelect.locator('option').allTextContents();
  expect(options).toContain('Inbox');
  expect(options).toContain('Someday');
});

test('can create task with inbox status', async ({ page }) => {
  await page.goto('http://localhost:3001/tasks/new');
  await page.fill('input#title', 'Test inbox task');
  await page.selectOption('select#status', 'inbox');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/tasks\/\d+/);
  await expect(page.locator('text=inbox')).toBeVisible();
});

test('URL filtering works with inbox status', async ({ page }) => {
  await page.goto('http://localhost:3001/tasks?status=inbox');
  await expect(page).toHaveURL(/status=inbox/);
  // Verify only inbox tasks are shown (implementation-specific)
});
```

**Run E2E Tests**:
```bash
pnpm --filter meme-gtd-web test:e2e
```

---

## Verification Checklist

### Functional Requirements Verification

- [ ] **FR-001**: Tasks can have status="inbox" (test via API, CLI, Web UI)
- [ ] **FR-002**: Tasks can have status="someday" (test via API, CLI, Web UI)
- [ ] **FR-003**: API accepts inbox/someday in task creation
- [ ] **FR-004**: API accepts inbox/someday in task updates
- [ ] **FR-005**: API filters tasks by status=inbox
- [ ] **FR-006**: API filters tasks by status=someday
- [ ] **FR-007**: CLI accepts inbox/someday in task create command
- [ ] **FR-008**: CLI accepts inbox/someday in task update command
- [ ] **FR-009**: CLI accepts inbox/someday in task list filter
- [ ] **FR-010**: Web UI status dropdown includes inbox/someday
- [ ] **FR-011**: Web UI supports URL filtering with status=inbox
- [ ] **FR-012**: Web UI supports URL filtering with status=someday
- [ ] **FR-013**: All status transitions work without restrictions
- [ ] **FR-014**: Default status for direct task creation remains "open"
- [ ] **FR-015**: Memo promotion defaults to status="inbox"
- [ ] **FR-016**: Project boards display inbox/someday tasks correctly
- [ ] **FR-017**: UI displays statuses in GTD workflow order
- [ ] **FR-018**: Existing status="open" tasks remain unchanged

### Success Criteria Verification

- [ ] **SC-001**: Tasks created with inbox status in <2 seconds
- [ ] **SC-002**: Tasks updated to someday status persist correctly
- [ ] **SC-003**: All interfaces filter/display inbox/someday correctly
- [ ] **SC-004**: 100% feature parity with existing status values
- [ ] **SC-005**: Users can distinguish inbox vs someday tasks
- [ ] **SC-006**: Existing "open" tasks unchanged after deployment

---

## Troubleshooting

### Build Errors

**Issue**: TypeScript errors about TaskStatus type mismatch

**Solution**: Ensure `meme-gtd-shared` is rebuilt first, then rebuild dependent packages:
```bash
pnpm --filter meme-gtd-shared build
pnpm build
```

### API Validation Errors

**Issue**: API returns 400 Bad Request for inbox/someday status

**Solution**: Verify Zod schema is updated and API server is restarted:
```bash
# Check schema
cat packages/api/src/schemas/taskSchemas.ts | grep TaskStatusSchema

# Restart dev server
pnpm server:dev
```

### Web UI Dropdown Missing Options

**Issue**: Status dropdown doesn't show Inbox/Someday

**Solution**: Verify TypeScript type and JSX options are updated, then rebuild:
```bash
# Check type definition
grep "type TaskStatus" packages/web/src/components/TaskForm.tsx

# Rebuild and restart
pnpm --filter meme-gtd-web build
pnpm dev:web
```

---

## Deployment Notes

### Pre-Deployment Checklist

- [ ] All tests pass (unit, integration, e2e)
- [ ] OpenAPI spec updated and validated
- [ ] CHANGELOG.md updated with new status values
- [ ] Documentation updated (README, user guides)

### Deployment Steps

1. Merge feature branch to main
2. Deploy API server (no database migration required)
3. Deploy Web UI with updated TypeScript client
4. Update CLI package (publish new version if distributed)

### Rollback Plan

If issues arise:
1. Revert code changes
2. Existing inbox/someday tasks in database remain (TEXT column accepts any value)
3. Optional: Add application filter to hide inbox/someday tasks temporarily

---

## Next Steps

After implementation is complete and verified:

1. **Run `/speckit:tasks`**: Generate detailed task breakdown from this plan
2. **Execute tasks**: Follow task list to implement changes
3. **Code review**: Ensure all changes follow meme-gtd coding standards
4. **Documentation**: Update user-facing docs with new status explanations
5. **Release**: Tag new version following semantic versioning (likely MINOR bump)

---

## Resources

- **Feature Spec**: `specs/027-task-status-someday-inbox/spec.md`
- **Data Model**: `specs/027-task-status-someday-inbox/data-model.md`
- **Research**: `specs/027-task-status-someday-inbox/research.md`
- **API Changes**: `specs/027-task-status-someday-inbox/contracts/api-changes.md`
- **GTD Reference**: `docs/gtd.md`

---

**Estimated Total Time**: 2-3 hours

**Difficulty**: Beginner-Intermediate (straightforward enum extension)

**Impact**: Low risk, backward compatible, no database migration
