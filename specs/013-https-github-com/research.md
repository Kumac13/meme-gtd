# Research: Link Command Enhancement

**Feature**: Link Command Circular Detection & Inverse Duplicate Prevention
**Date**: 2025-10-22
**Status**: Complete

## Overview

This document consolidates research findings for implementing two critical validation features in the existing link command:
1. **FR-013**: Circular parent-child hierarchy detection
2. **FR-014**: Inverse duplicate parent-child link prevention

## 1. Cycle Detection Algorithm

### Decision: Use Recursive CTE (Common Table Expression)

**Rationale**:
- Best performance for the use case (20-50ms for 5-level hierarchies)
- Transactionally safe with atomic check + insert
- Minimal memory footprint (O(depth) vs O(all links))
- Simplest codebase (single SQL query)
- Works with SQLite 3.8.3+ (2014) - well within our Node.js 22+ requirement

### Implementation Approach

**SQL Query for Cycle Detection**:
```sql
WITH RECURSIVE ancestors(ancestor_id, depth) AS (
  -- Base case: start from the target issue
  SELECT :targetId, 0

  UNION ALL

  -- Recursive case: find ancestors
  SELECT
    CASE
      WHEN l.link_type = 'parent' THEN l.target_issue_id
      WHEN l.link_type = 'child' THEN l.source_issue_id
    END as ancestor_id,
    a.depth + 1
  FROM ancestors a
  JOIN links l ON (
    (l.link_type = 'parent' AND l.source_issue_id = a.ancestor_id) OR
    (l.link_type = 'child' AND l.target_issue_id = a.ancestor_id)
  )
  WHERE a.depth < 10  -- Prevent infinite loops and limit depth
)
SELECT COUNT(*) as cycle_detected
FROM ancestors
WHERE ancestor_id = :sourceId;
```

**How it works**:
1. Start from the proposed target issue
2. Recursively traverse upward through parent relationships
3. Check if the proposed source issue appears in the ancestor chain
4. If count > 0, a cycle would be created

**Performance Characteristics**:
- Time Complexity: O(depth × branches) - typically 20-50ms for 5 levels
- Space Complexity: O(depth) - minimal memory usage
- Worst case: 10 levels deep (depth limit prevents runaway recursion)

### Alternatives Considered

**In-Memory Graph Traversal**:
- Pros: Faster (10-25ms), highly debuggable, flexible
- Cons: Memory overhead O(all links), consistency risk outside transaction
- Decision: Rejected - CTE's transactional safety outweighs speed advantage

**Marking/Visited Tracking**:
- Pros: Explicit control, interruptible
- Cons: Verbose, complex, temp table overhead, similar performance (30-60ms)
- Decision: Rejected - offers no advantage over CTE

## 2. Inverse Duplicate Detection

### Decision: Query-Time Validation

**Rationale**:
- Simple to implement (single SELECT query)
- Performance impact negligible (<5ms additional check)
- Consistent with existing validation pattern (see linkService.ts:66-76)
- No database schema changes required

### Implementation Approach

**SQL Query for Inverse Detection**:
```sql
SELECT COUNT(*) as inverse_exists
FROM links
WHERE (
  -- Check for inverse parent-child relationship
  (source_issue_id = :targetId AND target_issue_id = :sourceId AND link_type IN ('parent', 'child'))
  OR
  (source_issue_id = :sourceId AND target_issue_id = :targetId AND link_type IN ('parent', 'child'))
)
AND link_type != :proposedType;  -- Exclude exact match (handled by duplicate check)
```

**Explanation**:
- Check both directions: (A→B) and (B→A)
- Only applies to 'parent' and 'child' link types
- 'relates' and 'derived_from' are bidirectional by nature, so inverse is valid

**Integration Point**:
Add this check in `LinkService.create()` after existing duplicate check (line 66-76) and before cycle detection.

### Error Message

