# Cycle Detection Algorithms for Parent-Child Hierarchies

**Research Date**: 2025-10-22
**Context**: Issue #18 - Link Command Implementation (FR-013)
**Requirement**: Detect circular parent-child relationships in SQLite database

## Problem Statement

We need to detect circular parent-child relationships when creating new links in the `links` table:
- Table schema: `source_issue_id`, `target_issue_id`, `link_type`
- Link types include: `parent`, `child`, `relates`, `derived_from`
- Only `parent` and `child` types create hierarchies that need cycle detection
- Performance target: Under 100ms for 5-level hierarchies with up to 50 children per node

### Example Circular Reference

```
Task A --child--> Task B --child--> Task C --child--> Task A  (CYCLE!)
```

When creating a new link, we must detect if it would create such a cycle.

---

## Approach 1: Recursive CTE (Common Table Expression)

### Description

SQLite 3.8.3+ supports `WITH RECURSIVE` for graph traversal. We can traverse ancestors starting from the target node to detect if we reach the source node.

### SQL Implementation

```sql
-- Check if adding link (sourceId, targetId, 'parent' or 'child') creates a cycle
-- For 'parent': source is child, target is parent
-- For 'child': source is parent, target is child

-- Example: Check if making task 5 a child of task 10 creates a cycle
-- We need to traverse all ancestors of task 10 to see if we reach task 5

WITH RECURSIVE ancestors(id, depth) AS (
  -- Base case: start from the proposed parent (targetId)
  SELECT
    :targetId AS id,
    0 AS depth

  UNION ALL

  -- Recursive case: follow parent links upward
  SELECT
    CASE
      WHEN l.link_type = 'parent' THEN l.target_issue_id  -- parent link: target is parent
      WHEN l.link_type = 'child' THEN l.source_issue_id   -- child link: source is parent
    END AS id,
    a.depth + 1 AS depth
  FROM ancestors a
  INNER JOIN links l ON (
    -- Follow parent relationships
    (l.link_type = 'parent' AND l.source_issue_id = a.id) OR
    (l.link_type = 'child' AND l.target_issue_id = a.id)
  )
  WHERE a.depth < 10  -- Safety limit to prevent infinite loops on existing cycles
)
SELECT COUNT(*) > 0 AS has_cycle
FROM ancestors
WHERE id = :sourceId;  -- If we reach sourceId, we have a cycle
```

### Performance Characteristics

**Time Complexity**: O(N) where N is the number of ancestors in the hierarchy
- Best case: O(1) - immediate parent has no ancestors
- Worst case: O(5 * 50) = O(250) nodes for 5 levels × 50 children (but linear traversal)
- Average case: O(depth) where depth is typically 2-3 levels

**Space Complexity**: O(depth) for the recursive CTE result set

**Measured Performance** (estimated based on SQLite characteristics):
- 1-level hierarchy: < 1ms
- 3-level hierarchy: 5-10ms
- 5-level hierarchy with 50 children: 20-50ms
- Well within 100ms target

### Pros

1. **Database-native solution**: Leverages SQLite's optimized recursive query engine
2. **Simple logic**: Query directly expresses the graph traversal
3. **No data transfer**: Entire operation happens in database, no TypeScript processing
4. **Transactional safety**: Atomic check within the same transaction as insert
5. **Depth limiting**: Built-in safety with `WHERE depth < 10` prevents infinite loops

### Cons

1. **SQLite version requirement**: Requires SQLite 3.8.3+ (released 2014, should be fine)
2. **Limited debuggability**: Harder to debug CTE execution compared to application code
3. **Query complexity**: More complex SQL, potential maintenance burden
4. **Bidirectional link logic**: Must handle both `parent` and `child` link types in query

### Recommendation

**Score: 9/10** - Best choice for this use case

**Rationale**:
- Performance is excellent and well within target
- Keeps validation logic close to data
- No serialization overhead
- Most robust solution for concurrent operations

---

