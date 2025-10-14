# Research: Interactive Confirmation for Memo Delete

**Feature**: 003-https-github-com
**Created**: 2025-10-14

## Research Areas

### 1. Interactive Prompting in Node.js CLI Applications

**Decision**: Use native Node.js `readline` module for interactive prompts

**Rationale**:
- Native solution - no external dependencies needed
- Provides TTY detection via `process.stdin.isTTY`
- Well-supported across Node.js versions
- Handles stdin/stdout properly for interactive input
- Integrates cleanly with oclif commands

**Alternatives Considered**:
- **inquirer.js**: More feature-rich but adds dependency and complexity. Overkill for simple y/n prompt.
- **prompts**: Lightweight but still an external dependency. readline is sufficient for our use case.
- **oclif/prompts (@oclif/core)**: oclif v4 doesn't include built-in prompting utilities

**Implementation Pattern**:
```typescript
import * as readline from 'readline';

// Check if TTY available
if (!process.stdin.isTTY) {
  // Require --yes flag
  this.error('Cannot prompt for confirmation. Please use --yes flag to confirm deletion.');
}

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Prompt for confirmation
rl.question('Delete memo #5: "Example content..."? (y/n): ', (answer) => {
  rl.close();
  const normalized = answer.toLowerCase().trim();
  if (['y', 'yes'].includes(normalized)) {
    // Proceed with deletion
  } else if (['n', 'no'].includes(normalized)) {
    // Cancel
  } else {
    // Invalid input - re-prompt or error
  }
});
```

---

### 2. Graceful Handling of Ctrl+C (SIGINT)

**Decision**: Use Node.js event listeners to detect Ctrl+C and clean up readline interface

**Rationale**:
- Standard Unix signal handling pattern
- Prevents readline from leaving terminal in bad state
- Provides clean exit message
- No external dependencies

**Implementation Pattern**:
```typescript
let rl: readline.Interface | null = null;

process.on('SIGINT', () => {
  if (rl) {
    rl.close();
  }
  console.log('\nDeletion cancelled.');
  process.exit(130); // Standard exit code for SIGINT
});

rl = readline.createInterface({ /* ... */ });
```

---

### 3. Input Validation and Re-prompting

**Decision**: Accept case-insensitive variants (y/yes/n/no), reject invalid input with clear message

**Rationale**:
- Matches user expectations from other CLI tools (rm -i, git)
- Case-insensitive matching is more forgiving
- Clear error messages guide users to valid options
- For invalid input, display error and cancel (don't re-prompt to avoid infinite loop)

**Implementation Pattern**:
```typescript
const answer = input.toLowerCase().trim();

if (['y', 'yes'].includes(answer)) {
  return true; // Confirmed
} else if (['n', 'no'].includes(answer)) {
  return false; // Cancelled
} else {
  console.error(`Invalid input: "${input}". Please answer 'y' or 'n'.`);
  console.log('Deletion cancelled.');
  return false;
}
```

---

### 4. Memo Content Preview in Prompt

**Decision**: Show first 60 characters of memo content in deletion prompt

**Rationale**:
- Helps users verify they're deleting the right memo
- 60 characters fits comfortably in most terminal widths (80 cols standard)
- Truncate with ellipsis (...) if longer
- Matches pattern from `memo list` command

**Implementation Pattern**:
```typescript
const memo = service.show(args.id);
const preview = memo.bodyMd.length > 60
  ? memo.bodyMd.substring(0, 60) + '...'
  : memo.bodyMd;
const firstLine = preview.split('\n')[0]; // Only show first line

const question = `Delete memo #${args.id}: "${firstLine}"? (y/n): `;
```

---

### 5. Testing Interactive CLI Commands

**Decision**: Use Node.js `child_process.spawn` with stdin piping for integration tests

**Rationale**:
- Allows simulating user input in tests
- Tests actual CLI behavior (not just mocked functions)
- Verifies TTY detection works correctly
- Can test both interactive and non-interactive modes

**Implementation Pattern**:
```javascript
import { spawn } from 'child_process';

test('interactive deletion with y', (t, done) => {
  const proc = spawn('node', ['dist/index.js', 'memo', 'delete', '5']);

  proc.stdin.write('y\n');
  proc.stdin.end();

  let stdout = '';
  proc.stdout.on('data', (data) => { stdout += data; });

  proc.on('close', (code) => {
    assert.equal(code, 0);
    assert.match(stdout, /memo #5 marked as deleted/i);
    done();
  });
});
```

---

### 6. Backward Compatibility with --yes Flag

**Decision**: Preserve existing `--yes` flag behavior exactly as-is

**Rationale**:
- Existing automation/scripts depend on this flag
- Adding `-y` alias is additive (no breaking change)
- Interactive prompt only appears when flag is absent
- No changes to flag parsing or validation logic

**Implementation**: No changes needed to flag definition, only modify command execution flow.

---

## Summary

All technical decisions use native Node.js capabilities without additional dependencies. The implementation follows Unix CLI conventions (similar to `rm -i`) and maintains backward compatibility with the existing `--yes` flag.

**Key Technologies**:
- Node.js `readline` module for interactive prompts
- Process signals (`SIGINT`) for Ctrl+C handling
- `process.stdin.isTTY` for terminal detection
- `child_process.spawn` for integration testing

**No external dependencies added** - all functionality available in Node.js standard library and existing oclif framework.
