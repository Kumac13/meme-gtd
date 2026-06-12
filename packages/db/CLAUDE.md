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

## マイグレーション追加手順

1. リポジトリルートの `schema/` に **連番** でSQLファイルを追加（例: `014_add_xxx.sql`）
2. **既存のマイグレーションファイルは絶対に変更しない**（適用済みDBと不整合になる）
3. マイグレーションは `ensureDatabase()` がCLI/APIサーバー起動時に自動適用する
4. `packages/shared` の型、対応するリポジトリ、core のサービス、API契約チェーン（`docs/architecture.md` 参照）まで追随させる

## 実装ルール

- **テストなしのDB層変更は禁止**（ルートCLAUDE.md参照）
- 論理削除が原則: `is_deleted`フラグを使い、物理DELETEしない（activity_logはトリガーでUPDATE/DELETE自体が禁止）
- keyword検索（`searchRepository.ts`）は日本語対応のため意図的にLIKEを使用。FTS5に置き換えない
- WALモード前提（CLIとAPIが同一DBファイルを同時に開く）

## 検証

開発・テストでは必ずテスト用DB（`test-data/test.db` / 一時ディレクトリ）を使用。本番DB（`~/.local/share/mgtd/issues.db`）には絶対に触れない（ルートCLAUDE.mdのAI Safetyセクション参照）。