## Approach 2: In-Memory Graph Traversal (BFS/DFS)

### Description

Load all relevant links from database into memory, build a graph structure, and perform breadth-first or depth-first search to detect cycles.

### TypeScript Implementation (DFS)

```typescript
/**
 * Detect if adding a parent-child link would create a cycle
 * @param db Database instance
 * @param sourceId Source issue ID (child in parent link, parent in child link)
 * @param targetId Target issue ID (parent in parent link, child in child link)
 * @param linkType 'parent' or 'child'
 * @returns true if cycle detected
 */
function detectCycle(
  db: Database.Database,
  sourceId: number,
  targetId: number,
  linkType: 'parent' | 'child'
): boolean {
  // Load all parent-child links into memory
  const allLinks = db.prepare(`
    SELECT source_issue_id, target_issue_id, link_type
    FROM links
    WHERE link_type IN ('parent', 'child')
  `).all() as Array<{
    source_issue_id: number;
    target_issue_id: number;
    link_type: 'parent' | 'child';
  }>;

  // Build adjacency list: child -> [parents]
  const childToParents = new Map<number, number[]>();

  for (const link of allLinks) {
    let child: number, parent: number;

    if (link.link_type === 'parent') {
      // parent link: source is child, target is parent
      child = link.source_issue_id;
      parent = link.target_issue_id;
    } else {
      // child link: source is parent, target is child
      child = link.target_issue_id;
      parent = link.source_issue_id;
    }

    if (!childToParents.has(child)) {
      childToParents.set(child, []);
    }
    childToParents.get(child)!.push(parent);
  }

  // Add the proposed new link to the graph
  const newChild = linkType === 'parent' ? sourceId : targetId;
  const newParent = linkType === 'parent' ? targetId : sourceId;

  if (!childToParents.has(newChild)) {
    childToParents.set(newChild, []);
  }
  childToParents.get(newChild)!.push(newParent);

  // DFS to check if we can reach sourceId from targetId
  // (following parent links upward from newParent)
  const visited = new Set<number>();
  const stack: number[] = [newParent];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === newChild) {
      // We reached the child from its own ancestor - cycle detected!
      return true;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    // Add all parents of current node to stack
    const parents = childToParents.get(current) || [];
    for (const parent of parents) {
      if (!visited.has(parent)) {
        stack.push(parent);
      }
    }
  }

  return false;
}
```

### Performance Characteristics

**Time Complexity**:
- Load links: O(L) where L is total number of parent/child links in database
- Build adjacency list: O(L)
- DFS traversal: O(V + E) where V = nodes, E = edges in subgraph
- Total: O(L + V + E) ≈ O(L) for typical hierarchies

**Space Complexity**: O(L) for storing all links in memory

**Measured Performance** (estimated):
- Database query to load all links: 5-10ms (even for 1000s of links)
- Graph construction: 5-10ms
- DFS traversal: 1-5ms (only visits relevant subgraph)
- Total: 10-25ms for typical case
- Well within 100ms target

### Pros

1. **Debuggable**: Easy to step through and understand in TypeScript
2. **Flexible**: Can easily extend to return cycle path, detect multiple cycles, etc.
3. **Testable**: Unit tests can mock graph structure without database
4. **No SQLite version dependency**: Works with any SQLite version
5. **Reusable**: Graph structure can be cached or reused for multiple checks

### Cons

1. **Memory overhead**: Loads all links into memory (could be 1000s of records)
2. **Serialization cost**: Database -> JavaScript object conversion
3. **Consistency risk**: If links are modified during check, in-memory state is stale
4. **Less transactional**: Harder to ensure atomic check + insert
5. **Full table scan**: Loads ALL links even if only checking small subgraph

### Recommendation

**Score: 6/10** - Acceptable but not optimal

**Rationale**:
- Good for debugging and testing
- Performance acceptable but not as good as CTE
- Memory overhead unnecessary for small graphs
- Best for cases where you need additional graph analysis beyond cycle detection

---

## Approach 3: Marking/Visited Tracking Algorithm

### Description

A hybrid approach that uses SQL to iteratively traverse the graph with session-level temporary tables to track visited nodes. This is essentially a SQL-based implementation of the DFS/BFS algorithm.

### SQL Implementation

```sql
-- Create temporary table for tracking visited nodes
CREATE TEMP TABLE IF NOT EXISTS visited_nodes (
  issue_id INTEGER PRIMARY KEY,
  depth INTEGER
);

-- Initialize with target node (proposed parent)
INSERT INTO visited_nodes (issue_id, depth)
VALUES (:targetId, 0);

-- Iteratively expand frontier (up to max depth)
-- Iteration 1: depth 0 -> depth 1
INSERT OR IGNORE INTO visited_nodes (issue_id, depth)
SELECT
  CASE
    WHEN l.link_type = 'parent' THEN l.target_issue_id
    WHEN l.link_type = 'child' THEN l.source_issue_id
  END AS issue_id,
  1 AS depth
FROM visited_nodes v
INNER JOIN links l ON (
  (l.link_type = 'parent' AND l.source_issue_id = v.issue_id) OR
  (l.link_type = 'child' AND l.target_issue_id = v.issue_id)
)
WHERE v.depth = 0;

-- Iteration 2: depth 1 -> depth 2
-- (Repeat for each level up to max depth)

-- Check if source node was reached
SELECT COUNT(*) > 0 AS has_cycle
FROM visited_nodes
WHERE issue_id = :sourceId;

-- Cleanup
DROP TABLE visited_nodes;
```

### Alternative: Single Multi-Statement Function

```typescript
function detectCycleWithMarking(
  db: Database.Database,
  sourceId: number,
  targetId: number,
  linkType: 'parent' | 'child'
): boolean {
  // Use a transaction for isolation
  const checkCycle = db.transaction(() => {
    // Create temp table
    db.exec('CREATE TEMP TABLE visited_nodes (issue_id INTEGER PRIMARY KEY, depth INTEGER)');

    // Start with target
    db.prepare('INSERT INTO visited_nodes VALUES (?, 0)').run(targetId);

    // Iterative expansion (max 10 levels)
    for (let depth = 0; depth < 10; depth++) {
      const inserted = db.prepare(`
        INSERT OR IGNORE INTO visited_nodes (issue_id, depth)
        SELECT
          CASE
            WHEN l.link_type = 'parent' THEN l.target_issue_id
            WHEN l.link_type = 'child' THEN l.source_issue_id
          END,
          ? + 1
        FROM visited_nodes v
        INNER JOIN links l ON (
          (l.link_type = 'parent' AND l.source_issue_id = v.issue_id) OR
          (l.link_type = 'child' AND l.target_issue_id = v.issue_id)
        )
        WHERE v.depth = ?
      `).run(depth, depth);

      // If no new nodes added, we've reached the top
      if (inserted.changes === 0) break;
    }

    // Check if source was reached
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM visited_nodes WHERE issue_id = ?'
    ).get(sourceId) as { count: number };

    // Cleanup
    db.exec('DROP TABLE visited_nodes');

    return result.count > 0;
  });

  return checkCycle();
}
```

### Performance Characteristics

**Time Complexity**: O(depth × average_branching_factor)
- Each iteration processes one level of the tree
- For 5 levels: 5 iterations
- Each iteration: O(nodes_at_level)

**Space Complexity**: O(total_ancestors) for temp table

**Measured Performance** (estimated):
- Temp table creation: 1ms
- Per-level iteration: 5-10ms
- 5 levels: 25-50ms
- Cleanup: 1ms
- Total: 30-60ms
- Within 100ms target

### Pros

1. **Explicit control**: Fine-grained control over traversal
2. **Debuggable**: Can inspect temp table at each iteration
3. **Interruptible**: Can add early termination logic
4. **Session isolation**: Temp table is session-specific
5. **No recursion limits**: Avoids potential SQLite recursion depth issues

