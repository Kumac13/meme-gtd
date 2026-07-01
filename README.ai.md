# meme-gtd

GTD (Getting Things Done) ベースのローカルファースト個人タスク管理ツール。

## コンセプト

- **Memo**: 頭の中のアイデア・未整理事項を素早く取り込む（Inboxに入る前の状態）
- **Task**: トリアージ後の実行可能なアクション
- **Article**: ブラウザ拡張 / iOS Share Extension で保存したWeb記事のアーカイブ
- **ローカルファースト**: SQLiteでデータ完全ローカル保持
- **単一ユーザー前提**: 認証なし、個人利用

## クライアント

| クライアント | 場所 | バックエンドへの経路 |
|-------------|------|---------------------|
| CLI `mgtd` | `packages/cli` | core サービス直接呼び出し（HTTP非経由） |
| Web UI | `packages/web` | REST API（OpenAPIから自動生成したクライアント） |
| iOS アプリ + Share Extension | `ios/MemeGTD` | REST API（手書きSwiftモデル・要手動同期） |
| Chrome 拡張 | `packages/extension` | REST API（`POST /api/articles`） |

リポジトリ構造と変更の波及範囲は `docs/architecture.md` を参照。

## GTDワークフロー

```
Memo (Captured) → promote → Task (Inbox)
                              ↓
            inbox → open → next → done
                         → waiting
                         → scheduled
                         → someday
                         → canceled
```

- `memo`: 未整理のアイデアプール
- `task`: 実行可能なアクション（ステータスで進捗管理）
- `promote`: memo を task に昇格（derived_from リンクで追跡）
  - `GET /api/memos/{id}/promote-preview` — サーバが昇格後の task body（メモ本文 + `## Comments` セクション inline）を返す read-only エンドポイント。Web UI / iOS / CLI すべてこれを使ってフォーム / エディタの初期値を埋める（本文整形ロジックをクライアントに複製しない）
  - `POST /api/memos/{id}/promote` — トランザクション内で task 作成・derived_from 作成・`memo.promoted` ログ・ラベル/プロジェクト/他リンクの引き継ぎを実行
  - 任意フィールド: `bodyMd`（省略時は preview と同じロジックでサーバが生成）/ `status`（全8値）/ `taskKind` / `scheduledStart` / `scheduledEnd` / `isAllDay`
  - `bodyMd` 指定時は verbatim で採用（ユーザ編集結果を尊重）

## データモデル

### issues（メモ・タスク・記事 共通）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| type | TEXT | `memo` / `task` / `article` |
| title | TEXT | task/articleは必須、メモはNULL |
| body_md | TEXT | 本文（Markdown） |
| status | TEXT | タスクのみ: `inbox`/`open`/`next`/`waiting`/`scheduled`/`someday`/`done`/`canceled` |
| task_kind | TEXT | タスクのみ: `event`（予定）/`action`（作業、デフォルト） |
| is_bookmarked | INTEGER | ブックマークフラグ (0/1) |
| is_deleted | INTEGER | 論理削除フラグ (0/1) |
| meta | TEXT | JSON形式の追加情報。articleは `originalUrl`/`siteName`/`archivedAt` を保持 |
| created_at | TEXT | 作成日時 (ISO 8601) |
| updated_at | TEXT | 更新日時 (ISO 8601) |
| **スケジュール（新形式）** |||
| scheduled_start | TEXT | 予定開始日時 (ISO 8601) |
| scheduled_end | TEXT | 予定終了日時 (ISO 8601) |
| is_all_day | INTEGER | 終日イベントフラグ (0/1) |
| actual_start | TEXT | 実績開始日時 |
| actual_end | TEXT | 実績終了日時 |
| notify_before_minutes | INTEGER | 通知設定（分前） |
| **スケジュール（旧形式・非推奨）** |||
| scheduled_on | TEXT | 開始日 (YYYY-MM-DD) |
| end_date | TEXT | 終了日 (YYYY-MM-DD) |
| start_time | TEXT | 開始時刻 (HH:MM) |
| end_time | TEXT | 終了時刻 (HH:MM) |
| duration | INTEGER | 所要時間（分） |

### labels

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| name | TEXT UNIQUE | ラベル名 |
| description | TEXT | 説明 |
| created_at | TEXT | 作成日時 |

