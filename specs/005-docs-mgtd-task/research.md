# Research: mgtd task Command Implementation

**Feature**: 005-docs-mgtd-task
**Date**: 2025-10-14
**Status**: Complete

## Research Overview

This document consolidates technical research and design decisions for implementing the `mgtd task` command set. Since this feature mirrors the existing `mgtd memo` implementation with task-specific extensions, most technical patterns are already validated. Research focuses on task-specific concerns: status management, scheduled date handling, and state transition semantics.

## 1. Task Status Enum and State Transitions

### Decision

Task status follows GTD workflow phases with 6 states:
- `open` - Initial state, in Inbox
- `next` - Queued for immediate action (Next Actions list)
- `waiting` - Blocked on external dependency (Waiting For list)
- `scheduled` - Time-specific action (Calendar/Tickler)
- `done` - Completed successfully
- `canceled` - Abandoned or no longer relevant

### Rationale

- Aligns with GTD methodology phases documented in `docs/requirement.md` section 3 (GTD Workflow)
- Provides clear semantic meaning for list filtering (`task list --status next`)
- Separates completion types (done vs canceled) for analytics and review
- `scheduled` state works with `scheduled_on` date field for calendar integration

### Alternatives Considered

1. **Simpler 3-state model (open/done/canceled)**:
   - Rejected: Loses GTD workflow granularity (Next Actions vs Waiting For distinction)
   - Users would need labels or custom fields to replicate GTD phases

2. **Open-ended status strings (user-defined)**:
   - Rejected: Increases complexity, breaks type safety, harder to validate
   - CLI would need dynamic validation instead of compile-time enum

3. **Separate `priority` field instead of status differentiation**:
   - Rejected: Priority and workflow phase are orthogonal concerns
   - Users can use labels for priority (`--label high-priority`)

### Implementation Notes

- Database: `issues.status` column already exists as TEXT, stores enum value
- Validation: CLI commands validate status input against allowed enum before database insertion
- Type safety: TypeScript enum or union type `'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled'`

## 2. Scheduled Date Format and Validation

### Decision

Use ISO 8601 date-only format (YYYY-MM-DD) stored as TEXT in SQLite `scheduled_on` column.

### Rationale

- ISO 8601 is lexicographically sortable (enables `ORDER BY scheduled_on`)
- TEXT storage matches SQLite best practices (no native date type)
- Date-only format aligns with requirement FR-017 and Out of Scope (no time components)
- Human-readable in CLI output and --json exports

### Alternatives Considered

1. **Unix timestamp (integer seconds)**:
   - Rejected: Less human-readable in CLI output, requires conversion for display
   - Loses timezone-agnostic date semantics (GTD tasks are date-focused, not timestamp-focused)

2. **SQLite DATETIME type simulation**:
   - Rejected: SQLite has no native datetime type, TEXT is standard
   - Adding time components violates Out of Scope requirement

3. **Separate year/month/day integer columns**:
   - Rejected: Complicates queries, harder to validate, non-standard

### Implementation Notes

- Parsing: Use JavaScript `Date` constructor or date library (e.g., `new Date('2025-10-20')`)
- Validation: Regex `/^\d{4}-\d{2}-\d{2}$/` + `Date.parse()` check for validity
- Display: Format for human output using `Intl.DateTimeFormat` or keep ISO for simplicity
- Edge case: Past dates are allowed (users may schedule past items for tracking)

## 3. Type Safety: Preventing Memo/Task ID Confusion

### Decision

Implement runtime type checking at repository layer before any database operation:

```typescript
// In taskRepository.ts
const validateTaskType = (db: Database, id: number): void => {
  const row = db.prepare('SELECT type FROM issues WHERE id = ? AND is_deleted = 0').get(id);
  if (!row) throw new Error(`Task not found: ${id}`);
  if (row.type !== 'task') throw new Error(`ID refers to different type (${row.type})`);
};
```

### Rationale

- Matches requirement FR-012: "MUST validate type field and reject operations when provided ID refers to memo"
- Catches errors before data corruption (e.g., updating memo record with task-specific status)
- Provides clear error messages for user correction
- Mirrors existing `getMemo()` pattern in `memoRepository.ts` line 72-73

### Alternatives Considered

1. **Separate ID namespaces (memo IDs start at 1, task IDs at 1000000)**:
   - Rejected: Complicates ID generation, breaks single sequence, requires migration
   - Violates existing schema design (single `issues` table with shared ID sequence)

