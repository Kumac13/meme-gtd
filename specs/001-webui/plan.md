# Implementation Plan: Calendar View for Web UI

**Branch**: `001-webui` | **Date**: 2025-11-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-webui/spec.md`

## Summary

WebUIにカレンダー画面を追加し、スケジュールされたタスクを月/週/日表示でカレンダー形式に表示する。タスクはステータスで色分け（Done=緑、その他=白）され、タイルクリックで右側1/3にモーダル表示・編集可能。カレンダーUIは@schedule-x/react、URL状態管理はnuqsを使用。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**:
- Frontend: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11, Tailwind CSS 4.1.14
- Backend: Fastify 5.2.0, Zod 3.23.8, better-sqlite3
- New: @schedule-x/react (calendar UI), nuqs (URL state management)

**Storage**: SQLite (better-sqlite3) - 既存のissuesテーブルを使用
**Testing**: vitest (unit), playwright (e2e)
**Target Platform**: Web browser (desktop/mobile)
**Project Type**: Monorepo (packages/web, packages/api, etc.)
**Performance Goals**: 初期表示 < 2秒（100タスク）、表示切替 < 0.5秒、モーダル表示 < 0.3秒
**Constraints**: 1日50件のタスクでスムーズスクロール
**Scale/Scope**: シングルユーザーGTDアプリ

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| プロジェクト構成 | ✅ PASS | 既存のpackages/web, packages/apiを使用 |
| 新規依存関係 | ✅ PASS | @schedule-x/react, nuqsは調査済み・適切 |
| テスト方針 | ✅ PASS | 既存のvitest/playwrightを継続使用 |
| API設計 | ✅ PASS | 既存GET /tasksエンドポイントを拡張 |

## Project Structure

### Documentation (this feature)

```text
specs/001-webui/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-extension.yaml
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
packages/
├── api/
│   └── src/
│       ├── routes/tasks.ts        # 拡張: scheduledFrom/scheduledTo追加
│       └── schemas/taskSchemas.ts # 拡張: クエリパラメータ追加
├── web/
│   └── src/
│       ├── App.tsx                # 変更: /calendarルート追加
│       ├── components/
│       │   ├── Layout.tsx         # 変更: Calendarタブ追加
│       │   ├── ItemDetail.tsx     # 変更: モーダル対応
│       │   └── calendar/          # 新規: カレンダーコンポーネント
│       │       ├── CalendarView.tsx
│       │       ├── CalendarToolbar.tsx
│       │       ├── TaskTile.tsx
│       │       └── TaskDetailModal.tsx
│       ├── pages/
│       │   └── Calendar.tsx       # 新規: カレンダーページ
│       └── hooks/
│           └── useCalendarState.ts # 新規: nuqsでURL状態管理
└── tests/
    └── web/
        └── calendar.spec.ts       # 新規: e2eテスト
```

**Structure Decision**: 既存のmonorepo構造を維持し、packages/webにカレンダー関連コンポーネントを追加、packages/apiにクエリパラメータを追加。

## Complexity Tracking

> 違反なし - 既存構造内での拡張のため、複雑さの正当化不要
