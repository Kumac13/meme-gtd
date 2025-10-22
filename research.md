# meme-gtd Test Patterns Research

## 1. Test Organization Structure

### Directory Layout
- **Per-package tests**: Each package has its own `test/` directory
  - `packages/core/test/`
  - `packages/db/test/`
  - `packages/api/test/`
  - `packages/cli/test/`

### Test File Naming Conventions
- Naming pattern: `{module}.test.ts`
- Examples:
  - `packages/core/test/memoService.test.ts`
  - `packages/core/test/taskService.test.ts`
  - `packages/db/test/memoRepository.test.ts`
  - `packages/api/test/integration/memos.test.ts`

### API Integration Tests Structure
- Nested organization: `packages/api/test/integration/`
- Grouped by feature:
  - `memos.test.ts` (memo CRUD operations)
  - `tasks.test.ts` (task CRUD operations)
  - `comments.test.ts` (comment operations)
  - `labels.test.ts` (label operations)
  - `links.test.ts` (link operations)
  - `errors.test.ts` (error handling)
  - `logging.test.ts` (logging behavior)
  - `cors.test.ts` (CORS configuration)
  - `server-config.test.ts` (server setup)
  - `swagger.test.ts` (API documentation)

## 2. Test Framework

### Node.js Built-in Test Module
- **Framework**: `node:test` (Node.js native testing)
- **Assertions**: `node:assert/strict`
- **Node version required**: >= 22.0.0 (from package.json)

### Test Imports Pattern
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

// OR for grouped tests (describe/it style):
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
```

### Package.json Test Scripts
**packages/core/package.json:**
```json
"test": "node --import tsx/esm --test test/*.test.ts"
```

**packages/db/package.json:**
```json
"test": "node --import tsx/esm --test test/*.test.ts"
```

**packages/api/package.json:**
```json
"test": "tsx --test test/**/*.test.ts",
"test:watch": "tsx --test --watch test/**/*.test.ts"
```

### Supporting Tools
- **TypeScript execution**: `tsx` (for `node:test` with TypeScript)
- **Not used**: vitest, jest, mocha (these are installed as devDependencies but not used for tests)

## 3. Integration Tests vs Unit Tests

### Integration Tests (API Layer)
**File**: `/packages/api/test/integration/memos.test.ts`

**Characteristics:**
- Use `describe()` and `it()` for test grouping
- Use `beforeEach()` and `afterEach()` for test lifecycle
- Test entire HTTP endpoints via Fastify's `app.inject()`
- Focus on end-to-end request/response behavior
- Test HTTP status codes, JSON responses, and full workflows

**Example Structure:**
```typescript
describe('Memo CRUD Operations', () => {
  let app: FastifyInstance;
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const testServer = await createTestServer();
    app = testServer.app;
    cleanup = testServer.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should create a new memo (POST /api/memos)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/memos',
      payload: memoData,
    });
    assert.strictEqual(response.statusCode, 201);
  });
});
```

### Unit/Service Tests (Core/DB Layer)
**Files**:
- `/packages/core/test/memoService.test.ts`
- `/packages/core/test/taskService.test.ts`
- `/packages/db/test/memoRepository.test.ts`

**Characteristics:**
- Use `test()` for individual test functions
- No test grouping (flat structure)
- Focus on individual service/repository methods
- Test business logic and data persistence
- Often async due to config/database setup

**Example Structure:**
```typescript
import test from 'node:test';
import assert from 'node:assert/strict';

