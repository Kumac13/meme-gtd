# Quickstart: Include Labels in API Responses

**Feature**: Include Labels in API Responses
**Branch**: `011-https-github-com`
**Prerequisites**: Development environment set up, tests passing

## Implementation Checklist

### Phase 1: Update API Schemas (packages/api)

- [ ] **1.1** Modify `packages/api/src/schemas/memoSchemas.ts`:
  ```typescript
  // In MemoSchema
  labels: z.array(z.string()).describe('Array of label names assigned to this memo')
  ```

- [ ] **1.2** Modify `packages/api/src/schemas/taskSchemas.ts`:
  ```typescript
  // In TaskSchema
  labels: z.array(z.string()).describe('Array of label names assigned to this task')
  ```

- [ ] **1.3** Update `MemoDetailSchema` and `TaskDetailSchema` to include `labels` in required fields

### Phase 2: Update Core Services (packages/core)

- [ ] **2.1** Modify `packages/core/src/index.ts` - `MemoService.list()`:
  ```typescript
  public list(filters: ListMemoFilters = {}) {
    const memos = listMemos(this.db, filters);
    return memos.map(memo => ({
      ...memo,
      labels: listMemoLabels(this.db, memo.id)
    }));
  }
  ```

- [ ] **2.2** Modify `packages/core/src/index.ts` - `MemoService.show()`:
  ```typescript
  public show(id: number) {
    const memo = getMemo(this.db, id);
    return {
      ...memo,
      labels: listMemoLabels(this.db, id)
    };
  }
  ```

- [ ] **2.3** Modify `packages/core/src/index.ts` - `TaskService.list()`:
  ```typescript
  public list(filters: ListTaskFilters = {}) {
    const tasks = listTasks(this.db, filters);
    return tasks.map(task => ({
      ...task,
      labels: listTaskLabels(this.db, task.id)
    }));
  }
  ```

- [ ] **2.4** Modify `packages/core/src/index.ts` - `TaskService.show()`:
  ```typescript
  public show(id: number) {
    const task = getTask(this.db, id);
    return {
      ...task,
      labels: listTaskLabels(this.db, id)
    };
  }
  ```

### Phase 3: Update API Integration Tests (packages/api)

- [ ] **3.1** Modify `packages/api/test/integration/memos.test.ts`:
  - Update list test to assert `labels` field exists and is an array
  - Update detail test to assert `labels` field exists
  - Add test case for memo with labels
  - Add test case for memo without labels (empty array)

- [ ] **3.2** Modify `packages/api/test/integration/tasks.test.ts`:
  - Update list test to assert `labels` field exists and is an array
  - Update detail test to assert `labels` field exists
  - Add test case for task with labels
  - Add test case for task without labels (empty array)

### Phase 4: Build and Test API

- [ ] **4.1** Build API package:
  ```bash
  pnpm --filter meme-gtd-api build
  ```

- [ ] **4.2** Run API tests:
  ```bash
  pnpm --filter meme-gtd-api test
  ```

- [ ] **4.3** Verify all tests pass

### Phase 5: Update CLI Formatters (packages/cli)

- [ ] **5.1** Modify `packages/cli/src/commands/memo/list.ts`:
  - Update human-readable formatter to display labels
  - JSON output will automatically include labels (no change needed)

- [ ] **5.2** Modify `packages/cli/src/commands/memo/view.ts`:
  - Update human-readable formatter to display labels

- [ ] **5.3** Modify `packages/cli/src/commands/task/list.ts`:
  - Update human-readable formatter to display labels

- [ ] **5.4** Modify `packages/cli/src/commands/task/view.ts`:
  - Update human-readable formatter to display labels

### Phase 6: Test CLI

- [ ] **6.1** Build CLI package:
  ```bash
  pnpm --filter meme-gtd-cli build
  ```

- [ ] **6.2** Manual test - Create memo with labels:
  ```bash
  mgtd memo create --body "Test memo" --label test --label demo
  ```

