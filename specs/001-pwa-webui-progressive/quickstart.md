# Quickstart: PWA化 - WebUIのProgressive Web App対応

**Date**: 2025-11-26
**Feature**: 001-pwa-webui-progressive

## Prerequisites

- Node.js 22+
- pnpm
- packages/web の既存環境

## Setup

### 1. 依存パッケージのインストール

```bash
cd packages/web
pnpm add -D vite-plugin-pwa
```

### 2. アイコンファイルの配置

`packages/web/public/`に以下のファイルを配置:

- `pwa-192x192.png` (192x192, 青背景に白「M」)
- `pwa-512x512.png` (512x512, 青背景に白「M」)
- `apple-touch-icon-180x180.png` (180x180, 青背景に白「M」)
- `favicon.svg` (SVG形式)

### 3. vite.config.ts の更新

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'meme-gtd',
        short_name: 'meme-gtd',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // ... 既存の設定
});
```

### 4. index.html の更新

`<head>`内に以下を追加:

```html
<meta name="theme-color" content="#3b82f6">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="meme-gtd">
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">
```

## Build & Verify

### ビルド

```bash
pnpm build
```

### 出力確認

```bash
ls dist/
# 以下が存在することを確認:
# - sw.js
# - manifest.webmanifest
# - index.html (PWAメタタグ含む)
```

### ローカルプレビュー

```bash
pnpm preview
# http://localhost:4173 でアクセス
```

## Testing

### Lighthouse PWA監査

1. Chrome DevToolsを開く
2. Lighthouse タブを選択
3. 「Progressive Web App」をチェック
4. 「Analyze page load」を実行
5. 「インストール可能」の要件を確認

### Service Worker確認

1. Chrome DevTools → Application タブ
2. 左メニュー「Service Workers」を選択
3. sw.jsが登録されていることを確認

### オフラインテスト

1. Application → Service Workers
2. 「Offline」チェックボックスをON
3. ページをリロード
4. UIが表示されることを確認

### iOS実機テスト

1. iPhoneでSafariを開く
2. アプリURLにアクセス
3. 共有ボタン → 「ホーム画面に追加」
4. ホーム画面からアプリを起動
5. ブラウザUIなしで表示されることを確認

## Troubleshooting

### Service Workerが登録されない

- HTTPS接続を確認（localhost除く）
- ビルド済みか確認（`dist/sw.js`存在）
- キャッシュをクリア（DevTools → Application → Clear storage）

### iOSでスタンドアロンモードにならない

- `apple-mobile-web-app-capable`メタタグを確認
- 「ホーム画面に追加」から起動したか確認
- Safariで直接開いた場合はブラウザUIが表示される

### アイコンが表示されない

- ファイルパスを確認（`/public/`直下に配置）
- ファイル形式を確認（PNG、正しいサイズ）
- キャッシュをクリアして再確認