test('MemoService create and list', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  const service = new MemoService({ config });
  const memo = service.create({ bodyMd: 'core memo' });
  assert.equal(list.length, 1);
  fs.removeSync(dir);
});
```

## 4. Database Testing Patterns

### Test Database Setup
**Helper Function Pattern** (`packages/db/test/memoRepository.test.ts`):
```typescript
const createTempDb = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-dbtest-'));
  const dbPath = path.join(dir, 'issues.db');
  applyMigrations(dbPath);  // Initialize with schema
  const db = openDatabase({ dbPath });
  return { dir, db, dbPath };
};
```

### Service Layer Setup Pattern
**Helper Function** (`packages/core/test/memoService.test.ts`):
```typescript
const setupConfig = async (dir: string) => {
  const dbPath = path.join(dir, 'issues.db');
  const configPath = path.join(dir, 'context.json');
  applyMigrations(dbPath);  // Apply database migrations
  await writeConfig({
    dbPath,
    mode: 'local',
    schemaVersion: '001_init',
    updatedAt: new Date().toISOString()
  }, configPath);
  return { dbPath, configPath };
};
```

### Test Server Setup Pattern (API)
**File**: `/packages/api/test/helpers/testServer.ts`

**Key Features:**
- Creates temporary directory for test database
- Initializes database with schema
- Builds Fastify app with test configuration
- Supports log capture for testing logging behavior
- Provides cleanup function for resource management

```typescript
export async function createTestServer(
  options: TestServerOptions = {}
): Promise<{ app: FastifyInstance; cleanup: () => Promise<void>; logs?: LogMessage[] }> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mgtd-api-test-'));
  const dbPath = join(tmpDir, 'test.db');
  
  const config: MgtdConfig = {
    dbPath,
    mode: 'local',
    schemaVersion: '001_init',
  };
  
  const db = ensureDatabase(config);
  db.close();
  
  // Build Fastify app with test config
  const app = await buildApp({
    config,
    corsAllowedOrigins: options.corsAllowedOrigins ?? ['*'],
    logger: logStream ? { level: 'info', stream: logStream } : { level: 'error' }
  });
  
  const cleanup = async () => {
    await app.close();
  };
  
  return { app, cleanup, logs };
}
```

### Cleanup Pattern
**Common Approach:**
1. Use `mkdtempSync()` from `node:fs` to create temporary directory
2. Call `applyMigrations(dbPath)` to initialize fresh database
3. Run tests against isolated database
4. Use `fs.removeSync(dir)` to clean up after each test
5. Manually manage environment variables for config path

**Environment Variables in Tests:**
```typescript
process.env.MGTD_CONFIG_PATH = configPath;
// ... run test ...
delete process.env.MGTD_CONFIG_PATH;  // Clean up
```

## 5. Service Layer Testing Examples

### MemoService Tests
**File**: `/packages/core/test/memoService.test.ts`

Tests covered:
- `create()` - Create memo with labels
- `promote()` - Promote memo to task
- List operations
- Label management

**Pattern:**
```typescript
test('MemoService create and list', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mgtd-core-'));
  const { configPath } = await setupConfig(dir);
  process.env.MGTD_CONFIG_PATH = configPath;
  const { config } = await loadConfig({ configPath });
  const service = new MemoService({ config });
  
  const memo = service.create({ bodyMd: 'core memo', labels: ['core'] });
  const list = service.list({ label: 'core' });
  
  assert.equal(list.length, 1);
  assert.equal(list[0].id, memo.id);
  
  delete process.env.MGTD_CONFIG_PATH;
  fs.removeSync(dir);
});
```

### TaskService Tests
**File**: `/packages/core/test/taskService.test.ts`

Tests covered:
- CRUD operations (create, show, edit, remove)
- Status management (close, cancel, reopen)
- Comment operations (add, list, update, delete)
- Label operations (listLabels, setLabels)
- Bookmark operations (setBookmark)

**Pattern for Status Changes:**
```typescript
test('TaskService close', async () => {
  const service = new TaskService({ config });
  const task = service.create({ title: 'Close Test', bodyMd: 'Body' });
  const closed = service.close(task.id);
  assert.equal(closed.status, 'done');
  fs.removeSync(dir);
});
```

**Pattern for Related Operations:**
```typescript
test('TaskService close with comment', async () => {
  const service = new TaskService({ config });
  const task = service.create({ title: 'Close Test', bodyMd: 'Body' });
  service.close(task.id, 'Completed successfully');
  const comments = service.listComments(task.id);
  assert.equal(comments.length, 1);
  assert.equal(comments[0].bodyMd, 'Completed successfully');
});
```

### LinkService Tests
**File**: `/packages/core/test/linkService.test.ts`

Tests covered:
- Link creation with validation (self-reference, existence checks, duplicates)
- Multiple link types (parent, child, relates, derived_from)
- Link listing with filtering
- Link removal

**Pattern for Error Testing:**
```typescript
test('LinkService.create() validates self-reference', () => {
  const { config, cleanup } = createTempConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });
  const task = taskService.create({ title: 'Task', bodyMd: '' });

  assert.throws(() => {
    linkService.create(task.id, task.id, 'parent');
  }, /Cannot link issue to itself \(ID: \d+\)/);

  cleanup();
});
```

## 6. CLI Command Testing Examples

### Editor Utility Tests
**File**: `/packages/cli/test/lib/editor.test.ts`

**Pattern:**
```typescript
describe('maybePromptEditor', () => {
  it('should throw error when both editor and noEditor are true', async () => {
    const options: EditorOptions = {
      editor: true,
      noEditor: true,
      initialContent: 'test'
    };

    await assert.rejects(
      async () => await maybePromptEditor(options),
      /Cannot specify both --editor and --no-editor/
    );
  });
});
```

### Legacy Flag Detection Tests
**File**: `/packages/cli/test/lib/legacy-flags.test.ts`

**Pattern:**
```typescript
describe('detectLegacyFlags', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv.slice();
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should detect --bodyFile flag', () => {
    process.argv = ['node', 'script.js', '--bodyFile', 'test.md'];
    const mappings = { '--bodyFile': '--body-file' };
    const result = detectLegacyFlags(mappings);
    assert.strictEqual(result.detected, true);
  });
});
```

## 7. Error Assertion Patterns

### Direct Assertions
```typescript
// Equality
assert.equal(list.length, 1);
assert.strictEqual(response.statusCode, 201);

