# init / memo 実装ロードマップ（更新用）

最終更新: 2025-10-13（担当: assistant）

---

## 進捗サマリ（2025-10-13）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を整備し、`mgtd init` / `mgtd memo` コマンドを実装。
- ✅ `schema/001_init.sql` に全テーブルと FTS トリガを定義し、`applyMigrations` から適用可能にした。
- ✅ `context.json` の仕様を `docs/requirement.md` に追記し、`docs/cli_requirement.md` に CLI シーケンス図を追加。
- ✅ `pnpm run mgtd:install` でグローバルに CLI を導入できるようスクリプトを整備し、`mgtd --help` / `mgtd memo --help` のルーティングを修正。
- ✅ DB/CORE 向けの node:test テストを追加し、`pnpm test` が成功することを確認。
- ✅ README を更新し、インストール・動作確認・テスト手順を明記。
- 🔄 残改善: 補完スクリプト、CHANGELOG、CLI 統合テスト。

---

## 今後の改善候補

| 項目 | 説明 |
| --- | --- |
| 補完スクリプト/リリースノート | zsh/fish 補完や CHANGELOG 草案を整備する。 |
| CLI 統合テスト | `mgtd` コマンドを e2e で実行する自動テストを検討。 |

---

## 備考

- 動作確認例:
  ```bash
  pnpm install
  pnpm build
  pnpm run mgtd:install
  mgtd init --db ~/.local/share/mgtd/issues.db --force
  mgtd memo create --body 'first memo' --label test
  mgtd memo list --json
  mgtd memo --help
  ```
- Node 22.18.0 上での開発を前提。Node 24 系を利用する場合は `pnpm rebuild better-sqlite3` を推奨。
