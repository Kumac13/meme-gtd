# Developer Quickstart: Label and Status Search

**Feature**: 024-tasks-memos-label
**Date**: 2025-11-04
**For**: Developers implementing this feature

## Overview

This quickstart guide provides a practical walkthrough for implementing label and status filtering across Web UI, REST API, and CLI. Follow these steps in order for a smooth implementation.

---

## Prerequisites

- [x] Branch `024-tasks-memos-label` checked out
- [x] Dependencies installed: `pnpm install`
- [x] Test database seeded: `pnpm mgtd:test init -d $PWD/test-data/test.db -f`
- [x] API server running on port 3001: `pnpm server:dev`

---

## Implementation Order

**Recommended order** (bottom-up, starting with shared foundation):

1. **Database Layer** → 2. **Core Services** → 3. **API** → 4. **CLI** → 5. **Web UI**

This order minimizes dependencies and allows incremental testing.

---

## Phase 1: Database Layer (Estimated: 1-2 hours)

### Task 1.1: Extend Filter Interfaces

**File**: `packages/db/src/taskRepository.ts`

```typescript
// Before
export interface ListTaskFilters {
  status?: TaskStatus;
  label?: string;        // Single label only
  search?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
}

// After (⭐ ADD labels field)
export interface ListTaskFilters {
  status?: TaskStatus;
  labels?: string[];     // ⭐ NEW: Multiple labels (OR logic)
  label?: string;        // ⚠️ KEEP for backward compatibility
  search?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
}
```

**File**: `packages/db/src/memoRepository.ts`

```typescript
// Same change for ListMemoFilters (no status field)
export interface ListMemoFilters {
  labels?: string[];     // ⭐ NEW
  label?: string;        // ⚠️ KEEP for backward compatibility
  search?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
}
```

### Task 1.2: Update Query Builder

**File**: `packages/db/src/taskRepository.ts` (listTasks function, ~line 105)

```typescript
export function listTasks(db: Database, filters: ListTaskFilters = {}): Task[] {
  const conditions: string[] = ["type = 'task'", "is_deleted = 0"];
  const params: Record<string, any> = {};

  // ... existing status filter ...

  // ⭐ MODIFY: Support both label (single) and labels (array)
  const labelFilter = filters.labels || (filters.label ? [filters.label] : undefined);
  if (labelFilter && labelFilter.length > 0) {
    // Build IN clause with parameterized placeholders
    const placeholders = labelFilter.map((_, i) => `@label${i}`).join(', ');
    conditions.push(
      `id IN (
        SELECT issue_id FROM issue_labels il
        JOIN labels l ON l.id = il.label_id
        WHERE l.name IN (${placeholders}) COLLATE NOCASE
      )`
    );
    labelFilter.forEach((label, i) => {
      params[`label${i}`] = label;
    });
  }

  // ... rest of function (bookmark, search, order, limit) ...
}
```

**File**: `packages/db/src/memoRepository.ts` (listMemos function, ~line 84)

```typescript
// Same logic for memos (no status filter)
export function listMemos(db: Database, filters: ListMemoFilters = {}): Memo[] {
  const conditions: string[] = ["type = 'memo'", "is_deleted = 0"];
  const params: Record<string, any> = {};

  // ⭐ ADD: Same label filtering logic as tasks
  const labelFilter = filters.labels || (filters.label ? [filters.label] : undefined);
  if (labelFilter && labelFilter.length > 0) {
    const placeholders = labelFilter.map((_, i) => `@label${i}`).join(', ');
    conditions.push(
      `id IN (
        SELECT issue_id FROM issue_labels il
        JOIN labels l ON l.id = il.label_id
        WHERE l.name IN (${placeholders}) COLLATE NOCASE
      )`
    );
    labelFilter.forEach((label, i) => {
      params[`label${i}`] = label;
    });
  }

  // ... rest of function ...
}
```

### Task 1.3: Add Unit Tests

**File**: `packages/db/test/taskRepository.test.ts`

