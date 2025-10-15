# Contract: CLI Commands (mgtd task)

**Package**: meme-gtd-cli
**Directory**: packages/cli/src/commands/task/

## Overview

All task CLI commands follow oclif framework conventions and mirror the structure of memo commands. Common patterns:
- Flags use kebab-case (`--body-file`, not `--bodyFile`)
- Legacy camelCase flags detected and rejected with migration guidance
- `--json` flag available on all commands for machine-readable output
- `--editor` / `--no-editor` flags control editor launch behavior
- Confirmation prompts for destructive operations (can skip with `--yes`)

## Command: task create

**File**: `packages/cli/src/commands/task/create.ts`

### Synopsis

```bash
mgtd task create --title <text> [--body <text> | --body-file <path>] [options]
```

### Flags

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--title`, `-t` | string | Yes | Task title |
| `--body`, `-b` | string | No | Task body (Markdown) |
| `--body-file`, `-f` | string | No | Read body from file (use `-` for stdin) |
| `--editor` | boolean | No | Force editor launch (exclusive with `--no-editor`) |
| `--no-editor` | boolean | No | Suppress editor (exclusive with `--editor`) |
| `--status`, `-s` | string | No | Initial status (default: `open`) |
| `--scheduled-on` | string | No | Scheduled date (YYYY-MM-DD) |
| `--label`, `-l` | string[] | No | Labels to attach (multiple allowed) |
| `--project`, `-p` | number[] | No | Project IDs (multiple allowed) |
| `--json`, `-j` | boolean | No | JSON output |

### Behavior

1. Validate `--title` is non-empty
2. Load body from `--body`, `--body-file`, or launch editor based on flags (see memo create logic)
3. Validate `--status` against enum if provided
4. Validate `--scheduled-on` date format if provided
5. Call `TaskService.create()` with inputs
6. Output confirmation or JSON

### Output

**Text Mode** (default):
```
Created task #42
```

**JSON Mode** (`--json`):
```json
{
  "task": {
    "id": 42,
    "type": "task",
    "title": "Buy groceries",
    "bodyMd": "Milk, eggs, bread",
    "status": "open",
    "scheduledOn": null,
    "createdAt": "2025-10-14T10:00:00.000Z",
    "updatedAt": "2025-10-14T10:00:00.000Z",
    "isBookmarked": false,
    "isDeleted": false
  }
}
```

### Examples

```bash
mgtd task create --title "Buy groceries" --body "Milk, eggs" --label shopping
mgtd task create --title "Team meeting" --scheduled-on 2025-10-20 --status scheduled
mgtd task create --title "Draft blog post" --body-file draft.md --json
```

---

## Command: task list

**File**: `packages/cli/src/commands/task/list.ts`

### Synopsis

```bash
mgtd task list [--status <value>] [--label <name>] [--search <query>] [options]
```

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--status`, `-s` | string | Filter by status (open/next/waiting/scheduled/done/canceled) |
| `--label`, `-l` | string | Filter by label name |
| `--search`, `-q` | string | Full-text search query |
| `--limit`, `-n` | number | Max results (default: 30) |
| `--order`, `-o` | string | Sort direction (`asc`/`desc`, default: `desc`) |
| `--bookmarked` | boolean | Show only bookmarked tasks |
| `--json`, `-j` | boolean | JSON output |

### Behavior

1. Call `TaskService.list(filters)`
2. Format output as table or JSON

### Output

**Text Mode** (default):
```
★ #42  Buy groceries              open     2025-10-14
  #43  Team meeting               scheduled 2025-10-14
  #44  Fix auth bug               next     2025-10-14
```

**JSON Mode**:
```json
{
  "tasks": [
    { "id": 42, "title": "Buy groceries", "status": "open", ... },
    { "id": 43, "title": "Team meeting", "status": "scheduled", ... }
  ]
}
```

### Examples

```bash
mgtd task list --status next
mgtd task list --label urgent --limit 5
mgtd task list --search "grocery" --json
mgtd task list --bookmarked
```

---

## Command: task view

**File**: `packages/cli/src/commands/task/view.ts`

### Synopsis

```bash
mgtd task view <id> [--comments] [--json]
```

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | number | Yes | Task ID |

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--comments` | boolean | Include comment timeline |
| `--json`, `-j` | boolean | JSON output |

### Behavior

1. Call `TaskService.show(id)`
2. If `--comments`, call `TaskService.listComments(id)`
3. Format output

### Output

**Text Mode**:
```
Task #42: Buy groceries
Status: open
Body:
Milk, eggs, bread

Labels: personal, shopping
Created: 2025-10-14 10:00
Updated: 2025-10-14 10:00

Comments (if --comments flag):
  #101 (2025-10-14 11:00): Started shopping
```

**JSON Mode**: Returns full task object with optional comments array.

---

## Command: task edit

**File**: `packages/cli/src/commands/task/edit.ts`

### Synopsis

```bash
mgtd task edit <id> [--title <text>] [--body <text>] [--status <value>] [options]
```

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | number | Yes | Task ID |

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--title`, `-t` | string | Update title |
| `--body`, `-b` | string | Update body |
| `--body-file`, `-f` | string | Read body from file |
| `--editor` | boolean | Launch editor |
| `--no-editor` | boolean | Suppress editor |
| `--status`, `-s` | string | Update status |
| `--scheduled-on` | string | Update scheduled date (or `null` to clear) |
| `--add-label` | string[] | Add labels (incremental) |
| `--remove-label` | string[] | Remove labels |
| `--json`, `-j` | boolean | JSON output |

