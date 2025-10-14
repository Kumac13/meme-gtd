# Implementation Plan: mgtd task Command Implementation

**Branch**: `005-docs-mgtd-task` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-docs-mgtd-task/spec.md`

## Summary

This feature implements the `mgtd task` command set for managing actionable tasks in the GTD workflow. The implementation mirrors the existing `mgtd memo` command structure, adding task-specific functionality including status management (open/next/waiting/scheduled/done/canceled), scheduled date handling, and state transition commands (close/cancel/reopen). The task commands will use the same `issues` table with `type='task'` and enforce type safety to prevent memo/task ID confusion. This provides users with a complete CLI for moving from capture (memo) to execution (task) phases in GTD methodology.

## Technical Context

**Language/Version**: TypeScript with Node.js 22.x, using ES modules
**Primary Dependencies**:
- @oclif/core (CLI framework, already in use for memo commands)
- better-sqlite3 (SQLite driver, already integrated)
- meme-gtd-db (database layer, extends for task operations)
- meme-gtd-core (service layer, add TaskService parallel to MemoService)
- meme-gtd-shared (shared types, extend with Task type)

**Storage**: SQLite local database (already initialized), `issues` table with type discriminator
**Testing**: node:test (already in use), TDD approach following memo command patterns
**Target Platform**: macOS/Linux CLI, installed via pnpm
**Project Type**: Monorepo with pnpm workspaces (packages/cli, packages/core, packages/db, packages/config, packages/shared, packages/logger)
**Performance Goals**:
- Task list filtering on 1000+ records in <1 second (using FTS5 for search, indexed queries for status/label)
- Task create/view operations in <10 seconds including editor launch
- All operations maintain type safety with zero false positives on type validation

**Constraints**:
- Must maintain 100% backward compatibility with existing memo commands
- Must reuse existing infrastructure (database schema, FTS5, labels, projects)
- Type validation must catch memo/task mismatches at runtime before database access
- CLI flags must follow kebab-case convention established in v0.1.1
- Must detect and reject legacy camelCase flags with migration guidance

**Scale/Scope**:
- 11 new CLI commands (create, list, view, edit, close, cancel, reopen, delete, comment add/edit/delete, label add/set/remove, bookmark/unbookmark)
- Extends 3 packages: cli (command files), core (TaskService), db (taskRepository)
- Reuses existing database schema (no migrations needed)
- Estimated 8 user stories with 40+ acceptance scenarios

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: No project constitution found at `.specify/memory/constitution.md` (file contains template placeholders only)

**Default Quality Gates Applied**:
- ✅ **Code Reuse**: Feature reuses existing packages (cli, core, db), follows established patterns from memo commands
- ✅ **Testing**: TDD approach mandatory, tests written before implementation (following v0.1.0/v0.1.1 patterns)
- ✅ **Documentation**: Requirements and CLI specs already documented in docs/requirement.md and docs/cli_requirement.md
- ✅ **No Duplication**: TaskService will parallel MemoService structure, sharing common utilities from db layer

**No violations to justify** - proceeding with standard quality practices.

## Project Structure

### Documentation (this feature)

```
specs/005-docs-mgtd-task/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (already created)
├── checklists/
│   └── requirements.md  # Specification quality checklist (already created)
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
│   └── src/
│       └── commands/
│           ├── memo/              # Existing (reference for patterns)
│           │   ├── create.ts
│           │   ├── list.ts
│           │   ├── view.ts
│           │   ├── edit.ts
│           │   ├── delete.ts
│           │   ├── promote.ts
│           │   ├── bookmark.ts
│           │   ├── unbookmark.ts
│           │   ├── comment/
│           │   │   ├── add.ts
│           │   │   ├── edit.ts
│           │   │   └── delete.ts
│           │   └── label/
│           │       ├── add.ts
│           │       ├── set.ts
│           │       └── remove.ts
│           └── task/              # NEW - parallel structure to memo/
│               ├── create.ts      # NEW
│               ├── list.ts        # NEW
│               ├── view.ts        # NEW
│               ├── edit.ts        # NEW
│               ├── delete.ts      # NEW
│               ├── close.ts       # NEW
│               ├── cancel.ts      # NEW
│               ├── reopen.ts      # NEW
│               ├── bookmark.ts    # NEW
│               ├── unbookmark.ts  # NEW
│               ├── comment/       # NEW
│               │   ├── add.ts     # NEW
│               │   ├── edit.ts    # NEW
│               │   └── delete.ts  # NEW
│               └── label/         # NEW
│                   ├── add.ts     # NEW
│                   ├── set.ts     # NEW
│                   └── remove.ts  # NEW
│
├── core/
│   └── src/
│       └── index.ts               # MODIFY - export TaskService alongside MemoService
│
├── db/
│   └── src/
│       ├── memoRepository.ts      # Existing (reference for patterns)
│       └── taskRepository.ts      # NEW - parallel functions for task operations
│
└── shared/
    └── src/
        └── types.ts               # MODIFY - add Task type alongside Memo type

tests/ (or per-package test directories)
├── cli/
│   └── commands/
│       └── task/                  # NEW - mirror memo test structure
│           ├── create.test.ts
│           ├── list.test.ts
│           ├── view.test.ts
│           ├── edit.test.ts
│           ├── close.test.ts
│           ├── cancel.test.ts
│           ├── reopen.test.ts
│           └── ...
├── core/
│   └── taskService.test.ts        # NEW
└── db/
    └── taskRepository.test.ts     # NEW
```

**Structure Decision**: This is a monorepo with pnpm workspaces. The task feature extends three existing packages (cli, core, db) and adds parallel implementations mirroring the memo command structure. The `issues` table is shared, differentiated by the `type` field ('memo' vs 'task'). No new packages are needed—all changes are additive within existing package boundaries. The CLI command tree follows oclif conventions with nested directories (task/comment/add.ts → `mgtd task comment add`).

## Complexity Tracking

*No violations to justify - all design decisions follow established patterns from memo implementation.*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |
