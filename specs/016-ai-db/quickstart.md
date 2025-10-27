# Quickstart: Using Test Environment Safely

**Feature**: Production DB Protection from Test Contamination
**For**: AI assistants and developers testing features

## Problem This Solves

Running `mgtd` commands directly modifies the production database. This caused data loss when AI executed test commands without proper isolation. This guide shows how to use the test environment safely.

## Prerequisites

- meme-gtd repository cloned
- Dependencies installed (`pnpm install`)
- CLI built (`pnpm build`)

## For AI Assistants: Critical Rules

### ✅ ALWAYS Use Test Wrapper

```bash
# Correct - uses test database
pnpm mgtd:test task create -t "Test Task" --no-editor
pnpm mgtd:test memo create --body "Test memo" --no-editor
pnpm mgtd:test project list --json
```

### ❌ NEVER Use Direct mgtd

```bash
# WRONG - modifies production database!
mgtd task create -t "Test"
mgtd memo list
mgtd project create "Test Project"
```

### Why?

- `mgtd` defaults to production DB: `~/.local/share/mgtd/issues.db`
- `pnpm mgtd:test` sets `DB_PATH=./test-data/test.db` automatically
- One forgotten environment variable = production data lost

## First-Time Setup

### 1. Initialize Test Database

```bash
# Create test database (only needed once)
pnpm mgtd:test init -d ./test-data/test.db -f
```

**Expected output**:
```
Initialized database at ./test-data/test.db
Applied migrations: 001_init, 002_add_project_view_meta
```

### 2. Verify Test Environment

```bash
# Check that test database is empty
pnpm mgtd:test task list --json
```

**Expected output**:
```json
{
  "tasks": []
}
```

### 3. Create Test Data

```bash
# Add some test tasks
pnpm mgtd:test task create -t "Test Task 1" --no-editor --json
pnpm mgtd:test task create -t "Test Task 2" --no-editor --json
pnpm mgtd:test memo create --body "Test memo" --no-editor --json
```

## Daily Usage

### Testing a Feature

```bash
# Start fresh (optional - clears test data)
rm -f ./test-data/test.db
pnpm mgtd:test init -d ./test-data/test.db -f

# Test your feature
pnpm mgtd:test task create -t "Feature test" --no-editor
pnpm mgtd:test task list

# Verify production is untouched (should show real data)
# Only do this if you're certain you want to check production!
# Better: Trust that test wrapper works correctly.
```

### Running Integration Tests

```bash
# Integration tests use temporary directories automatically
pnpm --filter meme-gtd-cli test

# All tests should pass without touching production
```

### Testing API Server

```bash
# Start test API server (port 3001, uses test-data/test.db)
pnpm server:dev

# In another terminal, test API
curl http://localhost:3001/api/tasks
curl http://localhost:3001/api/memos

# Production API (port 3000) uses production DB
# Do NOT start it during testing!
```

## Common Scenarios

### Scenario 1: Manual Feature Verification

```bash
# You implemented a new project command feature

# Step 1: Initialize test DB if needed
pnpm mgtd:test init -d ./test-data/test.db -f

# Step 2: Test the new feature
pnpm mgtd:test project create "Test Project" --json
pnpm mgtd:test task create -t "Test Task" --no-editor --json
pnpm mgtd:test project add 1 1 --json

# Step 3: Verify results
pnpm mgtd:test project view 1 --json

# Production DB remains untouched ✓
```

### Scenario 2: Debugging a Failing Test

```bash
# Test is failing, need to reproduce manually

# Step 1: Clear test data
rm -f ./test-data/test.db
pnpm mgtd:test init -d ./test-data/test.db -f

# Step 2: Manually run test steps
pnpm mgtd:test task create -t "Bug reproduction" --no-editor
pnpm mgtd:test task list --json

# Step 3: Inspect test database directly
sqlite3 ./test-data/test.db "SELECT * FROM issues;"
```

### Scenario 3: Testing with Custom Test Database

```bash
# Want to use a different test database location

# Option 1: Set DB_PATH manually
DB_PATH=/tmp/my-test.db pnpm mgtd init -d /tmp/my-test.db -f
DB_PATH=/tmp/my-test.db pnpm mgtd task create -t "Test"

# Option 2: Override test wrapper
DB_PATH=/tmp/my-test.db pnpm mgtd:test task create -t "Test"
# Note: DB_PATH env var takes precedence over wrapper's default
```

## Troubleshooting

### Problem: "Database not found" error

```bash
# Error: SQLITE_CANTOPEN: unable to open database file
# Solution: Initialize test database first
pnpm mgtd:test init -d ./test-data/test.db -f
```

### Problem: Test wrapper seems to use production DB

```bash
# Verify test wrapper is working
echo $DB_PATH  # Should be empty in your shell
pnpm mgtd:test task list --json  # Should show test data only

# Check if test database exists
ls -la ./test-data/test.db
```

### Problem: Accidentally modified production DB

```bash
# STOP IMMEDIATELY
# Report to user: "I accidentally modified production database"
# Do NOT attempt to fix it yourself
# User will decide on recovery approach (backup, restore, etc.)
```

### Problem: Tests are slow

```bash
# Test database might be large
ls -lh ./test-data/test.db

# If > 10MB, consider clearing old test data
rm -f ./test-data/test.db
pnpm mgtd:test init -d ./test-data/test.db -f
```

## Environment Variables Reference

| Variable | Purpose | Test Value | Production Value |
|----------|---------|------------|------------------|
| `DB_PATH` | Database file location | `./test-data/test.db` | Not set (defaults to `~/.local/share/mgtd/issues.db`) |
| `MGTD_CONFIG_PATH` | Config file location | Set by integration tests to temp file | `~/.config/mgtd/context.json` |
| `PORT` | API server port | `3001` | `3000` |

## Commands Reference

### Test Wrapper Commands

```bash
# All mgtd commands work with test wrapper
pnpm mgtd:test <command> [options]

# Examples:
pnpm mgtd:test init -d ./test-data/test.db -f
pnpm mgtd:test task create -t "Title" --no-editor
pnpm mgtd:test task list --json
pnpm mgtd:test memo create --body "Content" --no-editor
pnpm mgtd:test project create "Project Name"
pnpm mgtd:test project list --json
```

### Production Commands (For Humans Only)

```bash
# ⚠️  AI MUST NOT USE THESE
# Humans use these for real work

mgtd task create -t "Real Task"
mgtd memo create
mgtd project create "Real Project"
```

### Test Execution

```bash
# Run CLI integration tests (automatic test isolation)
pnpm --filter meme-gtd-cli test

# Run API integration tests (automatic test isolation)
pnpm --filter meme-gtd-api test

# Run all tests across all packages
pnpm test
```

## Validation Checklist

Before considering this feature complete:

- [ ] `pnpm mgtd:test` command exists in root package.json
- [ ] Test wrapper uses `./test-data/test.db` by default
- [ ] Production `mgtd` command still defaults to production DB
- [ ] All 82+ existing CLI tests still pass
- [ ] CLAUDE.md contains prominent AI safety section
- [ ] Quickstart guide is clear and complete
- [ ] Production database contents unchanged after testing

## Additional Resources

- **Specification**: [spec.md](./spec.md)
- **Implementation Plan**: [plan.md](./plan.md)
- **Research**: [research.md](./research.md)
- **CLAUDE.md**: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/CLAUDE.md`
- **Config package**: `packages/config/src/index.ts`
