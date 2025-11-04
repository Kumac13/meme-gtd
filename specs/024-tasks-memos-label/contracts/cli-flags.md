# CLI Flag Specifications

**Feature**: 024-tasks-memos-label
**Date**: 2025-11-04

## Overview

This document specifies the CLI flag updates for label filtering with comma-separated values support. The implementation extends existing `--label` and `--status` flags to support OR-based filtering with multiple values.

---

## Command: `mgtd task list`

### Updated Flags

#### `--label` / `-l`

**Current Behavior**:
```bash
mgtd task list --label bug
# Filters tasks with "bug" label
```

**New Behavior** (⭐ EXTENDED):
```bash
# Single label (backward compatible)
mgtd task list --label bug

# Multiple labels (OR logic - NEW)
mgtd task list --label bug,enhancement,documentation

# Combined with other flags (AND logic)
mgtd task list --label bug --status open
mgtd task list --label bug,enhancement --status open --bookmarked
```

**Flag Specification**:
```typescript
static flags = {
  label: Flags.string({
    char: 'l',
    summary: 'Filter by label name(s)',
    description: 'Filter tasks by label. Supports comma-separated values for OR logic (e.g., bug,enhancement)',
    required: false,
  }),
  // ... other existing flags
}
```

**Parsing Logic**:
```typescript
async run() {
  const { flags } = await this.parse(TaskListCommand);

  const filters: ListTaskFilters = {};

  // ⭐ NEW: Parse comma-separated labels
  if (flags.label) {
    const labelArray = flags.label.split(',').map(l => l.trim()).filter(Boolean);
    filters.labels = labelArray;
  }

  if (flags.status) filters.status = flags.status;
  if (flags.bookmarked) filters.isBookmarked = true;

  const taskService = new TaskService({ db: this.db });
  const tasks = taskService.list(filters);

  this.printTasks(tasks, flags.json);
}
```

**Examples**:
```bash
# Single label
$ mgtd task list --label bug
Listing tasks filtered by label: bug
#1  [bug] Fix login issue                     [open]
#3  [bug, high-priority] Memory leak           [open]

# Multiple labels (OR logic)
$ mgtd task list --label bug,enhancement
Listing tasks filtered by labels: bug, enhancement
#1  [bug] Fix login issue                     [open]
#2  [enhancement] Add dark mode                [next]
#3  [bug, high-priority] Memory leak           [open]
#5  [enhancement] Export to PDF                [waiting]

# Combined with status (AND logic)
$ mgtd task list --label bug --status open
Listing tasks filtered by label: bug, status: open
#1  [bug] Fix login issue                     [open]
#3  [bug, high-priority] Memory leak           [open]

# No matches
$ mgtd task list --label nonexistent
No tasks found

# JSON output
$ mgtd task list --label bug --json
[
  {
    "id": 1,
    "type": "task",
    "title": "Fix login issue",
    "status": "open",
    "labels": [{"id": 1, "name": "bug", "description": "Bug fixes"}],
    "created_at": "2025-11-01T10:00:00Z",
    "updated_at": "2025-11-01T10:00:00Z",
    "is_bookmarked": false
  }
]
```

**Error Handling**:
```bash
# Empty label name (after trimming)
$ mgtd task list --label "  ,  "
Error: Invalid label filter. Label names cannot be empty.

# Label with spaces (quoted)
$ mgtd task list --label "needs review"
Listing tasks filtered by label: needs review
# (Label name may contain spaces, so this is valid)
```

---

#### `--status` / `-s` (No Changes - Listed for Completeness)

**Existing Behavior** (unchanged):
```bash
mgtd task list --status open
mgtd task list --status done
```

**Flag Specification**:
```typescript
static flags = {
  status: Flags.string({
    char: 's',
    summary: 'Filter by status',
    options: ['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'],
    required: false,
  }),
  // ... other flags
}
```

**Note**: Status filtering does NOT support comma-separated values (status is single-select).

---

#### Other Existing Flags (No Changes)

```typescript
static flags = {
  search: Flags.string({
    summary: 'Filter using full-text search',
    required: false,
  }),
  limit: Flags.integer({
    char: 'n',
    summary: 'Maximum number of rows',
    required: false,
  }),
  order: Flags.string({
    char: 'o',
    summary: 'Sort direction',
    options: ['asc', 'desc'],
    default: 'desc',
    required: false,
  }),
  bookmarked: Flags.boolean({
    summary: 'Show only bookmarked tasks',
    required: false,
  }),
  json: Flags.boolean({
    char: 'j',
    summary: 'Return JSON output',
    required: false,
  }),
}
```

---

## Command: `mgtd memo list`

### Updated Flags

#### `--label` / `-l`

**Current Behavior**:
```bash
mgtd memo list --label idea
# Filters memos with "idea" label
```

