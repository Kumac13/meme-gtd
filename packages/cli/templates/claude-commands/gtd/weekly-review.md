---
description: Conduct GTD weekly review
---

# GTD Weekly Review

Guide the user through a comprehensive weekly review following GTD methodology.

## Review Checklist

Present this checklist and help the user work through each step:

### 1. **Get Clear**
- [ ] Collect loose papers and materials
- [ ] Process inbox to zero (run `/gtd:inbox-review`)
- [ ] Empty your head - capture any open loops

### 2. **Get Current**
- [ ] Review "Next Actions" list (`pnpm mgtd:test task list --status next`)
- [ ] Review "Waiting For" list (`pnpm mgtd:test task list --status waiting`)
- [ ] Review project list (`pnpm mgtd:test project list`)
- [ ] Review calendar - past and future

### 3. **Get Creative**
- [ ] Review "Someday/Maybe" list
- [ ] Review goals and objectives
- [ ] Generate new ideas and projects

## Interactive Process

For each section:
1. Run the appropriate `pnpm mgtd:test` command
2. Show the results
3. Ask: "Anything to update, complete, or add?"
4. Proceed when user confirms

## Important Safety Rules

**⚠️ CRITICAL - ALWAYS USE TEST ENVIRONMENT:**

```bash
# ✅ CORRECT - Use test wrapper
pnpm mgtd:test task list --json
pnpm mgtd:test memo list --json
pnpm mgtd:test project list --json

# ❌ WRONG - Direct execution (DESTROYS PRODUCTION)
mgtd task list  # 🚨 DANGER: Reads production DB
```

**YOU MUST:**
- Always use `pnpm mgtd:test` for ALL CLI operations
- Never run `mgtd` directly
- Verify production DB unchanged after testing
