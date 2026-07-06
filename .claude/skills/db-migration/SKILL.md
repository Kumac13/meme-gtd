---
name: db-migration
description: Use when changing the database schema — adding a new numbered SQL migration under schema/, updating shared types, repositories, and tests. Also covers applying a migration to the production DB (ONLY on explicit user instruction, with mandatory backup first). Never modify existing migration files.
---

# DBスキーマ変更・マイグレーション手順

このスキルがDBマイグレーション手順の唯一の正。ファイル形式のルールは `schema/CLAUDE.md` にも記載がある（作業ディレクトリで自動ロードされるため）。

## マイグレーションファイルの作成

- 既存のSQLファイルは変更せず、必ず新しい連番ファイルを追加する（適用済みDBとの整合が壊れるため）
- 形式: `schema/XXX_description.sql`（例: `007_add_calendar_datetime_fields.sql`）
  - XXX: 3桁の連番（既存の最大番号 + 1）
  - description: スネークケースで機能を表現
- 冪等に書く（`IF NOT EXISTS` を使用）
- `ALTER TABLE ... ADD COLUMN` を含むファイルには他のDDL・バックフィルを混在させない（列が既存だと duplicate column 例外でファイル全体が「適用済み」扱いになるため。トリガー再作成などは別の連番ファイルに分ける）
- 既存データの移行が必要な場合は同一ファイル内にUPDATE文も記述
- コメントで変更内容を説明

## 必須の追随作業（これを終えるまで作業未完了）

- [ ] `packages/db/src/migrate.ts` の `migrations` 配列に新しいSQLファイルを登録（`schema/` は自動走査されない）
- [ ] `packages/shared` のドメイン型を更新
- [ ] `packages/db` のリポジトリを更新
- [ ] テストを追加・更新（テストなしのバックエンド変更は禁止）
- [ ] APIに影響する場合は api-schema-sync スキルのチェックリストも実施
- [ ] `docs/er-diagram.md`（データモデルの正）を更新

## 動作確認（必ずテスト環境で）

```bash
# テストDBを再初期化して新スキーマを確認
pnpm mgtd:test init -d $PWD/test-data/test.db -f --yes
sqlite3 $PWD/test-data/test.db "PRAGMA table_info(issues);"
```

## <critical-safety>本番DBマイグレーション</critical-safety>

**本番DBへのマイグレーションはユーザーの明示的な指示がある場合のみ実行する。**
指示がない場合はマイグレーションファイルの追加までで止め、本番適用が必要である旨を報告する。

### 手順（`mgtd db migrate` を使う）

`mgtd db migrate` は適用前に自動でバックアップを作成し、既存DBを削除しない安全な適用コマンド。
`mgtd init` は使用しない（既存DBに対して `--force` ありではDBを削除するため）。
生の sqlite3 でSQLを流し込む方法も使わない（バックアップ・適用状況チェックを迂回するため）。

```bash
# 1. 適用予定のマイグレーションを確認（変更なし）
mgtd db migrate --dry-run

# 2. 適用（自動でバックアップが作成される）
mgtd db migrate
```

### 実行後の確認

```bash
# 1. スキーマが期待どおり変わったことを確認
sqlite3 ~/.local/share/mgtd/issues.db "PRAGMA table_info(issues);"

# 2. データ移行の結果を確認（移行SQLがある場合）
sqlite3 ~/.local/share/mgtd/issues.db "SELECT id, title, new_column FROM issues LIMIT 5;"

# 3. アプリケーションの動作確認
pnpm server:start  # 本番サーバー起動してエラーがないことを確認
```

### ロールバック

バックアップは `~/.local/share/mgtd/backups/` に `issues-YYYYMMDD-HHmmssSSS.db` 形式で作成される。

```bash
# バックアップ一覧を確認し、直前のものから復元
ls -la ~/.local/share/mgtd/backups/
cp ~/.local/share/mgtd/backups/issues-YYYYMMDD-HHmmssSSS.db ~/.local/share/mgtd/issues.db
```

問題が発生した場合は即座に作業を停止し、変更内容を報告してユーザーの指示を仰ぐこと。
