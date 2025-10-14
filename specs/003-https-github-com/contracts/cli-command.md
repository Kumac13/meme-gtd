# CLI Command Contract: memo delete (Interactive)

**Feature**: 003-https-github-com
**Created**: 2025-10-14

## Command Signature

```bash
mgtd memo delete <id> [--yes | -y]
```

## Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | integer | Yes | ID of the memo to delete |

## Flags

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--yes` | `-y` | boolean | false | Skip interactive confirmation and delete immediately |

## Behavior

### Interactive Mode (default)

**When**: Command run without `--yes` flag AND stdin is a TTY

**Flow**:
1. Fetch memo by ID
2. Display prompt: `Delete memo #<id>: "<preview>"? (y/n): `
3. Wait for user input
4. Process response:
   - `y`, `Y`, `yes`, `Yes`, `YES` → Delete memo
   - `n`, `N`, `no`, `No`, `NO` → Cancel operation
   - Any other input → Display error and cancel
5. Display result message

**Example**:
```bash
$ mgtd memo delete 5
Delete memo #5: "Fix the authentication bug in user login..."? (y/n): y
Memo #5 marked as deleted.
```

### Non-Interactive Mode (--yes flag)

**When**: Command run with `--yes` or `-y` flag

**Flow**:
1. Fetch memo by ID
2. Delete memo immediately (no prompt)
3. Display success message

**Example**:
```bash
$ mgtd memo delete 5 --yes
Memo #5 marked as deleted.
```

### Non-TTY Environment

**When**: Command run without `--yes` flag AND stdin is NOT a TTY (piped, automated script)

**Flow**:
1. Detect non-TTY environment
2. Display error message
3. Exit with code 1

**Example**:
```bash
$ echo "something" | mgtd memo delete 5
Error: Cannot prompt for confirmation. Please use --yes flag to confirm deletion.
$ echo $?
1
```

## Output

### Success Messages

| Scenario | Message |
|----------|---------|
| Deletion confirmed (interactive) | `Memo #<id> marked as deleted.` |
| Deletion via --yes | `Memo #<id> marked as deleted.` |
| Deletion cancelled (interactive) | `Deletion cancelled.` |

### Error Messages

| Scenario | Message | Exit Code |
|----------|---------|-----------|
| Memo not found | `Error: Memo #<id> not found` | 1 |
| Invalid input (not y/n) | `Invalid input: "<input>". Please answer 'y' or 'n'.\nDeletion cancelled.` | 0 |
| Non-TTY without --yes | `Error: Cannot prompt for confirmation. Please use --yes flag to confirm deletion.` | 1 |
| Ctrl+C pressed | `\nDeletion cancelled.` | 130 |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (memo deleted or cancelled gracefully) |
| 1 | Error (memo not found, non-TTY without --yes) |
| 130 | Interrupted by user (SIGINT / Ctrl+C) |

## Interactive Prompt Format

```
Delete memo #<id>: "<preview>"? (y/n):
```

**Preview Rules**:
- Show first 60 characters of `body_md`
- Show only first line (stop at first `\n`)
- Append `...` if truncated
- Preserve exact content (no escaping/sanitization needed for display)

**Example Prompts**:
```
Delete memo #5: "Fix authentication bug"? (y/n):
Delete memo #12: "This is a very long memo that will be truncated after six..."? (y/n):
```

## Response Validation

| Input | Normalized | Result |
|-------|-----------|---------|
| `y` | `y` | Confirm |
| `Y` | `y` | Confirm |
| `yes` | `yes` | Confirm |
| `Yes` | `yes` | Confirm |
| `YES` | `yes` | Confirm |
| `n` | `n` | Cancel |
| `N` | `n` | Cancel |
| `no` | `no` | Cancel |
| `No` | `no` | Cancel |
| `NO` | `no` | Cancel |
| `yep` | (invalid) | Error + Cancel |
| `nope` | (invalid) | Error + Cancel |
| `maybe` | (invalid) | Error + Cancel |
| (empty) | (invalid) | Error + Cancel |

## Backward Compatibility

- Existing `--yes` flag behavior unchanged
- New `-y` short alias added
- Scripts using `--yes` continue to work without modification
- Interactive prompt is purely additive (only appears when flag absent)

## Testing Scenarios

### Integration Tests

1. **Interactive confirm (y)**: User types 'y' → memo deleted
2. **Interactive confirm (yes)**: User types 'yes' → memo deleted
3. **Interactive cancel (n)**: User types 'n' → memo not deleted
4. **Interactive cancel (no)**: User types 'no' → memo not deleted
5. **Invalid input**: User types 'maybe' → error + cancel
6. **Empty input**: User presses enter → error + cancel
7. **Ctrl+C**: User presses Ctrl+C → cancel with exit 130
8. **Non-interactive --yes**: Flag provided → immediate deletion
9. **Non-interactive -y**: Short flag provided → immediate deletion
10. **Non-TTY without flag**: Piped/script without --yes → error
11. **Non-existent memo**: Invalid ID → error (existing behavior)
12. **Case insensitive**: 'YES', 'No', 'Y', 'n' → all work correctly

### Edge Cases

- Very long memo content → truncated to 60 chars
- Memo with newlines → only first line shown
- Special characters in memo → displayed as-is
- Multiple spaces in input → trimmed before validation
- Uppercase/lowercase mix → normalized correctly
