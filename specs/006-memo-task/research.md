# Research: 統合ラベル管理システム

**Feature**: 006-memo-task | **Date**: 2025-10-15

## Research Questions

No research required - all technical context is clear from existing codebase analysis.

## Technology Decisions

### 1. Label Repository Functions

**Decision**: Create `labelRepository.ts` with label-specific operations

**Rationale**:
- Existing `attachLabels()` in memoRepository and taskRepository are duplicated
- Labels are a shared concern across memo/task
- Centralize label operations in dedicated repository

**Alternatives considered**:
- Keep functions duplicated in memo/task repositories → Rejected: violates DRY principle
- Put all functions in a single generic repository → Rejected: too broad, loses domain separation

### 2. LabelService Design

**Decision**: Create LabelService class in `packages/core/src/index.ts`

**Rationale**:
- Follows existing pattern (MemoService, TaskService)
- Provides abstraction layer for CLI commands
- Handles DB connection initialization

**Alternatives considered**:
- Call repository functions directly from CLI → Rejected: bypasses service layer pattern
- Extend MemoService/TaskService → Rejected: labels are independent domain

### 3. CLI Command Structure

**Decision**: Create top-level `label` command with subcommands (list, add, set, delete)

**Rationale**:
- Aligns with spec requirement (FR-001 through FR-006)
- Follows oclif pattern (existing `memo`, `task` commands)
- GitHub CLI (`gh label`) uses same structure

**Alternatives considered**:
- Flat commands (`mgtd label-list`, `mgtd label-add`) → Rejected: not oclif convention
- Keep memo/task label commands → Rejected: violates spec (FR-011)

### 4. Command Deletion Strategy

**Decision**: Remove all files in `packages/cli/src/commands/{memo,task}/label/`

**Rationale**:
- FR-011 requires complete removal
- SC-005 verifies commands are not executable
- No migration needed (DB schema unchanged)

**Alternatives considered**:
- Deprecate with warning → Rejected: spec requires immediate removal
- Redirect to new commands → Rejected: out of scope (no auto-migration)

### 5. Label ID vs Name in `mgtd label set`

**Decision**: Use `<issue-id> <label-id>` format (IDs for both arguments)

**Rationale**:
- Spec explicitly shows `mgtd label set 5 2` (ID-based)
- Avoids ambiguity with spaces in label names
- Consistent with internal DB representation

**Alternatives considered**:
- `<issue-id> <label-name>` → Rejected: spec shows numeric label-id
- `--label-id` flag → Rejected: spec shows positional arguments

### 6. Reuse Existing DB Functions

**Decision**: Extract and reuse `attachLabels()`, `detachLabels()` from existing repositories

**Rationale**:
- FR-005 explicitly requires using existing `attachLabels()`
- No DB schema changes (SC-003 CASCADE already implemented)
- Functions are already tested

**Alternatives considered**:
- Rewrite functions → Rejected: unnecessary, increases risk
- Keep duplicated in memo/task repos → Rejected: violates DRY

## Implementation Notes

- oclif automatically handles command registration when files are in `commands/` directory
- CLI must update `MULTIWORD_COMMANDS` array in `packages/cli/src/index.ts` to include new label commands
- Existing tests for label operations can be adapted for new commands
- JSON output format should match existing command patterns (`--json` flag)

## Open Questions

None - all technical details resolved from spec and codebase analysis.
