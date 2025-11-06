---
description: Promote a memo to a task
argument-hint: "<memo-id>"
---

# Promote Memo to Task

Convert a captured memo into an actionable task.

## Your Task

1. **Fetch the memo first:**
   ```bash
   pnpm mgtd:test memo view $ARGUMENTS --json
   ```

   Show the memo content to the user for confirmation.

2. **Ask clarifying questions:**
   - Task title (suggest extracting from memo body)
   - Task status (open/next/waiting/scheduled)
   - Any labels to add?
   - Which project (if any)?

3. **Execute promotion:**
   ```bash
   pnpm mgtd:test memo promote $ARGUMENTS \
     --title "Task Title" \
     --status next \
     --label labelname \
     --json
   ```

4. **Confirm result:**
   - Show the new task ID
   - Confirm the memo was promoted successfully

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test memo view 1 --json
pnpm mgtd:test memo promote 1 --title "..."

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd memo promote 1  # 🚨 DANGER: Modifies production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing

Memo ID to promote: $ARGUMENTS