### issue_labels（多対多）

| カラム | 型 | 説明 |
|--------|-----|------|
| issue_id | INTEGER FK | issues.id |
| label_id | INTEGER FK | labels.id |
| assigned_at | TEXT | 割り当て日時 |

### projects

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| name | TEXT UNIQUE | プロジェクト名 |
| description | TEXT | 説明 |
| status | TEXT | `planned`/`active`/`paused`/`done`/`canceled` |
| start_date | TEXT | 開始日 (YYYY-MM-DD) |
| end_date | TEXT | 終了日 (YYYY-MM-DD) |
| view_meta | TEXT | 表示設定JSON |
| created_at | TEXT | 作成日時 |

### project_items（タスク・プロジェクト紐付け）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| project_id | INTEGER FK | projects.id |
| issue_id | INTEGER FK | issues.id |
| position | REAL | 表示順序 |
| view_meta | TEXT | 表示設定JSON |
| created_at | TEXT | 作成日時 |
| updated_at | TEXT | 更新日時 |

### links（memo/task間の関連）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| source_issue_id | INTEGER FK | リンク元 issues.id |
| target_issue_id | INTEGER FK | リンク先 issues.id |
| link_type | TEXT | `parent`/`child`/`relates`/`derived_from` |
| created_at | TEXT | 作成日時 |

**自動 `#id` メンション**: メモ・タスク・記事の本文／コメント保存時、`#123` のような表記は core サービス層（`rewriteIssueMentions`）が `[#123](/<type>/123)` という Markdown リンクに書き換え、同時に `relates` 型の link を作成する。`issues` テーブル内で memo/task/article は番号空間が共通なので `#id` 一つで一意に解決できる。コードブロック・インラインコード・既存リンク内・`\#id`（エスケープ）・存在しない id・自己参照は変換対象外。一度作られた link は本文編集で `#id` が消えても残る（GitHub と同じ流儀）。

**インタラクティブ Markdown チェックボックス（Task 限定）**: Task の本文と Task のコメントに含まれる `- [ ]` / `- [x]` は、表示画面のままトグルできる（Edit に入る必要なし）。書き換えは **クライアント側完結**（Web は `packages/web/src/utils/todoMarkdown.ts`、iOS は `ios/.../Utilities/TodoMarkdown.swift`）で、コードブロック内・blockquote 内の `- [ ]` は採番対象外。トグル結果は既存 `PATCH /api/tasks/{id}` / `PUT /api/tasks/{taskId}/comments/{commentId}` で全文置換保存される。**インタラクティブ操作（トグル + 並べ替え）は activity log を積まない** — core 層の `isInteractiveTodoChange` が old/new bodyMd を比較してログ呼び出しを抑止する。サーバ側は title・body それぞれ「実際に変わったか」を `beforeTask` と比較してからログ判断する（Web は toggle 時に現タイトルを送ってくるため、`!== undefined` だけでは不十分）。Web のみネスト含む並べ替えにも対応（`@dnd-kit/sortable`）。Memo・Article は対象外。

### url_links（外部URLリンク）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| issue_id | INTEGER FK | 紐付け先 issues.id |
| url | TEXT | 外部URL |
| title | TEXT | 表示タイトル（任意） |
| created_at | TEXT | 作成日時 |

### comments

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| issue_id | INTEGER FK | issues.id |
| body_md | TEXT | コメント本文（Markdown） |
| is_deleted | INTEGER | 論理削除フラグ |
| created_at | TEXT | 作成日時 |
| updated_at | TEXT | 更新日時 |

### comment_revisions（編集履歴）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| comment_id | INTEGER FK | comments.id |
| body_md | TEXT | 編集前の本文 |
| created_at | TEXT | 作成日時 |

### activity_log（イベントソーシング）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER PK | 自動採番 |
| event_type | TEXT | イベントタイプ（`task.created`, `memo.updated` 等） |
| occurred_at | TEXT | 発生日時 (ISO 8601) |
| source_type | TEXT | 操作元: `cli`/`api`/`system` |
| payload | TEXT | JSON形式のイベント固有データ |
| issue_id | INTEGER VIRTUAL | payloadから抽出（Generated Column） |
| project_id | INTEGER VIRTUAL | payloadから抽出（Generated Column） |
| label_id | INTEGER VIRTUAL | payloadから抽出（Generated Column） |

