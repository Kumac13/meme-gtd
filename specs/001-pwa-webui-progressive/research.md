# Research: PWA化 - WebUIのProgressive Web App対応

**Date**: 2025-11-26
**Feature**: 001-pwa-webui-progressive

## Overview

vite-plugin-pwaを使用したReact + Vite 7プロジェクトでのPWA実装に関する調査結果。

## Decisions

### 1. PWAプラグイン選定

**Decision**: vite-plugin-pwa v1.1.0以上を使用

**Rationale**:
- v1.0.1+でVite 7.0.0を公式サポート
- v1.1.0はビルドエラーハンドリングの改善あり
- Workbox v7.3.0統合済み
- generateSW戦略で手書きService Worker不要

**Alternatives considered**:
- @vite-pwa/assets-generator: アイコン自動生成可能だが、シンプルな「M」アイコンは手動作成で十分
- workbox-cli直接使用: より複雑、vite-plugin-pwaで抽象化されている

### 2. Service Worker戦略

**Decision**: `registerType: 'autoUpdate'` を使用

**Rationale**:
- ユーザーへの通知なしにバックグラウンド更新
- 次回ページロード時に新バージョン適用
- シンプルな体験を優先（要件: 最低限のオフライン対応）

**Alternatives considered**:
- `prompt`: 更新通知UIが必要、実装コスト増加
- `manual`: より複雑な制御が必要、今回の要件には過剰

### 3. キャッシュ戦略

**Decision**: 静的アセットのみprecache、APIはキャッシュしない

**Rationale**:
- 要件: 「オフライン対応は最低限でいい」
- iOS Safari 50MBキャッシュ制限を考慮
- APIデータのキャッシュは将来のPush通知実装時に再検討

**Configuration**:
```typescript
workbox: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
  cleanupOutdatedCaches: true,
}
```

### 4. iOS対応方針

**Decision**: manifestに加えてHTML meta tagsを必須とする

**Rationale**:
- iOS 26は`<meta name="apple-mobile-web-app-capable">`を使用
- manifestの`display`プロパティはiOSで無視される
- `apple-touch-icon`はmanifestのiconsとは別に必要

**Required meta tags**:
```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="meme-gtd">
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png">
```

### 5. アイコン仕様

**Decision**: 4種類のアイコンを作成

| ファイル | サイズ | 用途 |
|----------|--------|------|
| pwa-192x192.png | 192x192 | Android/一般PWA |
| pwa-512x512.png | 512x512 | スプラッシュ画面 |
| apple-touch-icon-180x180.png | 180x180 | iOS専用 |
| favicon.svg | - | ブラウザタブ |

**Design**: 青背景(#3b82f6) + 白文字「M」

**Rationale**:
- 要件: 「MemoのMが出てればいい」
- maskableアイコンは不要（シンプルなデザインで十分）
- SVG faviconはモダンブラウザ対応

### 6. テーマカラー

**Decision**: #3b82f6 (Tailwind blue-500)

**Rationale**:
- 既存UIで使用されている青色
- Assumptionsセクションで明記済み

## Implementation Notes

### Vite設定の最小構成

```typescript
import { VitePWA } from 'vite-plugin-pwa';

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
})
```

### 検証方法

1. `pnpm build` 後に`dist/`内を確認:
   - `sw.js` (Service Worker)
   - `manifest.webmanifest`
2. Lighthouse PWA監査で「インストール可能」確認
3. iOS実機で「ホーム画面に追加」テスト

## References

- [vite-plugin-pwa Documentation](https://vite-pwa-org.netlify.app/)
- [Apple Safari Web Content Configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Web.dev PWA Guide](https://web.dev/learn/pwa/)