**New Behavior** (⭐ EXTENDED):
```bash
# Single label (backward compatible)
mgtd memo list --label idea

# Multiple labels (OR logic - NEW)
mgtd memo list --label idea,meeting-notes,todo

# Combined with other flags (AND logic)
mgtd memo list --label idea --bookmarked
```

**Flag Specification**:
```typescript
static flags = {
  label: Flags.string({
    char: 'l',
    summary: 'Filter by label name(s)',
    description: 'Filter memos by label. Supports comma-separated values for OR logic (e.g., idea,meeting-notes)',
    required: false,
  }),
  // ... other existing flags
}
```

**Parsing Logic**:
```typescript
async run() {
  const { flags } = await this.parse(MemoListCommand);

  const filters: ListMemoFilters = {};

  // ⭐ NEW: Parse comma-separated labels
  if (flags.label) {
    const labelArray = flags.label.split(',').map(l => l.trim()).filter(Boolean);
    filters.labels = labelArray;
  }

  if (flags.bookmarked) filters.isBookmarked = true;

  const memoService = new MemoService({ db: this.db });
  const memos = memoService.list(filters);

  this.printMemos(memos, flags.json);
}
```

**Examples**:
```bash
# Single label
$ mgtd memo list --label idea
Listing memos filtered by label: idea
#10 [idea, technical] Consider using WebSockets...

# Multiple labels (OR logic)
$ mgtd memo list --label idea,meeting-notes
Listing memos filtered by labels: idea, meeting-notes
#10 [idea, technical] Consider using WebSockets...
#12 [meeting-notes] Weekly standup notes...
#15 [idea] User feedback summary...

# Combined with bookmarked
$ mgtd memo list --label idea --bookmarked
Listing bookmarked memos filtered by label: idea
#15 [idea] User feedback summary...

# No matches
$ mgtd memo list --label nonexistent
No memos found

# JSON output
$ mgtd memo list --label idea --json
[
  {
    "id": 10,
    "type": "memo",
    "body_md": "Consider using WebSockets for real-time updates",
    "labels": [
      {"id": 3, "name": "idea", "description": "Feature ideas"},
      {"id": 7, "name": "technical", "description": null}
    ],
    "created_at": "2025-11-03T09:15:00Z",
    "updated_at": "2025-11-03T09:15:00Z",
    "is_bookmarked": false
  }
]
```

---

#### Other Existing Flags (No Changes)

```typescript
static flags = {
  search: Flags.string({
    char: 's',
    summary: 'Filter using full-text search',
    required: false,
  }),
  limit: Flags.integer({
    char: 'n',
    summary: 'Maximum number of rows',
    required: false,
  }),
  order: Flags.string({
    char: 'o',
    summary: 'Sort direction',
    options: ['asc', 'desc'],
    default: 'desc',
    required: false,
  }),
  bookmarked: Flags.boolean({
    summary: 'Show only bookmarked memos',
    required: false,
  }),
  json: Flags.boolean({
    char: 'j',
    summary: 'Return JSON output',
    required: false,
  }),
}
```

**Note**: Memos do NOT have `--status` flag (status is task-specific).

---

## Help Text Updates

### `mgtd task list --help`

```
Filter and display tasks

USAGE
  $ mgtd task list [FLAGS]

FLAGS
  -l, --label=<value>      Filter by label name(s). Comma-separated for OR logic (e.g., bug,enhancement)
  -s, --status=<option>    Filter by status
                           <options: open|next|waiting|scheduled|done|canceled>
  --search=<value>         Filter using full-text search
  -n, --limit=<value>      Maximum number of rows
  -o, --order=<option>     Sort direction
                           <options: asc|desc>
                           [default: desc]
  --bookmarked             Show only bookmarked tasks
  -j, --json               Return JSON output
  -h, --help               Show help for command

EXAMPLES
  $ mgtd task list
  $ mgtd task list --status open
  $ mgtd task list --label bug
  $ mgtd task list --label bug,enhancement
  $ mgtd task list --label bug --status open
  $ mgtd task list --bookmarked --json
```

### `mgtd memo list --help`

```
Filter and display memos

USAGE
  $ mgtd memo list [FLAGS]

FLAGS
  -l, --label=<value>      Filter by label name(s). Comma-separated for OR logic (e.g., idea,meeting-notes)
  -s, --search=<value>     Filter using full-text search
  -n, --limit=<value>      Maximum number of rows
  -o, --order=<option>     Sort direction
                           <options: asc|desc>
                           [default: desc]
  --bookmarked             Show only bookmarked memos
  -j, --json               Return JSON output
  -h, --help               Show help for command

EXAMPLES
  $ mgtd memo list
  $ mgtd memo list --label idea
  $ mgtd memo list --label idea,meeting-notes
  $ mgtd memo list --bookmarked
  $ mgtd memo list --search "meeting notes" --json
```

