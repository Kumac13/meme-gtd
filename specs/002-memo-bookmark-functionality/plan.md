# Implementation Plan: Memo & Task Bookmark Functionality

**Branch**: `002-memo-bookmark-functionality` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-memo-bookmark-functionality/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature enables users to bookmark memos and tasks for quick access to prioritized items. The implementation adds bookmark/unbookmark commands to both memo and task CLIs, extends list commands with `--bookmarked` filtering, and ensures bookmark status is preserved during memo-to-task promotion. The existing `is_bookmarked` field in the issues table will be utilized with new CLI commands and repository methods.

## Technical Context

**Language/Version**: TypeScript (ES2022), Node.js >=22.0.0
**Primary Dependencies**: oclif (CLI framework), better-sqlite3 (SQLite driver), zod (validation)
**Storage**: SQLite (existing issues table with is_bookmarked field)
**Testing**: node:test (native test runner)
**Target Platform**: macOS/Linux CLI (single-user local-first application)
**Project Type**: Monorepo with pnpm workspaces (packages: cli, core, db, config, shared, logger)
**Performance Goals**: <2s for bookmark operations, <1s for filtered list retrieval
**Constraints**: Local SQLite only, no remote API, preserves GitHub CLI (`gh`) command patterns
**Scale/Scope**: Single-user, ~13 new CLI commands, 2 repository methods, ~15 integration tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Inferred Principles (from existing codebase)

1. **Monorepo Structure**: Features organized in pnpm workspace packages (cli, core, db, config, shared, logger)
2. **Test-Driven Development**: Tests in node:test, located alongside source in test/ directories
3. **CLI-First Design**: GitHub CLI (`gh`) patterns, oclif framework, kebab-case flags
4. **Type Safety**: TypeScript with strict mode, zod validation for runtime types
5. **Local-First**: SQLite only, no remote sync, single-user focus

### Gate Evaluation

| Gate | Status | Notes |
|------|--------|-------|
| Follows monorepo structure | ✅ PASS | Changes in packages/cli, packages/db (existing structure) |
| Tests written first | ✅ PASS | TDD approach specified in tasks phase |
| GitHub CLI patterns | ✅ PASS | bookmark/unbookmark mirrors `gh` command style |
| Type safety maintained | ✅ PASS | TypeScript with zod validation |
| Local-first design | ✅ PASS | No remote API, SQLite only |

**Overall**: ✅ ALL GATES PASSED - Ready for Phase 0 research

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
packages/
├── cli/
│   ├── src/
│   │   └── commands/
│   │       ├── memo/
│   │       │   ├── bookmark.ts       # NEW: memo bookmark command
│   │       │   ├── unbookmark.ts     # NEW: memo unbookmark command
│   │       │   └── list.ts           # MODIFY: add --bookmarked flag
│   │       └── task/
│   │           ├── bookmark.ts       # NEW: task bookmark command
│   │           ├── unbookmark.ts     # NEW: task unbookmark command
│   │           └── list.ts           # MODIFY: add --bookmarked flag
│   └── test/
│       └── commands/
│           ├── memo/
│           │   └── bookmark.test.js  # NEW: integration tests
│           └── task/
│               └── bookmark.test.js  # NEW: integration tests
│
├── db/
│   └── src/
│       ├── memoRepository.ts         # MODIFY: add setBookmark()
│       └── taskRepository.ts         # MODIFY: add setBookmark()
│
└── core/
    └── src/
        └── (no changes - bookmark is simple CRUD)
```

**Structure Decision**: Monorepo with pnpm workspaces. This feature adds new CLI commands to packages/cli, extends repository methods in packages/db, and adds integration tests. No changes to packages/core as bookmark operations are straightforward database updates without complex business logic.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