// Deep equality
assert.deepEqual(labels, ['idea']);
assert.deepEqual(listMemoLabels(db, memo.id), ['idea']);

// Truthiness
assert.ok(result.taskId > 0);
assert.ok(memo.id);
```

### Error Testing
```typescript
// Async error testing
await assert.rejects(
  async () => await maybePromptEditor(options),
  /Cannot specify both --editor and --no-editor/
);

// Synchronous error testing
assert.throws(() => {
  linkService.create(task.id, task.id, 'parent');
}, /Cannot link issue to itself \(ID: \d+\)/);
```

## 8. Test Fixtures and Helpers

### Fixture Helper File
**File**: `/packages/api/test/helpers/fixtures.ts`

**Purpose**: Standardize test data creation

```typescript
export function createMemoFixture(overrides?: Partial<CreateMemoInput>): CreateMemoInput {
  return {
    bodyMd: 'Test memo body',
    ...overrides,
  };
}

export function createTaskFixture(overrides?: Partial<CreateTaskInput>): CreateTaskInput {
  return {
    title: 'Test task title',
    bodyMd: 'Test task body',
    status: 'open',
    ...overrides,
  };
}

// Batch creation helpers
export function createMemoFixtures(count: number): CreateMemoInput[] {
  return Array.from({ length: count }, (_, i) => ({
    bodyMd: `Test memo ${i + 1}`,
  }));
}
```

### Usage in Tests
```typescript
// In integration tests
const memoData = createMemoFixture({ bodyMd: 'Test memo content' });
const response = await app.inject({
  method: 'POST',
  url: '/api/memos',
  payload: memoData,
});
```

## 9. API Integration Test Patterns

### HTTP Testing via Fastify Inject
**File**: `/packages/api/test/integration/memos.test.ts`

```typescript
// POST request with payload
const response = await app.inject({
  method: 'POST',
  url: '/api/memos',
  payload: createMemoFixture({ bodyMd: 'Test memo content' }),
});

assert.strictEqual(response.statusCode, 201);
const memo = JSON.parse(response.body);
assert.strictEqual(memo.type, 'memo');
assert.strictEqual(memo.bodyMd, 'Test memo content');
```

### Testing Complex Workflows
```typescript
// Create -> Modify -> Verify
const createResponse = await app.inject({
  method: 'POST',
  url: '/api/memos',
  payload: createMemoFixture({ bodyMd: 'Original content' }),
});
const memo = JSON.parse(createResponse.body);

const response = await app.inject({
  method: 'PATCH',
  url: `/api/memos/${memo.id}`,
  payload: { bodyMd: 'Updated content' },
});

assert.strictEqual(response.statusCode, 200);
const updated = JSON.parse(response.body);
assert.strictEqual(updated.bodyMd, 'Updated content');
```

### Testing Query Parameters
```typescript
const response = await app.inject({
  method: 'GET',
  url: '/api/memos?bookmarked=true',
});

