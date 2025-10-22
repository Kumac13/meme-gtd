# Data Model: Link Entity

**Feature**: Link Command Enhancement
**Date**: 2025-10-22
**Status**: Design Complete

## Overview

This document describes the Link entity data model and validation rules. The database schema already exists (schema/001_init.sql:60-68) - this document focuses on the enhanced validation logic for FR-013 and FR-014.

## Entity: Link

### Description

A Link represents a directional relationship between two issues (tasks or memos). Links enable hierarchical task organization (parent-child) and associative relationships (relates, derived_from) for GTD workflows.

### Database Schema (Existing)

**Table**: `links`

```sql
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_issue_id INTEGER NOT NULL,
    target_issue_id INTEGER NOT NULL,
    link_type TEXT NOT NULL CHECK (link_type IN ('parent', 'child', 'relates', 'derived_from')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    FOREIGN KEY (source_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
    FOREIGN KEY (target_issue_id) REFERENCES issues(id) ON DELETE CASCADE
);
```

**Indexes** (existing, from schema):
- Primary key on `id`
- Foreign key indexes on `source_issue_id` and `target_issue_id` (auto-created by SQLite)

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | INTEGER | Auto | Unique link identifier |
| `source_issue_id` | INTEGER | Yes | ID of the source issue (origin of the relationship) |
| `target_issue_id` | INTEGER | Yes | ID of the target issue (destination of the relationship) |
| `link_type` | TEXT | Yes | Type of relationship: 'parent', 'child', 'relates', 'derived_from' |
| `created_at` | TEXT (ISO 8601) | Auto | Timestamp when link was created |

### Link Types

| Type | Direction | Meaning | Example |
|------|-----------|---------|---------|
| `parent` | source → target | Source is a parent of target | Task "Project A" has child task "Subtask 1" |
| `child` | source → target | Source is a child of target | Task "Subtask 1" belongs to "Project A" |
| `relates` | bidirectional | Source is related to target (non-hierarchical) | Task "Design UI" relates to "Write docs" |
| `derived_from` | source → target | Source was derived/created from target | Task "Implement" derived from memo "Idea" |

**Note**: 'parent' and 'child' are inverse relationships:
- "A parent of B" (source=A, target=B, type=parent)
- "B child of A" (source=B, target=A, type=child)

These represent the same hierarchical relationship from different perspectives.

## Validation Rules

### Existing Validations (from linkService.ts)

1. **V1 - Self-Reference Prevention**
   - Rule: `source_issue_id` ≠ `target_issue_id`
   - Error: "Cannot link issue to itself (ID: {id})"
   - Applied: All link types

2. **V2 - Source Existence**
   - Rule: Source issue must exist and not be soft-deleted
   - Error: "Issue #{source_id} not found"
   - Query: `SELECT id FROM issues WHERE id = ? AND is_deleted = 0`

3. **V3 - Target Existence**
   - Rule: Target issue must exist and not be soft-deleted
   - Error: "Issue #{target_id} not found"
   - Query: `SELECT id FROM issues WHERE id = ? AND is_deleted = 0`

4. **V4 - Duplicate Prevention**
   - Rule: No duplicate links with same (source, target, type) triple
   - Error: "Link already exists (source: {s}, target: {t}, type: {type})"
   - Query: Check for existing link with exact match

### New Validations (FR-013, FR-014)

5. **V5 - Inverse Duplicate Prevention (FR-014)**
   - Rule: For parent/child link types, prevent creating inverse relationship
   - Applied: Only 'parent' and 'child' types (not 'relates' or 'derived_from')
   - Logic:
     - If creating "A parent of B" (source=A, target=B, type=parent)
     - Block if "B parent of A" exists (source=B, target=A, type=parent)
     - Block if "A child of B" exists (source=A, target=B, type=child)
     - This prevents bidirectional parent-child relationships
   - Error: "Cannot create inverse parent-child link: Issue #{target} is already a {type} of Issue #{source}"
   - Query:
     ```sql
     SELECT * FROM links
     WHERE (
       (source_issue_id = :targetId AND target_issue_id = :sourceId) OR
       (source_issue_id = :sourceId AND target_issue_id = :targetId)
     )
     AND link_type IN ('parent', 'child')
     AND NOT (source_issue_id = :sourceId AND target_issue_id = :targetId AND link_type = :type)
     ```

