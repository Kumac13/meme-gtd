# config開発ガイド

設定とDBパスの解決。ルートCLAUDE.mdの本番DB保護（critical-safety）を実装で担保するのがこのパッケージ。

- `assertTestEnvSafety()` は `MGTD_ENV=test` でDBパスが本番データディレクトリに解決された場合に例外で実行を止める最後の砦（Issue #48 の再発防止）。リファクタでこのガードを迂回・緩和しない。`test/safety.test.ts` はその回帰テストなので削らない
- 設定ファイル不在時にも `DB_PATH` を優先する分岐は意図的（過去にこの分岐が DB_PATH を無視して本番DBに接続する事故があった）。分岐と該当コメントを維持する
- テストは `node --import tsx/esm --test test/*.test.ts`（ビルド不要）。import は実体が `.ts` でも `../src/index.js` と書く