assert.strictEqual(response.statusCode, 200);
const memos = JSON.parse(response.body);
assert.strictEqual(memos.length, 1);
assert.strictEqual(memos[0].isBookmarked, true);
```

### Testing Error Responses
```typescript
const response = await app.inject({
  method: 'POST',
  url: '/api/memos',
  payload: { bodyMd: '' },  // Invalid: empty body
});

assert.strictEqual(response.statusCode, 400);
const error = JSON.parse(response.body);
assert.strictEqual(error.code, 'VALIDATION_ERROR');
```

## 10. Database Repository Testing Patterns

### Repository Method Testing
**File**: `/packages/db/test/memoRepository.test.ts`

```typescript
test('create/list memo with labels', () => {
  const { dir, db } = createTempDb();
  
  const memo = createMemo(db, { bodyMd: 'hello memo', labels: ['idea'] });
  const memos = listMemos(db, { label: 'idea' });
  
  assert.equal(memos.length, 1);
  assert.equal(memos[0].id, memo.id);
  assert.deepEqual(listMemoLabels(db, memo.id), ['idea']);
  
  db.close();
  fs.removeSync(dir);
});
```

### Testing Complex Query Results
```typescript
test('listMemos returns commentCount field', () => {
  const { dir, db } = createTempDb();

  // Test memo with 0 comments
  const memo1 = createMemo(db, { bodyMd: 'memo without comments' });
  let memos = listMemos(db, {});
  assert.equal(memos[0].commentCount, 0);

  // Test memo with comments
  const memo2 = createMemo(db, { bodyMd: 'memo with comments' });
  addComment(db, memo2.id, 'comment 1');
  addComment(db, memo2.id, 'comment 2');
  
  memos = listMemos(db, {});
  const foundMemo2 = memos.find(m => m.id === memo2.id);
  assert.equal(foundMemo2.commentCount, 2);

  // Test soft-deleted comments not counted
  const memo3 = createMemo(db, { bodyMd: 'memo with deleted comments' });
  addComment(db, memo3.id, 'active comment');
  const deletedComment = addComment(db, memo3.id, 'to be deleted');
  deleteComment(db, deletedComment.id);
  
  memos = listMemos(db, {});
  const foundMemo3 = memos.find(m => m.id === memo3.id);
  assert.equal(foundMemo3.commentCount, 1);  // Only active comments

  db.close();
  fs.removeSync(dir);
});
```

## Summary of Key Patterns

1. **Framework**: Node.js `node:test` module (no external test framework)
2. **Organization**: Per-package test directories with feature-based grouping
3. **Database**: Fresh temporary database for each test using migrations
4. **Setup/Teardown**: Manual in test bodies with beforeEach/afterEach for API tests
5. **Test Data**: Fixture helpers for consistent test data creation
6. **Assertions**: `node:assert/strict` with regex pattern matching for errors
7. **Integration Testing**: Fastify `app.inject()` for HTTP endpoint testing
8. **Service Testing**: Direct service class instantiation with mocked config
9. **Database Testing**: Direct repository function calls with temporary database
10. **Error Testing**: Both `assert.throws()` and `assert.rejects()` with regex pattern matching

## File References for Implementation

### Core Test Files
- `/packages/core/test/memoService.test.ts` - Memo service testing example
- `/packages/core/test/taskService.test.ts` - Task service testing example (largest test file)
- `/packages/core/test/linkService.test.ts` - Link service with error validation patterns

### Database Test Files
- `/packages/db/test/memoRepository.test.ts` - Repository-level testing with temp database
- `/packages/db/test/taskRepository.test.ts` - Task repository testing patterns

### API Integration Test Files
- `/packages/api/test/integration/memos.test.ts` - Comprehensive HTTP endpoint testing
- `/packages/api/test/integration/comments.test.ts` - Comment operations with fixtures
- `/packages/api/test/helpers/testServer.ts` - Test server setup helper
- `/packages/api/test/helpers/fixtures.ts` - Test data fixtures

### CLI Test Files
- `/packages/cli/test/lib/editor.test.ts` - Utility function testing
- `/packages/cli/test/lib/legacy-flags.test.ts` - Flag detection and formatting tests
