# Implementation Plan: モバイル表示改善

**Branch**: `001-task-118-status` | **Date**: 2025-11-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-task-118-status/spec.md`

## Summary

モバイル表示（640px未満）でのヘッダーレイアウトを改善する。ロゴ「Mëmo」の非表示、ナビリンク間隔の縮小、マージンの削除により、横スクロールを防止し、4つのナビゲーションリンクを画面内に収める。Tailwind CSSのレスポンシブユーティリティクラスを使用したモバイルファーストアプローチで実装。

## Technical Context

**Language/Version**: TypeScript 5.5.4
**Primary Dependencies**: React 19.2.0, React Router DOM 7.9.4, Tailwind CSS 4.1.14
**Storage**: N/A（UIのみの変更）
**Testing**: Vitest（unit）, Playwright（e2e）
**Target Platform**: Web（モバイルブラウザ対応）
**Project Type**: web（monorepo内のpackages/web）
**Performance Goals**: N/A（視覚的なレイアウト変更のみ）
**Constraints**: 既存のデスクトップレイアウトを変更しない
**Scale/Scope**: 単一ファイル（Layout.tsx）の変更

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitutionファイルが未設定（テンプレート状態）のため、プロジェクト固有のゲートなし。
この機能は以下の一般的なベストプラクティスに従う：
- [x] 既存のコードパターン（Tailwindクラス使用）を踏襲
- [x] 変更範囲を最小限に抑える（単一ファイル）
- [x] 既存のテスト基盤を活用
- [x] モバイルファーストアプローチ（Tailwindの標準パターン）

## Project Structure

### Documentation (this feature)

```text
specs/001-task-118-status/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── quickstart.md        # Phase 1 output
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
packages/web/
├── src/
│   ├── components/
│   │   └── Layout.tsx   # 変更対象ファイル
│   ├── pages/
│   └── api/
└── tests/
    └── e2e/             # Playwright tests
```

**Structure Decision**: 既存のmonorepo構造を維持。変更は`packages/web/src/components/Layout.tsx`のみ。

## Complexity Tracking

該当なし - 単純なCSSクラスの追加・変更のみ。新規アーキテクチャやパターンの導入なし。