```typescript
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { listTasks } from '../src/taskRepository.js';
import { createTestDatabase, seedLabels, seedTasks } from './testHelpers.js';

describe('listTasks with multiple label filter', () => {
  it('filters by single label (backward compatible)', () => {
    const db = createTestDatabase();
    seedLabels(db, ['bug', 'enhancement']);
    seedTasks(db, [
      { id: 1, title: 'Task 1', labels: ['bug'] },
      { id: 2, title: 'Task 2', labels: ['enhancement'] },
    ]);

    const tasks = listTasks(db, { label: 'bug' });
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, 'Task 1');
  });

  it('filters by multiple labels (OR logic)', () => {
    const db = createTestDatabase();
    seedLabels(db, ['bug', 'enhancement', 'documentation']);
    seedTasks(db, [
      { id: 1, title: 'Task 1', labels: ['bug'] },
      { id: 2, title: 'Task 2', labels: ['enhancement'] },
      { id: 3, title: 'Task 3', labels: ['documentation'] },
    ]);

    const tasks = listTasks(db, { labels: ['bug', 'enhancement'] });
    assert.strictEqual(tasks.length, 2);
    assert.ok(tasks.some(t => t.title === 'Task 1'));
    assert.ok(tasks.some(t => t.title === 'Task 2'));
  });

  it('case-insensitive label matching', () => {
    const db = createTestDatabase();
    seedLabels(db, ['Bug', 'ENHANCEMENT']);
    seedTasks(db, [
      { id: 1, title: 'Task 1', labels: ['Bug'] },
      { id: 2, title: 'Task 2', labels: ['ENHANCEMENT'] },
    ]);

    const tasks = listTasks(db, { labels: ['bug', 'enhancement'] });
    assert.strictEqual(tasks.length, 2);
  });

  it('combines label and status filters (AND logic)', () => {
    const db = createTestDatabase();
    seedLabels(db, ['bug']);
    seedTasks(db, [
      { id: 1, title: 'Open Bug', labels: ['bug'], status: 'open' },
      { id: 2, title: 'Done Bug', labels: ['bug'], status: 'done' },
    ]);

    const tasks = listTasks(db, { labels: ['bug'], status: 'open' });
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].title, 'Open Bug');
  });
});
```

**Run tests**:
```bash
cd packages/db
pnpm test
```

---

## Phase 2: Core Services (Estimated: 30 minutes)

### Task 2.1: Verify Pass-Through Logic

**Files to check**:
- `packages/core/src/TaskService.ts`
- `packages/core/src/MemoService.ts`

**What to verify**:
```typescript
// Should already work (just passes filters through to repository)
public list(filters: ListTaskFilters = {}) {
  const tasks = listTasks(this.db, filters);
  return tasks.map(task => ({
    ...task,
    labels: listTaskLabels(this.db, task.id)
  }));
}
```

**No changes needed** - Service layer already passes filters through to repository layer.

---

## Phase 3: REST API (Estimated: 2-3 hours)

### Task 3.1: Update Zod Schemas

**File**: `packages/api/src/schemas/taskSchemas.ts` (~line 84)

```typescript
// Before
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional().describe('Filter by task status'),
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
});

// After (⭐ ADD label field)
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional().describe('Filter by task status'),
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
  label: z.string().optional().describe('Filter by label (comma-separated for multiple)'),  // ⭐ NEW
});
```

**File**: `packages/api/src/schemas/memoSchemas.ts` (~line 91)

```typescript
// Before
export const MemoQuerySchema = z.object({
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
});

// After (⭐ ADD label field)
export const MemoQuerySchema = z.object({
  bookmarked: z.enum(['true', 'false']).optional().describe('Filter by bookmark status'),
  label: z.string().optional().describe('Filter by label (comma-separated for multiple)'),  // ⭐ NEW
});
```

### Task 3.2: Update Handlers

**File**: `packages/api/src/handlers/taskHandlers.ts` (~line 36)

```typescript
export async function listTasksHandler(
  request: FastifyRequest<{
    Querystring: { status?: string; bookmarked?: string; label?: string };  // ⭐ ADD label
  }>,
  reply: FastifyReply
) {
  const taskService = new TaskService({ db: request.server.db });
  const { status, bookmarked, label } = request.query;  // ⭐ DESTRUCTURE label

  const filters: any = {};
  if (status) {
    filters.status = status;
  }
  if (bookmarked === 'true') {
    filters.isBookmarked = true;
  }
  // ⭐ NEW: Parse comma-separated labels
  if (label) {
    filters.labels = label.split(',').map(l => l.trim()).filter(Boolean);
  }

  try {
    const tasks = taskService.list(filters);
    return reply.status(200).send(tasks);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}
```

**File**: `packages/api/src/handlers/memoHandlers.ts` (~line 32)

