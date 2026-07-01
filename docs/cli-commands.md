# CLIコマンドリファレンス

> 目的: mgtd CLIコマンドの構文・オプション・使用例の完全なリファレンス
> 読むタイミング: CLIコマンドの仕様確認・追加・変更時
> 更新タイミング: CLIコマンドの追加・変更時（cli-command-add スキルのチェックリストに含まれる）

## 検索・フィルタコマンド

### 全文検索（タスク・メモのリスト検索）

`mgtd task list` / `mgtd memo list` の `--search` 系オプションは、SQLite FTS5（`issues_fts` テーブル）を利用した全文検索を行う。クロスタイプ検索の `mgtd search keyword` はこれとは別実装（LIKE部分一致）である点に注意（後述の「検索コマンド」セクションを参照）。詳細は `docs/architecture.md` の「検索アーキテクチャ」を参照。

#### タスクの検索オプション

タスクは3種類の検索オプションをサポートする。

```bash
# Search both title AND body (default)
mgtd task list --search "authentication"
mgtd task list --search "login screen"

# Search title only
mgtd task list --search-title "Implement OAuth"
mgtd task list --search-title "Fix bug"

# Search body only
mgtd task list --search-body "OAuth integration details"
mgtd task list --search-body "error handling"
```

#### メモの検索オプション

メモは本文の検索をサポートする。

```bash
# Search memo body
mgtd memo list --search "meeting notes"
mgtd memo list --search "project requirements"

# Explicit body search (equivalent to --search for memos)
mgtd memo list --search-body "action items"
```

#### 検索機能の詳細

**複数語検索（ANDロジック）:**
検索クエリ内の複数の単語は暗黙のANDで結合される。

```bash
# Find tasks containing BOTH "login" AND "OAuth"
mgtd task list --search "login OAuth"

# Find memos containing BOTH "meeting" AND "requirements"
mgtd memo list --search "meeting requirements"
```

**フィルタとの組み合わせ:**
検索はラベル・ステータスフィルタと組み合わせ可能。

```bash
# Search for "authentication" in bugs
mgtd task list --search "authentication" --label bug

# Search for "OAuth" in open tasks
mgtd task list --search "OAuth" --status open

# Search memos with specific label
mgtd memo list --search "action items" --label meeting-notes
```

**プレビュースニペット:**
検索結果には、マッチ箇所をハイライトしたプレビュースニペットが含まれる（`--json` 使用時）。

```bash
mgtd task list --search "login" --json
# Returns: "preview": "Implement <mark>login</mark> feature"
```

**プロジェクトID・リンクID:**
タスクリストのレスポンスには、関連するプロジェクトIDとリンクIDの配列が含まれる（`--json` 使用時）。

```bash
mgtd task list --json
# Returns: "projectIds": [1, 2], "linkIds": [5, 8]
```

これによりAIエージェントが関連プロジェクト・リンクをコンテキストとして参照できる。

**前方一致ワイルドカード検索:**
`*` サフィックスで前方一致検索が可能。特に日本語テキストの検索で有用。

```bash
# English: exact word match
mgtd task list --search "auth"        # Matches "auth" as standalone word
mgtd task list --search "auth*"       # Matches "auth", "authentication", "authorize", etc.

# Japanese: prefix wildcard recommended
mgtd task list --search-title "MS*"   # Matches "MSのタスク", "MSお困りごと", etc.
mgtd memo list --search "会議*"       # Matches "会議メモ", "会議議事録", etc.
```

