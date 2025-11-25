# Implementation Plan: PWA化 - WebUIのProgressive Web App対応

**Branch**: `001-pwa-webui-progressive` | **Date**: 2025-11-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-pwa-webui-progressive/spec.md`

## Summary

meme-gtdのWebUIをProgressive Web App (PWA)化し、ホーム画面へのアプリ追加とオフライン時の基本アクセスを実現する。vite-plugin-pwaを使用してmanifest生成、Service Worker設定、アイコン提供を行う。iOS 26の「Open as Web App」デフォルト動作に対応。

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**: Vite 7.1.11, React 19.2.0, vite-plugin-pwa (新規追加)
**Storage**: N/A（PWA機能はクライアントサイドのみ）
**Testing**: Vitest (既存), Lighthouse PWA監査
**Target Platform**: iOS 26+, Android (Chrome), Desktop browsers
**Project Type**: web (monorepo内のpackages/web)
**Performance Goals**: Lighthouse PWA監査で「インストール可能」要件を満たす
**Constraints**: オフラインキャッシュは静的アセットのみ（50MB制限考慮）、APIはキャッシュしない
**Scale/Scope**: 既存WebUIへのPWA機能追加（新規画面なし）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| Simplicity | ✅ Pass | vite-plugin-pwaで最小構成、カスタムService Worker不要 |
| Test-First | ✅ Pass | Lighthouse監査で検証可能 |
| Library-First | N/A | フロントエンド機能追加のため該当なし |
| Observability | ✅ Pass | Service Worker登録状況はブラウザDevToolsで確認可能 |

## Project Structure

### Documentation (this feature)

```text
specs/001-pwa-webui-progressive/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A for this feature)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/web/
├── public/
│   ├── pwa-192x192.png      # NEW: PWAアイコン (192x192)
│   ├── pwa-512x512.png      # NEW: PWAアイコン (512x512)
│   ├── apple-touch-icon-180x180.png  # NEW: iOS用アイコン
│   └── favicon.svg          # NEW: ブラウザタブ用SVG
├── index.html               # MODIFY: PWAメタタグ追加
├── vite.config.ts           # MODIFY: VitePWAプラグイン追加
└── package.json             # MODIFY: vite-plugin-pwa依存追加
```

**Structure Decision**: 既存のpackages/web構造を維持し、publicディレクトリにアイコンを追加。vite.config.tsでVitePWAプラグインを設定することで、manifest.jsonとService Workerは自動生成される。

## Complexity Tracking

> No violations - using minimal PWA configuration via vite-plugin-pwa.