```typescript
export async function listMemosHandler(
  request: FastifyRequest<{
    Querystring: { bookmarked?: string; label?: string };  // ⭐ ADD label
  }>,
  reply: FastifyReply
) {
  const memoService = new MemoService({ db: request.server.db });
  const { bookmarked, label } = request.query;  // ⭐ DESTRUCTURE label

  const filters: any = {};
  if (bookmarked === 'true') {
    filters.isBookmarked = true;
  }
  // ⭐ NEW: Parse comma-separated labels
  if (label) {
    filters.labels = label.split(',').map(l => l.trim()).filter(Boolean);
  }

  try {
    const memos = memoService.list(filters);
    return reply.status(200).send(memos);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error' });
  }
}
```

### Task 3.3: Add API Tests

**File**: `packages/api/test/routes/tasks.test.ts`

```typescript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { buildTestServer } from '../testHelpers.js';

describe('GET /api/tasks with label filter', () => {
  let server;

  beforeEach(async () => {
    server = await buildTestServer();
    // Seed test data
    await server.db.exec("INSERT INTO labels (name) VALUES ('bug'), ('enhancement')");
    await server.db.exec("INSERT INTO issues (type, title, body_md, status) VALUES ('task', 'Fix bug', 'Details', 'open')");
    // ... attach labels ...
  });

  it('filters by single label', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tasks?label=bug',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.ok(tasks.every(t => t.labels.some(l => l.name === 'bug')));
  });

  it('filters by multiple labels (comma-separated)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tasks?label=bug,enhancement',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.ok(tasks.every(t =>
      t.labels.some(l => l.name === 'bug' || l.name === 'enhancement')
    ));
  });

  it('combines label and status filters', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tasks?label=bug&status=open',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.ok(tasks.every(t =>
      t.status === 'open' && t.labels.some(l => l.name === 'bug')
    ));
  });

  it('returns empty array for non-existent label', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/tasks?label=nonexistent',
    });

    assert.strictEqual(response.statusCode, 200);
    const tasks = JSON.parse(response.body);
    assert.strictEqual(tasks.length, 0);
  });
});
```

**Run tests**:
```bash
cd packages/api
pnpm test
```

### Task 3.4: Update OpenAPI Spec

**File**: `packages/api/docs/api/openapi.yaml`

See `contracts/api-updates.yaml` for full specification.

**Generate updated spec**:
```bash
cd packages/api
pnpm openapi:generate
```

---

## Phase 4: CLI (Estimated: 2 hours)

### Task 4.1: Update Commands

**File**: `packages/cli/src/commands/task/list.ts` (~line 59)

```typescript
async run() {
  const { flags } = await this.parse(TaskListCommand);

  const filters: ListTaskFilters = {};

  if (flags.status) {
    filters.status = flags.status as TaskStatus;
  }

  // ⭐ MODIFY: Parse comma-separated labels
  if (flags.label) {
    const labelArray = flags.label.split(',').map(l => l.trim()).filter(Boolean);
    filters.labels = labelArray;
  }

  if (flags.search) {
    filters.search = flags.search;
  }

  if (flags.limit) {
    filters.limit = flags.limit;
  }

  if (flags.order) {
    filters.order = flags.order as 'asc' | 'desc';
  }

  if (flags.bookmarked) {
    filters.isBookmarked = true;
  }

  const taskService = new TaskService({ db: this.db });
  const tasks = taskService.list(filters);

  if (flags.json) {
    this.log(JSON.stringify(tasks, null, 2));
  } else {
    this.printTasks(tasks);
  }
}
```

**File**: `packages/cli/src/commands/memo/list.ts` (~line 54)

```typescript
// Same logic for memos (no status filter)
async run() {
  const { flags } = await this.parse(MemoListCommand);

  const filters: ListMemoFilters = {};

  // ⭐ MODIFY: Parse comma-separated labels
  if (flags.label) {
    const labelArray = flags.label.split(',').map(l => l.trim()).filter(Boolean);
    filters.labels = labelArray;
  }

  // ... rest of filters ...

  const memoService = new MemoService({ db: this.db });
  const memos = memoService.list(filters);

  if (flags.json) {
    this.log(JSON.stringify(memos, null, 2));
  } else {
    this.printMemos(memos);
  }
}
```

### Task 4.2: Update Help Text

**File**: `packages/cli/src/commands/task/list.ts` (~line 20)

