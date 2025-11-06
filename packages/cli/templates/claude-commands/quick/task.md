---
description: Quickly create a task in test environment
argument-hint: "<task title>"
---

# Quick Task Creation

Rapidly create a task without interrupting your flow.

## Your Task

1. **Create the task:**
   ```bash
   pnpm mgtd:test task create --title "$ARGUMENTS" --no-editor --json
   ```

2. **Confirm creation:**
   - Show the created task ID and title
   - Ask if user wants to:
     - Set status (default is "open")
     - Add labels
     - Add to a project

3. **Optional follow-ups:**
   - Set status: `pnpm mgtd:test task close <id>` or similar
   - Add label: `pnpm mgtd:test label set <task-id> <label-name>`
   - Add to project: `pnpm mgtd:test project add <project-id> <task-id>`

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test task create --title "..." --no-editor

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd task create  # 🚨 DANGER: Writes to production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing

Task title: $ARGUMENTS
