# Quickstart: Bookmark Functionality Implementation

**Feature**: 002-memo-bookmark-functionality
**Date**: 2025-10-14
**For**: Developers implementing bookmark commands

---

## Overview

This quickstart guides you through implementing bookmark functionality for memos and tasks. You'll add 4 new CLI commands, modify 2 existing commands, and extend 2 repository methods.

**Estimated Time**: 4-6 hours (including tests)

---

## Prerequisites

Before starting:

1. **Read these documents** (in order):
   - `spec.md` - Understand user stories and success criteria
   - `research.md` - Understand design decisions (idempotency, visual indicators, etc.)
   - `data-model.md` - Understand database usage (no schema changes needed)
   - `contracts/cli-commands.md` - Understand command signatures and errors

2. **Setup development environment**:
   ```bash
   cd /path/to/meme-gtd
   pnpm install
   pnpm build
   ```

3. **Verify current branch**:
   ```bash
   git branch --show-current
   # Should show: 002-memo-bookmark-functionality
   ```

4. **Verify database schema** has `is_bookmarked`:
   ```bash
   pnpm run mgtd:dev init --db /tmp/test.db --force
   sqlite3 /tmp/test.db "PRAGMA table_info(issues);" | grep is_bookmarked
   # Should show: is_bookmarked | INTEGER | 0 | 0 | 0
   ```

---

## Implementation Path

### Step 1: Repository Layer (packages/db)

**File**: `packages/db/src/memoRepository.ts`

Add the `setBookmark()` method:

```typescript
export function setBookmark(db: Database, id: number, isBookmarked: boolean): void {
  const stmt = db.prepare(`
    UPDATE issues
    SET is_bookmarked = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND type = 'memo'
      AND is_deleted = 0
  `);

  const result = stmt.run(isBookmarked ? 1 : 0, id);

  if (result.changes === 0) {
    // Check if it's a type mismatch or not found
    const check = db.prepare('SELECT type FROM issues WHERE id = ? AND is_deleted = 0').get(id);
    if (check && check.type !== 'memo') {
      throw new Error(`Issue #${id} is not a memo`);
    }
    throw new Error(`Memo #${id} not found`);
  }
}
```

**Test First** (TDD):
Create `packages/db/test/memoRepository.test.ts` and write tests for:
- Setting bookmark on unbookmarked memo
- Setting bookmark on already-bookmarked memo (idempotent)
- Unsetting bookmark on bookmarked memo
- Error: non-existent ID
- Error: task ID (type mismatch)

Run tests: `pnpm --filter @meme-gtd/db test`

**File**: `packages/db/src/taskRepository.ts`

Add the same `setBookmark()` method but with `type = 'task'`:

```typescript
export function setBookmark(db: Database, id: number, isBookmarked: boolean): void {
  const stmt = db.prepare(`
    UPDATE issues
    SET is_bookmarked = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
      AND type = 'task'
      AND is_deleted = 0
  `);

  const result = stmt.run(isBookmarked ? 1 : 0, id);

  if (result.changes === 0) {
    const check = db.prepare('SELECT type FROM issues WHERE id = ? AND is_deleted = 0').get(id);
    if (check && check.type !== 'task') {
      throw new Error(`Issue #${id} is not a task`);
    }
    throw new Error(`Task #${id} not found`);
  }
}
```

**Test**: Create `packages/db/test/taskRepository.test.ts` with similar test cases.

---

### Step 2: CLI Commands (packages/cli)

#### 2a. memo bookmark

**File**: `packages/cli/src/commands/memo/bookmark.ts`

```typescript
import { Command, Flags } from '@oclif/core';
import { loadConfig } from '@meme-gtd/config';
import { getDatabase } from '@meme-gtd/db';
import { setBookmark } from '@meme-gtd/db/memoRepository';

export default class MemoBookmark extends Command {
  static override description = 'Mark a memo as bookmarked for quick access';

  static override examples = [
    '<%= config.bin %> <%= command.id %> 12',
    '<%= config.bin %> <%= command.id %> 12 --json',
  ];

