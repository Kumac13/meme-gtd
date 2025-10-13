# init / memo 実装ロードマップ（更新用）

最終更新: 2025-10-13（担当: assistant）

---

## 進捗サマリ（2025-10-13）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を整備し、`mgtd init` / `mgtd memo` コマンドを実装。
- ✅ `schema/001_init.sql` に全テーブルと FTS トリガを定義し、`applyMigrations` から適用可能にした。
- ✅ `context.json` の仕様を `docs/requirement.md` に追記し、`docs/cli_requirement.md` に CLI シーケンス図を追加。
- ✅ `pnpm run mgtd:install` でグローバルに CLI を導入できるようスクリプトを整備し、`~/.local/bin/mgtd` へシンボリックリンクを作成する方式に統一。
- ✅ DB/CORE 向けの node:test テストを追加し、`pnpm test` が成功することを確認。
- ✅ README を更新し、インストール・動作確認・テスト手順を明記。
- ✅ CLI ヘルプ体系を刷新し、スペース区切りのサブコマンドでも `--help` が整形出力されるようにした（`src/index.ts` の正規化と各コマンド metadata を追加）。
- ✅ bash / zsh / fish 向け補完スクリプトを `scripts/completions/` に追加し、README に導入手順を追記。
- ✅ `CHANGELOG.md` を作成し、0.1.0 の変更履歴を整理。
- ✅ CLI 統合テスト（help コマンド検証）を追加し、`pnpm test` で自動実行されるよう整備。

- 🔄 残改善: オートコンプリートの動的生成（将来的に `mgtd completion` コマンド化）、リリースパッケージ化、さらなる e2e テスト強化。

---

## 備考

- 動作確認例:
  ```bash
  pnpm install
  pnpm build
  pnpm run mgtd:install
  export PATH="$HOME/.local/bin:$PATH"
  mgtd init --db ~/.local/share/mgtd/issues.db --force
  mgtd memo create --body 'first memo' --label test
  mgtd memo list --json
  mgtd memo --help
  ```
- Node 22.18.0 上での開発を前提。Node 24 系を利用する場合は `pnpm rebuild better-sqlite3` を推奨。