2. **Type prefix in CLI (M#12 for memo, T#34 for task)**:
   - Considered as display enhancement but not enforced at input
   - Display-only: CLI can show `M#12` and `T#34` for clarity, but users input numeric IDs
   - Does not replace runtime validation (user could still type wrong ID)

3. **No validation (rely on user discipline)**:
   - Rejected: High risk of silent data corruption
   - Example failure: `mgtd task close <memoId>` would set memo status to "done" (invalid state)

### Implementation Notes

- Every `getTask()`, `updateTask()`, `deleteTask()` calls `validateTaskType()` first
- Error messages follow existing pattern from `memoRepository.ts` line 77
- CLI layer catches errors and formats for user-friendly output

## 4. State Transition Commands (close/cancel/reopen)

### Decision

Provide dedicated commands for common state transitions:
- `mgtd task close <id>` - Sets status to `done`
- `mgtd task cancel <id>` - Sets status to `canceled`
- `mgtd task reopen <id>` - Sets status to `open`

All support optional `--comment` flag to document reason for transition.

### Rationale

- Improves UX over generic `mgtd task edit <id> --status done`
- Semantic clarity: "close task #42" is more intuitive than "edit status to done"
- Enables future enhancement: auto-commenting on close (e.g., "Closed on 2025-10-14")
- Matches GitHub CLI convention: `gh issue close`, `gh pr reopen`

### Alternatives Considered

1. **Single generic edit command only**:
   - Rejected: Less discoverable, longer command syntax for common operations
   - Users would need to remember exact status enum values

2. **More granular transitions (open-to-next, next-to-waiting, etc.)**:
   - Rejected: Over-engineering, too many commands for state machine
   - Users can use `mgtd task edit --status <target>` for arbitrary transitions

3. **Interactive mode (prompt for new status)**:
   - Out of scope for CLI (conflicts with automation/scripting)
   - Could be added later as `mgtd task transition <id>` with prompts

### Implementation Notes

- `close` and `cancel` are terminal states (but `reopen` allows recovery)
- `reopen` resets to `open` (Inbox), not previous status (simplifies implementation)
- Comment flag: `--comment "Resolved by PR #123"` calls `addComment()` after status update
- Each command is separate CLI file (packages/cli/src/commands/task/close.ts)

## 5. Reusing Memo Infrastructure

### Decision

Task commands reuse existing infrastructure without modification:
- Labels: Same `labels`, `issue_labels` tables (no task-specific labels)
- Comments: Same `comments`, `comment_revisions` tables (generic to `issues`)
- Projects: Same `projects`, `project_items` tables
- FTS: Same `issues_fts` table (indexes both memo and task body_md)
- Bookmarks: Same `is_bookmarked` column on `issues` table

### Rationale

- Zero database migrations needed (requirement: "Reuses existing database schema")
- Maintains consistency: labels applied to memos can be applied to tasks
- Simplifies codebase: No parallel label/comment/project implementations
- FTS already handles `type` filtering in WHERE clause

### Alternatives Considered

1. **Separate task_labels, task_comments tables**:
   - Rejected: Unnecessary duplication, complicates label management commands
   - Would require separate `mgtd task-label create` vs `mgtd label create`

2. **Task-specific label namespaces (e.g., "task:urgent")**:
   - Not enforced: Users can adopt naming convention voluntarily
   - No technical restriction, purely organizational

3. **Disable certain features for tasks (e.g., no comments on tasks)**:
   - Rejected: Artificial limitation, comments useful for task progress notes
   - Requirement FR-009 explicitly requires task comments

### Implementation Notes

- `taskRepository.ts` calls same `attachLabels()`, `attachProjects()` helpers from `memoRepository.ts`
- Consider extracting shared functions to `commonRepository.ts` or `issueRepository.ts` during implementation
- FTS queries: `WHERE i.type = 'task' AND f.body_md MATCH @search`

## 6. CLI Command Structure and Naming

### Decision

Mirror `mgtd memo` command tree structure exactly:
```
mgtd task create
mgtd task list
mgtd task view
mgtd task edit
mgtd task delete
mgtd task close          # Task-specific
mgtd task cancel         # Task-specific
mgtd task reopen         # Task-specific
mgtd task bookmark
mgtd task unbookmark
mgtd task comment add
mgtd task comment edit
mgtd task comment delete
mgtd task label add
mgtd task label set
mgtd task label remove
```

### Rationale

- Consistency: Users familiar with `mgtd memo` commands learn `mgtd task` instantly
- Follows GitHub CLI convention: `gh issue` and `gh pr` have parallel structures
- oclif framework supports nested command directories naturally (task/comment/add.ts)

### Alternatives Considered

1. **Flat namespace (mgtd task-create, mgtd task-list)**:
   - Rejected: Harder to navigate, doesn't scale for subcommands (task-comment-add)
   - oclif best practice uses directories for namespacing

2. **Shorter aliases (mgtd t create, mgtd t ls)**:
   - Out of scope for initial implementation
   - Could be added via oclif aliases config later

3. **Different verb for create (mgtd task new, mgtd task add)**:
   - Rejected: Breaks consistency with `mgtd memo create`
   - GitHub CLI uses `create` (`gh issue create`)

### Implementation Notes

- Each command is separate TypeScript file in packages/cli/src/commands/task/
- oclif discovers commands via directory structure automatically
- Shared options (--json, --editor, --body-file) reuse flag definitions from memo commands

## 7. Testing Strategy

### Decision

Follow TDD approach established in v0.1.0/v0.1.1:
1. Write tests first for each repository function
2. Write tests for service layer methods
3. Write CLI integration tests (command invocation via node:test)
4. Run test suite before implementation (`pnpm test` must fail initially)
5. Implement until all tests pass (Red-Green-Refactor)

### Rationale

- Requirement: "TDD approach mandatory" (from CLAUDE.md)
- Proven approach from memo implementation (see docs/plan_init_memo.md)
- Prevents regression: Tests ensure task commands don't break memo commands
- Contract validation: Tests document expected behavior for future maintainers

### Alternatives Considered

1. **Implementation-first, tests-later**:
   - Rejected: Violates project policy from CLAUDE.md
   - Risks: Harder to refactor, tests may be written to pass existing code (not spec)

2. **Only unit tests (no integration tests)**:
   - Rejected: CLI commands require integration tests for flag parsing, output formatting
   - Unit tests alone miss oclif framework behavior

3. **Manual testing only**:
   - Rejected: Not repeatable, doesn't catch regressions, slows iteration

### Implementation Notes

- Test files: `packages/db/test/taskRepository.test.ts`, `packages/core/test/taskService.test.ts`, `packages/cli/test/commands/task/*.test.ts`
- Use in-memory SQLite (`:memory:`) for test database
- Mock editor for CLI tests (avoid launching $EDITOR in CI)
- Test type validation: Ensure memo IDs fail when passed to task commands

## 8. Performance Optimization

### Decision

Rely on existing SQLite indexes and FTS5 for performance:
- Status filtering: Add index on `(type, status, is_deleted)` if not present
- Label filtering: Existing `issue_labels` join is fast with small label cardinality
- Full-text search: `issues_fts` table already indexes `body_md` with FTS5
- Date range: Index on `(type, scheduled_on)` for future date queries

### Rationale

- Success criteria SC-002: "Filter 1000+ tasks by status or label in <1 second"
- SQLite performs well on indexed columns with low cardinality (6 status values)
- FTS5 provides O(log n) search on indexed text
- 1000 tasks is small dataset for SQLite (handles millions of rows efficiently)

### Alternatives Considered

1. **Caching layer (Redis, in-memory LRU)**:
   - Rejected: Over-engineering for local-only CLI, adds complexity
   - SQLite on local disk is already fast for 1000-record queries

2. **Pagination with cursor-based navigation**:
   - Out of scope: `--limit` flag provides basic pagination
   - Cursor-based (--after <id>) could be added later if needed

3. **Pre-computed aggregates (task count by status)**:
   - Not needed for initial implementation
   - SQLite `COUNT(*)` queries with indexes are fast enough

### Implementation Notes

- Check existing indexes: `SELECT * FROM sqlite_master WHERE type='index'`
- Add composite index if missing: `CREATE INDEX IF NOT EXISTS idx_issues_type_status ON issues(type, status, is_deleted)`
- Monitor performance with `EXPLAIN QUERY PLAN` during testing

## Summary of Decisions

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Status Enum** | 6 states (open/next/waiting/scheduled/done/canceled) | Aligns with GTD workflow, semantic clarity |
| **Date Format** | ISO 8601 date-only (YYYY-MM-DD) as TEXT | Sortable, human-readable, standard |
| **Type Safety** | Runtime validation at repository layer | Prevents data corruption, clear errors |
| **State Transitions** | Dedicated commands (close/cancel/reopen) | Better UX than generic edit |
| **Infrastructure Reuse** | Share labels/comments/projects/FTS with memos | Zero migrations, consistency |
| **Command Structure** | Mirror `mgtd memo` tree exactly | Consistency, predictability |
| **Testing** | TDD with unit + integration tests | Project policy, prevents regression |
| **Performance** | SQLite indexes + FTS5, no caching | Sufficient for local CLI scale |

## Next Steps

With research complete, proceed to Phase 1:
- **data-model.md**: Document Task entity schema and relationships
- **contracts/**: Define repository function signatures and CLI command contracts
- **quickstart.md**: Provide getting started guide for `mgtd task` commands
