# Data Model: PWA化 - WebUIのProgressive Web App対応

**Date**: 2025-11-26
**Feature**: 001-pwa-webui-progressive

## Overview

このフィーチャーはクライアントサイドのPWA設定のみを対象とし、データベーススキーマの変更は不要。以下はPWA構成要素の概念モデル。

## Entities

### Web App Manifest

アプリのメタデータを定義する設定ファイル。vite-plugin-pwaにより自動生成。

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| name | string | Yes | アプリのフルネーム（例: "meme-gtd"） |
| short_name | string | Yes | ホーム画面表示用の短縮名 |
| description | string | No | アプリの説明 |
| theme_color | string | Yes | ブラウザUI/ステータスバーの色 (#3b82f6) |
| background_color | string | Yes | スプラッシュ画面の背景色 (#ffffff) |
| display | enum | Yes | 表示モード ("standalone") |
| start_url | string | Yes | アプリ起動時のURL ("/") |
| scope | string | No | PWAのスコープ ("/") |
| icons | Icon[] | Yes | アプリアイコンの配列 |

### Icon

アプリアイコンの定義。複数サイズが必要。

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| src | string | Yes | アイコンファイルのパス |
| sizes | string | Yes | アイコンサイズ（例: "192x192"） |
| type | string | Yes | MIMEタイプ（"image/png"） |
| purpose | string | No | 用途（"any", "maskable"） |

### Service Worker Cache

Workboxにより管理されるキャッシュエントリ。

| Property | Type | Description |
|----------|------|-------------|
| url | string | キャッシュされたリソースのURL |
| revision | string | リソースのハッシュ（自動生成） |
| integrity | string | サブリソース整合性チェック用 |

## State Transitions

### Service Worker Lifecycle

```
[Installing] → [Installed] → [Activating] → [Activated]
     ↓              ↓
[Redundant]   [Waiting]
```

| State | Description |
|-------|-------------|
| Installing | SW登録中、キャッシュをprecache中 |
| Installed | インストール完了、古いSWがアクティブな場合はWaitingへ |
| Waiting | 新しいSWがインストール済み、古いSWの終了待ち |
| Activating | 古いキャッシュのクリーンアップ中 |
| Activated | アクティブ、すべてのリクエストを制御 |
| Redundant | 置き換えられた、または失敗 |

### autoUpdate動作

```
[App Load] → [Check for SW Update] → [Update Found?]
                                          ↓ Yes
                                    [Install New SW]
                                          ↓
                                    [Skip Waiting]
                                          ↓
                                    [Activate New SW]
                                          ↓
                                    [Next Page Load: New Content]
```

## Validation Rules

### Manifest Validation

- `name`: 1-45文字、必須
- `short_name`: 1-12文字推奨（ホーム画面表示）
- `theme_color`: 有効なCSS色値
- `display`: "fullscreen" | "standalone" | "minimal-ui" | "browser"
- `icons`: 最低192x192と512x512が必要（Lighthouse要件）

### iOS Specific Requirements

- `apple-touch-icon`: 180x180 PNG必須
- `apple-mobile-web-app-capable`: "yes"必須
- `apple-mobile-web-app-status-bar-style`: "default" | "black" | "black-translucent"

## Data Volume Assumptions

- Manifest: ~1KB
- Service Worker: ~50KB（Workbox生成）
- Precached assets: ~2-5MB（アプリサイズ依存）
- iOS Safari cache limit: 50MB

## Relationships

```
[manifest.webmanifest]
    ├── icons[] ──→ [/public/pwa-192x192.png]
    │             └→ [/public/pwa-512x512.png]
    └── [Service Worker (sw.js)]
           └── workbox cache ──→ [Static Assets]
                                    ├── *.js
                                    ├── *.css
                                    └── *.html

[index.html]
    ├── <link rel="manifest">
    ├── <meta name="theme-color">
    └── <link rel="apple-touch-icon"> ──→ [/public/apple-touch-icon-180x180.png]
```