### Cons

1. **Verbose**: Requires multiple statements and loop logic
2. **Temp table overhead**: CREATE/DROP operations add latency
3. **Complex transaction handling**: Must ensure cleanup in all code paths
4. **Not significantly faster**: Similar performance to recursive CTE
5. **More code**: More lines of code to maintain

### Recommendation

**Score: 5/10** - Acceptable but unnecessarily complex

**Rationale**:
- Performance similar to CTE but more code
- Useful if you need intermediate state inspection
- Not worth the added complexity for this simple use case

---

## Comparison Summary

| Criterion | Recursive CTE | In-Memory Graph | Marking Algorithm |
|-----------|---------------|-----------------|-------------------|
| **Performance** | Excellent (20-50ms) | Good (10-25ms) | Good (30-60ms) |
| **Memory Usage** | Low (O(depth)) | High (O(all links)) | Medium (O(ancestors)) |
| **Code Complexity** | Medium (complex SQL) | High (graph + DFS) | Very High (multi-step) |
| **Debuggability** | Low | High | Medium |
| **Maintainability** | High | Medium | Low |
| **Transactional Safety** | Excellent | Medium | Good |
| **SQLite Version** | 3.8.3+ (2014) | Any | Any |
| **Scalability** | Excellent | Good | Good |

---

## Final Recommendation

### Primary Choice: **Recursive CTE (Approach 1)**

**Rationale**:
1. **Best performance**: Leverages database engine optimization, no serialization overhead
2. **Simplest codebase**: Single SQL query, no complex application logic
3. **Transactional safety**: Atomic check within same transaction as link creation
4. **Future-proof**: Scales well as database grows
5. **Low memory**: Only stores visited ancestors, not entire link graph

**Implementation Plan**:
```typescript
// In packages/core/src/linkService.ts

private detectCycle(sourceId: number, targetId: number, linkType: 'parent' | 'child'): boolean {
  const query = `
    WITH RECURSIVE ancestors(id, depth) AS (
      SELECT :targetId AS id, 0 AS depth
      UNION ALL
      SELECT
        CASE
          WHEN l.link_type = 'parent' THEN l.target_issue_id
          WHEN l.link_type = 'child' THEN l.source_issue_id
        END AS id,
        a.depth + 1 AS depth
      FROM ancestors a
      INNER JOIN links l ON (
        (l.link_type = 'parent' AND l.source_issue_id = a.id) OR
        (l.link_type = 'child' AND l.target_issue_id = a.id)
      )
      WHERE a.depth < 10
    )
    SELECT COUNT(*) as count FROM ancestors WHERE id = :sourceId
  `;

  const result = this.db.prepare(query).get({
    sourceId,
    targetId
  }) as { count: number };

  return result.count > 0;
}
```

### Fallback Choice: **In-Memory Graph (Approach 2)**

Use this if:
- SQLite version is too old (< 3.8.3)
- You need detailed cycle path information for error messages
- You're building additional graph analysis features (e.g., finding all cycles, visualization)

---

## Testing Strategy

### Unit Tests

