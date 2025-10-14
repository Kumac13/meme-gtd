# Research: Memo & Task Bookmark Functionality

**Feature**: 002-memo-bookmark-functionality
**Date**: 2025-10-14
**Purpose**: Research implementation patterns for bookmark functionality in CLI tools

---

## Research Areas

### 1. CLI Command Patterns for Bookmark-like Features

**Research Question**: What are established patterns for bookmark/pin/star commands in popular CLI tools?

**Findings**:

- **GitHub CLI (`gh`)**: Uses `gh issue pin` / `gh issue unpin` for pinning issues to repository
- **Git**: Uses `git tag` for marking specific commits (similar conceptual model)
- **Docker**: Uses `docker tag` for marking images
- **npm**: Uses `npm star` / `npm unstar` for favoriting packages

**Decision**: Use `bookmark` / `unbookmark` verbs (not `pin` / `star`)

**Rationale**:
- "Bookmark" clearly communicates the purpose (quick access to saved items)
- Avoids confusion with GitHub's "pin" (which has different semantics - visibility, not access)
- More intuitive for GTD context where users "mark" items for later review
- Aligns with database field name `is_bookmarked` already in schema

**Alternatives Considered**:
- `pin` / `unpin`: Too similar to GitHub Issues pinning (which pins to top of list publicly)
- `star` / `unstar`: Implies rating/favoriting rather than access prioritization
- `mark` / `unmark`: Too generic, doesn't convey purpose

---

### 2. Idempotency Patterns in CLI Operations

**Research Question**: How should bookmark commands handle already-bookmarked or non-bookmarked items?

**Findings**:

- **Git operations**: `git add` is idempotent - adding an already-staged file succeeds silently
- **Unix file operations**: `mkdir -p` succeeds if directory exists
- **Docker**: `docker tag` overwrites existing tags without error
- **HTTP REST**: PUT requests are typically idempotent

**Decision**: Implement idempotent bookmark operations

**Rationale**:
- Users expect bookmark commands to succeed regardless of current state
- Reduces cognitive load - users don't need to check state before running command
- Matches REST API best practices (if future API is added)
- Simplifies scripting and automation

**Implementation**:
- `mgtd memo bookmark 12`: Always succeeds, sets `is_bookmarked = true`
- `mgtd memo unbookmark 12`: Always succeeds, sets `is_bookmarked = false`
- No error messages for "already bookmarked" or "not bookmarked"
- Success message indicates current state after operation

**Alternatives Considered**:
- Error on duplicate: Would require users to check state first, poor UX
- Warning on duplicate: Creates noise in scripts, inconsistent with Unix philosophy

---

### 3. Bookmark State Preservation During Promotion

**Research Question**: Should bookmark status transfer from memo to task during `memo promote`?

**Findings**:

- **GitHub Issues → PR**: Labels, assignees, and milestones can be transferred
- **Email clients**: Flagged/starred status often transfers when moving messages
- **Note-taking apps**: Tags and bookmarks typically transfer when converting notes to tasks

**Decision**: Preserve bookmark status during promotion

**Rationale**:
- If a memo was important enough to bookmark, the derived task is likely equally important
- Maintains user intent across the memo→task transition
- Avoids forcing users to re-bookmark after promotion
- Consistent with how labels are already preserved during promotion

**Implementation**:
```typescript
// In memo promote workflow
const newTask = await createTask({
  ...taskData,
  is_bookmarked: sourceMemo.is_bookmarked  // Copy bookmark status
});
```

**Alternatives Considered**:
- Reset to false: Would require users to re-bookmark, poor UX for workflow continuity
- Prompt user: Too disruptive for a minor attribute, slows down GTD capture→clarify→organize flow

---

### 4. Filter Combination Behavior

**Research Question**: How should `--bookmarked` interact with other filters like `--label` or `--search`?

**Findings**:

- **Git log**: Multiple filters combine with AND logic (`git log --author=X --since=Y`)
- **GitHub CLI**: `gh issue list --label bug --state open` combines with AND
- **SQL WHERE clauses**: Multiple conditions AND by default
- **Unix tools**: Pipeline filters (grep, awk) chain with AND semantics

