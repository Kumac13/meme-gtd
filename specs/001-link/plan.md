# Implementation Plan: link設定時の検索機能

**Branch**: `001-link` | **Date**: 2025-11-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-link/spec.md`

## Summary

リンク設定時にID直接入力を検索/選択UIに置き換える。既存の検索API（`/api/tasks?search=`, `/api/memos?search=`）を活用し、新規コンポーネント`IssuePicker`を作成して`AddLinkInline`と`TaskFormLinks`に統合する。バックエンド変更不要のフロントエンドのみの実装。

## Technical Context

**Language/Version**: TypeScript 5.5.4
**Primary Dependencies**: React 19.2.0, React Router DOM 7.9.4, Tailwind CSS 4.1.14
**Storage**: N/A（既存API使用、バックエンド変更なし）
**Testing**: Vitest（ユニットテスト）, Playwright（E2Eテスト）
**Target Platform**: Web（モダンブラウザ）
**Project Type**: Web（モノレポ構成）
**Performance Goals**: 検索結果1秒以内表示、デバウンス300ms
**Constraints**: 既存API仕様維持、バックエンド変更なし
**Scale/Scope**: フロントエンドのみ、3コンポーネント修正/新規

## Constitution Check

*GATE: Constitution未設定のため、標準的なコード品質基準を適用*

- [x] 既存パターンへの準拠（他コンポーネントと一貫したスタイル）
- [x] 型安全性の確保（TypeScript strict mode）
- [x] アクセシビリティ対応（キーボードナビゲーション）
- [x] テスト可能な設計

## Project Structure

### Documentation (this feature)

```text
specs/001-link/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - no API changes)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
packages/web/src/
├── components/
│   ├── IssuePicker.tsx        # NEW: 検索/選択UIコンポーネント
│   ├── AddLinkInline.tsx      # MODIFY: IssuePickerを統合
│   └── TaskFormLinks.tsx      # MODIFY: IssuePickerを統合
├── api/services/
│   ├── TasksService.ts        # 既存（変更なし）
│   └── MemosService.ts        # 既存（変更なし）
└── types/
    └── links.ts               # 既存（型定義追加の可能性）
```

**Structure Decision**: 既存のモノレポ構成（packages/web）を維持。新規コンポーネントは`components/`に追加。

## Complexity Tracking

> 憲法違反なし - 複雑性の正当化不要
