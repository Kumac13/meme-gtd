# Contracts: PWA化

**Date**: 2025-11-26
**Feature**: 001-pwa-webui-progressive

## Overview

このフィーチャーはクライアントサイドのPWA設定のみを対象とし、新規APIエンドポイントは不要。

## API Changes

**None** - バックエンド変更なし

## Static Assets (New)

以下のファイルを`packages/web/public/`に追加:

| File | Size | Purpose |
|------|------|---------|
| pwa-192x192.png | 192x192 | Android/一般PWA用アイコン |
| pwa-512x512.png | 512x512 | スプラッシュ画面用アイコン |
| apple-touch-icon-180x180.png | 180x180 | iOS用アイコン |
| favicon.svg | - | ブラウザタブ用 |

## Generated Files (Build Time)

vite-plugin-pwaにより自動生成:

| File | Location | Purpose |
|------|----------|---------|
| manifest.webmanifest | dist/ | Web App Manifest |
| sw.js | dist/ | Service Worker |
| workbox-*.js | dist/ | Workboxランタイム |

## Configuration Files (Modified)

| File | Change |
|------|--------|
| packages/web/vite.config.ts | VitePWAプラグイン追加 |
| packages/web/index.html | PWAメタタグ追加 |
| packages/web/package.json | vite-plugin-pwa依存追加 |