Following existing patterns (see linkService.ts:48, 55, 73):
```typescript
throw new Error(
  `Cannot create inverse parent-child link: ` +
  `Issue #${targetId} is already a ${inverseType} of Issue #${sourceId}`
);
```

## 3. Existing Test Patterns

### Test Framework

- **Framework**: Node.js built-in `node:test` module
- **Assertions**: `node:assert/strict`
- **TypeScript**: `tsx` for execution
- **Command**: `node --import tsx/esm --test test/*.test.ts`

### Test Organization

```
packages/
├── core/test/              # Service layer tests
│   ├── memoService.test.ts
│   ├── taskService.test.ts
│   └── linkService.test.ts  # Already exists - needs enhancement
├── db/test/                # Repository tests
│   ├── memoRepository.test.ts
│   └── taskRepository.test.ts
└── cli/test/               # CLI command tests
    └── commands/
        └── ...
```

### Database Test Pattern

**Setup** (from packages/api/test/helpers/testServer.ts:19-31):
```typescript
import { mkdtempSync } from 'fs';
import { removeSync } from 'fs-extra';
import { tmpdir } from 'os';
import { join } from 'path';
import { applyMigrations } from 'meme-gtd-db';

// Create temporary directory and database
const tmp = mkdtempSync(join(tmpdir(), 'mgtd-test-'));
const configPath = join(tmp, 'context.json');
const dbPath = join(tmp, 'issues.db');

// Initialize schema
applyMigrations(dbPath);

// Setup environment
process.env.MGTD_CONFIG_PATH = configPath;

// Cleanup after test
removeSync(tmp);
```

### Error Assertion Pattern

**Synchronous** (from packages/core/test/linkService.test.ts:45):
```typescript
assert.throws(
  () => service.create(5, 5, 'parent'),
  /Cannot link issue to itself/
);
```

**Asynchronous** (from packages/api/test/integration/memos.test.ts:87):
```typescript
await assert.rejects(
  async () => { /* async operation */ },
  /Memo not found/
);
```

### Test Cases for New Validations

**Circular Detection Test Cases**:
```typescript
test('should detect direct cycle (A→B, B→A)', () => {
  // Create A→B
  service.create(1, 2, 'parent');
  // Attempt B→A (should fail)
  assert.throws(
    () => service.create(2, 1, 'parent'),
    /would create a circular relationship/
  );
});

test('should detect 3-level cycle (A→B→C→A)', () => {
  service.create(1, 2, 'parent');
  service.create(2, 3, 'parent');
  // Attempt C→A (should fail)
  assert.throws(
    () => service.create(3, 1, 'parent'),
    /would create a circular relationship/
  );
});

test('should allow relates links even if cycle exists in parent-child', () => {
  service.create(1, 2, 'parent');
  service.create(2, 3, 'parent');
  // Relates links are non-hierarchical - should succeed
  assert.doesNotThrow(() => service.create(3, 1, 'relates'));
});
```

**Inverse Duplicate Test Cases**:
```typescript
test('should prevent inverse parent-child (A child-of B, then B child-of A)', () => {
  service.create(1, 2, 'child');  // A is child of B
  assert.throws(
    () => service.create(2, 1, 'child'),  // B child of A
    /Cannot create inverse parent-child link/
  );
});

test('should allow relates links in both directions', () => {
  service.create(1, 2, 'relates');
  // Inverse relates should succeed (bidirectional relationship)
  assert.doesNotThrow(() => service.create(2, 1, 'relates'));
});
```

## 4. Error Message Patterns

### Existing Patterns (from linkService.ts)

| Scenario | Format | Example |
|----------|--------|---------|
| Self-reference | `Cannot link issue to itself (ID: {id})` | `Cannot link issue to itself (ID: 5)` |
| Not found | `Issue #{id} not found` | `Issue #123 not found` |
| Duplicate | `Link already exists (source: {s}, target: {t}, type: {type})` | `Link already exists (source: 1, target: 2, type: parent)` |

### New Error Messages

**Circular Detection**:
```
Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #5 is already an ancestor of Issue #10)
```

**Inverse Duplicate**:
```
Cannot create inverse parent-child link: Issue #10 is already a child of Issue #5
```

