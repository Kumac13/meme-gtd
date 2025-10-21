# Research: Include Labels in API Responses

**Feature**: Include Labels in API Responses
**Date**: 2025-10-21
**Purpose**: Technical research to resolve unknowns and establish implementation approach

## Existing Implementation Analysis

### Database Layer (packages/db)

**Findings**:
- Label query functions already exist:
  - `listMemoLabels(db, memoId): string[]` - Returns array of label names for a memo
  - `listTaskLabels(db, taskId): string[]` - Returns array of label names for a task
- Both functions query `issue_labels` JOIN `labels` tables
- Returns deduplicated, alphabetically sorted label names
- Filters out deleted labels (`is_deleted = 0`)

**Decision**: Use existing `listMemoLabels` and `listTaskLabels` functions. No new DB functions needed.

**Rationale**: Existing functions already implement all required logic (deduplication, sorting, deleted label filtering).

### API Layer (packages/api)

**Current Behavior**:
- API handlers call `MemoService.list()` and `TaskService.show()` from `packages/core`
- Services return data from `packages/db` repository functions
- Schemas validate responses using Zod
- Current schemas do NOT include `labels` field

**Findings**:
- `MemoSchema` and `TaskSchema` in `packages/api/src/schemas/` need `labels: z.array(z.string())` field
- `MemoDetailSchema` and `TaskDetailSchema` already extend base schemas for detail endpoints
- Handlers in `packages/api/src/handlers/` need to call label functions and add to response

**Decision**: Modify schemas to include optional `labels` array, update handlers to populate it.

**Rationale**: Follows existing pattern for detail schemas (e.g., `commentsCount` field already uses this pattern).

### Core Layer (packages/core)

**Current Behavior**:
- `MemoService.list()` calls `listMemos(db, filters)` from db package
- `MemoService.show(id)` calls `getMemo(db, id)` from db package
- Services are thin wrappers around repository functions

**Findings**:
- Services can call `listMemoLabels(db, memoId)` for each item
- For list endpoints: Need to iterate results and add labels
- For detail endpoints: Single call to get labels

**Decision**:
- List methods: Map over results, call `listMemoLabels`/`listTaskLabels` for each item
- Show methods: Call label function once, merge into result

**Rationale**: Keeps DB layer unchanged, adds label fetching in service layer where business logic belongs.

**Alternatives Considered**:
- Option A (rejected): Modify DB repository to JOIN labels in single query
  - Rejected because: More complex query, harder to maintain, N+1 acceptable for current scale
- Option B (chosen): Service layer fetches labels separately
  - Chosen because: Simple, uses existing functions, maintainable

### CLI Layer (packages/cli)

**Current Behavior**:
- CLI commands use `MemoService` and `TaskService` from `packages/core`
- JSON output uses `--json` flag
- Human-readable output formats data with chalk

**Findings**:
- If services return objects with `labels` field, CLI will automatically include it in JSON
- Human-readable formatter may need update to display labels

**Decision**:
- JSON output: No changes needed (will automatically include labels)
- Human formatter: Add labels display in list and view commands

**Rationale**: JSON serialization handles new fields automatically.

## Performance Considerations

### Query Performance

**Analysis**:
- Current: 1 query per list/detail endpoint
- After change: 1 base query + N label queries (N = number of items)
- For detail endpoints: 1 base query + 1 label query

**Benchmarking Plan**:
- Measure response time before/after for list endpoints with 10, 50, 100 items
- Verify <50ms increase per success criteria

**Mitigation** (if needed):
- If N+1 becomes performance issue, can optimize later with single JOIN query
- Current scale (personal GTD tool) doesn't require optimization

### Memory Impact

**Analysis**:
- Each label name is a short string (~10-50 chars)
- Typical item has 0-5 labels
- Minimal memory increase

**Decision**: No special handling needed for current scale.

## API Compatibility

### Backward Compatibility

**Analysis**:
- Adding new field to response is backward compatible
- Existing clients ignore unknown fields
- Web UI already prepared to consume labels
- CLI JSON output additive change

**Decision**: No versioning or migration needed - purely additive change.

**Rationale**: Adding optional field to response doesn't break existing consumers.

### OpenAPI Schema

**Impact**:
- OpenAPI spec will be regenerated after schema changes
- Web UI API client will be regenerated from updated OpenAPI spec
- TypeScript types will include new `labels` field

**Decision**: Run OpenAPI generation and Web client generation after API changes.

## Testing Strategy

### Unit Tests

**Scope**: Not needed - using existing DB functions which are already tested.

### Integration Tests

**Scope**:
- Modify existing API integration tests in `packages/api/test/integration/`
- Add assertions for `labels` field in responses
- Test empty labels case
- Test multiple labels case

**Files to modify**:
- `memos.test.ts`: Update list/detail test assertions
- `tasks.test.ts`: Update list/detail test assertions

### CLI Tests

**Scope**:
- Modify existing CLI command tests
- Verify JSON output includes labels
- Verify human-readable output displays labels

## Implementation Order

1. **DB Layer**: No changes (use existing functions)
2. **Core Layer**: Update `MemoService.list()`, `MemoService.show()`, `TaskService.list()`, `TaskService.show()`
3. **API Layer**:
   - Update Zod schemas to include `labels` field
   - Update handlers to populate labels
   - Update integration tests
4. **CLI Layer**: Update formatters to display labels
5. **Web Layer**: Regenerate API client from updated OpenAPI spec

## Open Questions

**None** - All technical details resolved through existing code analysis.
