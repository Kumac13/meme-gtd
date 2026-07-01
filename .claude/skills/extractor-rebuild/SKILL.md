---
name: extractor-rebuild
description: Use after changing article extraction logic anywhere under packages/extension/src/ — rebuilds the iOS extractor.bundle.js so the Share Extension stays in sync with the browser extension. Forgetting this leaves iOS silently running stale extraction logic.
---

# 記事抽出バンドルの再ビルド（iOS同期）

記事抽出ロジック（`packages/extension/src/content/extractor.ts` など `packages/extension/src/` 配下）を変更した場合、
iOS Share Extension用のバンドルを再ビルドしないと、iOSだけ古いロジックのまま動く「静かな不整合」が発生する。

## 再ビルドコマンド

```bash
cd packages/extension
pnpm exec esbuild src/ios-extractor.ts --bundle --format=iife --outfile=../../ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js --target=es2020
```

## 確認

```bash
# バンドルが更新されたことを確認
ls -la ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js
```

## 追随作業

- [ ] 再生成した `extractor.bundle.js` を変更と同じコミットに含める
- [ ] iOSの動作確認が必要な場合は ios-deploy スキルでビルド・デプロイする
- [ ] 抽出ロジックの仕様変更なら関連 `docs/` を更新する（更新トリガー表: `docs/CLAUDE.md`）