```typescript
static flags = {
  label: Flags.string({
    char: 'l',
    summary: 'Filter by label name(s)',
    description: 'Filter tasks by label. Supports comma-separated values for OR logic (e.g., bug,enhancement)',  // ⭐ UPDATE
  }),
  // ... other flags ...
}
```

**File**: `packages/cli/src/commands/memo/list.ts` (~line 18)

```typescript
// Same update for memo command
```

### Task 4.3: Add CLI Tests

See `contracts/cli-flags.md` for complete test specifications.

**Run tests**:
```bash
cd packages/cli
pnpm test
```

---

## Phase 5: Web UI (Estimated: 4-6 hours)

### Task 5.1: Create Query Parser

**File**: `packages/web/src/utils/queryParser.ts` (NEW)

```typescript
export interface ParsedSearchQuery {
  labels?: string[];
  status?: string;
  rawQuery?: string;
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  if (!query || query.trim() === '') {
    return { rawQuery: query };
  }

  const result: ParsedSearchQuery = { rawQuery: query };

  // Pattern: key:value or key:"quoted value"
  const regex = /(\w+):(?:"([^"]+)"|([^:\s]+))/g;
  let match;

  while ((match = regex.exec(query)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2] || match[3];

    if (key === 'label') {
      result.labels = value.split(',').map(v => v.trim()).filter(Boolean);
    } else if (key === 'status') {
      result.status = value.trim();
    }
  }

  return result;
}

export function serializeFilters(filters: ParsedSearchQuery): string {
  const parts: string[] = [];

  if (filters.labels && filters.labels.length > 0) {
    parts.push(`label:${filters.labels.join(',')}`);
  }

  if (filters.status) {
    parts.push(`status:${filters.status}`);
  }

  return parts.join(' ');
}
```

### Task 5.2: Create useUrlFilters Hook

**File**: `packages/web/src/hooks/useUrlFilters.ts` (NEW)

```typescript
import { useSearchParams } from 'react-router-dom';
import { parseSearchQuery, serializeFilters, type ParsedSearchQuery } from '../utils/queryParser';

export function useUrlFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const rawQuery = searchParams.get('q') || '';
  const filters = parseSearchQuery(rawQuery);

  const updateFilters = (newFilters: ParsedSearchQuery) => {
    const serialized = serializeFilters(newFilters);
    setSearchParams(serialized ? { q: serialized } : {});
  };

  return { filters, updateFilters, rawQuery };
}
```

### Task 5.3: Create SearchInput Component

**File**: `packages/web/src/components/SearchInput.tsx` (NEW)

```tsx
import React, { useState, useEffect } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder }: SearchInputProps) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(inputValue);
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeout);
  }, [inputValue, onChange]);

  return (
    <div className="search-input">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder || 'Search (e.g., label:bug status:open)'}
        className="w-full px-4 py-2 border rounded"
      />
      {inputValue && (
        <button
          onClick={() => setInputValue('')}
          className="absolute right-2 top-2"
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

### Task 5.4: Update Pages

**File**: `packages/web/src/pages/TasksPage.tsx`

```tsx
import { SearchInput } from '../components/SearchInput';
import { useUrlFilters } from '../hooks/useUrlFilters';

export function TasksPage() {
  const { filters, updateFilters, rawQuery } = useUrlFilters();

  // Fetch tasks with filters
  const tasksQuery = useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.labels) params.set('label', filters.labels.join(','));
      if (filters.status) params.set('status', filters.status);
      const response = await fetch(`/api/tasks?${params}`);
      return response.json();
    },
  });

  return (
    <div>
      <SearchInput
        value={rawQuery}
        onChange={(query) => updateFilters(parseSearchQuery(query))}
        placeholder="Filter tasks (e.g., label:bug status:open)"
      />
      {/* ... render tasks ... */}
    </div>
  );
}
```

**File**: `packages/web/src/pages/MemosPage.tsx` (similar changes)

### Task 5.5: Add Tests

**File**: `packages/web/test/utils/queryParser.test.ts`

```typescript
import { describe, it } from 'vitest';
import { expect } from 'vitest';
import { parseSearchQuery, serializeFilters } from '../../src/utils/queryParser';