6. **V6 - Circular Hierarchy Prevention (FR-013)**
   - Rule: Prevent cycles in parent-child hierarchies
   - Applied: Only 'parent' and 'child' types (not 'relates' or 'derived_from')
   - Logic:
     - When creating "A parent of B", check if B is already an ancestor of A
     - Traverse upward from target through parent relationships
     - If source is found in ancestor chain, reject (would create cycle)
   - Error: "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #{source} is already an ancestor of Issue #{target})"
   - Query (Recursive CTE):
     ```sql
     WITH RECURSIVE ancestors(ancestor_id, depth) AS (
       SELECT :targetId, 0
       UNION ALL
       SELECT
         CASE
           WHEN l.link_type = 'parent' THEN l.target_issue_id
           WHEN l.link_type = 'child' THEN l.source_issue_id
         END,
         a.depth + 1
       FROM ancestors a
       JOIN links l ON (
         (l.link_type = 'parent' AND l.source_issue_id = a.ancestor_id) OR
         (l.link_type = 'child' AND l.target_issue_id = a.ancestor_id)
       )
       WHERE a.depth < 10
     )
     SELECT COUNT(*) FROM ancestors WHERE ancestor_id = :sourceId
     ```

### Validation Order

Validations are applied in this sequence (optimized for performance):

1. V1: Self-reference (cheapest check, fails fast)
2. V2: Source exists (single query)
3. V3: Target exists (single query)
4. V4: Duplicate link (indexed query)
5. V5: Inverse duplicate (indexed query, only for parent/child)
6. V6: Circular hierarchy (recursive CTE, only for parent/child)

**Rationale**:
- Fail fast on cheap checks first
- Only run expensive cycle detection if all other validations pass
- Only apply parent/child specific checks when link_type is 'parent' or 'child'

## State Transitions

### Link Lifecycle

```
[Not Exists] --create()--> [Active] --remove()--> [Deleted (CASCADE)]
                              |
                              |---(issue deleted)---> [Deleted (CASCADE)]
```

**States**:
- **Not Exists**: Link has not been created yet
- **Active**: Link exists in database and is queryable
- **Deleted**: Link is removed (either explicitly via remove() or cascade deleted when either issue is deleted)

**No soft delete**: Links are hard-deleted. The CASCADE delete ensures referential integrity.

## Relationships

### Issue ↔ Link

**Cardinality**:
- One issue can have many links (as source or target)
- One link connects exactly two issues

**Cascade Behavior**:
- When an issue is deleted, all its links are automatically deleted (ON DELETE CASCADE)
- This prevents orphaned links

### Link Type Semantics

**Hierarchical** (parent/child):
- Forms a directed acyclic graph (DAG) after FR-013 enforcement
- One task can have multiple children
- One task can have one logical parent (but multiple parent links are technically possible)

**Non-Hierarchical** (relates, derived_from):
- No cycle prevention
- No inverse duplicate prevention
- Can form any graph structure (including cycles)

## Data Integrity Constraints

### Database-Level Constraints (existing)

1. **Primary Key**: Unique `id`
2. **Foreign Keys**: `source_issue_id` and `target_issue_id` must exist in `issues` table
3. **CHECK Constraint**: `link_type` must be one of: 'parent', 'child', 'relates', 'derived_from'
4. **CASCADE DELETE**: Links deleted when either issue is deleted
5. **NOT NULL**: All required fields enforced at database level

### Application-Level Constraints (new)

6. **Inverse Duplicate**: Enforced in LinkService.create() before insert
7. **Circular Hierarchy**: Enforced in LinkService.create() before insert

**Why Application-Level**:
- Complex graph traversal (recursive CTE) cannot be expressed as database constraint
- Conditional logic (only applies to specific link types) is cleaner in application code
- Better error messages and user feedback

