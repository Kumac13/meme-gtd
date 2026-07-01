---
name: db-migration
description: Use when changing the database schema — adding a new numbered SQL migration under schema/, updating shared types, repositories, and tests. Also covers applying a migration to the production DB (ONLY on explicit user instruction, with mandatory backup first). Never modify existing migration files.
---

# DBスキーマ変更・マイグレーション手順

詳細は `schema/CLAUDE.md` を参照。

## マイグレーションファイルの作成

- **既存のSQLファイルは変更禁止** — 必ず新しい連番ファイルを追加する
- 形式: `schema/XXX_description.sql`（例: `007_add_calendar_datetime_fields.sql`）
  - XXX: 3桁の連番（既存の最大番号 + 1）
  - description: スネークケースで機能を表現
- 冪等性を意識する（`IF NOT EXISTS` を使用）
- 既存データの移行が必要な場合は同一ファイル内にUPDATE文も記述
- コメントで変更内容を説明

## 必須の追随作業（これを終えるまで作業未完了）

- [ ] `packages/shared` のドメイン型を更新
- [ ] `packages/db` のリポジトリを更新
- [ ] テストを追加・更新（**テストなしのバックエンド変更は禁止**）
- [ ] APIに影響する場合は api-schema-sync スキルのチェックリストも実施
- [ ] `README.ai.md` を更新（スキーマ変更時は必須）

## 動作確認（必ずテスト環境で）

```bash
# テストDBを再初期化して新スキーマを確認
pnpm mgtd:test init -d $PWD/test-data/test.db -f --yes
sqlite3 $PWD/test-data/test.db "PRAGMA table_info(issues);"
```

## <critical-safety>本番DBマイグレーション</critical-safety>

**IMPORTANT: 本番DBへのマイグレーションはユーザーの明示的な指示がある場合のみ実行。**
指示がない場合はマイグレーションファイルの追加までで止め、本番適用が必要である旨を報告する。

### 事前準備（必須）

```bash
# 1. 本番DBのバックアップを作成
cp ~/.local/share/mgtd/issues.db ~/.local/share/mgtd/backup/issues_$(date +%Y-%m-%d_%H%M%S).db

# 2. バックアップを確認
ls -la ~/.local/share/mgtd/backup/
```

### 実行方法

**`mgtd init` は使用禁止**（既存DBに対して `--force` なしでは実行拒否、`--force` ありではDB削除）。
sqlite3 で直接SQLを実行する:

```bash
# マイグレーションファイルを直接実行
sqlite3 ~/.local/share/mgtd/issues.db < schema/XXX_migration_name.sql

# 実行結果を確認
sqlite3 ~/.local/share/mgtd/issues.db ".schema issues" | head -20
```

### 実行後の確認

```bash
# 1. 新しいカラムが追加されていることを確認
sqlite3 ~/.local/share/mgtd/issues.db "PRAGMA table_info(issues);"

# 2. データ移行の結果を確認（移行SQLがある場合）
sqlite3 ~/.local/share/mgtd/issues.db "SELECT id, title, new_column FROM issues LIMIT 5;"

# 3. アプリケーションの動作確認
pnpm server:start  # 本番サーバー起動してエラーがないことを確認
```

### ロールバック

```bash
# バックアップから復元
cp ~/.local/share/mgtd/backup/issues_YYYY-MM-DD_HHMMSS.db ~/.local/share/mgtd/issues.db
```

問題が発生した場合は即座に作業を停止し、変更内容を報告してユーザーの指示を仰ぐこと。