  static override flags = {
    json: Flags.boolean({
      char: 'j',
      summary: 'Output result as JSON',
      description: 'Return the bookmark status in JSON format.',
      default: false,
    }),
  };

  static override args = [
    {
      name: 'id',
      required: true,
      description: 'Memo ID to bookmark',
      parse: async (input: string) => {
        const id = parseInt(input, 10);
        if (isNaN(id) || id <= 0) {
          throw new Error('Invalid ID: must be a positive integer');
        }
        return id;
      },
    },
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(MemoBookmark);
    const config = await loadConfig();
    const db = getDatabase(config.dbPath);

    try {
      setBookmark(db, args.id, true);

      if (flags.json) {
        this.log(JSON.stringify({ id: args.id, isBookmarked: true }));
      } else {
        this.log(`Bookmarked memo #${args.id}`);
      }
    } catch (error) {
      this.error(error instanceof Error ? error.message : String(error), { exit: 1 });
    }
  }
}
```

**Test First**: Create `packages/cli/test/commands/memo/bookmark.test.js`

See `contracts/cli-commands.md` for full test scenarios.

#### 2b. memo unbookmark

**File**: `packages/cli/src/commands/memo/unbookmark.ts`

Similar to `bookmark.ts`, but call `setBookmark(db, args.id, false)` and output "Removed bookmark from memo #X".

#### 2c. task bookmark / unbookmark

**Files**:
- `packages/cli/src/commands/task/bookmark.ts`
- `packages/cli/src/commands/task/unbookmark.ts`

Copy from memo commands, replace:
- Import from `@meme-gtd/db/taskRepository`
- Error messages: "memo" → "task"
- Output messages: "memo" → "task"

---

### Step 3: Modify list Commands

#### 3a. memo list

**File**: `packages/cli/src/commands/memo/list.ts`

Add flag:
```typescript
bookmarked: Flags.boolean({
  summary: 'Show only bookmarked memos',
  description: 'Filter the list to show only bookmarked memos.',
  default: false,
}),
```

Modify query building:
```typescript
let whereClauses = ['type = ?', 'is_deleted = 0'];
let params: any[] = ['memo'];

if (flags.bookmarked) {
  whereClauses.push('is_bookmarked = 1');
}

// ... existing label, search filters
```

Modify text output to show `★`:
```typescript
for (const memo of memos) {
  const indicator = memo.is_bookmarked ? '★' : ' ';
  this.log(`${indicator} #${memo.id} ${preview} ...`);
}
```

Ensure JSON output includes `isBookmarked`:
```typescript
{
  id: memo.id,
  body: memo.body_md,
  updatedAt: memo.updated_at,
  isBookmarked: memo.is_bookmarked === 1,  // Convert SQLite integer to boolean
}
```

#### 3b. task list

**File**: `packages/cli/src/commands/task/list.ts`

Apply same changes as `memo list`.

---

### Step 4: Modify memo promote

**File**: `packages/cli/src/commands/memo/promote.ts` (or wherever promotion logic lives)

When creating the new task record, copy `is_bookmarked`:

```typescript
const newTask = {
  type: 'task',
  title: flags.title,
  body_md: memo.body_md,
  status: 'open',
  is_bookmarked: memo.is_bookmarked,  // NEW: preserve bookmark status
  // ... other fields
};
```

**Test**: Verify in integration test that promoting a bookmarked memo creates a bookmarked task.

---

## Testing Strategy

### Unit Tests (packages/db)

Run: `pnpm --filter @meme-gtd/db test`

- `memoRepository.test.ts`: 5-7 tests for setBookmark()
- `taskRepository.test.ts`: 5-7 tests for setBookmark()

### Integration Tests (packages/cli)

Run: `pnpm --filter meme-gtd-cli test`

- `bookmark.test.js` (memo): 8-10 tests covering happy path, errors, idempotency, JSON output
- `bookmark.test.js` (task): 8-10 tests (same scenarios)
- Update `list.test.js` (memo): Add `--bookmarked` filter tests
- Update `list.test.js` (task): Add `--bookmarked` filter tests
- Update `promote.test.js`: Add bookmark preservation tests

**Expected Total**: ~23 tests (as per contracts/cli-commands.md)

---

## Manual Verification

After implementation:

```bash
# Build everything
pnpm build

