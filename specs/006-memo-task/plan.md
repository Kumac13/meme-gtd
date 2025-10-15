# Implementation Plan: 統合ラベル管理システム

**Branch**: `006-memo-task` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-memo-task/spec.md`

## Summary

既存の`memo label`/`task label`コマンドを削除し、統合された`mgtd label`コマンドを実装する。DBスキーマは変更せず、既存の`attachLabels()`等のリポジトリ関数を再利用する。新しいLabelServiceを作成し、CLI層から呼び出す。

## Technical Context

**Language/Version**: TypeScript (existing codebase)
**Primary Dependencies**: oclif (CLI framework), better-sqlite3 (database)
**Storage**: SQLite (existing schema - no changes required)
**Testing**: Node.js test runner (existing test infrastructure)
**Target Platform**: CLI (Node.js)
**Project Type**: Monorepo (pnpm workspaces)
**Performance Goals**: 1000 labels list in <1 second
**Constraints**: Reuse existing DB functions, maintain DB schema compatibility
**Scale/Scope**: 4 new CLI commands, 1 new Service class, remove 8 existing commands

## Constitution Check

*GATE: Constitution file is a template placeholder - skipping formal constitution check*

**No violations**: This feature adds CLI commands and a service layer without introducing new complexity. It simplifies the codebase by:
- Removing duplicate `memo label`/`task label` commands (8 files)
- Adding unified `mgtd label` commands (4 files)
- Net reduction of 4 command files

## Project Structure

### Documentation (this feature)

```
specs/006-memo-task/
├── plan.md              # This file
├── research.md          # Phase 0 output (next step)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```
packages/
├── cli/
│   └── src/
│       └── commands/
│           ├── label/              # NEW: Unified label commands
│           │   ├── index.ts        # label list
│           │   ├── add.ts          # label add
│           │   ├── set.ts          # label set
│           │   └── delete.ts       # label delete
│           ├── memo/
│           │   └── label/          # DELETE: All files in this directory
│           │       ├── index.ts
│           │       ├── add.ts
│           │       ├── set.ts
│           │       └── remove.ts
│           └── task/
│               └── label/          # DELETE: All files in this directory
│                   ├── index.ts
│                   ├── add.ts
│                   ├── set.ts
│                   └── remove.ts
│
├── core/
│   └── src/
│       └── index.ts                # ADD: LabelService class
│
├── db/
│   └── src/
│       ├── labelRepository.ts      # NEW: Label-specific repository functions
│       └── index.ts                # MODIFY: Export new functions
│
└── shared/
    └── src/
        └── index.ts                # ADD: Label type if needed

tests/
└── [Existing test structure - add label command tests]
```

**Structure Decision**: Monorepo structure with existing packages. New `LabelService` added to `packages/core`, new repository functions added to `packages/db/src/labelRepository.ts`, new CLI commands added to `packages/cli/src/commands/label/`.

## Complexity Tracking

*No violations - no complexity justification needed*
