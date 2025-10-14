# Implementation Plan: Memo Command CLI Requirements Alignment

**Branch**: `001-docs-plan-init` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-docs-plan-init/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

この機能は、mgtdのmemoコマンドをGitHub CLI準拠に修正するものです。主要な変更点は以下の3つ：

1. **オプション命名規則の統一** (P1): camelCase（`--bodyFile`, `--addLabel`）からkebab-case（`--body-file`, `--add-label`）への変更により、GitHub CLIとの一貫性を確保し、学習コストを削減する。
2. **エディタ起動の明示的制御** (P2): `--editor` / `--no-editor`フラグを追加し、スクリプト自動化とインタラクティブな編集の両方のユースケースに対応する。
3. **機能重複の解消** (P3): `memo edit --set-label`を削除し、`memo label set`コマンドに一元化することで、設計の一貫性を保つ。

技術的アプローチ：既存のoclif CLIフレームワークを利用し、フラグ定義を変更してテストとドキュメントを更新する。破壊的変更を含むため、旧オプションに対する適切なエラーメッセージを提供する。

## Technical Context

**Language/Version**: TypeScript (ES Modules), Node.js 22.18.0+
**Primary Dependencies**: oclif 3.x (CLI framework), better-sqlite3 (SQLite driver)
**Storage**: SQLite (local database at `~/.local/share/mgtd/issues.db`)
**Testing**: node:test (Node.js native test runner)
**Target Platform**: CLI (macOS, Linux, Windows)
**Project Type**: Monorepo (pnpm workspace) - packages: cli, core, db, config, logger, shared
**Performance Goals**: コマンド応答時間 < 100ms (local DB operations)
**Constraints**:
  - 単一ユーザー・ローカルファースト設計
  - 既存テストが100%パスすること
  - 後方互換性なし（旧オプションは明示的エラー）
**Scale/Scope**:
  - 影響範囲: 6コマンド（`memo create`, `memo edit`, `memo promote`, `memo comment add`, `memo comment edit`, `memo label set`）
  - 変更対象ファイル: 約10ファイル（コマンド定義、テスト、ドキュメント）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (Constitution fileがテンプレートのため、プロジェクト固有の原則を適用)

このプロジェクトは以下の原則に従います：

1. **Monorepo構成**: pnpm workspaceによるパッケージ分離（cli, core, db, config, logger, shared）
2. **GitHub CLI準拠**: オプション命名規則とUXをGitHub CLIに揃える
3. **テスト駆動**: 既存テストの100%パスを必須とし、新規テストを追加
4. **ローカルファースト**: SQLiteベースの単一ユーザー設計

この機能は既存コマンドの修正であり、新規アーキテクチャパターンを導入しないため、複雑性の追加はありません。

## Project Structure

### Documentation (this feature)

```
specs/001-docs-plan-init/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   └── flag-changes.md  # オプション変更の詳細定義
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/
├── cli/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── memo/
│   │   │   │   ├── create.ts           # 変更対象: --body-file, --editor, --no-editor
│   │   │   │   ├── edit.ts             # 変更対象: --body-file, --add-label, --remove-label, --set-label削除
│   │   │   │   ├── promote.ts          # 変更対象: --body-file, --add-label, --remove-label
│   │   │   │   └── comment/
│   │   │   │       ├── add.ts          # 変更対象: --body-file, --editor, --no-editor
│   │   │   │       └── edit.ts         # 変更対象: --body-file
│   │   │   └── init.ts
│   │   └── lib/
│   │       └── editor.ts               # エディタ起動ロジックの拡張
│   └── test/
│       ├── commands/                   # 変更対象: コマンドテスト
│       └── integration/                # 変更対象: E2Eテスト
├── core/
│   ├── src/
│   │   └── services/
│   │       └── MemoService.ts          # 影響なし（サービス層は変更なし）
│   └── test/
├── db/
│   └── src/
│       └── repositories/
│           └── memoRepository.ts       # setMemoLabels関数は保持
└── shared/
    └── src/
        └── types/                      # 型定義（必要に応じて更新）

docs/
├── cli_requirement.md                  # 参照元（変更なし）
└── plan_init_memo.md                   # 参照元（変更なし）

README.md                               # ドキュメント更新対象
```

**Structure Decision**: pnpm monorepo構成を採用。CLI層（packages/cli）のフラグ定義のみを変更し、コア層（packages/core, packages/db）のビジネスロジックには影響を与えない。これにより、変更範囲を最小化し、テストの保守性を維持する。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

該当なし - この機能は既存アーキテクチャ内での修正のみであり、新たな複雑性を導入しません。
