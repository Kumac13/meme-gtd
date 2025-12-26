# Schema マイグレーションガイド

## ファイル命名規則

- 形式: `XXX_description.sql`（例: `007_add_calendar_datetime_fields.sql`）
- XXX: 3桁の連番（001から開始）
- description: スネークケースで機能を表現

## マイグレーションファイルの書き方

- 冪等性を意識（`IF NOT EXISTS` を使用）
- 既存データの移行が必要な場合は同一ファイル内でUPDATE文も記述
- コメントで変更内容を説明

## <critical-safety>本番DBマイグレーション手順</critical-safety>

**IMPORTANT: 本番DBへのマイグレーションはユーザーの明示的な指示がある場合のみ実行**

### マイグレーションが必要なケース

新しいスキーマバージョン（`schema/XXX_*.sql`）を追加した場合、本番DBにも適用が必要。

### 事前準備（必須）

```bash
# 1. 本番DBのバックアップを作成
cp ~/.local/share/mgtd/issues.db ~/.local/share/mgtd/backup/issues_$(date +%Y-%m-%d_%H%M%S).db

# 2. バックアップを確認
ls -la ~/.local/share/mgtd/backup/
```

### マイグレーション実行方法

**`mgtd init` は使用禁止**: 既存DBに対して `--force` なしでは実行拒否、`--force` ありではDB削除

**正しい方法**: sqlite3で直接SQLを実行

```bash
# マイグレーションファイルを直接実行
sqlite3 ~/.local/share/mgtd/issues.db < schema/XXX_migration_name.sql

# 実行結果を確認
sqlite3 ~/.local/share/mgtd/issues.db ".schema issues" | head -20
```

### マイグレーション後の確認

```bash
# 1. 新しいカラムが追加されていることを確認
sqlite3 ~/.local/share/mgtd/issues.db "PRAGMA table_info(issues);"

# 2. データ移行の結果を確認（移行SQLがある場合）
sqlite3 ~/.local/share/mgtd/issues.db "SELECT id, title, new_column FROM issues LIMIT 5;"

# 3. アプリケーションの動作確認
pnpm server:start  # 本番サーバー起動してエラーがないことを確認
```

### ロールバック手順

問題が発生した場合：

```bash
# バックアップから復元
cp ~/.local/share/mgtd/backup/issues_YYYY-MM-DD_HHMMSS.db ~/.local/share/mgtd/issues.db
```
