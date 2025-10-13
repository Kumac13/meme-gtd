# init / memo 実装ロードマップ（更新用）

最終更新: 2025-10-13（担当: assistant）

---

## 進捗サマリ（2025-10-13）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を整備し、`mgtd init` / `mgtd memo` コマンドを実装。
- ✅ `schema/001_init.sql` に全テーブルと FTS トリガを定義し、`applyMigrations` から適用可能にした。
- ✅ `context.json` の仕様を `docs/requirement.md` に追記し、`docs/cli_requirement.md` に CLI シーケンス図を追加。
- ✅ `pnpm mgtd` / `pnpm mgtd:dev` スクリプトで CLI を直接実行可能に調整（`pnpm mgtd init --db .tmp/issues.db --force` で確認済み）。
- ✅ DB/CORE 向けの node:test テストを作成し、`applyMigrations` を用いる形に整理（※ `packages/core` 側は path 問題で失敗中）。
- ❌ `pnpm test` が未完了。`packages/core` テストで `schema_migrations` テーブルが見つからず失敗する（調査・修正中）。
- ❌ `mgtd memo list` がエラーになる問題を特定。`memo list` コマンドを `memo` のエイリアスに変更し、`mgtd memo` / `mgtd memo list` の双方で一覧できるように調整中（ビルドは通るがテスト未実施）。
- ❌ README / 補完スクリプト / リリースノート整備は未着手。

---

## Blocker / Issue

| 課題 | 詳細 | 対応状況 |
| --- | --- | --- |
| schema_migrations が見つからない | `packages/core` のテスト環境で `applyMigrations` が schema ディレクトリを参照できない。 | 原因調査・修正中 |
| `memo list` の仕様乖離 | `memo` ルートコマンドが一覧処理を持っていたため `mgtd memo list` がエラー。`memo list` にエイリアスを付ける形で調整。 | 修正済（ビルド確認済み） |
| 自動テストの未整備 | `packages/db` / `packages/core` のテストを node:test で作成。CLI 統合テストは未実装。 | 継続対応 |

---

## 未完タスク

1. `packages/core` テストの修正（schema ファイル参照を安定化させ、`pnpm test` をパスさせる）。
2. CLI ドキュメント／README／補完スクリプトなどリリース準備。
3. CLI 統合テストの追加（`mgtd` コマンドを実際に叩くエンドツーエンドテスト）。

---

## 備考

- CLI 動作確認は `pnpm mgtd init --db .tmp/issues.db --force` の成功で確認済み。`mgtd memo list --json` もエイリアス修正後に再確認予定。
- Node 22.18.0 上での開発を前提にしており、Node 24 系を使う場合は `pnpm rebuild better-sqlite3` が必要。
