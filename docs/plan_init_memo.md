# init / memo 実装ロードマップ（更新用）

最終更新: 2025-10-13（担当: assistant）

---

## 進捗サマリ（2025-10-13）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を整備し、`mgtd init` / `mgtd memo` コマンドを実装。
- ✅ `schema/001_init.sql` に全テーブルと FTS トリガを定義し、`applyMigrations` から適用可能にした。
- ✅ `context.json` の仕様を `docs/requirement.md` に追記し、`docs/cli_requirement.md` に CLI シーケンス図を追加。
- ✅ `pnpm mgtd` / `pnpm mgtd:dev` スクリプトで CLI を実行可能にし、`pnpm --filter meme-gtd-cli link --global` で `mgtd` コマンドとして利用できることを確認。
- ✅ DB/CORE 向けの node:test テストを追加し、`pnpm test` が全パッケージで成功することを確認。
- ✅ `memo` トピックのルーティングを整理し、`mgtd memo`, `mgtd memo list`, `mgtd memo --help` が期待通りに動作。
- ✅ README を整備してセットアップ／テスト／主要コマンド／ヘルプ表示手順を追記。
- 🔄 残改善: 補完スクリプト、CHANGELOG、CLI 統合テスト。

---

## 今後の改善候補

| 項目 | 説明 |
| --- | --- |
| 補完スクリプト/リリースノート | zsh/fish 補完や CHANGELOG 草案を整備する。 |
| CLI 統合テスト | `mgtd` コマンドを e2e で実行する自動テストを検討。 |

---

## 備考

- 動作確認コマンド例:
  ```bash
  pnpm install
  pnpm build
  pnpm mgtd init --db .tmp/issues.db --force
  pnpm mgtd memo create --body 'first memo' --label test
  pnpm mgtd memo list --json
  pnpm mgtd memo --help
  ```
- Node 22.18.0 上での開発を前提。Node 24 系を利用する場合は `pnpm rebuild better-sqlite3` を推奨。
