# Research: Comment Count Aggregation Implementation

**Feature**: Add Comment Count to API List Responses
**Date**: 2025-10-21
**Phase**: 0 (Research & Decision Making)

## Overview

This document captures the research and technical decisions for implementing comment count aggregation in the memo and task list endpoints.

## Research Questions

### 1. SQL Aggregation Pattern for Comment Counts

**Question**: What is the most efficient SQL pattern for adding comment counts to list queries in SQLite?

**Research Findings**:

The existing codebase uses `better-sqlite3` with straightforward SQL queries. Current pattern in `listMemos()` (packages/db/src/memoRepository.ts:83-126):

```sql
SELECT * FROM issues WHERE type = 'memo' AND is_deleted = 0 ORDER BY updated_at DESC
```

**Options Evaluated**:

1. **LEFT JOIN with COUNT and GROUP BY**:
   ```sql
   SELECT i.*, COUNT(c.id) as comment_count
   FROM issues i
   LEFT JOIN comments c ON c.issue_id = i.id AND c.is_deleted = 0
   WHERE i.type = 'memo' AND i.is_deleted = 0
   GROUP BY i.id
   ORDER BY i.updated_at DESC
   ```
   - ✅ Single query, efficient
   - ✅ Returns 0 for items with no comments
   - ✅ Compatible with existing filters
   - ⚠️ Requires GROUP BY on all selected columns for complex queries

2. **Subquery in SELECT**:
   ```sql
   SELECT *,
     (SELECT COUNT(*) FROM comments WHERE issue_id = i.id AND is_deleted = 0) as comment_count
   FROM issues i
   WHERE i.type = 'memo' AND i.is_deleted = 0
   ORDER BY i.updated_at DESC
   ```
   - ✅ Cleaner syntax, no GROUP BY needed
   - ✅ Works seamlessly with existing WHERE/ORDER BY clauses
   - ✅ Returns 0 for items with no comments
   - ✅ Better suited for search queries with FTS joins

3. **Post-processing with separate queries**:
   - ❌ N+1 query problem
   - ❌ Poor performance
   - ❌ Not considered

**Decision**: Use **subquery in SELECT** pattern

**Rationale**:
- The codebase has two different query paths: standard filtering and full-text search (FTS)
- The FTS path already uses a JOIN (`SELECT i.* FROM issues i JOIN issues_fts f...`)
- Adding a LEFT JOIN with GROUP BY would complicate both paths and require grouping by all columns
- Subquery approach is cleaner, more maintainable, and works identically for both paths
- SQLite query planner handles correlated subqueries efficiently for this scale
- Maintains compatibility with existing filter logic without restructuring queries

### 2. Type System Updates

**Question**: How should the `commentCount` field flow through the TypeScript type system?

**Research Findings**:

Current type hierarchy (from packages/shared/src/types.ts and repository files):

```typescript
// Repository layer returns
interface Memo {
  id: number;
  type: 'memo';
  bodyMd: string;
  // ... other fields
}

// Service layer enhances with labels
MemoService.list() → Array<Memo & { labels: string[] }>

// API layer uses Zod schemas
MemoSchema (Zod) → validates response
```

**Options Evaluated**:

1. **Add to base Memo/Task types in shared package**:
   - ✅ Single source of truth
   - ❌ Implies all Memo/Task instances have commentCount (not true for single-item fetches)

2. **Create new MemoWithCount/TaskWithCount types**:
   - ✅ Type-safe distinction
   - ❌ Duplicates most fields
   - ❌ Complicates service layer

3. **Add optional commentCount to existing types**:
   - ✅ Minimal changes
   - ✅ Reflects reality (field present in lists, absent in detail endpoints)
   - ✅ Matches existing pattern (labels are added dynamically)

**Decision**: Add `commentCount?: number` as optional field to repository return types, make required in Zod schemas for list endpoints

**Rationale**:
- Matches existing pattern where labels are added by service layer
- Repository returns optional field, service layer ensures it's present
- Zod schemas enforce presence at API boundary
- Minimal type system changes

### 3. Performance Considerations

**Question**: Will adding comment count aggregation impact query performance?

**Research Findings**:

Current database structure (from schema/001_init.sql):
- `comments` table has `issue_id` column with FK constraint
- No explicit index on `comments.issue_id` beyond FK
- Typical data scale: dozens to hundreds of issues, potentially thousands of comments

**Indexing Analysis**:

SQLite automatically creates indexes for:
- ✅ PRIMARY KEY (comments.id)
- ✅ FOREIGN KEY (comments.issue_id) - implicit index for FK constraint

