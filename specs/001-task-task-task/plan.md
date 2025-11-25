# Implementation Plan: タスクからタスクを作成する機能

**Branch**: `001-task-task-task` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-task-task-task/spec.md`

## Summary

タスク詳細画面（/tasks/:id）から直接新規タスクを作成できる機能を実装する。ブックマークアイコンの右隣に「新規タスク」ボタンを配置し、クリック時にTaskDetail画面の右半分にオーバーラップするモーダルを表示。モーダルでは既存のTaskFormコンポーネントを再利用し、Links設定UI（デフォルトで元タスクへの`relates`リンク設定済み）を追加する。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11, Tailwind CSS 4.1.14
**Storage**: SQLite (better-sqlite3) - 既存の`links`テーブルを使用
**Testing**: Vitest 1.6.0 + @testing-library/react (web), Playwright (E2E)
**Target Platform**: Web browser (modern browsers)
**Project Type**: Monorepo (pnpm workspaces) - packages/web が対象
**Performance Goals**: モーダル表示 < 100ms、タスク作成 < 500ms
**Constraints**: 既存のTaskForm, LinksService, AddLinkInlineコンポーネントを再利用
**Scale/Scope**: 単一ユーザー向けGTDアプリ、UI変更のみ（API変更なし）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitutionが未設定のためスキップ。既存のコードパターンとアーキテクチャに従う。

## Project Structure

### Documentation (this feature)

```text
specs/001-task-task-task/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/web/src/
├── components/
│   ├── TaskForm.tsx              # 変更: Links UI追加
│   ├── TaskFormLinks.tsx         # 新規: TaskForm用Links設定コンポーネント
│   ├── ItemDetail.tsx            # 変更: 新規タスクボタン追加（mode='page'時のみ）
│   └── CreateTaskModal.tsx       # 新規: タスク作成モーダル
├── pages/
│   ├── TaskDetail.tsx            # 変更: モーダル状態管理
│   └── TaskNew.tsx               # 確認: Links UI表示
└── types/
    └── links.ts                  # 既存: 変更なし
```

**Structure Decision**: 既存のMonorepo構造を維持。変更は`packages/web`に限定され、API変更は不要（既存のLinksServiceで対応可能）。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

なし - 既存コンポーネントの拡張と新規UIコンポーネントの追加のみ。