- [ ] **6.3** Manual test - List memos with JSON:
  ```bash
  mgtd memo list --json
  ```
  Verify `labels` array is present

- [ ] **6.4** Manual test - View memo:
  ```bash
  mgtd memo view <id>
  ```
  Verify labels are displayed

### Phase 7: Regenerate OpenAPI and Web Client

- [ ] **7.1** Regenerate OpenAPI spec:
  ```bash
  pnpm --filter meme-gtd-api openapi:generate
  ```

- [ ] **7.2** Verify `labels` field in OpenAPI spec:
  ```bash
  grep -A 5 "labels:" packages/api/docs/api/openapi.yaml
  ```

- [ ] **7.3** Regenerate Web UI API client:
  ```bash
  pnpx openapi-typescript-codegen \
    --input /Users/hiraku-kumagai/ghq/github.com/Kumac13/meme-gtd/packages/api/docs/api/openapi.yaml \
    --output /Users/hiraku-kumagai/ghq/github.com/Kumac13/meme-gtd/packages/web/src/api \
    --client fetch
  ```

- [ ] **7.4** Build Web UI:
  ```bash
  pnpm --filter meme-gtd-web build
  ```

### Phase 8: Integration Testing

- [ ] **8.1** Start API server:
  ```bash
  pnpm server:dev
  ```

- [ ] **8.2** In separate terminal, start Web UI:
  ```bash
  pnpm dev:web
  ```

- [ ] **8.3** Create test data via CLI:
  ```bash
  mgtd memo create --body "Test with labels" --label important --label work
  mgtd task create --title "Test task" --body "Description" --label bug
  ```

- [ ] **8.4** Verify in Web UI:
  - Open http://localhost:5173
  - Navigate to memos list - verify labels are displayed
  - Navigate to tasks list - verify labels are displayed
  - Click on memo/task - verify labels on detail page

### Phase 9: Final Checks

- [ ] **9.1** Run all tests:
  ```bash
  pnpm test
  ```

- [ ] **9.2** Check for TypeScript errors:
  ```bash
  pnpm build
  ```

- [ ] **9.3** Verify no breaking changes in API responses

## Verification Commands

### Check API Response (after starting server)

```bash
# List memos with labels
curl http://localhost:3000/api/memos | jq '.[0].labels'

# Get memo detail
curl http://localhost:3000/api/memos/1 | jq '.labels'

# List tasks with labels
curl http://localhost:3000/api/tasks | jq '.[0].labels'

# Get task detail
curl http://localhost:3000/api/tasks/10 | jq '.labels'
```

### Expected Output

```json
["important", "work"]  // or [] for no labels
```

## Rollback Plan

If issues are discovered:

1. **Revert API changes**:
   ```bash
   git checkout main -- packages/api/src/schemas/
   ```

2. **Revert Core changes**:
   ```bash
   git checkout main -- packages/core/src/index.ts
   ```

3. **Rebuild**:
   ```bash
   pnpm build
   pnpm test
   ```

## Performance Validation

After implementation, measure performance impact:

```bash
# Benchmark list endpoints
time curl http://localhost:3000/api/memos > /dev/null
time curl http://localhost:3000/api/tasks > /dev/null
```

**Success Criteria**: Response time increase <50ms

## Common Issues

### Issue: Labels not appearing in response

**Solution**: Check that:
1. Service methods are calling `listMemoLabels`/`listTaskLabels`
2. Handlers are using updated service methods
3. API package is rebuilt after changes

### Issue: TypeScript errors in Web client

**Solution**: Regenerate Web client after OpenAPI spec update

### Issue: Tests failing

**Solution**: Update test assertions to expect `labels` field in responses

## Next Steps

After implementation complete:
1. Update GitHub Issue #30 with completion status
2. Consider implementing label filtering in Web UI (Issue #34 prerequisite)
3. Consider performance optimization if >50ms impact observed