describe('queryParser', () => {
  it('parses single label', () => {
    const result = parseSearchQuery('label:bug');
    expect(result.labels).toEqual(['bug']);
  });

  it('parses multiple labels', () => {
    const result = parseSearchQuery('label:bug,enhancement');
    expect(result.labels).toEqual(['bug', 'enhancement']);
  });

  it('parses combined filters', () => {
    const result = parseSearchQuery('label:bug status:open');
    expect(result.labels).toEqual(['bug']);
    expect(result.status).toBe('open');
  });

  it('round-trips serialize/parse', () => {
    const original = { labels: ['bug', 'enhancement'], status: 'open' };
    const serialized = serializeFilters(original);
    const parsed = parseSearchQuery(serialized);
    expect(parsed.labels).toEqual(original.labels);
    expect(parsed.status).toBe(original.status);
  });
});
```

**Run tests**:
```bash
cd packages/web
pnpm test
```

---

## Testing Checklist

### Manual Testing

```bash
# 1. Start test environment
pnpm server:dev  # Terminal 1 (API on port 3001)

# 2. Test API directly
curl http://localhost:3001/api/tasks?label=bug
curl http://localhost:3001/api/tasks?label=bug,enhancement
curl "http://localhost:3001/api/tasks?label=bug&status=open"

# 3. Test CLI
pnpm mgtd:test task list --label bug
pnpm mgtd:test task list --label bug,enhancement
pnpm mgtd:test task list --label bug --status open

# 4. Test Web UI
# Open http://localhost:3001
# Type in search: label:bug
# Try: label:bug,enhancement
# Try: label:bug status:open
```

### Automated Testing

```bash
# Run all tests
pnpm test

# Or run package-by-package
cd packages/db && pnpm test
cd packages/api && pnpm test
cd packages/cli && pnpm test
cd packages/web && pnpm test
```

---

## Common Pitfalls

### 1. Forgetting to Filter Empty Strings

```typescript
// ❌ WRONG: Empty strings cause issues
filters.labels = label.split(',').map(l => l.trim());

// ✅ CORRECT: Filter out empty strings
filters.labels = label.split(',').map(l => l.trim()).filter(Boolean);
```

### 2. Not Handling Backward Compatibility

```typescript
// ✅ CORRECT: Support both label and labels
const labelFilter = filters.labels || (filters.label ? [filters.label] : undefined);
```

### 3. SQL Injection Vulnerability

```typescript
// ❌ WRONG: String interpolation (SQL injection risk)
const sql = `WHERE l.name IN (${labels.join(',')})`;

// ✅ CORRECT: Parameterized queries
const placeholders = labels.map((_, i) => `@label${i}`).join(', ');
const sql = `WHERE l.name IN (${placeholders})`;
labels.forEach((label, i) => params[`label${i}`] = label);
```

### 4. Missing URL Encoding

```typescript
// ❌ WRONG: Label with spaces breaks URL
fetch(`/api/tasks?label=needs review`);

// ✅ CORRECT: URLSearchParams handles encoding
const params = new URLSearchParams({ label: 'needs review' });
fetch(`/api/tasks?${params}`);
```

---

## Performance Optimization Tips

1. **Database Indexes**: Verify existing indexes are used (check with EXPLAIN QUERY PLAN)
2. **Debounce Search Input**: Already implemented (300ms delay)
3. **Memoize Query Results**: Use React Query for caching
4. **Limit Result Sets**: Add `limit` parameter to prevent large responses

---

## Debugging Commands

```bash
# Check database queries
sqlite3 test-data/test.db "EXPLAIN QUERY PLAN SELECT * FROM issues WHERE id IN (SELECT issue_id FROM issue_labels il JOIN labels l ON l.id = il.label_id WHERE l.name IN ('bug'))"

# Watch API logs
pnpm server:dev  # Shows all requests

# Debug CLI with test database
DB_PATH=$PWD/test-data/test.db MGTD_CONFIG_PATH=$PWD/test-data/context.json node --inspect packages/cli/dist/index.js task list --label bug
```

---

## Next Steps

After completing implementation:
1. Run full test suite: `pnpm test`
2. Update documentation: `docs/cli-commands.md`, `docs/api-filtering.md`
3. Generate updated OpenAPI spec: `cd packages/api && pnpm openapi:generate`
4. Run `/speckit.tasks` to generate tasks.md for tracking
5. Proceed with implementation following tasks.md

---

## Questions?

Refer back to:
- `spec.md` - Feature requirements
- `research.md` - Technical decisions
- `data-model.md` - Data structures
- `contracts/` - API/CLI specifications