**Decision**: Use AND logic for filter combination

**Rationale**:
- Matches user expectations from similar tools
- More powerful filtering (users can narrow down results progressively)
- Consistent with existing `--label` and `--search` filter behavior
- Simpler implementation (no need for complex OR/NOT logic)

**Implementation**:
```bash
# Show bookmarked memos with label "urgent"
mgtd memo list --bookmarked --label urgent

# SQL: WHERE is_bookmarked = true AND labels LIKE '%urgent%'
```

**Alternatives Considered**:
- OR logic: Would make filters too permissive, less useful for narrowing results
- Complex boolean expressions: Too complicated for CLI interface, YAGNI

---

### 5. Visual Indicators in List Output

**Research Question**: How should bookmarked items be visually distinguished in text output?

**Findings**:

- **GitHub CLI**: Uses emoji (🚀) for releases, labels with colors
- **Git**: Uses `*` for current branch, `->` for remote tracking
- **npm list**: Uses tree characters (├──, └──) for hierarchy
- **Unicode conventions**: ⭐ (star), 📌 (pin), 🔖 (bookmark) are common

**Decision**: Use `★` (filled star) for bookmarked items in text output

**Rationale**:
- ★ is widely recognized symbol for favorites/bookmarks
- Single character, doesn't disrupt table alignment
- Renders correctly in most terminals (Unicode U+2605)
- Distinct from other indicators in the CLI

**Implementation**:
```typescript
// In list formatter
const bookmarkIndicator = memo.is_bookmarked ? '★' : ' ';
console.log(`${bookmarkIndicator} #${memo.id} ${preview}`);
```

**Display Format**:
```
  ID    Preview                        Updated        Labels
★ #12   Important design decision...   2 hours ago    urgent, design
  #13   Regular memo content...        1 day ago      inbox
★ #14   Critical bug to investigate    3 hours ago    bug
```

**Alternatives Considered**:
- `[B]` prefix: Too verbose, harder to scan visually
- Color coding: Not accessible, doesn't work in all terminals
- No indicator: Reduces usability, users can't see bookmarks without filter

---

### 6. Repository Method Design

**Research Question**: What's the best signature for the setBookmark repository method?

**Findings**:

- **Active Record pattern**: `memo.bookmark()` / `memo.unbookmark()` (instance methods)
- **Repository pattern**: `memoRepository.setBookmark(id, value)` (data layer)
- **Existing codebase**: Uses repository pattern (e.g., `memoRepository.getMemo(id)`)

**Decision**: Add `setBookmark(id: number, value: boolean)` to repository

**Rationale**:
- Consistent with existing repository pattern in packages/db
- Single method handles both bookmark and unbookmark (boolean parameter)
- Clear separation: CLI layer handles command routing, repository handles data
- Easier to test (mock repository method)

**Implementation**:
```typescript
// packages/db/src/memoRepository.ts
export function setBookmark(db: Database, id: number, isBookmarked: boolean): void {
  const stmt = db.prepare(`
    UPDATE issues
    SET is_bookmarked = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND type = 'memo' AND is_deleted = 0
  `);
  stmt.run(isBookmarked ? 1 : 0, id);
}
```

**Alternatives Considered**:
- Separate `bookmark()` / `unbookmark()` methods: Duplicates logic, more code to maintain
- Instance method on Memo model: Would require ORM, doesn't match current architecture

---

## Summary of Decisions

| Area | Decision | Key Reason |
|------|----------|------------|
| Command naming | `bookmark` / `unbookmark` | Clear purpose, avoids GitHub "pin" confusion |
| Idempotency | Always succeed regardless of current state | Matches Unix philosophy, better UX |
| Promotion behavior | Preserve bookmark status | Maintains user intent across workflows |
| Filter combination | AND logic for multiple filters | Consistent with existing filters, more powerful |
| Visual indicator | `★` character in list output | Universally recognized, terminal-friendly |
| Repository API | `setBookmark(id, boolean)` | Consistent with existing pattern, single method |

---

## Open Questions

None - all research areas resolved with clear decisions.
