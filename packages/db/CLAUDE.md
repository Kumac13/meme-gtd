# db開発ガイド

## 責務

SQLite（better-sqlite3）のリポジトリ層とマイグレーション実行。上位層（core/api/cli）はこのパッケージ経由でのみDBに触れる。

```
src/
├── *Repository.ts   # ドメインごとのリポジトリ（memo/task/label/link/project/
│                    #   projectItem/article/activityLog/embedding/search/urlLink）
├── migrate.ts       # マイグレーションランナー（schema_migrationsテーブルで管理）
└── index.ts         # 全エクスポート + ensureDatabase / openDatabase
```

## マイグレーション追加

手順とチェックリストは db-migration スキルが唯一の正。
このパッケージ固有の事実: マイグレーションは `ensureDatabase()` がCLI/APIサーバー起動時に自動適用する（`src/migrate.ts`、`schema_migrations` テーブルで管理）。新しいSQLファイルは `src/migrate.ts` の `migrations` 配列に登録して初めて適用される（`schema/` は自動走査されない）。

## 実装ルール

- テストなしのDB層変更は禁止（ルートCLAUDE.md参照）
- 論理削除が原則: `is_deleted`フラグを使い、物理DELETEしない（activity_logはトリガーでUPDATE/DELETE自体が禁止）
- `syncRepository.ts` だけは意図的に soft-deleted 行も読む（論理削除行をトゥームストーンとして同期配信するため）。「SELECTは `is_deleted = 0`」原則の唯一の例外で、他のリポジトリに広げない
- 行→ドメイン変換は各リポジトリの行マッパ関数（`memoRowToMemo` 等）で手動変換する。新カラムはマッパにも追加しないとレスポンスから静かに欠落する。boolean カラムは `toBoolean()`（meme-gtd-shared）で変換する
- トランザクションは core のサービス層が張る。リポジトリ関数の中では張らない
- keyword検索（`searchRepository.ts`）は日本語対応のため意図的にLIKEを使用。FTS5に置き換えない
- WALモード前提（CLIとAPIが同一DBファイルを同時に開く）

## 検証

必ずテスト環境で行うこと（手順: test-env スキル。本番DB保護のため）。