```typescript
test('detectCycle() returns true for direct cycle', () => {
  // A -> B -> A
  const config = createTestConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const taskA = taskService.create({ title: 'A', bodyMd: '' });
  const taskB = taskService.create({ title: 'B', bodyMd: '' });

  // A is parent of B
  linkService.create(taskB.id, taskA.id, 'parent');

  // Try to make B parent of A (would create cycle)
  assert.throws(() => {
    linkService.create(taskA.id, taskB.id, 'parent');
  }, /Circular parent-child relationship detected/);
});

test('detectCycle() returns true for 3-level cycle', () => {
  // A -> B -> C -> A
  const config = createTestConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const A = taskService.create({ title: 'A', bodyMd: '' });
  const B = taskService.create({ title: 'B', bodyMd: '' });
  const C = taskService.create({ title: 'C', bodyMd: '' });

  linkService.create(B.id, A.id, 'parent'); // A is parent of B
  linkService.create(C.id, B.id, 'parent'); // B is parent of C

  // Try to make C parent of A (would create cycle)
  assert.throws(() => {
    linkService.create(A.id, C.id, 'parent');
  }, /Circular parent-child relationship detected/);
});

test('detectCycle() returns false for valid tree', () => {
  // A -> B, A -> C (no cycle)
  const config = createTestConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const A = taskService.create({ title: 'A', bodyMd: '' });
  const B = taskService.create({ title: 'B', bodyMd: '' });
  const C = taskService.create({ title: 'C', bodyMd: '' });

  linkService.create(B.id, A.id, 'parent');

  // This should succeed (no cycle)
  const link = linkService.create(C.id, A.id, 'parent');
  assert.ok(link.id);
});

test('detectCycle() handles 5-level hierarchy', () => {
  // Root -> L1 -> L2 -> L3 -> L4 -> L5
  const config = createTestConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const tasks = [];
  for (let i = 0; i < 6; i++) {
    tasks.push(taskService.create({ title: `L${i}`, bodyMd: '' }));
  }

  // Create chain
  for (let i = 1; i < 6; i++) {
    linkService.create(tasks[i].id, tasks[i-1].id, 'parent');
  }

  // Try to make L5 parent of Root (would create cycle)
  assert.throws(() => {
    linkService.create(tasks[0].id, tasks[5].id, 'parent');
  }, /Circular parent-child relationship detected/);
});

test('detectCycle() allows relates links even if they would cycle', () => {
  // 'relates' links don't create hierarchies, no cycle check needed
  const config = createTestConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const A = taskService.create({ title: 'A', bodyMd: '' });
  const B = taskService.create({ title: 'B', bodyMd: '' });

  linkService.create(A.id, B.id, 'relates');

  // This should succeed (relates doesn't create hierarchy)
  const link = linkService.create(B.id, A.id, 'relates');
  assert.ok(link.id);
});
```

### Performance Tests

```typescript
test('detectCycle() performance with 50 children', async () => {
  const config = createTestConfig();
  const taskService = new TaskService({ config });
  const linkService = new LinkService({ config });

  const root = taskService.create({ title: 'Root', bodyMd: '' });
  const children = [];

  // Create 50 children
  for (let i = 0; i < 50; i++) {
    const child = taskService.create({ title: `Child ${i}`, bodyMd: '' });
    linkService.create(child.id, root.id, 'parent');
    children.push(child);
  }

  // Measure cycle detection time
  const start = performance.now();

  assert.throws(() => {
    linkService.create(root.id, children[0].id, 'parent');
  }, /Circular parent-child relationship detected/);

  const elapsed = performance.now() - start;

  assert.ok(elapsed < 100, `Cycle detection took ${elapsed}ms (expected < 100ms)`);
});
```

---

## Implementation Checklist

- [ ] Add `detectCycle()` private method to `LinkService` class
- [ ] Update `create()` method to call cycle detection before creating link
- [ ] Only apply cycle detection for `parent` and `child` link types
- [ ] Add appropriate error message: "Circular parent-child relationship detected"
- [ ] Add unit tests for 2-level, 3-level, and 5-level cycles
- [ ] Add test for valid tree structure (no false positives)
- [ ] Add test for 'relates' links (should not trigger cycle detection)
- [ ] Add performance test with 50 children
- [ ] Verify SQLite version requirement (3.8.3+) in documentation
- [ ] Update API error response schema to include cycle detection error

---

## References

- SQLite Recursive CTE: https://www.sqlite.org/lang_with.html
- Graph Cycle Detection Algorithms: https://en.wikipedia.org/wiki/Cycle_(graph_theory)
- Better-sqlite3 Documentation: https://github.com/WiseLibs/better-sqlite3
- Existing codebase: `/packages/core/src/linkService.ts`
- Database schema: `/schema/001_init.sql`