**特徴:**
- Append-only（追記のみ、UPDATE/DELETE禁止）
- SQLiteトリガーで不変性保証
- Diff Logging: 更新系イベントで`{ old, new }`形式の変更前後記録
- Snapshotting: イベント発生時点の関連エンティティ名を焼き付け

**イベントタイプ:**
- Task: `task.created`, `task.updated`, `task.status_changed`, `task.deleted`, `task.bookmarked`
- Memo: `memo.created`, `memo.updated`, `memo.promoted`, `memo.deleted`, `memo.bookmarked`
- Project: `project.created`, `project.updated`, `project.deleted`, `project.item_added`, `project.item_removed`
- Label: `label.created`, `label.deleted`, `label.assigned`, `label.removed`
- Link: `link.created`, `link.deleted`
- Comment: `comment.created`, `comment.updated`, `comment.deleted`

### issues_fts（全文検索用 FTS5 仮想テーブル）

| カラム | 型 | 説明 |
|--------|-----|------|
| issue_id | INTEGER | issues.id（UNINDEXED: 検索対象外） |
| title | TEXT | タイトル |
| body_md | TEXT | 本文 |

### issue_embeddings（ベクトル埋め込み）

| カラム | 型 | 説明 |
|--------|-----|------|
| issue_id | INTEGER PK | issues.id（FK, CASCADE DELETE） |
| embedding | BLOB | ベクトル埋め込み（Float32Array） |
| model | TEXT | 使用モデル名（例: `qwen3-embedding:4b`） |
| dimensions | INTEGER | ベクトル次元数 |
| content_hash | TEXT | SHA-256 コンテンツハッシュ（変更検知用） |
| created_at | TEXT | 作成日時 |
| updated_at | TEXT | 更新日時 |

## インターフェース

### CLI (`mgtd`)

```bash
# メモ
mgtd memo create/list/view/edit/delete/promote

# タスク
mgtd task create/list/view/edit/close/reopen

# ラベル
mgtd label create/list/delete

# プロジェクト
mgtd project create/list/view
```

- `--json` オプションで全コマンドJSON出力対応
- GitHub CLI (gh) のUXをオマージュ

```bash
# Embedding
mgtd embedding sync --model <model> --json

# 横断検索
mgtd search keyword <query> --types <types> --limit <n> --json
mgtd search semantic <query> --types <types> --limit <n> --json

# DBバックアップ（オンラインバックアップAPI・WAL安全・世代管理）
mgtd db backup --keep <n> --output <dir> --list --json
```

### REST API

| エンドポイント | 説明 |
|---------------|------|
| `GET /api/health` | ヘルスチェック（DB接続・スキーマバージョン。異常時503） |
| `GET/POST /api/memos` | メモ一覧・作成 |
| `GET/PATCH/DELETE /api/memos/{id}` | メモ詳細・更新・削除 |
| `GET /api/memos/{id}/promote-preview` | 昇格後のtask本文プレビュー（read-only） |
| `POST /api/memos/{id}/promote` | メモ→タスク昇格 |
| `GET/POST /api/tasks` | タスク一覧・作成 |
| `GET/PATCH/DELETE /api/tasks/{id}` | タスク詳細・更新・削除 |
| `POST /api/tasks/{id}/demote` | タスク→メモ降格 |
| `GET/POST /api/articles` | 記事一覧・保存（拡張/Share Extensionから） |
| `GET/DELETE /api/articles/{id}` | 記事詳細・削除 |
| `GET/POST /api/labels` | ラベル一覧・作成 |
| `GET/POST /api/projects` | プロジェクト一覧・作成 |
| `GET/POST /api/links` | リンク一覧・作成 |
| `GET/POST /api/issues/{id}/url-links` | 外部URLリンク一覧・作成 |
| `DELETE /api/url-links/{id}` | URLリンク削除 |
| `GET/POST /api/issues/{id}/comments` | コメント一覧・作成 |
| `POST /api/attachments` | 画像アップロード（multipart） |
| `GET /api/attachments/{filename}` | 画像配信 |
| `GET /api/activity-log` | アクティビティログ一覧（フィルタ対応） |
| `GET /api/search/keyword` | キーワード検索（LIKE部分一致） |
| `GET /api/search/semantic` | セマンティック検索（ベクトル類似度） |