## Query Patterns

### Common Queries

**Get all links for an issue** (existing):
```sql
SELECT * FROM links
WHERE source_issue_id = ? OR target_issue_id = ?
```

**Filter by link type** (existing):
```sql
SELECT * FROM links
WHERE (source_issue_id = ? OR target_issue_id = ?)
  AND link_type = ?
```

**Get children of a task** (hierarchical query):
```sql
SELECT target_issue_id FROM links
WHERE source_issue_id = ? AND link_type = 'parent'
UNION
SELECT source_issue_id FROM links
WHERE target_issue_id = ? AND link_type = 'child'
```

**Get parent of a task** (hierarchical query):
```sql
SELECT target_issue_id FROM links
WHERE source_issue_id = ? AND link_type = 'child'
UNION
SELECT source_issue_id FROM links
WHERE target_issue_id = ? AND link_type = 'parent'
```

**Check for inverse link** (new, for V5):
```sql
SELECT * FROM links
WHERE (
  (source_issue_id = :targetId AND target_issue_id = :sourceId) OR
  (source_issue_id = :sourceId AND target_issue_id = :targetId)
)
AND link_type IN ('parent', 'child')
```

**Detect cycle** (new, for V6):
```sql
-- See V6 validation rule above for full CTE query
```

## Performance Characteristics

### Expected Query Performance

| Operation | Time Complexity | Expected Time |
|-----------|----------------|---------------|
| Create link (no cycle) | O(1) indexed lookups | <10ms |
| Create link (with cycle check) | O(depth × branches) | 20-50ms |
| List links for issue | O(links per issue) | <5ms |
| Delete link | O(1) | <5ms |
| Cascade delete (issue deleted) | O(links per issue) | <10ms |

### Index Recommendations (existing)

- Primary key on `id` (auto)
- Foreign key indexes on `source_issue_id` and `target_issue_id` (auto)

**No additional indexes needed** - existing foreign key indexes are sufficient for:
- V5 inverse duplicate check
- V6 cycle detection CTE

## Edge Cases

### Handled by Validation

1. **Self-loop**: A→A (blocked by V1)
2. **Direct cycle**: A→B, B→A in parent/child (blocked by V5)
3. **3-level cycle**: A→B→C→A in parent/child (blocked by V6)
4. **Exact duplicate**: (A, B, parent) created twice (blocked by V4)
5. **Non-existent issue**: Source or target doesn't exist (blocked by V2/V3)

### Allowed Behaviors

1. **Multiple children**: A can have many children (B, C, D...)
2. **Multiple parents (technical)**: B can technically have multiple parent links, though GTD workflow typically uses single parent
3. **Relates cycles**: A→B→C→A with 'relates' type (allowed, non-hierarchical)
4. **Mixed relationships**: A can be parent of B and relate to C simultaneously

### Grandfathered Data

- **Existing links**: Not retroactively validated
- **Rationale**: Avoid disrupting existing workflows
- **Future**: Optional `mgtd link validate` command could audit existing links

## Type Definitions (TypeScript)

**Existing** (from packages/shared/src/types.ts):
```typescript
export interface Link {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
  createdAt: string;  // ISO 8601
}
```

**No changes needed** - enhanced validations use existing type.

## Summary

### What Changed

- ✅ Added V5: Inverse duplicate prevention for parent/child links
- ✅ Added V6: Circular hierarchy detection for parent/child links
- ❌ No schema changes
- ❌ No type definition changes
- ❌ No API contract changes

### Validation Enhancement

Before (4 validations):
1. Self-reference
2. Source exists
3. Target exists
4. Duplicate link

After (6 validations):
1. Self-reference
2. Source exists
3. Target exists
4. Duplicate link
5. **Inverse duplicate (parent/child only)**
6. **Circular hierarchy (parent/child only)**

### Performance Impact

- Non-hierarchical links (relates, derived_from): No change
- Hierarchical links (parent, child): +20-50ms for cycle detection
- Within requirements: SC-001 allows up to 10 seconds for link creation
