# Implementation Plan: Allow Optional Task Body

**Branch**: `007-https-github-com` | **Date**: 2025-10-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-https-github-com/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

タスク作成時にbodyを省略可能にする機能を実装する。現在は `packages/cli/src/commands/task/create.ts` の118行目で空bodyを拒否しているが、これを削除し、空文字列でもタスクを作成できるようにする。加えて、空bodyタスクの表示時に適切なプレースホルダー "(no body)" を表示する。

## Technical Context

**Language/Version**: TypeScript 5.5.4, Node.js 22.0.0+
**Primary Dependencies**: oclif 4.0.0 (CLI framework), better-sqlite3 9.0.0, zod 3.23.8
**Storage**: SQLite (better-sqlite3) - `issues` テーブルに `body_md TEXT NOT NULL DEFAULT ''` カラムが存在
**Testing**: Node.js native test runner (`node --test`)
**Target Platform**: CLI tool (macOS/Linux/Windows)
**Project Type**: Monorepo (pnpm workspaces) - 6 packages (cli, core, db, config, logger, shared)
**Performance Goals**: CLI応答速度 < 100ms (ローカルDB操作)
**Constraints**: ローカルストレージのみ、ネットワーク通信なし、既存テスト100%パス必須
**Scale/Scope**: 個人ユーザー向けCLI、影響範囲は2ファイル (create.ts, view.ts) + テスト追加

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

プロジェクトのCLAUDE.mdに基づく原則チェック:

### ✅ バージョン管理の原則
- **適用**: 新機能のためMINOR版上げ (0.3.0 → 0.4.0)
- **準拠**: バージョン更新は実装完了後に実施予定

### ✅ 段階的進歩
- **適用**: 小さな変更 (2ファイル修正 + テスト追加)
- **準拠**: 既存テスト100%パス必須、コンパイル成功が前提

### ✅ テスト駆動開発
- **適用**: テストファーストで実装
- **準拠**: 新機能のテストケース追加必須 (空bodyタスク作成・表示)

### ✅ ドキュメント更新
- **適用**: docs/cli_requirement.md の更新が必要
- **準拠**: 実装と同時にドキュメント更新

### ✅ コミット戦略
- **適用**: 実装コミット + バージョンコミット + タグ作成
- **準拠**: 論理的な区切りごとにコミット

**判定**: 全原則に準拠。Constitution違反なし。

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
├── cli/                          # CLI エントリーポイント
│   ├── src/
│   │   └── commands/
│   │       └── task/
│   │           ├── create.ts     # 修正対象: bodyバリデーション削除
│   │           └── view.ts       # 修正対象: 空body時のプレースホルダー追加
│   └── test/
│       └── commands/
│           └── task/
│               └── create-empty-body.test.js  # 新規追加
│
├── core/                         # ビジネスロジック
│   └── src/
│       └── task.service.ts       # 変更不要（既に空bodyを許容）
│
└── db/                           # データベース層
    └── src/
        └── schema.sql            # 確認のみ（変更不要）

docs/
└── cli_requirement.md            # 更新対象: 空body許容の記載追加
```

**Structure Decision**: モノレポ (pnpm workspaces) 構成を維持。変更は `packages/cli` パッケージのみ。DBスキーマやcoreロジックは変更不要（既に空文字列を許容している）。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

Constitution違反なし。このセクションは不要。
