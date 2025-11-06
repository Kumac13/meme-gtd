# Quick Start: Implementing Fuzzy Search

**Feature**: 025-a - Fuzzy Search for Tasks and Memos
**Date**: 2025-11-04

## Overview

This guide provides step-by-step instructions for implementing the fuzzy search feature. Follow the layers in order: Database → API → Frontend.

---

## Prerequisites

- ✅ FTS5 infrastructure already exists (no schema migration needed)
- ✅ TypeScript 5.5.4, Node.js 22+
- ✅ Familiarity with better-sqlite3, Fastify, React

---

## Layer 1: Database (packages/db)

### Step 1.1: Update taskRepository.ts

**File**: `packages/db/src/taskRepository.ts`

**Changes**:

1. Add `search` to `ListTaskFilters` interface:

```typescript
export interface ListTaskFilters {
  status?: TaskStatus;
  label?: string;
  labels?: string[];
  search?: string;  // ← ADD THIS
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
}
```

2. Modify `listTasks()` function (around line 133):

```typescript
export const listTasks = (db: Database.Database, filters: ListTaskFilters = {}): Task[] => {
  const searchConditions: string[] = [];
  const params: Record<string, any> = {};

  // Existing filters...
  searchConditions.push('i.type = \'task\'');
  searchConditions.push('i.is_deleted = 0');

  if (filters.status) {
    searchConditions.push('i.status = @status');
    params.status = filters.status;
  }

  // ... existing label filter logic ...

  // 🆕 NEW: Add FTS5 search condition
  let selectClause = 'SELECT i.*, (SELECT COUNT(*) FROM comments c WHERE c.issue_id = i.id AND c.is_deleted = 0) as comment_count';
  let fromClause = 'FROM issues i';

  if (filters.search) {
    // Add FTS5 join and snippet() for preview
    fromClause += ' JOIN issues_fts f ON f.issue_id = i.id';
    selectClause += ', snippet(issues_fts, 0, \'<mark>\', \'</mark>\', \'...\', 15) as preview';
    searchConditions.push('f.title MATCH @search');
    params.search = filters.search;
  }

  const whereClause = searchConditions.length > 0
    ? 'WHERE ' + searchConditions.join(' AND ')
    : '';

  const orderBy = filters.order === 'asc' ? 'ASC' : 'DESC';

  const sql = `${selectClause} ${fromClause} ${whereClause} ORDER BY i.id ${orderBy}`;

  return db.prepare(sql).all(params).map(taskRowToTask);
};
```

### Step 1.2: Update memoRepository.ts

**File**: `packages/db/src/memoRepository.ts`

**Changes** (similar pattern to tasks):

```typescript
export interface ListMemoFilters {
  label?: string;
  labels?: string[];
  search?: string;  // ← ADD THIS
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;
}

// In listMemos() function:
if (filters.search) {
  fromClause += ' JOIN issues_fts f ON f.issue_id = i.id';
  selectClause += ', snippet(issues_fts, 1, \'<mark>\', \'</mark>\', \'...\', 15) as preview';
  searchConditions.push('f.body_md MATCH @search');  // ← Note: body_md for memos
  params.search = filters.search;
}
```

**Key difference**: Memos search `body_md` (column index 1) instead of `title` (column index 0).

### Step 1.3: Add tests

**File**: `packages/db/test/taskRepository.test.ts`

```typescript
test('listTasks with search filter', () => {
  const db = setupTestDb();

  // Create test tasks
  createTask(db, { title: 'Implement login feature', bodyMd: '...' });
  createTask(db, { title: 'Fix authentication bug', bodyMd: '...' });
  createTask(db, { title: 'Add user settings', bodyMd: '...' });

  // Search by title
  const results = listTasks(db, { search: 'login' });

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].title, 'Implement login feature');
  assert.ok(results[0].preview); // Preview should be present
  assert.ok(results[0].preview.includes('<mark>login</mark>')); // Highlighted
});

test('listTasks with multi-word search', () => {
  const db = setupTestDb();

  createTask(db, { title: 'Implement OAuth login screen', bodyMd: '...' });
  createTask(db, { title: 'Update screen layout for login', bodyMd: '...' });
  createTask(db, { title: 'Add screen transitions', bodyMd: '...' });

  // Multi-word implicit AND
  const results = listTasks(db, { search: 'login screen' });

  assert.strictEqual(results.length, 2); // Both tasks have "login" AND "screen"
});
```

---

## Layer 2: API (packages/api)

### Step 2.1: Update Zod schemas

**File**: `packages/api/src/schemas/taskSchemas.ts`

```typescript
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  bookmarked: z.enum(['true', 'false']).optional(),
  label: z.string().optional(),
  search: z.string().optional(),  // ← ADD THIS
});
```

**File**: `packages/api/src/schemas/memoSchemas.ts`

