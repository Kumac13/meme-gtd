# Feature Specification: Interactive Confirmation for Memo Delete

**Feature Branch**: `003-https-github-com`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/4 の問題を解決したい。"

## User Scenarios & Testing

### User Story 1 - Interactive Deletion Confirmation (Priority: P1) 🎯 MVP

Users need a natural, interactive way to confirm memo deletion without remembering command flags. When a user attempts to delete a memo, they should be prompted with a yes/no question and can respond by typing 'y' or 'n'.

**Why this priority**: This is the core improvement requested - making deletion feel natural and safe. It directly addresses the user pain point of having to remember the `--yes` flag.

**Independent Test**: Run `mgtd memo delete <id>` and verify that an interactive prompt appears asking for confirmation. Responding 'y' should delete the memo, and 'n' should cancel the operation.

**Acceptance Scenarios**:

1. **Given** a memo exists with ID 5, **When** user runs `mgtd memo delete 5` and types 'y' at the prompt, **Then** the memo is marked as deleted and confirmation message is shown
2. **Given** a memo exists with ID 5, **When** user runs `mgtd memo delete 5` and types 'n' at the prompt, **Then** the memo is NOT deleted and cancellation message is shown
3. **Given** a memo exists with ID 5, **When** user runs `mgtd memo delete 5` and types 'yes' at the prompt, **Then** the memo is marked as deleted (accept common variants)
4. **Given** a memo exists with ID 5, **When** user runs `mgtd memo delete 5` and types 'no' at the prompt, **Then** the memo is NOT deleted (accept common variants)

---

### User Story 2 - Non-Interactive Mode for Automation (Priority: P2)

AI agents and scripts need to delete memos without interactive prompts. The `--yes` flag should bypass the interactive prompt and immediately delete the memo, enabling automated workflows.

**Why this priority**: Essential for automation and scripting use cases. Without this, the feature breaks existing automation workflows (including AI assistants).

**Independent Test**: Run `mgtd memo delete <id> --yes` and verify that the memo is deleted immediately without any interactive prompt.

**Acceptance Scenarios**:

1. **Given** a memo exists with ID 5, **When** user runs `mgtd memo delete 5 --yes`, **Then** the memo is immediately deleted without prompting for confirmation
2. **Given** a memo exists with ID 5, **When** an AI agent runs `mgtd memo delete 5 --yes`, **Then** the memo is deleted and the script can capture the exit code for success/failure

---

### User Story 3 - Short Flag Alias (Priority: P3)

Power users want to quickly confirm deletions with minimal typing. A short flag `-y` should work identically to `--yes` for convenience.

**Why this priority**: Nice-to-have convenience feature for frequent users. Low implementation cost but improves user experience for power users.

**Independent Test**: Run `mgtd memo delete <id> -y` and verify it behaves identically to `--yes`.

**Acceptance Scenarios**:

1. **Given** a memo exists with ID 5, **When** user runs `mgtd memo delete 5 -y`, **Then** the memo is deleted immediately without prompting (same as --yes)

---

### Edge Cases

- What happens when user types invalid input (not y/n/yes/no) at the interactive prompt?
- How does the system handle Ctrl+C during the interactive prompt?
- What happens when running in an automated script or piped command without --yes flag?
- How does the command behave when attempting to delete a non-existent memo ID?
- What happens when attempting to delete an already-deleted memo?

## Requirements

### Functional Requirements

- **FR-001**: System MUST display an interactive yes/no prompt when `mgtd memo delete <id>` is run without the `--yes` flag
- **FR-002**: Interactive prompt MUST accept 'y', 'Y', 'yes', 'Yes', 'YES' as confirmation
- **FR-003**: Interactive prompt MUST accept 'n', 'N', 'no', 'No', 'NO' as cancellation
- **FR-004**: System MUST bypass interactive prompt when `--yes` flag is provided
- **FR-005**: System MUST support `-y` as a short alias for `--yes`
- **FR-006**: System MUST display appropriate error message when invalid input is provided at interactive prompt
- **FR-007**: System MUST handle Ctrl+C gracefully and cancel the deletion operation
- **FR-008**: System MUST detect when interactive input is not available (e.g., piped commands, automated scripts) and require the --yes flag, displaying the error message: "Cannot prompt for confirmation. Please use --yes flag to confirm deletion."
- **FR-009**: Interactive prompt MUST clearly indicate which memo is about to be deleted (show ID and preview of content)
- **FR-010**: System MUST maintain existing error handling for non-existent or already-deleted memos

### Key Entities

This feature does not introduce new entities. It modifies the behavior of the existing memo deletion interaction.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Users can delete memos using natural interactive confirmation (type 'y' or 'n') without needing to remember command flags
- **SC-002**: Interactive prompt responds to user input within 100ms
- **SC-003**: Automated scripts and AI agents can delete memos non-interactively using `--yes` flag without any prompts
- **SC-004**: Invalid inputs at the prompt are rejected with clear error messages and re-prompt the user
- **SC-005**: 100% of interactive deletion attempts clearly display what will be deleted (memo ID and content preview)

## Assumptions

- **Assumption 1**: The current `--yes` flag behavior is preserved for backward compatibility
- **Assumption 2**: Interactive prompt is only shown when running in a terminal with interactive input available
- **Assumption 3**: Command follows standard Unix conventions for interactive confirmations (similar to `rm -i`)
- **Assumption 4**: Memo content preview in prompt is limited to first 50-80 characters to avoid excessive output
- **Assumption 5**: Case-insensitive input matching (Y/y, YES/yes, etc.) is user-friendly and expected

## Scope

### In Scope

- Interactive yes/no prompt for `mgtd memo delete <id>`
- Accepting common variants of yes/no responses
- `--yes` flag to bypass prompt (existing behavior preserved)
- `-y` short flag alias
- Clear indication of what will be deleted
- Error handling for invalid inputs
- Graceful handling of Ctrl+C

### Out of Scope

- Undo/restore functionality for deleted memos (soft delete is separate feature)
- Batch deletion with interactive confirmation
- Confirmation prompts for other commands (create, edit, etc.)
- Configuration option to disable prompts globally
- Extending interactive prompts to task deletion or other entity types
