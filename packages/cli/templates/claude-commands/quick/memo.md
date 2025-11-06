---
description: Quickly create a memo in test environment
argument-hint: "<memo text>"
---

# Quick Memo Creation

Rapidly capture a memo without interrupting your flow.

## Your Task

1. **Create the memo:**
   ```bash
   pnpm mgtd:test memo create --body "$ARGUMENTS" --no-editor --json
   ```

2. **Confirm creation:**
   - Show the created memo ID and body
   - Ask if user wants to add labels or promote to task

3. **Optional follow-ups:**
   - Add label: `pnpm mgtd:test label set <memo-id> <label-name>`
   - Promote to task: `/promote <memo-id>`

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test memo create --body "..." --no-editor

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd memo create  # 🚨 DANGER: Writes to production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing

Memo text: $ARGUMENTS
