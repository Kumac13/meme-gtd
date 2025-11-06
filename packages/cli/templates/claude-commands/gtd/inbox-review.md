---
description: Review unlabeled memos and decide actions
argument-hint: "[--limit <n>]"
---

# GTD Inbox Review

Review unlabeled memos in your inbox and decide what to do with them.

## Your Task

1. **Fetch unlabeled memos** using:
   ```bash
   pnpm mgtd:test memo list --json
   ```

   Filter for memos without labels (or with `inbox` label).

2. **For each memo, ask the user:**
   - Is this actionable?
     - **YES** → Promote to task with `/promote <memo-id>`
     - **NO** → Options:
       - Delete it (not needed)
       - Archive with reference label
       - Move to "someday/maybe" project

3. **Show summary:**
   - Total memos reviewed
   - Actions taken (promoted, deleted, labeled)
   - Remaining inbox count

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test memo list --json

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd memo list  # 🚨 DANGER: Reads production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing

Process arguments: $ARGUMENTS
