# Quickstart: mgtd task Commands

**Feature**: 005-docs-mgtd-task
**Date**: 2025-10-14

## Prerequisites

- `mgtd init` completed (database initialized at `~/.local/share/mgtd/issues.db`)
- mgtd CLI installed (`pnpm run mgtd:install` or available in PATH)
- Basic understanding of GTD workflow (Inbox → Next Actions → Done)

## 5-Minute Tutorial

### 1. Create Your First Task

```bash
# Create task with title and body
mgtd task create --title "Buy groceries" --body "Milk, eggs, bread"

# Output:
# Created task #1
```

**What happened**: Task stored in database with `type='task'`, `status='open'` (Inbox state).

---

### 2. List Tasks

```bash
# List all tasks
mgtd task list

# Output (table format):
# #1  Buy groceries  open  2025-10-14
```

**Try filtering**:
```bash
mgtd task list --status open     # Only open tasks
mgtd task list --limit 5         # First 5 tasks
mgtd task list --json            # Machine-readable output
```

---

### 3. View Task Details

```bash
mgtd task view 1

# Output:
# Task #1: Buy groceries
# Status: open
# Body:
# Milk, eggs, bread
#
# Created: 2025-10-14 10:00
# Updated: 2025-10-14 10:00
```

---

### 4. Move Task to Next Actions

```bash
mgtd task edit 1 --status next

# Output:
# Updated task #1
```

**Verify change**:
```bash
mgtd task list --status next

# Output:
# #1  Buy groceries  next  2025-10-14
```

---

### 5. Add a Comment

```bash
mgtd task comment add 1 --body "Checked inventory, need coffee too"

# Output:
# Added comment to task #1
```

**View with comments**:
```bash
mgtd task view 1 --comments

# Output includes:
# Comments:
#   #1 (2025-10-14 11:00): Checked inventory, need coffee too
```

---

### 6. Close Task

```bash
mgtd task close 1 --comment "Completed at store"

# Output:
# Closed task #1
```

**Verify status**:
```bash
mgtd task view 1

# Output shows:
# Status: done
# Comments:
#   #2 (2025-10-14 12:00): Completed at store
```

---

## Common Workflows

### GTD Workflow: Capture → Triage → Execute

1. **Capture ideas as memos**:
   ```bash
   mgtd memo create --body "Research task management tools"
   ```

2. **Promote memo to task when actionable**:
   ```bash
   mgtd memo promote 1 --title "Evaluate Todoist vs Things"
   ```

3. **Move to Next Actions**:
   ```bash
   mgtd task edit 2 --status next
   ```

4. **Work on tasks**:
   ```bash
   mgtd task list --status next      # See Next Actions
   mgtd task close 2                 # Mark done when finished
   ```

---

### Schedule a Task

```bash
# Create task with scheduled date
mgtd task create \
  --title "Team meeting" \
  --body "Discuss Q4 roadmap" \
  --status scheduled \
  --scheduled-on 2025-10-20

# List scheduled tasks
mgtd task list --status scheduled
```

---

### Track Blocked Tasks

```bash
# Mark task as waiting
mgtd task edit 3 --status waiting

# Add comment explaining blocker
mgtd task comment add 3 --body "Waiting for PR #123 to merge"

# List all blocked tasks
mgtd task list --status waiting
```

---

### Use Labels for Context

```bash
# Create labeled task
mgtd task create --title "Fix auth bug" --label urgent --label backend

# Add more labels
mgtd task label add 4 --label security

# Filter by label
mgtd task list --label urgent

# Replace all labels
mgtd task label set 4 --label resolved
```

---

### Bookmark Important Tasks

```bash
# Bookmark task
mgtd task bookmark 5

# List bookmarked tasks
mgtd task list --bookmarked

# Remove bookmark
mgtd task unbookmark 5
```

---

### Search Tasks

```bash
# Full-text search in title and body
mgtd task list --search "grocery"

# Combine with filters
mgtd task list --search "bug" --status next
```

---

## Advanced Usage

### Create Task from File

```bash
# Write task description to file
echo "Review pull requests from team" > task-desc.md

# Create task with file content
mgtd task create --title "Code review" --body-file task-desc.md --label review
```

---

### Create Task from Stdin

```bash
# Pipe content to task
echo "Deploy v2.0 to production" | mgtd task create --title "Deployment" --body-file -
```

---

### Edit Task with Editor

```bash
# Launch $EDITOR to edit body
mgtd task edit 6 --editor

# Force editor even with --body flag
mgtd task edit 6 --body "Draft" --editor
```

