# Quickstart: Interactive Memo Delete Confirmation

**Feature**: 003-https-github-com
**Date**: 2025-10-14
**For**: Developers implementing interactive deletion

---

## Overview

Add interactive y/n confirmation to `mgtd memo delete` command while preserving the `--yes` flag for automation.

**Estimated Time**: 2-3 hours (including tests)

---

## Prerequisites

1. **Read these documents** (in order):
   - `spec.md` - Understand user stories and requirements
   - `research.md` - Understand technical decisions (readline, TTY detection)
   - `contracts/cli-command.md` - Command behavior and test scenarios

2. **Existing file to modify**:
   ```
   packages/cli/src/commands/memo/delete.ts
   ```

3. **Test file to create**:
   ```
   packages/cli/test/commands/memo/delete.test.js
   ```

---

## Implementation Steps

### Step 1: Write Integration Tests (TDD)

**File**: `packages/cli/test/commands/memo/delete.test.js`

Create test file with all scenarios from `contracts/cli-command.md`:

```javascript
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, describe } from 'node:test';

const cliDist = path.resolve(process.cwd(), 'dist', 'index.js');

describe('memo delete interactive confirmation', () => {
  let tmp, env;

  test('setup', () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-delete-'));
    const configPath = path.join(tmp, 'context.json');
    const dbPath = path.join(tmp, 'issues.db');
    env = { ...process.env, MGTD_CONFIG_PATH: configPath };

    // Initialize test database
    const proc = spawn(process.execPath, [cliDist, 'init', '-d', dbPath, '-f', '-j'], { env });
    // ... wait for completion
  });

  test('interactive deletion with y confirms', (t, done) => {
    // Create memo
    // Run: mgtd memo delete <id>
    // Send: y\n to stdin
    // Assert: memo deleted
  });

  test('interactive deletion with n cancels', (t, done) => {
    // Similar but send n\n
  });

  // Add all test scenarios from contracts
});
```

**Run tests** (they should fail - RED phase):
```bash
pnpm --filter meme-gtd-cli build
pnpm --filter meme-gtd-cli test
```

---

### Step 2: Implement Interactive Prompt

**File**: `packages/cli/src/commands/memo/delete.ts`

Import readline at top:
```typescript
import * as readline from 'readline';
```

Replace the run() method:

```typescript
async run(): Promise<void> {
  const { args, flags } = await this.parse(MemoDelete);
  const { config } = await loadConfig({ createIfMissing: true });
  const service = new MemoService({ config });

  // Get memo for preview
  let memo;
  try {
    memo = service.show(args.id);
  } catch (error) {
    this.error(`Memo #${args.id} not found`, { exit: 1 });
  }

  // Non-interactive mode: --yes flag provided
  if (flags.yes) {
    service.remove(args.id);
    this.log(`Memo #${args.id} marked as deleted.`);
    return;
  }

  // Check if TTY available
  if (!process.stdin.isTTY) {
    this.error('Cannot prompt for confirmation. Please use --yes flag to confirm deletion.', { exit: 1 });
  }

  // Interactive mode: prompt user
  const preview = this.createPreview(memo.bodyMd);
  const confirmed = await this.promptConfirmation(args.id, preview);

  if (confirmed) {
    service.remove(args.id);
    this.log(`Memo #${args.id} marked as deleted.`);
  } else {
    this.log('Deletion cancelled.');
  }
}

private createPreview(bodyMd: string): string {
  const firstLine = bodyMd.split('\n')[0];
  if (firstLine.length > 60) {
    return firstLine.substring(0, 60) + '...';
  }
  return firstLine;
}

