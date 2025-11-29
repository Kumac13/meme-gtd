# Research: モバイル表示改善

**Feature**: 001-task-118-status
**Date**: 2025-11-29

## Research Tasks

この機能はシンプルなCSS変更のため、NEEDS CLARIFICATIONはなし。以下は実装に必要な技術調査結果。

### 1. Tailwind CSS レスポンシブブレークポイント

**Decision**: Tailwind標準のsmブレークポイント（640px）を使用

**Rationale**:
- 仕様書でsm未満（639px以下）がモバイルと定義されている
- プロジェクトで既にTailwind CSS 4.1.14を使用中
- 既存のLayout.tsxで`sm:px-6`などsmブレークポイントを使用済み

**Alternatives considered**:
- カスタムブレークポイント追加 → 不要（標準smで要件を満たす）
- メディアクエリ直接記述 → Tailwindパターンから逸脱するため却下

### 2. モバイルファーストアプローチ

**Decision**: デフォルトをモバイルスタイル、sm以上でデスクトップスタイルを適用

**Rationale**:
- Tailwindはモバイルファーストがデフォルト設計
- 既存コードも`sm:px-6`のようにモバイルファーストパターンを使用
- 変更箇所を最小限に抑えられる

**Implementation Pattern**:
```
デフォルト（モバイル） → sm:（デスクトップ）
hidden              → sm:block    （ロゴ表示）
space-x-4           → sm:space-x-8 （間隔）
ml-0               → sm:ml-6      （マージン）
```

### 3. ナビリンク間隔の具体値

**Decision**: モバイルでは`space-x-4`（16px）を使用

**Rationale**:
- 現状の`space-x-8`（32px）では4リンクが収まらない
- `space-x-4`（16px）は最小タップターゲットサイズ（44px）を維持しつつ収まる
- 計算: 4リンク × 約60px（テキスト幅）+ 3間隔 × 16px = 約288px < 320px

**Alternatives considered**:
- `space-x-2`（8px）→ 十分な間隔があるため不要
- `space-x-6`（24px）→ 狭い画面で収まらない可能性

### 4. 横スクロール防止

**Decision**: ヘッダー内のflex要素に`overflow-hidden`は不要、間隔調整で対応

**Rationale**:
- ロゴ非表示 + 間隔縮小で自然に収まる
- `overflow-hidden`は内容が切れる可能性があり避けるべき
- 親要素の`max-w-7xl`と`px-4`で十分制約されている

**Verification needed**:
- 実装後に320px幅でテスト

## Resolved NEEDS CLARIFICATION

なし - 仕様書で全ての要件が明確に定義されている。

## Open Questions

なし - 実装を進める準備完了。
