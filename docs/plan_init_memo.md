# init / memo 実装ロードマップ（更新用）

最終更新: 2025-10-13（担当: assistant）

---

## 進捗サマリ（2025-10-13）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を整備し、`mgtd init` / `mgtd memo` コマンドを実装。
- ✅ `schema/001_init.sql` に全テーブルと FTS トリガを定義し、`applyMigrations` から適用可能にした。
- ✅ `context.json` の仕様を `docs/requirement.md` に追記し、`docs/cli_requirement.md` に CLI シーケンス図を追加。
- ✅ `pnpm mgtd` / `pnpm mgtd:dev` スクリプトで CLI を直接実行可能に調整（`pnpm mgtd init --db .tmp/issues.db --force` で確認済み）。
- ✅ DB/CORE 向けの node:test テストを追加し、`pnpm test` が全パッケージでパスすることを確認。
- ✅ `memo list` コマンドを `memo` トピックに統合し、`mgtd memo` / `mgtd memo list` の双方で一覧できるよう修正。
- ✅ README にセットアップ／テスト／主要コマンドを追記。
- 🔄 補完スクリプト／リリースノート草案（フェーズ5）および CLI 統合テストは今後の改善項目。

---

-## 今後の改善候補

| 項目 | 説明 |
| --- | --- |
| 補完スクリプト/リリースノート | zsh/fish 補完や CHANGELOG 草案を整備する。 |
| CLI 統合テスト | `mgtd` コマンドを e2e で実行する自動テストを検討。 |


---

## 備考

- CLI 動作確認は `pnpm mgtd init --db .tmp/issues.db --force` の成功で確認済み。`mgtd memo list --json` もエイリアス修正後に再確認予定。
- Node 22.18.0 上での開発を前提にしており、Node 24 系を使う場合は `pnpm rebuild better-sqlite3` が必要。