### Behavior

1. Fetch existing task via `TaskService.show(id)`
2. Apply updates from flags
3. If no body provided and editor not suppressed, launch editor with current body
4. Call `TaskService.edit()`
5. Output confirmation or JSON

### Examples

```bash
mgtd task edit 42 --title "Updated title"
mgtd task edit 42 --status next --add-label urgent
mgtd task edit 42 --scheduled-on 2025-10-20
mgtd task edit 42 --editor
```

---

## Command: task close

**File**: `packages/cli/src/commands/task/close.ts`

### Synopsis

```bash
mgtd task close <id> [--comment <text>] [--json]
```

### Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | number | Yes | Task ID |

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--comment`, `-c` | string | Closure reason/comment |
| `--json`, `-j` | boolean | JSON output |

### Behavior

1. Call `TaskService.close(id, comment)`
2. Output confirmation

### Output

**Text Mode**:
```
Closed task #42
```

### Examples

```bash
mgtd task close 42
mgtd task close 42 --comment "Completed successfully"
```

---

## Command: task cancel

**File**: `packages/cli/src/commands/task/cancel.ts`

### Synopsis

```bash
mgtd task cancel <id> [--comment <text>] [--json]
```

### Behavior

Same as `task close`, but sets status to `canceled`.

---

## Command: task reopen

**File**: `packages/cli/src/commands/task/reopen.ts`

### Synopsis

```bash
mgtd task reopen <id> [--json]
```

### Behavior

Sets status to `open`, output confirmation.

---

## Command: task delete

**File**: `packages/cli/src/commands/task/delete.ts`

### Synopsis

```bash
mgtd task delete <id> [--yes] [--json]
```

### Flags

| Flag | Type | Description |
|------|------|-------------|
| `--yes`, `-y` | boolean | Skip confirmation prompt |
| `--json`, `-j` | boolean | JSON output |

### Behavior

1. If not `--yes`, show confirmation prompt: `Delete task #<id>: "<title>"? (y/n):`
2. If TTY and no `--yes`, error with message to use `--yes` flag
3. Call `TaskService.remove(id)`
4. Output confirmation

---

## Command: task bookmark / unbookmark

**Files**:
- `packages/cli/src/commands/task/bookmark.ts`
- `packages/cli/src/commands/task/unbookmark.ts`

### Synopsis

```bash
mgtd task bookmark <id> [--json]
mgtd task unbookmark <id> [--json]
```

### Behavior

Call `TaskService.setBookmark(id, true/false)`, output confirmation.

---

## Command: task comment add

**File**: `packages/cli/src/commands/task/comment/add.ts`

### Synopsis

```bash
mgtd task comment add <taskId> [--body <text>] [--body-file <path>] [--json]
```

### Behavior

Same pattern as memo comment add (editor launch, body validation, call `TaskService.addComment()`).

---

## Command: task comment edit

**File**: `packages/cli/src/commands/task/comment/edit.ts`

### Synopsis

```bash
mgtd task comment edit <commentId> [--body <text>] [--editor] [--json]
```

### Behavior

Same pattern as memo comment edit (fetch existing, editor or flag, call `TaskService.updateComment()`).

---

## Command: task comment delete

**File**: `packages/cli/src/commands/task/comment/delete.ts`

### Synopsis

```bash
mgtd task comment delete <commentId> [--yes] [--json]
```

### Behavior

Confirmation prompt, call `TaskService.deleteComment()`.

---

## Command: task label add

**File**: `packages/cli/src/commands/task/label/add.ts`

### Synopsis

```bash
mgtd task label add <taskId> --label <name> [--label <name>...] [--json]
```

### Behavior

Incremental add: Fetch existing labels, merge with new, call `TaskService.edit({ addLabels })`.

---

## Command: task label set

**File**: `packages/cli/src/commands/task/label/set.ts`

### Synopsis

```bash
mgtd task label set <taskId> --label <name> [--label <name>...] [--json]
```

### Behavior

Replace all labels: Call `TaskService.setLabels(taskId, labels)`.

---

## Command: task label remove

**File**: `packages/cli/src/commands/task/label/remove.ts`

### Synopsis

```bash
mgtd task label remove <taskId> --label <name> [--label <name>...] [--json]
```

### Behavior

Incremental remove: Call `TaskService.edit({ removeLabels })`.

---

## Common Error Handling

All commands should catch and format errors:

| Error Type | CLI Message | Exit Code |
|------------|-------------|-----------|
| `"Task not found"` | `Error: Task #<id> not found` | 1 |
| `"ID refers to different type (memo)"` | `Error: ID #<id> refers to a memo, not a task` | 1 |
| Invalid status | `Error: Invalid status. Allowed: open, next, waiting, scheduled, done, canceled` | 1 |
| Invalid date | `Error: Invalid date format. Use YYYY-MM-DD` | 1 |
| Empty title | `Error: Task title cannot be empty` | 1 |
| Database error | `Error: <original message>` | 1 |

## Legacy Flag Detection

All commands using multi-word flags must detect legacy camelCase:

```typescript
const legacyResult = detectLegacyFlags({
  '--bodyFile': '--body-file',
  '--addLabel': '--add-label',
  '--removeLabel': '--remove-label',
  '--scheduledOn': '--scheduled-on'
});

if (legacyResult.detected) {
  this.error(formatLegacyFlagError(legacyResult));
}
```