契約の正は `packages/api/docs/api/openapi.yaml`（Zodスキーマから自動生成）。

### Web UI

- タスク/メモ/記事 一覧・詳細・編集
- カンバンボード（ステータス別表示）
- カレンダー表示（予定/実績）
- プロジェクト管理
- アクティビティログ表示

### iOS アプリ（`ios/MemeGTD`）

- SwiftUI製。メモ/タスク/記事の一覧・詳細・作成・編集、検索（keyword/semantic）、昇格フロー、画像添付
- Safari Share Extension でWeb記事を保存（`POST /api/articles`）
- SwiftモデルはAPIスキーマの手書きミラー。API変更時は手動同期が必要（`docs/architecture.md` の対応表参照）

## 検索アーキテクチャ

### 2つの検索モード

| モード | 方式 | 検索対象 | 結果の特徴 |
|--------|------|---------|-----------|
| keyword | LIKE部分一致 | title, body_md, comments | マッチ箇所（matches配列）を返す。同一issueの複数コメントマッチはグルーピング |
| semantic | ベクトル類似度 | embedding（title+body+comments全体） | similarity scoreを返す。comments全件を含む |

### keyword検索の設計意図

- FTS5ではなくLIKEを採用: FTS5のunicode61トークナイザーは日本語の単語境界を認識しないため
- コメントも検索対象: mgtdのコメントは「追記メモ」として重要情報を含む
- 結果はissue単位でグルーピング: 同一issueの複数コメントがマッチした場合、matches配列にまとめる
- matchesにはヒットした全文を切り詰めずに返す: ユーザーがマッチ内容を確認するため
- title/bodyMdは常に返す: マッチした内容が何のissueに属するか判断するための文脈情報

### semantic検索の設計意図

- embeddingはtitle+body_md+commentsから生成（コメントに重要情報があるため）
- 結果にcomments全件を含める: embedding対象と結果の情報を一致させる
- scoreはコサイン類似度（0-1）

### embedding基盤

- OpenAI互換 `/v1/embeddings` APIを使用（Ollama, OpenAI等のプロバイダに対応）
- 設定は `~/.config/mgtd/.env` で管理（`MGTD_EMBEDDING_URL`, `MGTD_EMBEDDING_MODEL`, `MGTD_EMBEDDING_API_KEY`）
- embedding生成のインターフェース: `generateEmbedding(text, config) → Float32Array`
- ベクトル検索: 全embeddingをメモリにロードし、コサイン類似度を計算（~1,500件規模で実用的）
- content hashによる変更検知: 内容が変わったissueのみ再生成

## 運用（Operations）

- **本番DBガード**: `MGTD_ENV=test` 設定時、dbPath が本番データディレクトリ（`~/.local/share/mgtd/`）に解決される場合は起動を拒否。`mgtd init --force` は非対話モードで `--yes` 必須
- **自動バックアップ**: APIサーバー稼働中、`MGTD_BACKUP_INTERVAL_HOURS`（既定24h）ごとに `<DBディレクトリ>/backups` へ世代管理付きでバックアップ
- **ヘルスチェック**: `GET /api/health`
- **常駐化**: systemd user unit テンプレート `deploy/systemd/mgtd-api.service`
- **ログ**: `MGTD_LOG_FILE` で日次ローテーション付きファイル出力（オプトイン）
- 詳細は `docs/operations.md`

## 技術スタック

- **言語**: TypeScript / Swift（iOS）
- **ランタイム**: Node.js 22+
- **DB**: SQLite (better-sqlite3)
- **API**: Fastify 5（Zodバリデーション、OpenAPI自動生成）
- **Web**: React 19 / Vite / Tailwind CSS
- **iOS**: SwiftUI（iOS 16+）+ Safari Share Extension
- **CLI**: oclif
- **拡張**: Chrome Extension（Readability + Turndown で記事抽出）
- **検索**: SQLite FTS5（タイプ内検索） / LIKE（横断keyword検索） / ベクトル検索（embedding + コサイン類似度）