---

### Reopen Closed Task

```bash
# Reopen completed or canceled task
mgtd task reopen 1

# Verify status reset to open
mgtd task view 1  # Status: open
```

---

### Delete Task

```bash
# With confirmation prompt
mgtd task delete 7

# Output:
# Delete task #7: "Old task"? (y/n): y
# Deleted task #7

# Skip confirmation (for scripts)
mgtd task delete 8 --yes
```

---

### JSON Output for Automation

```bash
# Get task data as JSON
mgtd task list --status next --json | jq '.tasks[].title'

# Create task and parse ID
TASK_ID=$(mgtd task create --title "Automated task" --json | jq -r '.task.id')
echo "Created task ID: $TASK_ID"
```

---

## Status Lifecycle Reference

```
[open] → Initial state (Inbox)
  ↓
[next] → Ready to execute (Next Actions)
  ↓
[done] → Completed (can reopen)

Alternative paths:
[open] → [waiting] → Blocked (Waiting For)
[open] → [scheduled] → Time-specific (Calendar)
[open] → [canceled] → Abandoned (can reopen)
```

**Commands**:
- `mgtd task edit <id> --status <state>` - Arbitrary transition
- `mgtd task close <id>` - Shortcut to set status=done
- `mgtd task cancel <id>` - Shortcut to set status=canceled
- `mgtd task reopen <id>` - Reset to status=open

---

## Tips and Best Practices

### 1. Use Labels for Context

```bash
# Context-based labels
mgtd task create --title "Email client" --label @home --label low-energy
mgtd task create --title "Code review" --label @work --label high-focus

# Filter by context
mgtd task list --label @home
```

### 2. Bookmark High-Priority Tasks

```bash
# Bookmark urgent tasks
mgtd task bookmark 10
mgtd task bookmark 11

# Daily review: Check bookmarked tasks
mgtd task list --bookmarked
```

### 3. Use Comments for Progress Tracking

```bash
# Document progress
mgtd task comment add 12 --body "50% complete, waiting on API"
mgtd task comment add 12 --body "API ready, finishing integration"
mgtd task close 12 --comment "Deployed to production"
```

### 4. Scheduled Tasks for Ticklers

```bash
# Create future task
mgtd task create \
  --title "Renew domain" \
  --scheduled-on 2025-11-01 \
  --status scheduled \
  --label admin
```

### 5. Weekly Review Workflow

```bash
# Review all open tasks
mgtd task list --status open

# Move actionable items to Next Actions
mgtd task edit 20 --status next

# Cancel stale tasks
mgtd task cancel 21 --comment "No longer relevant"

# Check waiting tasks
mgtd task list --status waiting
```

---

## Next Steps

- **Read the full spec**: [spec.md](./spec.md) for complete feature requirements
- **Review data model**: [data-model.md](./data-model.md) for schema details
- **Explore contracts**: [contracts/](./contracts/) for API reference
- **Implement feature**: [tasks.md](./tasks.md) (generated by `/speckit.tasks` command)

---

## Troubleshooting

### Error: "Task not found"

**Cause**: Invalid task ID or task deleted
**Solution**:
```bash
# List tasks to find valid ID
mgtd task list

# Check if task is deleted (DB query)
sqlite3 ~/.local/share/mgtd/issues.db "SELECT id, is_deleted FROM issues WHERE id=42"
```

---

### Error: "ID refers to different type (memo)"

**Cause**: Trying to use memo ID with task command
**Solution**:
```bash
# Use correct command for entity type
mgtd memo view 10    # For memos
mgtd task view 20    # For tasks
```

---

### Error: "Invalid status"

**Cause**: Invalid status value
**Solution**: Use one of: `open`, `next`, `waiting`, `scheduled`, `done`, `canceled`
```bash
# Correct
mgtd task edit 30 --status next

# Incorrect
mgtd task edit 30 --status todo  # Error
```

---

### Error: "Invalid date format"

**Cause**: Wrong date format for `--scheduled-on`
**Solution**: Use ISO 8601 date (YYYY-MM-DD)
```bash
# Correct
mgtd task edit 40 --scheduled-on 2025-10-20

# Incorrect
mgtd task edit 40 --scheduled-on 10/20/2025  # Error
```

---

## CLI Help

For inline help on any command:

```bash
mgtd task --help                  # List all task commands
mgtd task create --help           # Create command help
mgtd task list --help             # List command help
mgtd task comment add --help      # Comment subcommand help
```
