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
このパッケージ固有の事実: マイグレーションは `ensureDatabase()` がCLI/APIサーバー起動時に自動適用する（`src/migrate.ts`、`schema_migrations` テーブルで管理）。

## 実装ルール

- **テストなしのDB層変更は禁止**（ルートCLAUDE.md参照）
- 論理削除が原則: `is_deleted`フラグを使い、物理DELETEしない（activity_logはトリガーでUPDATE/DELETE自体が禁止）
- keyword検索（`searchRepository.ts`）は日本語対応のため意図的にLIKEを使用。FTS5に置き換えない
- WALモード前提（CLIとAPIが同一DBファイルを同時に開く）

## 検証

必ずテスト環境で行うこと（手順: test-env スキル。本番DB保護のため）。