**Performance Testing Plan**:
- Requirement: No more than 10% degradation (from spec.md SC-003)
- Test with varying data sizes: 10, 100, 1000 issues with 0-50 comments each
- Measure baseline vs. with comment count

**Decision**: Use existing FK index, monitor performance, add explicit index only if needed

**Rationale**:
- SQLite FK constraint already provides index on `issue_id`
- Subquery approach allows SQLite to use this index efficiently
- Defer explicit indexing until performance testing shows need
- Keep changes minimal per project principles

### 4. Handling Soft-Deleted Comments

**Question**: How should soft-deleted comments be handled in the count?

**Research Findings**:

Current soft-delete pattern (from schema/001_init.sql and repositories):
- All tables use `is_deleted INTEGER NOT NULL DEFAULT 0`
- Existing queries filter with `WHERE is_deleted = 0`
- Comments table includes `is_deleted` column

**Decision**: Exclude soft-deleted comments from count (`WHERE is_deleted = 0` in subquery)

**Rationale**:
- Consistent with existing soft-delete handling across the codebase
- Matches user expectation (deleted comments shouldn't be counted)
- Specified in FR-003 of spec.md

### 5. Backward Compatibility

**Question**: Will this change break existing API consumers?

**Research Findings**:

Current API consumers:
- Web UI (issue #28) - currently handles commentCount as optional
- Potentially external automation tools
- CLI (uses core/db directly, not affected)

**Decision**: Purely additive change, maintain backward compatibility

**Rationale**:
- Adding a field to JSON response is backward compatible
- Existing consumers will ignore unknown fields
- Web UI is ready to consume the field
- No version bump required (additive change per semver)

## Technology Stack Validation

**Database**: SQLite via better-sqlite3 ✅
- Supports subqueries in SELECT
- Efficient correlated subquery execution
- FK-based indexing sufficient

**Type Validation**: Zod ✅
- Update schemas to include `commentCount: z.number().int().nonnegative()`
- No breaking changes to schema validation

**Testing Framework**: Vitest ✅
- Existing test patterns can be extended
- Integration tests can validate field presence and accuracy

## Implementation References

### Example: How Labels are Currently Added

From packages/core/src/index.ts:72-77 (MemoService.list):

```typescript
public list(filters: ListMemoFilters = {}) {
  const memos = listMemos(this.db, filters);
  return memos.map(memo => ({
    ...memo,
    labels: listMemoLabels(this.db, memo.id)
  }));
}
```

This pattern will be followed: repository returns base data + commentCount, service layer propagates it.

### Query Pattern Reference

The two query paths to update:

1. **Standard filter path** (memoRepository.ts:104):
   ```typescript
   let sql = `SELECT * FROM issues WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`;
   ```

2. **Full-text search path** (memoRepository.ts:115-117):
   ```typescript
   sql = `SELECT i.* FROM issues i JOIN issues_fts f ON f.issue_id = i.id
           WHERE ${searchConditions.join(' AND ')}
           ORDER BY i.updated_at ${filters.order === 'asc' ? 'ASC' : 'DESC'}`;
   ```

Both will be updated to include comment count subquery.

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Performance degradation > 10% | Medium | Low | Add explicit index on comments.issue_id if needed; FK index should suffice |
| Type system complexity | Low | Low | Use optional typing pattern matching labels |
| Breaking change for consumers | High | Very Low | Purely additive change, no fields removed or modified |
| Query correctness with filters | Medium | Low | Comprehensive test coverage for all filter combinations |

## Alternatives Considered and Rejected

### Alternative 1: Separate Comment Count Endpoint
- **Approach**: Create GET /api/memos/:id/comments/count endpoint
- **Rejected Because**: Requires N additional API calls for list views, defeats purpose of this feature

### Alternative 2: Include Full Comment Data in List Response
- **Approach**: Embed all comments in list responses
- **Rejected Because**: Violates REST principles, massive payload size, not required by use case

### Alternative 3: Cache Comment Counts in issues Table
- **Approach**: Add `comment_count` column to issues table, update via triggers
- **Rejected Because**: Adds complexity (triggers), data redundancy, over-engineering for current scale

## Next Steps (Phase 1)

Based on this research:

1. **Data Model**: Document the commentCount field addition to Memo/Task types
2. **Contracts**: Update OpenAPI schemas for MemoSchema and TaskSchema
3. **Quickstart**: Create developer guide for implementing comment count feature
4. **Update Agent Context**: Run update script to add SQLite subquery patterns to agent memory

## References

- SQLite Subquery Documentation: https://www.sqlite.org/lang_select.html#scalar_subquery
- Project Requirements: docs/requirement.md
- Database Schema: schema/001_init.sql
- Current Implementation: packages/db/src/memoRepository.ts, packages/db/src/taskRepository.ts
