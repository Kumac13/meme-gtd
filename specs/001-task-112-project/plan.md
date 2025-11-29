# Implementation Plan: Project List View Status Filter

**Branch**: `001-task-112-project` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-task-112-project/spec.md`

## Summary

Project の List ビュー（`/projects/:id/list`）に Kanban ビューと同様のステータスフィルタ機能を追加する。FilterBar コンポーネントを再利用し、ステータスでのフィルタリング、Done/Canceled のソート末尾表示、各タスクへのステータスバッジ表示を実装する。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11
**Storage**: N/A（クライアントサイドのみ、既存APIを使用）
**Testing**: Vitest（既存のテスト環境）
**Target Platform**: Web（デスクトップ・モバイル両対応）
**Project Type**: Monorepo（pnpm workspaces）
**Performance Goals**: フィルタ切り替えは即座に反映（クライアントサイドフィルタリング）
**Constraints**: 既存のFilterBarコンポーネントを再利用、Kanbanビューとの一貫性維持
**Scale/Scope**: packages/web のみ変更（2ファイル）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution未設定のため、以下の標準ゲートを適用:
- [x] 既存コンポーネント再利用優先 → FilterBar を再利用
- [x] 最小変更原則 → 2ファイルのみ変更
- [x] 既存パターン踏襲 → TasksList と同様の実装パターン

## Project Structure

### Documentation (this feature)

```text
specs/001-task-112-project/
├── spec.md              # 機能仕様
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/web/
├── src/
│   ├── pages/
│   │   └── ListView.tsx       # 変更対象: FilterBar追加、フィルタ・ソートロジック
│   └── components/
│       ├── FilterBar.tsx      # 既存: 再利用（変更なし）
│       └── ItemList.tsx       # 変更対象: ステータスバッジ追加
└── tests/
    └── (既存テストに追加)
```

**Structure Decision**: Monorepo構造のpackages/webパッケージ内で、既存のコンポーネントパターンに従い最小限の変更を行う。

## Complexity Tracking

> 違反なし - シンプルな実装

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |
