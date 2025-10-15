# Quickstart: 統合ラベル管理システム

**Feature**: 006-memo-task | **Date**: 2025-10-15

## Development Setup

```bash
# Already on feature branch
git status  # Should show: On branch 006-memo-task

# Install dependencies (if needed)
pnpm install

# Run tests to verify baseline
pnpm test
```

## Implementation Order

### Step 1: Create Label Repository (DB Layer)

**File**: `packages/db/src/labelRepository.ts`

```bash
# Create new file with label-specific functions
touch packages/db/src/labelRepository.ts
```

**Functions to implement**:
1. `listAllLabels()` - SELECT all from labels table
2. `createLabel()` - INSERT new label with uniqueness check
3. `getLabel()` - SELECT by ID
4. `getLabelByName()` - SELECT by name
5. `deleteLabel()` - DELETE by name (CASCADE handles issue_labels)
6. `attachLabelToIssue()` - INSERT into issue_labels (idempotent)

**Export in** `packages/db/src/index.ts`

### Step 2: Create Label Service (Core Layer)

**File**: `packages/core/src/index.ts`

Add `LabelService` class:
- Constructor: Takes `MgtdConfig`, initializes DB connection
- Methods: `list()`, `create()`, `delete()`, `assignToIssue()`
- Pattern: Follow existing `MemoService`/`TaskService` structure

### Step 3: Create CLI Commands

**Directory**: `packages/cli/src/commands/label/`

```bash
mkdir -p packages/cli/src/commands/label
```

**Files to create**:
1. `index.ts` - `label list` command
2. `add.ts` - `label add` command
3. `set.ts` - `label set` command
4. `delete.ts` - `label delete` command

**Pattern**: Copy structure from existing commands (e.g., `memo/create.ts`)

### Step 4: Update CLI Index

**File**: `packages/cli/src/index.ts`

Add to `MULTIWORD_COMMANDS` array:
```typescript
['label', 'add'],
['label', 'set'],
['label', 'delete'],
['label']
```

### Step 5: Delete Old Commands

```bash
# Remove memo label commands
rm -rf packages/cli/src/commands/memo/label

# Remove task label commands
rm -rf packages/cli/src/commands/task/label
```

**Update**: Remove from `MULTIWORD_COMMANDS` in `packages/cli/src/index.ts`

### Step 6: Write Tests

**Files**:
- `packages/db/test/labelRepository.test.ts`
- `packages/core/test/labelService.test.ts`
- `packages/cli/test/commands/label/*.test.ts`

**Test Coverage**:
- All acceptance scenarios from spec
- Edge cases (duplicates, not found, CASCADE delete)
- JSON output format

### Step 7: Manual Verification

```bash
# Build CLI
pnpm --filter meme-gtd-core build
pnpm --filter cli build

# Test commands
pnpm -w run mgtd label list
pnpm -w run mgtd label add test-label
pnpm -w run mgtd label list --json
pnpm -w run mgtd label set 1 1
pnpm -w run mgtd label delete test-label

# Verify old commands are gone
pnpm -w run mgtd memo label 2>&1 | grep -q "command not found"
pnpm -w run mgtd task label 2>&1 | grep -q "command not found"
```

## Key Files to Modify

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/labelRepository.ts` | CREATE | New repository functions |
| `packages/db/src/index.ts` | MODIFY | Export new functions |
| `packages/core/src/index.ts` | MODIFY | Add LabelService class |
| `packages/cli/src/commands/label/*.ts` | CREATE | 4 new command files |
| `packages/cli/src/index.ts` | MODIFY | Update MULTIWORD_COMMANDS |
| `packages/cli/src/commands/memo/label/` | DELETE | Remove directory |
| `packages/cli/src/commands/task/label/` | DELETE | Remove directory |

## Success Criteria Checklist

- [ ] `mgtd label list` shows all labels
- [ ] `mgtd label add` creates label with uniqueness check
- [ ] `mgtd label set` assigns label to memo/task
- [ ] `mgtd label delete` removes label (CASCADE)
- [ ] All commands support `--json` flag
- [ ] `memo label` and `task label` commands not found
- [ ] All tests pass
- [ ] 1000 labels list in <1 second (SC-002)
