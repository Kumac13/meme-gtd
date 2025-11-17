# Implementation Plan: Markdown Copy Button for Web UI

**Branch**: `029-task` | **Date**: 2025-11-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/029-task/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

WebUIのタスク/メモ詳細画面に、Markdown形式のrawテキストをクリップボードにコピーするボタンを追加する機能。本文、個々のコメント、およびすべてのコンテンツ（タイトル+本文+全コメント）をコピーできる3つのコピーボタンを実装する。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11, Tailwind CSS 4.1.14
**Storage**: N/A (クライアント側のみ、既存のAPIから取得したデータを使用)
**Testing**: Vitest 1.6.0, Playwright 1.56.1
**Target Platform**: Web (デスクトップ・モバイルブラウザ: Chrome, Safari, Firefox, モバイルSafari, モバイルChrome)
**Project Type**: Web (monorepo内の`packages/web`パッケージ)
**Performance Goals**: コピー操作200ms以内、成功率95%以上（主要ブラウザ）、モバイル90%以上
**Constraints**: クリップボードAPI依存、HTTPS必須（一部環境）、UI層のみの変更（バックエンド変更なし）
**Scale/Scope**: 3つのコピーボタンコンポーネント、既存2ページ（TaskDetail、MemoDetail）と2コンポーネント（EditableContent、CommentSection）への統合

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: Constitution fileがテンプレート状態のため、プロジェクトの既存パターンに基づいて評価を実施。

### Existing Patterns Compliance

✅ **Monorepo Structure**: `packages/web`内での実装、既存パッケージ構造を維持
✅ **Component Reusability**: 共通コンポーネント（CopyButton）を作成し、複数箇所で再利用
✅ **Type Safety**: TypeScript strict mode、既存の型定義（Task、Memo、Comment）を活用
✅ **Testing**: Vitest unit tests + Playwright E2E tests
✅ **No Backend Changes**: UI層のみの変更、既存APIを使用
✅ **Accessibility**: キーボードナビゲーション、aria-label対応

### Gates

✅ **No New Dependencies**: Clipboard API（ブラウザ標準）のみ使用、新規npmパッケージ不要
✅ **No Database Changes**: データモデル変更なし
✅ **No Breaking Changes**: 既存機能への影響なし、純粋な機能追加

**Result**: All gates passed ✅

## Project Structure

### Documentation (this feature)

```
specs/029-task/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/web/
├── src/
│   ├── components/
│   │   ├── CopyButton.tsx           # NEW: 共通コピーボタンコンポーネント
│   │   ├── EditableContent.tsx      # MODIFY: 本文コピーボタン追加
│   │   ├── CommentSection.tsx       # MODIFY: コメントコピーボタン追加
│   │   └── ItemDetail.tsx           # MODIFY: すべてコピーボタン追加
│   ├── hooks/
│   │   └── useCopyToClipboard.ts    # NEW: クリップボードコピーロジック
│   ├── utils/
│   │   └── markdownFormatter.ts     # NEW: Markdown構造化フォーマッター
│   └── pages/
│       ├── TaskDetail.tsx           # MODIFY: すべてコピー機能のためのデータ収集
│       └── MemoDetail.tsx           # MODIFY: すべてコピー機能のためのデータ収集
└── tests/
    ├── unit/
    │   ├── CopyButton.test.tsx          # NEW: CopyButtonコンポーネントテスト
    │   ├── useCopyToClipboard.test.ts   # NEW: フックテスト
    │   └── markdownFormatter.test.ts    # NEW: フォーマッターテスト
    └── e2e/
        └── copy-functionality.spec.ts   # NEW: E2Eテスト（クリップボード統合）
```

**Structure Decision**: 既存のWeb applicationアーキテクチャ（monorepo内の`packages/web`）を使用。新規コンポーネント・フック・ユーティリティを既存ディレクトリ構造に追加し、既存コンポーネントを最小限の変更で拡張する。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Note**: No violations detected. All gates passed without requiring justification.