```typescript
export const MemoQuerySchema = z.object({
  bookmarked: z.enum(['true', 'false']).optional(),
  label: z.string().optional(),
  search: z.string().optional(),  // ← ADD THIS
});
```

### Step 2.2: Update handlers

**File**: `packages/api/src/handlers/taskHandlers.ts`

```typescript
export const listTasksHandler: RouteHandler<{
  Querystring: TaskQuery;
}> = async (request, reply) => {
  const { status, bookmarked, label, search } = request.query;

  const tasks = taskService.listTasks({
    status,
    isBookmarked: bookmarked === 'true' ? true : bookmarked === 'false' ? false : undefined,
    label,
    search,  // ← ADD THIS
  });

  reply.send(tasks);
};
```

**File**: `packages/api/src/handlers/memoHandlers.ts` (similar changes)

### Step 2.3: Add integration tests

**File**: `packages/api/test/integration/tasks.test.ts`

```typescript
test('GET /api/tasks with search parameter', async () => {
  const app = await buildApp();

  // Create test data
  await request(app.server)
    .post('/api/tasks')
    .send({ title: 'Implement login feature', bodyMd: 'OAuth integration' });

  await request(app.server)
    .post('/api/tasks')
    .send({ title: 'Fix bug in authentication', bodyMd: 'Session handling' });

  // Search by title
  const response = await request(app.server)
    .get('/api/tasks?search=login')
    .expect(200);

  assert.strictEqual(response.body.length, 1);
  assert.strictEqual(response.body[0].title, 'Implement login feature');
  assert.ok(response.body[0].preview); // Preview field present
});

test('GET /api/tasks with combined filters and search', async () => {
  // Test search + status + label filters together
  const response = await request(app.server)
    .get('/api/tasks?status=open&label=bug&search=authentication')
    .expect(200);

  // Verify results match ALL filters
  response.body.forEach(task => {
    assert.strictEqual(task.status, 'open');
    assert.ok(task.labels.includes('bug'));
    assert.ok(task.title.toLowerCase().includes('authentication') ||
              task.preview?.toLowerCase().includes('authentication'));
  });
});
```

---

## Layer 3: Frontend (packages/web)

### Step 3.1: Extend query parser

**File**: `packages/web/src/utils/queryParser.ts`

```typescript
export interface ParsedSearchQuery {
  labels?: string[];
  status?: string;
  freeText?: string;  // ← ADD THIS
  rawQuery?: string;
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  if (!query || query.trim() === '') {
    return {};
  }

  const result: ParsedSearchQuery = {
    rawQuery: query,
  };

  // ... existing label/status parsing ...

  // 🆕 NEW: Extract free-text (remove all key:value patterns)
  const freeText = query
    .replace(/\w+:[^\s]+/g, '')  // Remove structured filters
    .trim();

  if (freeText) {
    result.freeText = freeText;
  }

  return result;
}
```

### Step 3.2: Update API services

**File**: `packages/web/src/api/services/TasksService.ts`

```typescript
export class TasksService {
  static async listTasks(
    status?: TaskStatus,
    bookmarked?: boolean,
    label?: string,
    search?: string  // ← ADD THIS
  ): Promise<Task[]> {
    const params = new URLSearchParams();

    if (status) params.append('status', status);
    if (bookmarked !== undefined) params.append('bookmarked', String(bookmarked));
    if (label) params.append('label', label);
    if (search) params.append('search', search);  // ← ADD THIS

    const response = await fetch(`/api/tasks?${params.toString()}`);
    return response.json();
  }
}
```

**File**: `packages/web/src/api/services/MemosService.ts` (similar changes)

### Step 3.3: Update list pages

**File**: `packages/web/src/pages/TasksList.tsx`

```typescript
export default function TasksList() {
  const [searchParams] = useSearchParams();
  const { filters } = useUrlFilters();

  useEffect(() => {
    async function fetchTasks() {
      const labelParam = filters.parsedQuery.labels?.join(',');
      const effectiveStatus = filters.parsedQuery.status || statusFilter;

      const response = await TasksService.listTasks(
        effectiveStatus,
        bookmarkFilter,
        labelParam,
        filters.parsedQuery.freeText  // ← ADD THIS
      );

      setTasks(response || []);
    }

    fetchTasks();
  }, [statusFilter, bookmarkFilter, filters.searchQuery]);  // ← Dependency on searchQuery

  // ... rest of component ...
}
```

### Step 3.4: Create SearchResults component

**File**: `packages/web/src/components/SearchResults.tsx` (NEW)

