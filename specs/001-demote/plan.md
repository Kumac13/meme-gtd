# Implementation Plan: タスクをメモにdemote機能

**Branch**: `001-demote` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-demote/spec.md`

## Summary

タスクの内容（タイトル・本文・コメント）をメモとしてコピー作成する機能。調査や検討プロセスを含むタスクを完了した際、その成果物をドキュメントとして残せる。既存のpromoteMemo（メモ→タスク）の逆操作として、対称的な設計で実装する。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22.0.0+
**Primary Dependencies**: Fastify 5.2.0, @oclif/core 4.0.0, better-sqlite3 9.0.0, Zod 3.23.8
**Storage**: SQLite (既存のissues, links, issue_labels, issue_projectsテーブルを使用)
**Testing**: Node.js built-in test runner + tsx
**Target Platform**: CLI + Web API + Web UI
**Project Type**: モノレポ（packages/api, packages/cli, packages/core, packages/db, packages/web）
**Performance Goals**: N/A（既存パフォーマンス要件に準拠）
**Constraints**: 元タスクを変更してはならない
**Scale/Scope**: 単一タスクのdemote操作

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- ✅ 既存パターン踏襲（promote機能の対称設計）
- ✅ スキーマ変更なし（既存テーブルで対応可能）
- ✅ 新規依存関係なし
- ✅ テスト方針明確（既存テストパターンに従う）

## Project Structure

### Documentation (this feature)

```text
specs/001-demote/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.yaml         # OpenAPI仕様
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── db/
│   └── src/
│       ├── taskRepository.ts    # demoteTask関数追加
│       └── index.ts             # エクスポート追加
├── core/
│   └── src/
│       └── index.ts             # TaskService.demote()追加
├── api/
│   └── src/
│       ├── handlers/
│       │   └── taskHandlers.ts  # demoteTaskHandler追加
│       └── routes/
│           └── tasks.ts         # POST /api/tasks/:id/demote追加
├── cli/
│   └── src/
│       ├── commands/
│       │   └── task/
│       │       └── demote.ts    # 新規作成
│       └── index.ts             # MULTIWORD_COMMANDS登録
└── web/
    └── src/
        └── ...                  # UI追加（詳細は実装時に確認）
```

**Structure Decision**: 既存のモノレポ構造に従い、各パッケージの適切な場所にdemote機能を追加。新規ディレクトリ作成は不要。

## Complexity Tracking

違反なし。既存パターンに従った実装のため、複雑性の正当化は不要。

## 修正対象ファイル一覧

### Priority 1 - Core Implementation
1. `packages/db/src/taskRepository.ts` - demoteTask関数追加
2. `packages/db/src/index.ts` - demoteTaskエクスポート
3. `packages/core/src/index.ts` - TaskService.demote()メソッド追加
4. `packages/api/src/handlers/taskHandlers.ts` - demoteTaskHandler追加
5. `packages/api/src/routes/tasks.ts` - POSTルート追加

### Priority 2 - CLI
6. `packages/cli/src/commands/task/demote.ts` - 新規作成
7. `packages/cli/src/index.ts` - MULTIWORD_COMMANDS登録

### Priority 3 - Testing
8. `packages/db/test/taskRepository.test.ts` - demoteテスト追加
9. `packages/api/test/integration/tasks.test.ts` - APIテスト追加
10. `packages/cli/test/commands/task/demote.test.js` - CLIテスト追加（新規作成）

### Priority 4 - Web UI
11. `packages/web/src/...` - タスク詳細画面にdemoteボタン追加

## 生成済みアーティファクト

- [research.md](./research.md) - 技術調査結果
- [data-model.md](./data-model.md) - データモデル設計
- [contracts/api.yaml](./contracts/api.yaml) - OpenAPI仕様
- [quickstart.md](./quickstart.md) - 使い方ガイド