# Initialize test database
pnpm run mgtd:dev init --db /tmp/bookmark-test.db --force

# Create some memos
pnpm run mgtd:dev memo create -b "Memo 1" -j
pnpm run mgtd:dev memo create -b "Memo 2" -j
pnpm run mgtd:dev memo create -b "Memo 3" -j

# Bookmark memo #1
pnpm run mgtd:dev memo bookmark 1
# Output: Bookmarked memo #1

# Bookmark again (idempotent)
pnpm run mgtd:dev memo bookmark 1
# Output: Bookmarked memo #1 (no error)

# List all memos (should show ★ for #1)
pnpm run mgtd:dev memo list

# List only bookmarked
pnpm run mgtd:dev memo list --bookmarked
# Should show only #1

# JSON output
pnpm run mgtd:dev memo bookmark 2 --json
# Output: {"id":2,"isBookmarked":true}

# Unbookmark
pnpm run mgtd:dev memo unbookmark 1

# Promote bookmarked memo
pnpm run mgtd:dev memo bookmark 3
pnpm run mgtd:dev memo promote 3 --title "Task from bookmarked memo"
pnpm run mgtd:dev task list --bookmarked --json
# Should show new task with isBookmarked: true

# Error case: wrong type
pnpm run mgtd:dev memo bookmark 4
# Output: Error: Issue #4 is not a memo
```

---

## Common Pitfalls

### 1. SQLite Boolean Handling

SQLite stores booleans as integers (0/1). Always convert:
```typescript
// Reading from DB
isBookmarked: row.is_bookmarked === 1

// Writing to DB
stmt.run(isBookmarked ? 1 : 0, id)
```

### 2. Type Mismatch Errors

Check type BEFORE checking existence:
```typescript
const check = db.prepare('SELECT type FROM issues WHERE id = ?').get(id);
if (check && check.type !== 'memo') {
  throw new Error(`Issue #${id} is not a memo`);
}
throw new Error(`Memo #${id} not found`);
```

### 3. Idempotency

NEVER throw an error if already bookmarked/unbookmarked. Just succeed silently:
```typescript
// ❌ BAD
if (memo.is_bookmarked) {
  throw new Error('Already bookmarked');
}

// ✅ GOOD
setBookmark(db, id, true); // Succeeds regardless of current state
```

### 4. Visual Indicator Alignment

Use a single character space for non-bookmarked items to maintain table alignment:
```typescript
const indicator = memo.is_bookmarked ? '★' : ' '; // Space, not empty string
```

---

## Definition of Done

Before marking the feature complete, verify:

- ✅ All tests pass (`pnpm test`)
- ✅ Build succeeds (`pnpm build`)
- ✅ Manual verification scenarios pass
- ✅ All 4 new commands exist and work
- ✅ Both list commands support `--bookmarked` filter
- ✅ Promotion preserves bookmark status
- ✅ Visual indicators (★) appear in text output
- ✅ JSON output includes `isBookmarked` field
- ✅ Error messages are clear and helpful
- ✅ Idempotency guaranteed (no errors on repeat operations)

---

## Next Steps

After completing implementation:

1. Run full test suite: `pnpm test`
2. Commit changes with meaningful messages (see git commit conventions in CLAUDE.md)
3. Update CHANGELOG.md with bookmark feature (version 0.2.0)
4. Create PR to merge into `feature/init-memo` or `main`
5. Manual QA using scenarios from `contracts/cli-commands.md`

---

## Reference Materials

- **Spec**: `spec.md` - User stories and requirements
- **Research**: `research.md` - Design decisions
- **Data Model**: `data-model.md` - Database usage
- **Contracts**: `contracts/cli-commands.md` - Command signatures
- **Plan**: `plan.md` - Overall implementation plan

For questions or issues, refer to existing similar commands:
- `memo/label/add.ts` - Simple UPDATE operation
- `memo/list.ts` - Filter logic
- `memo/promote.ts` - Field copying between types
