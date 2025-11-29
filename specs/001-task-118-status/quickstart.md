# Quickstart: モバイル表示改善

**Feature**: 001-task-118-status
**Date**: 2025-11-29

## Overview

Layout.tsxのヘッダー部分にTailwindのレスポンシブクラスを追加し、モバイル表示（640px未満）を最適化する。

## Prerequisites

- Node.js 22+
- pnpm

## Setup

```bash
# リポジトリルートで
pnpm install
```

## Development

```bash
# 開発サーバー起動（テスト環境）
pnpm server:dev

# ブラウザで http://localhost:3001 にアクセス
# DevToolsでモバイルビューポートをシミュレート
```

## Changes Required

### File: `packages/web/src/components/Layout.tsx`

変更箇所：

1. **ロゴ部分** (`<h1>` タグ)
   - 変更前: `className="text-xl font-bold text-gray-900"`
   - 変更後: `className="hidden sm:block text-xl font-bold text-gray-900"`

2. **ナビリンクコンテナ** (`<div className="ml-6 flex space-x-8">`)
   - 変更前: `className="ml-6 flex space-x-8"`
   - 変更後: `className="flex space-x-4 sm:ml-6 sm:space-x-8"`

## Testing

### Manual Testing

1. **モバイルテスト（640px未満）**
   - DevToolsでビューポートを375px（iPhone）に設定
   - ロゴ「Mëmo」が非表示であることを確認
   - 4つのナビリンクが1行に収まることを確認
   - 横スクロールが発生しないことを確認
   - 各リンクをクリックして遷移を確認

2. **デスクトップテスト（640px以上）**
   - ビューポートを1024px以上に設定
   - ロゴ「Mëmo」が表示されることを確認
   - ナビリンク間隔が従来通り（32px）であることを確認

3. **境界テスト**
   - ビューポートを639px/640px/641pxで確認
   - 表示切り替えがスムーズであることを確認

4. **最小幅テスト**
   - ビューポートを320pxに設定
   - すべてのリンクがタップ可能であることを確認

### E2E Testing (Optional)

```bash
# Playwrightテスト実行
pnpm --filter meme-gtd-web test:e2e
```

## Verification Checklist

- [ ] モバイル（640px未満）でロゴが非表示
- [ ] モバイル（640px未満）でナビリンク間隔が縮小
- [ ] モバイル（640px未満）で横スクロールなし
- [ ] デスクトップ（640px以上）で既存レイアウト維持
- [ ] 320px幅で全リンクが操作可能
- [ ] 全ナビリンクのルーティングが正常