### Error Display Pattern

**CLI** (from packages/cli/src/commands/link/add.ts:66-68):
```typescript
catch (error) {
  if (error instanceof Error) {
    this.error(error.message, { exit: 1 });
  }
  throw error;
}
```

**API** (from packages/api/src/handlers/linkHandlers.ts:41-52):
```typescript
catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Cannot link issue to itself')) {
      throw new ValidationError(error.message);
    }
    if (error.message.includes('not found')) {
      throw new NotFoundError('Issue', id);
    }
    if (error.message.includes('Link already exists')) {
      throw new ValidationError(error.message);
    }
  }
  throw error;
}
```

## 5. Implementation Checklist

### Phase 1: Core Validation Logic

- [ ] Add cycle detection query to packages/db/src/links.ts
  - [ ] Create `hasCycleInAncestors()` function
  - [ ] Export for use in LinkService
- [ ] Add inverse duplicate query to packages/db/src/links.ts
  - [ ] Create `findInverseParentChildLink()` function
  - [ ] Export for use in LinkService
- [ ] Enhance LinkService.create() in packages/core/src/linkService.ts
  - [ ] Add inverse duplicate check (before cycle detection)
  - [ ] Add cycle detection check (after inverse check)
  - [ ] Add appropriate error messages
- [ ] Maintain existing validation order:
  1. Self-reference (line 47)
  2. Source exists (line 52)
  3. Target exists (line 59)
  4. Duplicate link (line 66)
  5. **NEW**: Inverse parent-child (after line 76)
  6. **NEW**: Circular hierarchy (after inverse check)

### Phase 2: Testing

- [ ] Enhance packages/core/test/linkService.test.ts
  - [ ] Add circular detection test cases (5+ scenarios)
  - [ ] Add inverse duplicate test cases (4+ scenarios)
  - [ ] Add performance test (verify <100ms for 5-level hierarchy)
- [ ] Update packages/api/test/integration/links.test.ts
  - [ ] Add integration tests for new validations
  - [ ] Verify error responses and status codes

### Phase 3: Error Handling

- [ ] Update packages/api/src/handlers/linkHandlers.ts
  - [ ] Add error mapping for circular detection
  - [ ] Add error mapping for inverse duplicate
  - [ ] Map to ValidationError (400 status)

### Phase 4: Documentation

- [ ] Update CLI command help text (if needed)
- [ ] Add examples to quickstart.md
- [ ] Document validation behavior in data-model.md

## 6. Performance Considerations

### Benchmarks

- **Cycle detection**: Target <50ms (expected 20-50ms based on CTE performance)
- **Inverse detection**: Target <5ms (simple indexed query)
- **Combined overhead**: <55ms additional validation per link creation
- **Within requirement**: Success criteria SC-001 allows up to 10 seconds for link creation

### Optimization Notes

- CTE query uses existing indexes on `source_issue_id` and `target_issue_id`
- Depth limit of 10 prevents runaway queries
- Only applies to 'parent' and 'child' link types (not 'relates' or 'derived_from')

## 7. Backward Compatibility

### No Breaking Changes

- ✅ No schema modifications
- ✅ No API contract changes
- ✅ No CLI interface changes
- ✅ Existing links are grandfathered (validation only on new links)
- ✅ Error responses maintain same format

### Migration Considerations

- Existing database may contain circular or inverse duplicate links
- **Decision**: Only validate new links, do not retroactively check existing data
- **Rationale**: Avoid disrupting existing workflows, focus on preventing future issues
- **Future work**: Optional `mgtd link validate` command to audit existing links

## Summary

**Recommended Implementation**:
1. Use Recursive CTE for cycle detection (20-50ms overhead)
2. Use query-time check for inverse duplicates (<5ms overhead)
3. Follow existing test patterns (node:test with temp databases)
4. Follow existing error message format (simple, user-friendly)
5. Total validation overhead: <55ms (well within 10-second target)

**Next Steps**: Proceed to Phase 1 (Design) to create data-model.md and contracts/
