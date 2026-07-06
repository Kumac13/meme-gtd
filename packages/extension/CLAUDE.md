# extension開発ガイド

Chrome拡張（MV3）と、iOS Share Extension用JS抽出バンドルのソース。

- `src/` 配下の抽出ロジックを変更したら、iOS用バンドルを再生成して同じコミットに含める。`pnpm build`（vite）は `src/ios-extractor.ts` をビルドしないため、これを忘れるとiOSだけ古い抽出ロジックのまま静かに動き続ける:

```bash
# packages/extension/ で実行
pnpm exec esbuild src/ios-extractor.ts --bundle --format=iife --outfile=../../ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js --target=es2020
```

- devDependencyの esbuild は上記iOSバンドル生成専用（viteからは使われない）。knip.json の ignoreDependencies に登録済みなので、未使用に見えても残す
- manifest.json のjsパス（`src/background/index.js` 等）は vite.config.ts の entryFileNames の出力名と一致させている。片方を変えるときは両方更新する（ビルドは通るのに拡張がロードできなくなるため）
- manifest.json の version はリリース同期の対象外（release スキルは package.json のみ更新する）。package.json とずれていてもバグではない
- 抽出ロジックはブラウザグローバル（DOMParser 等）前提で、iOSでは WKWebView が供給する。テスト（vitest + jsdom）とiOSの両方で動くAPIだけを使う
