# Implementation Plan: Interactive Confirmation for Memo Delete

**Branch**: `003-https-github-com` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-https-github-com/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Replace the current `--yes` requirement with an interactive y/n prompt when users run `mgtd memo delete <id>`. The `--yes` flag remains available for automation and scripts. Implementation uses native Node.js `readline` module for TTY detection and interactive input, with no external dependencies added.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js >=22.0.0 (actual: v20.18.3)
**Primary Dependencies**:
- @oclif/core v4.0.0 (CLI framework)
- Node.js readline (native module for interactive prompts)
- better-sqlite3 v9.0.0 (database, no changes needed)

**Storage**: N/A - no database changes required
**Testing**: Node.js native test runner (`node --test`)
**Target Platform**: CLI application (macOS, Linux, Windows terminals)
**Project Type**: Monorepo - packages/cli modification only
**Performance Goals**: Interactive prompt response <100ms
**Constraints**:
- Zero external dependencies added (use Node.js stdlib)
- Backward compatibility with `--yes` flag required
- TTY detection required for automation support

**Scale/Scope**: Single command modification in existing CLI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASSED (no constitution file exists - default pass)

**Notes**: Project does not have a defined constitution file at `.specify/memory/constitution.md`. No gates to evaluate.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/cli/
├── src/
│   └── commands/
│       └── memo/
│           └── delete.ts          # MODIFY: Add interactive prompt logic
└── test/
    └── commands/
        └── memo/
            └── delete.test.js      # CREATE: Integration tests for interactive deletion
```

**Structure Decision**: This is a monorepo project. Only the `packages/cli` package is affected. The modification is isolated to a single command file (`delete.ts`) with corresponding integration tests.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
