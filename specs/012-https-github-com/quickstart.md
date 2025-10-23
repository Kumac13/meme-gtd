# Quickstart: Implementing Comment Count Feature

**Feature**: Add Comment Count to API List Responses
**Target Audience**: Developers implementing this feature
**Estimated Time**: 2-3 hours

## Overview

This guide walks through implementing the comment count field in memo and task list endpoints. The change affects three packages in the monorepo: `db`, `core`, and `api`.

## Prerequisites

- Node.js >= 22.0.0
- pnpm 9.0.0
- Familiarity with TypeScript and SQLite
- Development environment set up (see main README.md)

## Implementation Checklist

### Phase 1: Database Layer (packages/db)

#### Step 1.1: Update Memo Repository

**File**: `packages/db/src/memoRepository.ts`

**Location**: Function `listMemos()` (around line 83)

**Change**:
```typescript
// BEFORE
let sql = `SELECT * FROM issues WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`;

// AFTER
let sql = `
  SELECT i.*,
    (SELECT COUNT(*) FROM comments c
     WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
  FROM issues i
  WHERE ${conditions.join(' AND ')}
  ORDER BY ${orderBy}`;
```

**Also update the FTS path** (around line 115):
```typescript
// BEFORE
sql = `SELECT i.* FROM issues i JOIN issues_fts f ON f.issue_id = i.id
        WHERE ${searchConditions.join(' AND ')}
        ORDER BY i.updated_at ${filters.order === 'asc' ? 'ASC' : 'DESC'}`;

// AFTER
sql = `
  SELECT i.*,
    (SELECT COUNT(*) FROM comments c
     WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count
  FROM issues i
  JOIN issues_fts f ON f.issue_id = i.id
  WHERE ${searchConditions.join(' AND ')}
  ORDER BY i.updated_at ${filters.order === 'asc' ? 'ASC' : 'DESC'}`;
```

**Update mapper function** `memoRowToMemo()` (around line 25):
```typescript
const memoRowToMemo = (row: any): Memo => ({
  id: row.id,
  type: 'memo',
  title: null,
  bodyMd: row.body_md,
  status: null,
  scheduledOn: null,
  meta: row.meta ? JSON.parse(row.meta) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isBookmarked: toBoolean(row.is_bookmarked),
  isDeleted: toBoolean(row.is_deleted),
  commentCount: row.comment_count ?? 0  // ← ADD THIS LINE
});
```

#### Step 1.2: Update Task Repository

**File**: `packages/db/src/taskRepository.ts`

**Apply the same changes** as Step 1.1, but for:
- Function `listTasks()`
- Function `taskRowToTask()`

**Pattern is identical**:
1. Add subquery to SELECT for both standard and FTS paths
2. Add `commentCount: row.comment_count ?? 0` to mapper

#### Step 1.3: Update Shared Types

**File**: `packages/shared/src/types.ts`

**Change**:
```typescript
export interface Memo {
  id: number;
  type: 'memo';
  title: null;
  bodyMd: string;
  status: null;
  scheduledOn: null;
  meta: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
  isDeleted: boolean;
  commentCount?: number;  // ← ADD THIS LINE (optional)
}

export interface Task {
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: TaskStatus;
  scheduledOn: string | null;
  meta: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
  isBookmarked: boolean;
  isDeleted: boolean;
  commentCount?: number;  // ← ADD THIS LINE (optional)
}
```

**Note**: Optional (`?`) because detail endpoints don't include this field.

#### Step 1.4: Write Database Tests

**File**: `packages/db/test/memoRepository.test.ts`

**Add test case**:
```typescript
describe('listMemos with comment counts', () => {
  it('should return comment count for each memo', () => {
    // Create memo
    const memo = createMemo(db, { bodyMd: 'Test memo' });

    // Add comments
    addComment(db, memo.id, 'Comment 1');
    addComment(db, memo.id, 'Comment 2');
    const comment3Id = addComment(db, memo.id, 'Comment 3').id;

    // Soft-delete one comment
    deleteComment(db, comment3Id);

    // List memos
    const memos = listMemos(db, {});

    // Verify count excludes deleted comment
    expect(memos).toHaveLength(1);
    expect(memos[0].commentCount).toBe(2);
  });

  it('should return 0 for memos with no comments', () => {
    createMemo(db, { bodyMd: 'Test memo without comments' });
    const memos = listMemos(db, {});

    expect(memos[0].commentCount).toBe(0);
  });
});
```

**File**: `packages/db/test/taskRepository.test.ts`

**Add similar test cases** for tasks.

### Phase 2: API Layer (packages/api)

#### Step 2.1: Update Memo Schema

**File**: `packages/api/src/schemas/memoSchemas.ts`

**Change**: Update `MemoSchema` definition (around line 35):
```typescript
export const MemoSchema = z.object({
  id: z.number().int().positive().describe('Unique memo ID'),
  type: z.literal('memo').describe('Issue type (always "memo")'),
  title: z.string().nullable().describe('Title (always null for memos)'),
  bodyMd: z.string().describe('Memo content in Markdown format'),
  status: z.string().nullable().describe('Status (always null for memos)'),
  scheduledOn: z.string().date().nullable().describe('Scheduled date (always null for memos)'),
  meta: z.record(z.any()).describe('Metadata object'),
  isBookmarked: z.boolean().describe('Whether the memo is bookmarked'),
  isDeleted: z.boolean().describe('Whether the memo is soft-deleted'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  labels: z.array(z.string()).describe('Array of label names assigned to this memo'),
  commentCount: z.number().int().nonnegative()  // ← ADD THIS LINE
    .describe('Number of non-deleted comments on this memo'),
});
```

#### Step 2.2: Update Task Schema

**File**: `packages/api/src/schemas/taskSchemas.ts`

**Change**: Update `TaskSchema` definition (around line 37):
```typescript
export const TaskSchema = z.object({
  id: z.number().int().positive().describe('Unique task ID'),
  type: z.literal('task').describe('Issue type (always "task")'),
  title: z.string().describe('Task title'),
  bodyMd: z.string().describe('Task description in Markdown format'),
  status: TaskStatusSchema.describe('Current task status'),
  scheduledOn: z.string().date().nullable().describe('Scheduled date for the task (YYYY-MM-DD, null if not scheduled)'),
  meta: z.record(z.any()).describe('Metadata object'),
  isBookmarked: z.boolean().describe('Whether the task is bookmarked'),
  isDeleted: z.boolean().describe('Whether the task is soft-deleted'),
  createdAt: z.string().datetime().describe('Creation timestamp'),
  updatedAt: z.string().datetime().describe('Last update timestamp'),
  labels: z.array(z.string()).describe('Array of label names assigned to this task'),
  commentCount: z.number().int().nonnegative()  // ← ADD THIS LINE
    .describe('Number of non-deleted comments on this task'),
});
```

#### Step 2.3: Write API Integration Tests

**File**: `packages/api/test/integration/memos.test.ts`

**Add test case**:
```typescript
describe('GET /api/memos', () => {
  it('should include commentCount in response', async () => {
    // Setup: Create memo with comments
    const memoService = new MemoService({ db });
    const memo = memoService.create({ bodyMd: 'Test memo' });
    memoService.addComment(memo.id, 'Comment 1');
    memoService.addComment(memo.id, 'Comment 2');

    // Request
    const response = await app.inject({
      method: 'GET',
      url: '/api/memos'
    });

    // Verify
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveLength(1);
    expect(body[0]).toHaveProperty('commentCount', 2);
  });

  it('should return 0 commentCount for memos without comments', async () => {
    const memoService = new MemoService({ db });
    memoService.create({ bodyMd: 'Test memo' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/memos'
    });

    const body = JSON.parse(response.body);
    expect(body[0]).toHaveProperty('commentCount', 0);
  });
});
```

**File**: `packages/api/test/integration/tasks.test.ts`

**Add similar test cases** for tasks.

### Phase 3: Validation

#### Step 3.1: Run Tests

```bash
# Run all tests in the monorepo
pnpm test

# Run specific package tests
pnpm --filter meme-gtd-db test
pnpm --filter meme-gtd-api test
```

**Expected**: All tests pass, including new comment count tests.

#### Step 3.2: Manual Testing (Test Environment)

**Start test API server**:
```bash
pnpm server:dev  # Runs on port 3001 with test-data/test.db
```

**Test memo endpoint**:
```bash
# List memos
curl http://localhost:3001/api/memos

# Expected response includes commentCount field:
# [
#   {
#     "id": 1,
#     "type": "memo",
#     "bodyMd": "...",
#     "commentCount": 2,
#     ...
#   }
# ]
```

**Test task endpoint**:
```bash
# List tasks
curl http://localhost:3001/api/tasks

# Expected response includes commentCount field
```

#### Step 3.3: Verify OpenAPI Documentation

```bash
# Check Swagger UI (if configured)
# Navigate to http://localhost:3001/documentation

# Verify MemoSchema and TaskSchema include commentCount field
```

### Phase 4: Performance Validation

#### Step 4.1: Benchmark Query Performance

**Create benchmark script**: `scripts/benchmark-comment-count.ts`

```typescript
import Database from 'better-sqlite3';
import { listMemos } from '../packages/db/src/memoRepository.js';

const db = Database('./test-data/test.db');

// Warm up
for (let i = 0; i < 10; i++) {
  listMemos(db, {});
}

// Benchmark
const iterations = 1000;
const start = performance.now();
for (let i = 0; i < iterations; i++) {
  listMemos(db, {});
}
const end = performance.now();

console.log(`Average query time: ${(end - start) / iterations}ms`);
```

**Run**:
```bash
tsx scripts/benchmark-comment-count.ts
```

**Verify**: Query time increase is < 10% (per spec requirement SC-003).

## Common Issues

### Issue 1: Tests Fail with "commentCount is undefined"

**Cause**: Mapper function not updated or SQL query missing subquery

**Solution**: Verify all three changes in Step 1.1 are applied:
1. SELECT with subquery
2. FTS SELECT with subquery
3. Mapper function includes `commentCount: row.comment_count ?? 0`

### Issue 2: Zod Validation Error

**Cause**: Schema expects required field but database returns undefined

**Solution**: Check SQL query returns `comment_count` column (note: underscore in SQL, camelCase in TypeScript)

### Issue 3: Count Includes Deleted Comments

**Cause**: Missing `is_deleted = 0` in WHERE clause

**Solution**: Verify subquery includes: `WHERE c.issue_id = i.id AND c.is_deleted = 0`

## Verification Checklist

Before considering this feature complete:

- [ ] Database tests pass for memos with comment count
- [ ] Database tests pass for tasks with comment count
- [ ] API integration tests verify field presence
- [ ] API integration tests verify field accuracy
- [ ] Manual testing shows correct counts
- [ ] Performance benchmark shows < 10% degradation
- [ ] OpenAPI schemas include commentCount
- [ ] All existing tests still pass (no regressions)
- [ ] TypeScript compilation succeeds with no errors

## Next Steps

After implementation:

1. Run full test suite: `pnpm test`
2. Update Web UI to remove optional handling (separate task)
3. Create PR following project contribution guidelines
4. Update CHANGELOG.md with feature addition

## Reference Files

- **Spec**: `specs/012-https-github-com/spec.md`
- **Research**: `specs/012-https-github-com/research.md`
- **Data Model**: `specs/012-https-github-com/data-model.md`
- **Contracts**: `specs/012-https-github-com/contracts/`

## Support

If you encounter issues not covered in this guide, refer to:
- Project requirements: `docs/requirement.md`
- Database schema: `schema/001_init.sql`
- Existing implementations: `packages/db/src/*Repository.ts`
