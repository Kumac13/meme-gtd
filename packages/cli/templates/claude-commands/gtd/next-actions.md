---
description: List tasks with status:next
argument-hint: "[--limit <n>]"
---

# GTD Next Actions

Display all tasks with `status:next` - your immediate action list.

## Your Task

1. **Fetch next actions:**
   ```bash
   pnpm mgtd:test task list --status next --json
   ```

2. **Display in readable format:**
   - Group by project (if applicable)
   - Show task ID, title, and labels
   - Highlight any bookmarked items

3. **Provide context-aware suggestions:**
   - If no next actions: "Great! Review waiting/scheduled tasks or capture new memos."
   - If many next actions: "You have X next actions. Consider prioritizing or delegating."

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test task list --status next --json

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd task list --status next  # 🚨 DANGER: Reads production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing

Process arguments: $ARGUMENTS