```tsx
import type { Task, Memo } from 'meme-gtd-shared';

export type LinkSearchResult = Task | Memo;

interface SearchResultsProps {
  results: LinkSearchResult[];
  onSelect: (issue: LinkSearchResult) => void;
  maxResults?: number;
  emptyMessage?: string;
}

export function SearchResults({
  results,
  onSelect,
  maxResults = 20,
  emptyMessage = "No results found"
}: SearchResultsProps) {
  const displayResults = results.slice(0, maxResults);
  const hasMore = results.length > maxResults;

  if (displayResults.length === 0) {
    return <div className="text-sm text-gray-500 py-2">{emptyMessage}</div>;
  }

  return (
    <div className="mt-2 border border-gray-200 rounded-md max-h-96 overflow-y-auto">
      <ul className="divide-y divide-gray-200">
        {displayResults.map(item => (
          <li
            key={item.id}
            onClick={() => onSelect(item)}
            className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{item.type}</span>
              <span className="text-xs text-gray-500">#{item.id}</span>
              <span className="text-sm font-medium">
                {item.title || '(no title)'}
              </span>
            </div>
            {item.preview && (
              <div
                className="text-xs text-gray-600 mt-1"
                dangerouslySetInnerHTML={{ __html: item.preview }}
              />
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
          More results available - refine your search
        </div>
      )}
    </div>
  );
}
```

### Step 3.5: Update AddLinkInline component

**File**: `packages/web/src/components/AddLinkInline.tsx`

Replace the ID input step with search UI:

```tsx
import SearchInput from './SearchInput';
import { SearchResults } from './SearchResults';

export default function AddLinkInline({
  sourceIssueId,
  onAdd,
  onCancel,
  creationState,
  setCreationState,
}: AddLinkInlineProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LinkSearchResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<LinkSearchResult | null>(null);

  // Debounced search
  const debouncedSearch = useDebouncedCallback(
    async (query: string) => {
      if (query.length < 3) {
        setSearchResults([]);
        return;
      }

      // Fetch from both tasks and memos
      const [tasks, memos] = await Promise.all([
        TasksService.listTasks(undefined, undefined, undefined, query),
        MemosService.listMemos(undefined, undefined, query),
      ]);

      setSearchResults([...tasks, ...memos]);
    },
    300
  );

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const handleSelectResult = (item: LinkSearchResult) => {
    setSelectedItem(item);
    // Proceed to link type selection...
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
      {!selectedItem ? (
        <>
          <div className="text-xs font-medium text-gray-700 mb-2">
            Search for item to link:
          </div>
          <SearchInput
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tasks or memos..."
            showStatusHint={false}
          />
          <SearchResults
            results={searchResults}
            onSelect={handleSelectResult}
            maxResults={20}
          />
        </>
      ) : (
        // Show link type selector...
      )}
    </div>
  );
}
```

---

## Testing Checklist

### Unit Tests

- [ ] `queryParser.parseSearchQuery()` extracts freeText correctly
- [ ] `taskRepository.listTasks()` with search parameter
- [ ] `memoRepository.listMemos()` with search parameter
- [ ] Multi-word search returns correct results
- [ ] Search with special characters (e.g., `@`, `#`)

### Integration Tests

- [ ] `GET /api/tasks?search=login` returns correct results
- [ ] `GET /api/memos?search=quarterly` returns correct results
- [ ] Combined filters: `?status=open&label=bug&search=auth`
- [ ] Preview field is present when search is active
- [ ] Preview field is absent when no search parameter

### Component Tests

- [ ] SearchResults displays results correctly
- [ ] SearchResults handles empty state
- [ ] SearchResults shows "More results available" when > 20 items
- [ ] AddLinkInline triggers search on input
- [ ] AddLinkInline creates link on result selection

### E2E Tests (Optional)

- [ ] User can search tasks from Tasks page
- [ ] User can search memos from Memos page
- [ ] User can create link using search UI
- [ ] Preview text highlights search terms

---

## Troubleshooting

### Issue: Search returns no results

**Check**:
1. FTS5 table is populated: `SELECT COUNT(*) FROM issues_fts;`
2. Triggers are active: Check schema for `CREATE TRIGGER` statements
3. Search term is tokenized correctly: Try simple single-word search first

### Issue: Preview field is missing

**Check**:
1. `snippet()` function in SELECT clause (only when `filters.search` is present)
2. Column index is correct: 0 for title, 1 for body_md
3. FTS5 join is present: `JOIN issues_fts f ON f.issue_id = i.id`

### Issue: Performance is slow

**Check**:
1. FTS5 index exists: `.schema issues_fts`
2. Query plan uses index: `EXPLAIN QUERY PLAN SELECT ... WHERE f.title MATCH 'term';`
3. Database file size is reasonable (<100MB for 10K rows)

---

## Next Steps

After implementing:

1. Run full test suite: `pnpm test`
2. Test in development environment: `pnpm server:dev`
3. Verify OpenAPI docs are updated: `pnpm openapi:generate`
4. Create pull request with reference to spec: `specs/025-a/spec.md`

---

## Reference Links

- [FTS5 Documentation](https://www.sqlite.org/fts5.html)
- [FTS5 snippet() function](https://www.sqlite.org/fts5.html#the_snippet_function)
- [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