**注:** 現在のFTS5トークナイザ（`unicode61`）はスペースと句読点で分割するため、英語には有効だが日本語の単語境界は扱えない。日本語テキストでは `*` ワイルドカードによる部分一致を推奨。日本語トークナイズ対応については [Issue #76](https://github.com/Kumac13/meme-gtd/issues/76) を参照。

#### 検索技術（リスト検索）

- **エンジン**: SQLite FTS5（`issues_fts` テーブル、unicode61トークナイザ）— `task list` / `memo list` の `--search` 系オプションに適用
- **マッチング**: 前方一致ワイルドカード（`*`）による部分一致をサポート
- **大文字小文字**: デフォルトで区別しない
- **パフォーマンス**: 10,000件規模のデータセットでも即時に結果を返す

なお、クロスタイプ検索の `mgtd search keyword` はFTS5ではなくLIKE部分一致を使用する（意図的な選択。unicode61トークナイザが日本語の単語境界を扱えないため）。詳細は `docs/architecture.md` の「検索アーキテクチャ」を参照。

### フィルタ付きタスクリスト

`--label` と `--status` フラグでタスクをフィルタリングする。

#### 単一ラベルでのフィルタ

```bash
mgtd task list --label bug
mgtd task list --label enhancement
```

#### 複数ラベルでのフィルタ（ORロジック）

カンマ区切りで複数ラベルを指定する。指定したラベルのいずれかにマッチするタスクが返される。

```bash
mgtd task list --label bug,enhancement
mgtd task list --label urgent,high-priority
```

#### ステータスでのフィルタ

```bash
mgtd task list --status open
mgtd task list --status next
mgtd task list --status done
```

有効なステータス値: `inbox`, `open`, `next`, `waiting`, `scheduled`, `someday`, `done`, `canceled`

#### フィルタの組み合わせ（ANDロジック）

ラベルとステータスのフィルタは組み合わせ可能。すべての条件にマッチするタスクが返される。

```bash
mgtd task list --label bug --status open
mgtd task list --label bug,enhancement --status next
```

#### その他のオプションとの併用

```bash
# Combine with other flags
mgtd task list --label urgent --order asc --limit 10
mgtd task list --label bug --status open --json
mgtd task list --label critical --bookmarked
```

### フィルタ付きメモリスト

`--label` フラグでメモをフィルタリングする。注: メモにはステータスがない。

#### 単一ラベルでのフィルタ

```bash
mgtd memo list --label idea
mgtd memo list --label meeting-notes
```

#### 複数ラベルでのフィルタ（ORロジック）

```bash
mgtd memo list --label idea,meeting-notes
mgtd memo list --label inbox,todo
```

#### その他のオプションとの併用

```bash
mgtd memo list --label important --order desc
mgtd memo list --label idea --limit 5 --json
```

## コマンド構文（完全版）

### Task List

```bash
mgtd task list [--status <state>] [--label <name>] [--search <query>] [--search-title <query>] [--search-body <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]
```

**オプション:**
- `--status <state>` - タスクステータスでフィルタ（inbox, open, next, waiting, scheduled, someday, done, canceled）
- `--label <name>` - ラベルでフィルタ。カンマ区切りでORロジックをサポート（例: bug,enhancement）
- `--search <query>` - タスクのタイトルと本文の両方をFTS5で検索（複数語はANDロジック）
- `--search-title <query>` - タスクのタイトルのみをFTS5で検索
- `--search-body <query>` - タスクの本文のみをFTS5で検索
- `--bookmarked` - ブックマーク済みタスクのみ表示
- `--order <asc|desc>` - ソート順（デフォルト: desc）
- `--limit <n>` - 最大件数
- `--json` - JSON形式で出力（検索時のプレビュースニペット、projectIds、linkIdsを含む）

### Memo List

```bash
mgtd memo list [--label <name>] [--search <query>] [--search-body <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]
```

**オプション:**
- `--label <name>` - ラベルでフィルタ。カンマ区切りでORロジックをサポート（例: idea,meeting-notes）
- `--search <query>` - メモの本文をFTS5で検索（複数語はANDロジック）
- `--search-body <query>` - メモの本文をFTS5で検索（メモでは --search と同じ）
- `--bookmarked` - ブックマーク済みメモのみ表示
- `--order <asc|desc>` - ソート順（デフォルト: desc）
- `--limit <n>` - 最大件数
- `--json` - JSON形式で出力（検索時のプレビュースニペットを含む）

## 使用例

### 一般的なユースケース

```bash
# All open bugs
mgtd task list --label bug --status open

# High priority items (multiple labels)
mgtd task list --label urgent,high-priority --status next

# All ideas and meeting notes from memos
mgtd memo list --label idea,meeting-notes

# Bookmarked urgent tasks
mgtd task list --label urgent --bookmarked

# Get JSON output for scripting
mgtd task list --label bug --status open --json

# Limit results
mgtd task list --label enhancement --limit 10
```

### 検索の使用例

```bash
# Search tasks for "authentication"
mgtd task list --search "authentication"

# Search task titles only
mgtd task list --search-title "Implement OAuth"

# Search task bodies only
mgtd task list --search-body "integration details"

# Multi-word search (AND logic)
mgtd task list --search "login OAuth"

# Search with label filter
mgtd task list --search "authentication" --label bug

# Search with status filter
mgtd task list --search "OAuth" --status open

# Search memos
mgtd memo list --search "meeting notes"

# Search memos with label
mgtd memo list --search "action items" --label meeting-notes

# Search with JSON output (includes preview)
mgtd task list --search "login" --json
```

### 他ツールとの連携

```bash
# Count open bugs
mgtd task list --label bug --status open --json | jq length

# Extract task titles
mgtd task list --label urgent --json | jq '.[].title'

# Filter and format
mgtd task list --label bug --json | jq '.[] | {id, title, status}'
```

## タスクスケジューリングコマンド

### タスクのスケジューリング

ISO 8601日時形式（YYYY-MM-DDTHH:MM:SS）でタスクをスケジュールする。

#### スケジュール付きタスクの作成

```bash
# Create a task with scheduled start and end times
mgtd task create --title "Team meeting" --scheduled-start 2025-12-10T14:00:00 --scheduled-end 2025-12-10T15:00:00 --no-editor

# Create an all-day event
mgtd task create --title "Conference" --scheduled-start 2025-12-11T00:00:00 --scheduled-end 2025-12-13T23:59:59 --all-day --no-editor

# Create with body content
mgtd task create --title "Project review" --body "Review Q4 progress" --scheduled-start 2025-12-15T10:00:00 --scheduled-end 2025-12-15T11:00:00 --no-editor
```

**オプション:**
- `--scheduled-start <datetime>` - 予定開始日時（ISO 8601: YYYY-MM-DDTHH:MM:SS）
- `--scheduled-end <datetime>` - 予定終了日時（ISO 8601: YYYY-MM-DDTHH:MM:SS）
- `--all-day` - 終日イベントとしてマーク（日付部分のみ使用される）

#### タスクスケジュールの編集

```bash
# Update scheduled times
mgtd task edit 12 --scheduled-start 2025-12-10T15:00:00 --scheduled-end 2025-12-10T16:00:00 --no-editor

# Convert to all-day event
mgtd task edit 12 --all-day --no-editor

# Convert from all-day to timed event
mgtd task edit 12 --no-all-day --no-editor

# Clear schedule (empty string)
mgtd task edit 12 --scheduled-start "" --scheduled-end "" --no-editor
```

#### 実際の実行時刻の記録

タスクが実際に実行された時刻を記録する（予定時刻とは別）。

```bash
# Record actual start time
mgtd task edit 12 --actual-start 2025-12-10T14:30:00 --no-editor

# Record actual start and end times
mgtd task edit 12 --actual-start 2025-12-10T14:30:00 --actual-end 2025-12-10T16:00:00 --no-editor

# Clear actual times
mgtd task edit 12 --actual-start "" --actual-end "" --no-editor
```

**編集オプション:**
- `--scheduled-start <datetime>` - 予定開始日時を更新（空文字列でクリア）
- `--scheduled-end <datetime>` - 予定終了日時を更新（空文字列でクリア）
- `--all-day` / `--no-all-day` - 終日イベントフラグの切り替え
- `--actual-start <datetime>` - 実際の開始日時を設定（空文字列でクリア）
- `--actual-end <datetime>` - 実際の終了日時を設定（空文字列でクリア）

### レガシースケジューリングオプション（非推奨）

以下のオプションは非推奨だが、後方互換性のため引き続き動作する。

```bash
# Deprecated: --scheduled-on, --start, --end-date, --end
mgtd task create --title "Meeting" --scheduled-on 2025-12-10 --start 14:00 --end 15:00

# Preferred: Use --scheduled-start and --scheduled-end
mgtd task create --title "Meeting" --scheduled-start 2025-12-10T14:00:00 --scheduled-end 2025-12-10T15:00:00
```

## プロジェクトコマンド

### Project Create

新規プロジェクトを作成する。ステータスとスケジュールは任意。

```bash
mgtd project create "Sprint 1" --status active --start-date 2025-01-01 --end-date 2025-03-31
mgtd project create "Q4 Goals" --description "Year-end objectives" --status planned
mgtd project create "Bug Tracker" --view table --json
```

**オプション:**
- `--description, -d` - プロジェクトの説明
- `--view, -v` - ビュータイプ: `board`（デフォルト）または `table`
- `--status` - プロジェクトステータス: `planned`（デフォルト）, `active`, `paused`, `done`, `canceled`
- `--start-date` - 開始日（YYYY-MM-DD形式）
- `--end-date` - 終了日（YYYY-MM-DD形式）
- `--json, -j` - JSON形式で出力

### Project List

全プロジェクトを一覧表示する。ステータスフィルタは任意。

```bash
mgtd project list
mgtd project list --status active
mgtd project list --json
```

**オプション:**
- `--status` - プロジェクトステータスでフィルタ
- `--json, -j` - JSON形式で出力

### Project View

プロジェクトの詳細（ステータス、スケジュール、関連アイテム）を表示する。

```bash
mgtd project view 5
mgtd project view 5 --json
```

### Project Update

プロジェクトのプロパティ（ステータス、スケジュールを含む）を更新する。

```bash
mgtd project update 5 --status done
mgtd project update 5 --start-date 2025-01-01 --end-date 2025-12-31
mgtd project update 5 --name "Updated Name" --description "New description"
mgtd project update 5 --status active --json
```

**オプション:**
- `--name` - プロジェクト名を更新
- `--description` - プロジェクトの説明を更新
- `--status` - プロジェクトステータスを更新
- `--start-date` - 開始日を更新（YYYY-MM-DD）
- `--end-date` - 終了日を更新（YYYY-MM-DD）
- `--json, -j` - JSON形式で出力

**ステータス値:**
- `planned` - 計画中
- `active` - 進行中
- `paused` - 一時停止中
- `done` - 完了
- `canceled` - 中止

### Project Add/Remove/Move

プロジェクト内のアイテムを管理する。

```bash
# Add task/memo to project
mgtd project add 5 12 --column "In Progress"

# Remove item from project
mgtd project remove 5 12

# Move item to different position/column
mgtd project move 5 12 --column "Done" --after 15
```

### Project Delete

プロジェクトを削除する（確認が必要）。

```bash
mgtd project delete 5
mgtd project delete 5 --yes --json
```

## Task Demote

タスクの内容（タイトル・本文・コメント）をコピーして新しいメモを作成する。元のタスクは変更されない。

### 基本的な使い方

```bash
mgtd task demote 21
mgtd task demote 8 --no-editor --json
```

### 本文を指定する場合

```bash
# Provide body inline
mgtd task demote 5 --body "Custom memo content"

# Load body from file
mgtd task demote 5 --body-file notes.md

# Load from stdin
echo "Content" | mgtd task demote 5 --body-file -
```

### ラベルを指定する場合

```bash
# Override labels (instead of inheriting from task)
mgtd task demote 5 --label documentation --label archive
```

### オプション

```bash
mgtd task demote <id> [--body <text>] [--body-file <path>] [--label <name>...] [--no-editor] [--json]
```

**オプション:**
- `--body, -b` - メモ本文をインラインで指定（上書き）
- `--body-file, -f` - ファイルまたは標準入力から本文を読み込む（標準入力は `-` を指定）
- `--label, -l` - メモに付与するラベル（未指定の場合はタスクから継承）
- `--no-editor` - エディタをスキップし、自動生成または指定された本文をそのまま使用
- `--json, -j` - JSON形式で出力

### 継承

新しいメモは元のタスクから以下を自動的に継承する。

- **ラベル** - タスクに付与された全ラベル（`--label` 指定時を除く）
- **プロジェクト** - 全プロジェクト所属
- **リンク** - 既存の全リンク（parent, child, relates, derived_from）
- 元のタスクへの `derived_from` リンクが自動的に作成される

### エディタの動作

デフォルトでは、自動生成された内容でエディタが開く。

- タスクタイトルが `# Title` 見出しとして
- タスク本文
- コメントがタイムスタンプ付きで時系列順に

`--no-editor` を指定するとエディタをスキップし、自動生成された内容をそのまま使用する。

### 出力

元のタスク（変更なし）と新しいメモのIDを返す。

```json
{
  "task": { "id": 21, "title": "Research OAuth", ... },
  "memoId": 45
}
```

## データベースコマンド

### Database Backup

SQLiteのオンラインバックアップAPIを使用して、一貫性のあるタイムスタンプ付きスナップショットを作成する。APIサーバーやCLIがデータベースを使用中でも安全に実行できる（WALモード）。未チェックポイントの書き込みもスナップショットに含まれる。

```bash
# Create a backup in ~/.local/share/mgtd/backups/ (default keeps 7 generations)
mgtd db backup

# Keep more generations
mgtd db backup --keep 14

# Store backups in a custom directory
mgtd db backup --output ~/backups/mgtd

# List existing backups (newest first)
mgtd db backup --list

# Specify database path
mgtd db backup --db ~/.local/share/mgtd/issues.db

# JSON output for scripting
mgtd db backup --json
```

**オプション:**
- `--db, -d <path>` - SQLiteデータベースファイルのパス（デフォルトは設定済みのパス）
- `--output, -o <dir>` - バックアップ先ディレクトリ（デフォルト: データベースファイルと同じディレクトリ内の `backups` ディレクトリ。本番では `~/.local/share/mgtd/backups/`）
- `--keep <n>` - 保持するバックアップ世代数。古いものは削除される（デフォルト: 7、`0` で削除無効化）
- `--list, -l` - バックアップを作成せず、既存バックアップの一覧を表示
- `--json, -j` - JSON形式で出力

**特徴:**
- **WALセーフ**: SQLiteのオンラインバックアップAPIを使用するため、未チェックポイントのWAL内容もスナップショットに含まれる（単純な `cp` では含まれない）
- **誤ったDB作成の防止**: ソースデータベースは `fileMustExist` 付きの読み取り専用で開かれるため、誤ったパスを指定しても空のデータベースが作成されることはない
- **世代管理**: バックアップは `issues-YYYYMMDD-HHmmssSSS.db` という形式（DBファイル名に基づく）で命名され、削除処理はこのパターンにマッチするファイルのみを対象とする

**リストア手順:**

```bash
# Stop the API server first, then:
cp ~/.local/share/mgtd/backups/issues-20260612-103000123.db ~/.local/share/mgtd/issues.db
rm -f ~/.local/share/mgtd/issues.db-wal ~/.local/share/mgtd/issues.db-shm
```

**出力例:**

```json
{
  "success": true,
  "dbPath": "/Users/name/.local/share/mgtd/issues.db",
  "backupPath": "/Users/name/.local/share/mgtd/backups/issues-20260612-103000123.db",
  "sizeBytes": 176128,
  "prunedFiles": []
}
```

### Database Migrate

未適用のデータベースマイグレーションを、既存データを削除せずに安全に適用する。

```bash
# Preview migrations (dry run)
mgtd db migrate --dry-run

# Apply migrations with automatic backup
mgtd db migrate

# Apply migrations without backup
mgtd db migrate --no-backup

# Specify database path
mgtd db migrate --db ~/.local/share/mgtd/issues.db

# JSON output for scripting
mgtd db migrate --json
```

**オプション:**
- `--db, -d <path>` - SQLiteデータベースファイルのパス（デフォルトは設定済みのパス）
- `--backup / --no-backup` - マイグレーション前にタイムスタンプ付きバックアップを作成（デフォルト: true）
- `--dry-run, -n` - 適用せずにマイグレーション内容をプレビュー
- `--json, -j` - JSON形式で出力

**特徴:**
- **自動バックアップ**: マイグレーション適用前に、`mgtd db backup` と同じ仕組みでWALセーフなスナップショットを `~/.local/share/mgtd/backups/` に作成する（例: `issues-20260612-103000123.db`）
- **安全な動作**: `mgtd init --force` とは異なり、このコマンドがデータベースを削除することはない
- **冪等性**: 適用済みのマイグレーションはスキップされる
- **エラーリカバリ**: 失敗時にはバックアップからのリストアコマンドを表示する

**出力例:**

```json
{
  "success": true,
  "dbPath": "/Users/name/.local/share/mgtd/issues.db",
  "dbSizeKB": 172,
  "backupPath": "/Users/name/.local/share/mgtd/backups/issues-20260612-103000123.db",
  "appliedMigrations": ["007_add_calendar_datetime_fields"],
  "skippedMigrations": ["001_init", "002_add_project_view_meta", ...]
}
```

## 検索コマンド

### Keyword Search

メモ・タスク・記事を横断してキーワード検索する。タイトル・本文・コメントをLIKEによる部分一致で検索する。

FTS5ではなくLIKEを使用するのは意図的な選択である（FTS5のunicode61トークナイザは日本語の単語境界を扱えないため、日本語を含むクロスタイプ検索の確実性を優先している）。FTS5への移行は提案しないこと。詳細は `docs/architecture.md` の「検索アーキテクチャ」を参照。

```bash
# Basic keyword search
mgtd search keyword "郡司ペギオ"

# Filter by issue types
mgtd search keyword "TODO" --types memo,task

# Limit results and output JSON
mgtd search keyword "meeting" --limit 5 --json
```

**オプション:**
- `--types, -t` - 検索対象のissueタイプをカンマ区切りで指定: memo, task, article
- `--limit, -n` - 最大件数（デフォルト: 20）
- `--json, -j` - JSON形式で出力

**結果の構造:**

結果はissue単位でグループ化される。複数のコメントがマッチした場合、同一issueの下にまとめて列挙される。

```json
{
  "results": [
    {
      "id": 1405,
      "type": "memo",
      "title": null,
      "bodyMd": "full body text...",
      "status": null,
      "isBookmarked": false,
      "labels": ["reading"],
      "commentCount": 17,
      "createdAt": "2026-02-19T09:18:16.650Z",
      "updatedAt": "2026-02-19T09:18:16.650Z",
      "matches": [
        { "field": "comment", "commentId": 864, "text": "matched comment text..." },
        { "field": "comment", "commentId": 867, "text": "another matched comment..." }
      ]
    }
  ],
  "total": 1
}
```

### Semantic Search

OpenAI互換の埋め込み（embeddings）によるベクトル類似度検索で、メモ・タスク・記事を横断検索する。事前に埋め込みの同期（`mgtd embedding sync`）が必要。

```bash
# Basic semantic search
mgtd search semantic "郡司ペギオ"

# Filter by types and limit
mgtd search semantic "GTD workflow" --types task --limit 10

# Specify model and output JSON
mgtd search semantic "読書メモ" --model qwen3-embedding:4b --json
```

**オプション:**
- `--types, -t` - 検索対象のissueタイプをカンマ区切りで指定: memo, task, article
- `--limit, -n` - 最大件数（デフォルト: 20）
- `--model, -m` - 埋め込みモデル名（`MGTD_EMBEDDING_MODEL` を上書き）
- `--json, -j` - JSON形式で出力

**設定（`~/.config/mgtd/.env` または環境変数で指定）:**
- `MGTD_EMBEDDING_URL` - OpenAI互換のembeddingsエンドポイント（デフォルト: `http://localhost:11434/v1`）
- `MGTD_EMBEDDING_MODEL` - モデル名（デフォルト: `qwen3-embedding:4b`）
- `MGTD_EMBEDDING_API_KEY` - APIキー（デフォルト: `ollama`）

**前提条件:**
- 埋め込みサーバーが起動していること（例: Ollama、OpenAI API）
- モデルがサーバー上で利用可能であること
- 埋め込みが同期済みであること（`mgtd embedding sync`）

**結果の構造:**

結果には本文全文、全コメント（埋め込み対象にはコメントも含まれる）、類似度スコアが含まれる。

```json
{
  "results": [
    {
      "id": 654,
      "type": "memo",
      "title": null,
      "bodyMd": "full body text...",
      "status": null,
      "isBookmarked": false,
      "labels": [],
      "comments": [
        { "id": 45, "bodyMd": "comment text...", "createdAt": "...", "updatedAt": "..." }
      ],
      "commentCount": 1,
      "createdAt": "2025-04-23T13:03:23.570Z",
      "updatedAt": "2025-04-23T13:03:23.570Z",
      "score": 0.47
    }
  ],
  "total": 1
}
```

## 埋め込みコマンド

### Embedding Sync

全issueのベクトル埋め込みを生成または更新する。新規issue、モデル変更、内容変更（SHA-256ハッシュで検出）を検知する。

```bash
# Sync embeddings with default settings
mgtd embedding sync

# Specify model (overrides MGTD_EMBEDDING_MODEL)
mgtd embedding sync --model qwen3-embedding:0.6b

# JSON output
mgtd embedding sync --json
```

**オプション:**
- `--model, -m` - 埋め込みモデル名（`MGTD_EMBEDDING_MODEL` を上書き）
- `--json, -j` - JSON形式で出力

**設定（`~/.config/mgtd/.env` または環境変数で指定）:**
- `MGTD_EMBEDDING_URL` - OpenAI互換のembeddingsエンドポイント（デフォルト: `http://localhost:11434/v1`）
- `MGTD_EMBEDDING_MODEL` - モデル名（デフォルト: `qwen3-embedding:4b`）
- `MGTD_EMBEDDING_API_KEY` - APIキー（デフォルト: `ollama`）

**前提条件:**
- 埋め込みサーバーが起動していること（例: Ollama、OpenAI API）
- モデルがサーバー上で利用可能であること

**出力:**
```json
{
  "created": 10,
  "updated": 2,
  "skipped": 0,
  "total": 12
}
```

## 補足事項

- **大文字小文字**: ラベルのマッチングは大文字小文字を区別しない
- **空白文字**: ラベル名の前後の空白は自動的にトリムされる
- **空の結果**: フィルタ条件にマッチするアイテムがない場合、空のリストが返される
- **警告**: `mgtd memo list` に `--status` フラグを付けると警告が表示される（メモにはステータスがないため）
- **日付バリデーション**: プロジェクトの開始日は終了日以前でなければならない
- **プロジェクトステータス**: 新規プロジェクトのデフォルトステータスは `planned`