private async promptConfirmation(id: number, preview: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Handle Ctrl+C
    const sigintHandler = () => {
      rl.close();
      this.log('\nDeletion cancelled.');
      process.exit(130);
    };
    process.once('SIGINT', sigintHandler);

    rl.question(`Delete memo #${id}: "${preview}"? (y/n): `, (answer) => {
      process.removeListener('SIGINT', sigintHandler);
      rl.close();

      const normalized = answer.toLowerCase().trim();

      if (['y', 'yes'].includes(normalized)) {
        resolve(true);
      } else if (['n', 'no'].includes(normalized)) {
        resolve(false);
      } else {
        this.log(`Invalid input: "${answer}". Please answer 'y' or 'n'.`);
        this.log('Deletion cancelled.');
        resolve(false);
      }
    });
  });
}
```

---

### Step 3: Run Tests (GREEN phase)

```bash
pnpm --filter meme-gtd-cli build
pnpm --filter meme-gtd-cli test
```

All tests should pass.

---

### Step 4: Manual Verification

```bash
# Build
pnpm build

# Initialize test DB
mgtd init --db /tmp/test-delete.db --force

# Create test memo
mgtd memo create --body "Test interactive delete"

# Test interactive mode
mgtd memo delete 1
# Type: y
# Expected: Memo #1 marked as deleted.

# Create another
mgtd memo create --body "Test cancel"

# Test cancellation
mgtd memo delete 2
# Type: n
# Expected: Deletion cancelled.

# Create another
mgtd memo create --body "Test --yes flag"

# Test non-interactive
mgtd memo delete 3 --yes
# Expected: Immediate deletion, no prompt

# Test -y short flag
mgtd memo create --body "Test short flag"
mgtd memo delete 4 -y
# Expected: Immediate deletion, no prompt

# Test invalid input
mgtd memo create --body "Test invalid"
mgtd memo delete 5
# Type: maybe
# Expected: Invalid input error + cancelled

# Test Ctrl+C
mgtd memo create --body "Test ctrl+c"
mgtd memo delete 6
# Press: Ctrl+C
# Expected: Cancelled with exit 130
```

---

## Common Pitfalls

### 1. Readline Not Closing

**Problem**: Process hangs after prompt
**Solution**: Always call `rl.close()` in all code paths

### 2. TTY Detection False Positives

**Problem**: Prompt appears in piped commands
**Solution**: Check `process.stdin.isTTY` before creating readline interface

### 3. SIGINT Listener Leak

**Problem**: Multiple SIGINT listeners accumulate
**Solution**: Use `process.once()` or `removeListener()` after prompt

### 4. Preview Truncation

**Problem**: Multi-line memos show newline in prompt
**Solution**: Split on `\n` and take only `[0]` before truncating

---

## Testing Strategy

### Unit Tests (None Needed)

This feature is pure CLI interaction - integration tests sufficient.

### Integration Tests

Run: `pnpm --filter meme-gtd-cli test`

**Required scenarios** (from contracts/cli-command.md):
- Interactive confirm (y/yes)
- Interactive cancel (n/no)
- Invalid input handling
- Ctrl+C handling
- --yes flag (non-interactive)
- -y short flag
- Non-TTY error
- Case insensitivity

**Expected Total**: ~12 tests

---

## Definition of Done

- ✅ All integration tests pass
- ✅ Manual verification scenarios pass
- ✅ Build succeeds: `pnpm build`
- ✅ Interactive prompt displays memo preview
- ✅ y/yes confirms deletion
- ✅ n/no cancels deletion
- ✅ Invalid input shows error and cancels
- ✅ Ctrl+C cancels gracefully (exit 130)
- ✅ --yes flag skips prompt
- ✅ -y short flag works
- ✅ Non-TTY requires --yes flag
- ✅ Case-insensitive input handling
- ✅ Backward compatibility maintained

---

## Reference Materials

- **Spec**: `spec.md` - User stories
- **Research**: `research.md` - Technical decisions
- **Contract**: `contracts/cli-command.md` - Command behavior

For questions, refer to:
- Node.js readline docs: https://nodejs.org/api/readline.html
- oclif command docs: https://oclif.io/docs/commands
- Existing delete.ts: Current implementation
