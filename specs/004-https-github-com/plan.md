# Implementation Plan: Version Command Implementation

**Branch**: `004-https-github-com` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-https-github-com/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Issue #5「versionをどのように管理するかの検討」および「versionを確認するコマンドを追加する」に対応。

1. **バージョン管理方針の確立と文書化**: Fixed Versioning採用、SemVerルール、リリースプロセスをdocs/versioning.mdに記載
2. **バージョン表示機能の実装**: `mgtd --version`および`mgtd -v`コマンドを実装し、CLIのバージョン番号をユーザーが確認できるようにする。oclifフレームワークのネイティブ機能を活用し、package.jsonから動的にバージョンを読み取る
3. **詳細情報の提供**: `mgtd version`サブコマンドを実装し、詳細な環境情報（Node.jsバージョン要件、ビルド情報）を提供する

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js >=22.0.0 (actual: v20.18.3)
**Primary Dependencies**:
- @oclif/core v4.0.0 (CLIフレームワーク)
- fs-extra v11.2.0 (ファイル操作)
- Node.js標準モジュール (fs, path)

**Storage**: N/A - package.jsonからの読み取りのみ
**Testing**: Node.js native test runner (`node --test`)
**Target Platform**: CLI application (macOS, Linux, Windows)
**Project Type**: Monorepo - packages/cli modification only
**Performance Goals**: バージョン表示は100ms以内
**Constraints**:
- 外部依存なし（Node.js標準モジュールとoclifのみ）
- package.jsonとの同期を保つ
- oclifのバージョン処理との競合を避ける

**Scale/Scope**: 単一コマンド追加（`mgtd version`）+ フラグ処理（`--version`, `-v`）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ No constitution file exists (template-only). No governance gates to evaluate.

Since `.specify/memory/constitution.md` contains only template instructions and no actual project rules, there are no complexity limits, architectural constraints, or approval gates to check. This feature can proceed directly to research phase.

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
│   ├── commands/
│   │   └── version.ts          # New: version subcommand
│   ├── index.ts                 # Modified: version flag handling
│   └── package.json             # Read: version source
└── test/
    └── commands/
        └── version.test.js      # New: version command tests
```

**Structure Decision**: Monorepo structure with single CLI package modification. This feature adds one new command file (`version.ts`) and modifies the main entry point (`index.ts`) to handle `--version` and `-v` flags. The version number is read from `packages/cli/package.json` at runtime.

**Key Files**:
- **`packages/cli/src/commands/version.ts`** (New): Implements `mgtd version` subcommand with detailed info
- **`packages/cli/src/index.ts`** (Modified): Handles `--version` / `-v` flags before command routing
- **`packages/cli/package.json`** (Read-only): Source of truth for version number
- **`packages/cli/test/commands/version.test.js`** (New): Test coverage for version functionality

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

N/A - No constitution violations detected.
