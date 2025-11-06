---
description: Clarify a memo to make it actionable
argument-hint: "<memo-id>"
---

# GTD Clarify Memo

Help clarify a vague memo into actionable next steps.

## Your Task

1. **Fetch the memo:**
   ```bash
   pnpm mgtd:test memo view $ARGUMENTS --json
   ```

2. **Analyze the memo and ask clarifying questions:**
   - What is the desired outcome?
   - What is the very next physical action?
   - Who is responsible?
   - Is this a single action or a project (multiple steps)?

3. **Based on answers, suggest:**
   - **If single action:** Promote to task with clear title
   - **If project:** Create project and break down into tasks
   - **If not actionable:** Suggest reference label or deletion

4. **Execute the decision:**
   - Use `pnpm mgtd:test memo promote <id>` if becoming a task
   - Use `pnpm mgtd:test project create` if becoming a project
   - Use `pnpm mgtd:test memo delete <id>` if not needed

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test memo view 1 --json
pnpm mgtd:test memo promote 1

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd memo view 1  # 🚨 DANGER: Reads production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing

Process memo ID: $ARGUMENTS