---

## Test Cases

### Unit Tests (packages/cli/test/commands/task/list.test.js)

```javascript
// ⭐ NEW TEST CASES

describe('mgtd task list --label', () => {
  it('filters tasks by single label', async () => {
    const result = await runCli(['task', 'list', '--label', 'bug', '--json']);
    const tasks = JSON.parse(result.stdout);
    assert.ok(tasks.every(t => t.labels.some(l => l.name === 'bug')));
  });

  it('filters tasks by multiple labels (OR logic)', async () => {
    const result = await runCli(['task', 'list', '--label', 'bug,enhancement', '--json']);
    const tasks = JSON.parse(result.stdout);
    assert.ok(tasks.every(t =>
      t.labels.some(l => l.name === 'bug' || l.name === 'enhancement')
    ));
  });

  it('combines label and status filters (AND logic)', async () => {
    const result = await runCli(['task', 'list', '--label', 'bug', '--status', 'open', '--json']);
    const tasks = JSON.parse(result.stdout);
    assert.ok(tasks.every(t =>
      t.status === 'open' && t.labels.some(l => l.name === 'bug')
    ));
  });

  it('returns empty array for non-existent label', async () => {
    const result = await runCli(['task', 'list', '--label', 'nonexistent', '--json']);
    const tasks = JSON.parse(result.stdout);
    assert.strictEqual(tasks.length, 0);
  });

  it('trims whitespace from comma-separated labels', async () => {
    const result = await runCli(['task', 'list', '--label', ' bug , enhancement ', '--json']);
    const tasks = JSON.parse(result.stdout);
    // Should work same as --label 'bug,enhancement'
    assert.ok(tasks.length > 0);
  });
});
```

### Integration Tests (packages/cli/test/integration/filtering.test.js)

```javascript
// ⭐ NEW INTEGRATION TESTS

describe('CLI filtering integration', () => {
  beforeEach(async () => {
    // Seed test database with predictable data
    await seedTestData();
  });

  it('CLI and API return same results for label filter', async () => {
    const cliResult = await runCli(['task', 'list', '--label', 'bug', '--json']);
    const cliTasks = JSON.parse(cliResult.stdout);

    const apiResponse = await fetch('http://localhost:3001/api/tasks?label=bug');
    const apiTasks = await apiResponse.json();

    assert.deepStrictEqual(cliTasks, apiTasks);
  });

  it('multiple label filter returns correct union', async () => {
    const result = await runCli(['task', 'list', '--label', 'bug,enhancement', '--json']);
    const tasks = JSON.parse(result.stdout);

    // Should include all tasks with bug OR enhancement
    const bugCount = tasks.filter(t => t.labels.some(l => l.name === 'bug')).length;
    const enhancementCount = tasks.filter(t => t.labels.some(l => l.name === 'enhancement')).length;
    const totalCount = tasks.length;

    // Total should be <= sum (some tasks may have both labels)
    assert.ok(totalCount <= bugCount + enhancementCount);
    assert.ok(totalCount >= Math.max(bugCount, enhancementCount));
  });
});
```

---

## Backward Compatibility

### ✅ Single Label Filtering Still Works

```bash
# Old usage (still works)
mgtd task list --label bug
mgtd memo list --label idea
```

### ✅ Existing Flags Unchanged

```bash
# All existing flag combinations continue working
mgtd task list --status open
mgtd task list --bookmarked
mgtd task list --search "login"
mgtd task list --limit 10 --order asc
```

### ✅ JSON Output Format Unchanged

```bash
# JSON structure remains the same
mgtd task list --label bug --json
# → Same Task[] schema as before (labels array already exists)
```

---

## Implementation Checklist

- [ ] Update `packages/cli/src/commands/task/list.ts`:
  - [ ] Add comma-splitting logic for `--label` flag
  - [ ] Update help text/description
  - [ ] Pass `labels` array to service layer

- [ ] Update `packages/cli/src/commands/memo/list.ts`:
  - [ ] Add comma-splitting logic for `--label` flag
  - [ ] Update help text/description
  - [ ] Pass `labels` array to service layer

- [ ] Update tests:
  - [ ] Add tests for comma-separated labels (`test/commands/task/list.test.js`)
  - [ ] Add tests for comma-separated labels (`test/commands/memo/list.test.js`)
  - [ ] Add integration tests for CLI+API consistency

- [ ] Update documentation:
  - [ ] Update `docs/cli-commands.md` with comma syntax examples
  - [ ] Add examples to README.md

- [ ] Verify backward compatibility:
  - [ ] Run existing test suite (should pass without changes)
  - [ ] Manual testing of single-label syntax
