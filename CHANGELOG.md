# Changelog

## 0.38.1 - 2026-07-03

### Bug Fixes

- **iOS: タブ復帰時にメモ一覧が空白になる問題を修正**: データが存在するのに（store=20件・エラーなし）リストだけが描画されない状態が発生していた。原因は、`defaultScrollAnchor(.bottom)` のチャット型レイアウトで LazyVStack が「既にデータを持った状態で再生成」されると初期レイアウトでセルを実体化しない iOS 26 の描画問題（スクロール操作で強制レイアウトされ表示される、初回起動は「空→挿入」順のため正常）。タブ復帰時も最初の1フレームを空でレイアウトし、直後にデータを挿入する（初回起動と同じ経路を通す）ことで回避。実機で診断オーバーレイを用いた原因特定と修正確認を実施済み。

## 0.38.0 - 2026-07-03

### New Features

- **iOS コメントのオフライン対応 + 競合の可視化（オフライン同期 Phase 6）**: Offline Sync ON時、メモへのコメント追加・編集・削除がオフラインで動作するようになった（未同期メモへのコメントも可。Outbox の FIFO 順で親メモの create が必ず先にサーバーへ届く）。
  - コメントもメモと同じID規約（同期済み = server_id、未同期 = 負のローカルID）と Outbox 圧縮規則（連続編集のマージ、create+delete 相殺）に従う。
  - 同期で conflicted copy が生成された場合、メモ一覧上部にトースト（"N conflicted copy created"）を4秒間表示する。
  - 競合ルール自体はサーバー側（Phase 2）で確定済み: メモ本文の同時編集はサーバー版温存 + クライアント版を複製保存、edit-beats-delete 双方向、コメントは LWW のみ。

### Bug Fixes

- **メモ・タスク一覧が接続再確立時に長時間表示されない問題を修正**: 一覧の初期ロードがラベル・プロジェクト取得（各タイムアウト60秒）の完了を待ってから走る直列構成だったため、Tailscale 再接続時などに画面が最大2分間空白になっていた（pull-to-refresh はこの経路を通らないため即表示され、症状の再現条件と一致）。一覧を最優先で取得し、ラベル・プロジェクトはその後に並行取得へ変更。あわせて GET 系リクエストのタイムアウトを15秒に短縮（更新系・画像アップロードは従来どおり）。

### Tests

- コメントの FIFO push 順序と issueUuid 対応、圧縮規則、push 結果の server_id 反映、conflictCopied 受領（サーバー版復元 + copy 取得 + 計数）、skipped delete の pull 復元、ローカル listComments を検証する8テストを追加（iOS 計29件）。

## 0.37.0 - 2026-07-02

### New Features

- **iOS メモのオフライン対応（Offline Sync Beta、オフライン同期 Phase 5）**: 設定画面の「Offline Sync (Beta)」トグル（デフォルトOFF）をONにすると、メモの作成・編集・削除・ブックマークがオフラインで動作し、オンライン復帰時にサーバーと自動同期される。OFFのままなら従来のオンライン専用挙動と完全に同一（既存ユーザー無影響）。
  - 書き込みはローカルGRDB更新 + Outbox（`pending_operations`）追記を単一トランザクションで行い、UIは即時反映。同一メモへの連続編集はOutbox内でマージ圧縮、送信前のcreate+deleteは相殺。
  - `SyncEngine`（actor）が push→pull の順で同期。push結果の `serverId` / `updatedAt` をローカルに記録し、pullは `server_seq` カーソルでページングして1ページ=1トランザクションで適用。Outboxに未送信操作が残るuuidへのリモート変更適用はスキップ（ローカル編集の保護・同期ループ防止）。
  - 同期トリガは4系統: アプリのフォアグラウンド復帰 / ネットワーク復帰（NWPathMonitor）/ ローカル書き込み直後 / pull-to-refresh。多重実行はactor+スケジューラで直列化。
  - 未同期のローカル行は負の整数IDでUI層に露出し、push後は自動的にサーバーIDへ切り替わる（ID再マッピング不要のUUID主キー設計）。
  - このフェーズのスコープ: メモ本体のみ。コメント・promote-preview・プロジェクトフィルタはオンライン時にサーバーへ委譲（コメントのオフライン化はPhase 6、タスク/記事の閲覧キャッシュはPhase 7）。画像添付はオフライン対象外。

### Tests

- `MemeGTDTests` に SyncEngine / OfflineFirstMemoDataSource のテストを追加（in-memory GRDB + MockTransport、7件）: Outbox FIFO・マージ圧縮・create+delete相殺、push成功時のserver_id記録とOutbox消化、通信失敗時のfailed遷移とリトライ、pullのページング・カーソル前進・task行の保存、pending中uuidの保護、ローカル一覧のbookmark/searchフィルタ。

## 0.36.2 - 2026-07-02

### Implementation Details

- **iOS ローカル DB 基盤 + テスト基盤（オフライン同期 Phase 4、UI 挙動変更なし）**: GRDB.swift 6.29.3 を SPM で導入（app / ShareExtension 両ターゲット）。App Group コンテナに `local.sqlite`（WAL）を起動時に生成する `AppDatabase` を新設。まだどの画面からも使われない。
  - スキーマ（`001_initial`）: issues / comments / labels / issue_labels / pending_operations（Outbox）/ sync_meta。サーバースキーマを 1:1 ミラーしつつ、PK はクライアント生成 UUIDv7 の `uuid`、`server_id` を併設。
  - GRDB Record 型（Issue / Comment / Label / IssueLabel / PendingOperation）、UUIDv7 生成器（RFC 9562、単調カウンタ付き）、DeviceID（初回生成 → sync_meta 永続化）を追加。
  - **iOS 初のユニットテストターゲット `MemeGTDTests` を新設**（共有スキームの Test アクション含む）。マイグレーション・Record round-trip・UUIDv7 形式/単調性・sync_meta・Outbox FIFO の14テスト。

## 0.36.1 - 2026-07-02

### Implementation Details

- **iOS DataSource シーム導入（オフライン同期 Phase 3、挙動変更ゼロ）**: 全 ViewModel の `APIClient.shared` 直呼びを protocol ベースの DataSource 経由に差し替えた。以降のオフライン対応フェーズは `DataSourceProvider` での実装差し替えだけで済む構造になる。
  - `ios/MemeGTD/MemeGTD/DataSources/` に 7 protocol + Remote 実装を新設（Memo / Task / Article / Search / Project / Label / IssueRelations）。Remote 実装は従来の APIClient 呼び出し（パス・メソッド・型）をそのまま移動したもの。
  - `DataSourceProvider`（ObservableObject、現時点は Remote 固定）を `MemeGTDApp` から environmentObject 注入し、各 View が既存の `store` 配線と同じ箇所で ViewModel にセットする。
  - 例外として据え置き: `SettingsView` の接続テスト、画像アップロード（オフライン恒久対象外）、ShareExtension（直POSTのまま）、レガシー `ContentView`。

## 0.36.0 - 2026-07-02

### New Features

- **同期API（iOS オフライン同期 Phase 2）**: 差分プルとオフライン操作適用の2エンドポイントを追加した。実装は `packages/core/src/syncService.ts`（`SyncService`）で、mutation は `MemoService` を経由するため activity log は通常どおり記録される。
  - `GET /api/sync/changes?since=<serverSeq>&limit=`: issues / comments / labels / issue_labels の変更を serverSeq 昇順で返す差分フィード。論理削除行（`isDeleted=true`）も含めて返すためクライアントが削除を検知できる。ハード削除される labels / issue_labels は `op:'delete'` のトンボストーンとして届く。`hasMore` によるカーソルページング付き。
  - `POST /api/sync/push`: クライアントの保留操作（memo / comment の create / update / delete）を FIFO で適用する。op ごとに個別トランザクション（部分成功）、クライアント採番の `opId` で冪等（再送は記録済み結果を `alreadyApplied` として返す）。
  - 競合解決: `updatedAt` は等値比較のみ（クロックスキュー・精度差対策）。レコード単位 LWW、ただしメモ本文の同時編集はサーバー版を温存しクライアント版を「Conflicted copy」メモとして保存（データ消失ゼロ）。edit-beats-delete を双方向で適用（削除済み行への編集は復活、編集済み行への stale な削除はスキップ）。
  - オフライン作成メモは `payload.createdAt` で執筆時刻を保持したままサーバーに登録される。
  - iOS 用 Swift ミラー `ios/MemeGTD/Shared/SyncModels.swift` を追加（Phase 5 の SyncEngine が使用予定。現時点では未使用）。

### Tests

- 同期APIの統合テストを `packages/api/test/integration/sync.test.ts` に追加（19件）: 差分フィードのカーソル/limit/hasMore/削除行包含/トンボストーン、push の4ステータス（applied / alreadyApplied / conflictCopied / skipped）、冪等再送、コメントの issueUuid 解決と FIFO、edit-beats-delete 両方向、ブックマークのみの LWW、activity log 記録。

## 0.35.0 - 2026-07-02

### New Features

- **iOS オフライン同期の基盤（Phase 1 / サーバー DB）**: 差分同期に必要な識別子・順序・削除記録・冪等性の土台を migration 014 で導入した。既存 API のレスポンス形は不変（クライアントへの影響なし）。
  - `issues` / `comments` に `uuid` 列を追加（同期用の恒久 ID）。新規行はリポジトリが UUIDv7 を採番し、リポジトリを経由しない INSERT にはトリガが UUIDv4 をフォールバック付与。既存行はマイグレーション内でバックフィル。
  - `issues` / `comments` / `labels` / `issue_labels` に `server_seq` 列を追加。`sync_sequence`（シングルトンカウンタ）から全書き込みにグローバル単調連番を SQLite トリガで打刻する。CLI は HTTP を通らず core→db 直書きのため、全書き込み経路をカバーできる層がトリガのみであることが採用理由。既存行には重複しない連番をバックフィルし、初回差分取得（`since=0`）で全行が返せる状態にした。
  - `sync_tombstones` を追加。ハード削除される `labels` / `issue_labels` の削除を記録する（CASCADE 削除でも発火することを検証済み）。論理削除の issues / comments は `is_deleted` 行自体がトンボストーンを兼ねるため対象外。
  - `sync_applied_ops` を追加。Phase 2 で実装する `POST /api/sync/push` の冪等性台帳（クライアント採番の `op_id` が主キー）。
  - `packages/shared` に `uuidv7()` ユーティリティと、`IssueBase` / `Comment` / `Label` への `uuid` / `serverSeq` フィールドを追加。CLI の `--json` 出力にはこれらのフィールドが追加で現れる（後方互換の追加変更）。

### Tests

- migration 014 の適用、CLI / API 両経路での server_seq 打刻、uuid の一意性とトリガフォールバック、ラベル削除（直接 / CASCADE）のトンボストーン生成、既存 FTS・activity_log トリガの無破壊、既存データへのバックフィルを検証するテストを `packages/db/test/syncSupport.test.ts` に追加。

## 0.34.0 - 2026-06-29

### New Features

- **インタラクティブな Markdown チェックボックス**: Task の本文・Task のコメント内に書いた `- [ ]` / `- [x]` を、Edit モードに入らず表示画面のままトグルできるようにした。GitHub の task list と同じ操作感。
  - **Web**: チェックボックスをクリックすると即時 `PATCH /api/tasks/{id}` または `PUT /api/tasks/{taskId}/comments/{commentId}` で保存。連続トグルは promise chain で直列化し、失敗時は楽観 UI をロールバックする。さらに各 todo の左に grip handle (常時表示・低彩度) があり、ドラッグ＆ドロップで順序を入れ替え可能。ネストした子項目は親と一緒に移動し、異なる親をまたぐ移動は弾いて警告を表示する（`@dnd-kit/sortable` ベース）。
  - **iOS**: SwiftUI の SF Symbol（`square` / `checkmark.square.fill`）として描画し、タップで即トグル + Haptic + PATCH。並べ替えは Web のみのスコープのため iOS では非対応。
  - **対象範囲は Task のみ**: Memo の本文・コメント・Article の本文では従来通り静的表示。スコープ外ではトグル UI も出ない。
  - コードブロック・blockquote 内の `- [ ]` はインデックス対象外（誤って触らない）。書き換えは行範囲ベースの 1 文字置換で、原文の整形を壊さない。
  - **インタラクティブ操作（トグル + 並べ替え）は activity log を積まない**: `core` の `isInteractiveTodoChange` が old/new bodyMd を比較し、変更が「`[ ]` ↔ `[x]` トグル」または「task list item の並べ替え（ネスト子も含む）」だけなら `task.updated` / `memo.updated` / `comment.updated` のログを抑止する。timeline が toggle/reorder の度に膨らまない。
  - **`task.updated` の title 誤計上を修正**: Web は toggle 時に現タイトルを丸ごと PATCH に乗せるため、サーバーが `input.title !== undefined` だけを見て log を作る挙動だと毎回 task.updated が積まれていた。サーバー側で `input.title !== beforeTask.title` の実差分チェックを追加し、変更がない場合は title diff も body diff も発行しない。

## 0.33.0 - 2026-06-29

### New Features

- **GitHub 風 `#id` 自動リンク**: メモ・タスク・記事の本文／コメントを保存すると、文章中の `#123` のような表記が `[#123](/<type>/123)` という Markdown リンクに書き換えられ、同時に参照先と `relates` 型の link が作成される。
  - 対象は `issues` テーブル（memo / task / article）。番号空間が共通なので `#id` 一つで一意に解決される。`projects` は別テーブルのため対象外。
  - 検出は core 層（`rewriteIssueMentions`）に集約。CLI / REST API / Share Extension いずれの保存パスからも同じ処理が走る。
  - コードブロック・インラインコード・既存 Markdown リンク内・`\#id`（エスケープ）・存在しない id・自己参照は変換対象外。同じ `#id` を複数回書いても link は 1 本にデデュープ。
  - 本文編集で `#id` を削除しても link は残る（GitHub と同じ。手動 link と自動 link を区別できないため）。不要なら従来通り LinkSection の × で個別削除可能。
  - Web: `react-markdown` の `a` レンダラが内部 URL を React Router `Link` に分岐させ、SPA 遷移する。
  - iOS: `MarkdownBody.onIssueTap` クロージャと `OpenURLAction` で内部 URL を `navigateToIssue` 経由の画面遷移にインターセプトする。

## 0.32.1 - 2026-06-23

### Bug Fixes

- **iOS Memo Loading Indicator Stuck**: `loadMemos` / `loadAllMemos` left `isLoading` at `true` when cancelled, on the assumption that a replacement reload task would take over the spinner. Cancellations from outside that path (e.g. SwiftUI tearing down the `.task` when the `ScrollView` `.id` flips, or any other view-driven `.task` cancel) had no replacement, so the "Loading memos…" overlay could remain on screen indefinitely. Both methods now clear `isLoading` via `defer` so the spinner is always released.

## 0.32.0 - 2026-06-18

### New Features

- **`GET /api/memos` accepts `order=asc|desc`**: Lets clients fetch memos in ascending creation order. Default remains `desc` (newest first) so existing consumers are unaffected.

### Behavior Changes

- **iOS Memo Schedule Filter**: When a schedule (created-date range) filter is active, the memo timeline now fetches the range in ascending order (oldest first) and loads the full filtered range. The oldest entry is the natural top of the list — no programmatic scrolling, so wide ranges open instantly instead of waiting for an animated scroll through hundreds of cells. Pull-to-refresh while the filter is active reloads the full range. Loading the whole range trades a short delay for completeness.

### Reliability

- **iOS Memo Reload Race Fix**: Filter changes while a full-range load is in flight now cancel the prior load to keep the timeline consistent. When the server reports a higher `total` than it actually returns, the list now settles `hasMore` to false so "No older memos" appears correctly.

## 0.31.0 - 2026-06-13

### New Features

- **Production DB safety guards** (Issue #48 follow-up):
  - `MGTD_ENV=test` now refuses to run when the resolved DB path is inside the production data directory (`~/.local/share/mgtd/`). `pnpm mgtd:test` and `pnpm server:dev` set it automatically.
  - `DB_PATH` is now honored even when the config file is missing (previously this silently fell back to the production database).
- **Database backup**:
  - New `mgtd db backup` command using SQLite's online backup API (WAL-safe, generation-managed pruning via `--keep`, `--list`, `--output`).
  - The API server now takes automatic periodic backups (`MGTD_BACKUP_ENABLED` / `MGTD_BACKUP_INTERVAL_HOURS` / `MGTD_BACKUP_KEEP` / `MGTD_BACKUP_DIR`).
  - `mgtd db migrate` pre-migration backups now use the online backup API instead of a plain file copy (which missed uncheckpointed WAL content) and are stored in `<db dir>/backups`.
- **Health check**: New `GET /api/health` endpoint reporting server version, uptime, and database connectivity (503 when the database is unreachable).
- **Log file output**: Optional `MGTD_LOG_FILE` writes JSON logs to a file with daily rotation (7 generations kept) in addition to stdout.
- **Process management**: systemd user unit template at `deploy/systemd/mgtd-api.service`; operational runbook in `docs/operations.md`.

### Behavior Changes

- `mgtd init --force` on an existing database now requires `--yes` in non-interactive mode (scripts, CI, AI agents) and shows a confirmation prompt on a TTY. Non-interactive overwrites without `--yes` exit with status 1.

## 0.30.0 - 2026-04-24

### New Features

- **Memo-to-Task Promotion (Web + iOS + CLI + API)**: Promote an existing memo to a task with all its context preserved
  - New `GET /api/memos/{id}/promote-preview` endpoint returns the task body that would be produced by promotion (memo body with comments inlined under a `## コメント` section). Web UI, iOS, and the `mgtd memo promote` CLI all use this single server-owned formatter to pre-fill the promotion editor.
  - `POST /api/memos/{id}/promote` now accepts optional `bodyMd`, `taskKind`, `scheduledStart`, `scheduledEnd`, `isAllDay`, and the full `TaskStatus` enum (including `done` and `canceled`). When `bodyMd` is omitted, the server builds the body via the same formatter as the preview; when supplied, the caller's body is used verbatim.
  - Promotion automatically carries over memo labels, project memberships, and outgoing/incoming links to the new task.
  - iOS "Promote to Task" action in the memo detail bottom sheet is a single atomic POST (no more two-step POST+PATCH).

## 0.29.0 - 2026-04-03

### New Features

- **Date Range Filtering**: Filter memos and tasks by date range across Web, iOS, and API
  - 8 presets: Today, Yesterday, This/Last Week, This/Last Month, This/Last Year
  - Custom range with wheel picker (iOS) and date inputs (Web)
  - New `createdFrom`/`createdTo` query parameters for memo API
  - URL-persisted filters for bookmarkable/shareable filtered views

## 0.27.1 - 2026-04-01

### Improvements

- **Web UI Status Filter**: Revert status filter from dropdown back to horizontal buttons for better usability (TasksList and ListView)

## 0.27.0 - 2026-03-23

### New Features

- **Semantic Search**: Vector-based search using Ollama embeddings (cosine similarity KNN)
  - New `issue_embeddings` table for storing vector embeddings as BLOBs
  - `GET /api/search/semantic` endpoint for semantic search
  - `mgtd embedding sync` CLI command for batch embedding generation
  - Support for `qwen3-embedding:4b` model (2560 dimensions, Japanese-capable)
  - SHA-256 content hash for staleness detection
  - Batch processing (50 items per request)

## 0.26.0 - 2026-03-05

### Improvements

- **iOS Toolbar Search**: Move search from bottom bar to navigation toolbar with animated expand/collapse (GitHub iOS style)
- **iOS MemoDetail**: Move info button from bottom bar to toolbar as ellipsis icon, making FloatingComposer full-width
- **iOS Input Areas**: ComposePill and FAB button now use full width without competing with search controls
- **AutoFocusTextField**: New UIViewRepresentable component for reliable keyboard focus in toolbar context

## 0.21.0 - 2026-02-28

### New Features

- **iOS Liquid Glass**: Replace opaque PillSurface with `.glassEffect(.regular)` for iOS 26 Liquid Glass appearance on all floating UI elements
- **iOS Depth Effects**: Replace ZStack bottom bar layout with `.safeAreaBar` + `.scrollEdgeEffectStyle(.soft)` for progressive scroll blur in MemoListView and MemoDetailView
- **iOS Side Menu Redesign**: Cream background with dedicated menu colors and content opacity fade

### Documentation

- Add Design System section to `ios/README.md` documenting PillSurface, safeAreaBar pattern, and side menu design

## 0.20.2 - 2026-02-14

### Bug Fixes

- **Mobile Memo Composer**: Adjusted mobile composer spacing/alignment and corrected send icon orientation.

## 0.20.1 - 2026-02-07

### Bug Fixes

- **Markdown Textarea**: Auto-grow textarea based on content, fixing mobile/PWA where resize handle is unavailable. Manual resize on PC is preserved. Write/Preview tab switch restores correct height.

## 0.20.0 - 2026-01-20

### New Features

- **Task Kind**: Distinguish between events (time-fixed appointments) and actions (tasks to do).
  - **Database**: New `task_kind` column with values `event` or `action` (default: `action`)
  - **Calendar Visual Distinction**:
    - Event: Green border only (hollow style)
    - Action: Left green border + light green background + checkbox (○/●)
  - **Web UI**: Kind toggle buttons in TaskForm and Schedule section
  - **CLI**: New `--kind` option for `task create` and `task edit` commands
  - **Migration**: Existing tasks with `mtg` label automatically set to `event`

## 0.19.1 - 2025-12-22

### Bug Fixes

- **Search Console**: Fixed critical issues with search functionality.
  - Resolved a race condition where search input was ignored/cleared immediately.
  - Fixed filtering logic to correctly search across all statuses (e.g. Inbox) when a label or search term is present, instead of being restricted to "Next" tasks by default.
  - Removed strict blocking on validation errors to allow forced search submission.

## 0.18.0 - 2025-12-11

### New Features

- **Activity Log (Event Sourcing)**: Track all user actions as immutable event log.
  - **Database**: New `activity_log` table with append-only design
    - Generated columns for efficient filtering (`issue_id`, `project_id`, `label_id`)
    - SQLite triggers enforce immutability (UPDATE/DELETE blocked)
  - **Event Types**: 20+ event types covering all entities
    - Task: `task.created`, `task.updated`, `task.status_changed`, `task.deleted`, `task.bookmarked`
    - Memo: `memo.created`, `memo.updated`, `memo.promoted`, `memo.deleted`, `memo.bookmarked`
    - Project: `project.created`, `project.updated`, `project.deleted`, `project.item_added`, `project.item_removed`
    - Label: `label.created`, `label.deleted`, `label.assigned`, `label.removed`
    - Link: `link.created`, `link.deleted`
    - Comment: `comment.created`, `comment.updated`, `comment.deleted`
  - **Diff Logging**: Update events capture `{ old, new }` values for change tracking
  - **Full Text Storage**: Complete body text stored (no truncation)
  - **Snapshotting**: Related entity names captured at event time
  - **API**: New `GET /api/activity-log` endpoint with filtering
    - Filter by: `issueId`, `projectId`, `labelId`, `eventType`, `sourceType`
    - Date range: `from`, `to`
    - Pagination: `limit`, `offset`, `order`
  - **Core Integration**: ActivityLogger integrated into all services
    - MemoService, TaskService, ProjectService, LabelService, LinkService
    - Transaction boundaries ensure consistency

## 0.17.0 - 2025-12-07

### New Features

- **Calendar Datetime Separation**: Separate scheduled (planned) times from actual (executed) times.
  - **Database Migration**: New fields in `issues` table:
    - `scheduled_start`, `scheduled_end` (ISO 8601 datetime): Planned schedule
    - `is_all_day` (boolean): All-day event flag
    - `actual_start`, `actual_end` (ISO 8601 datetime): Actual execution times
    - `notify_before_minutes` (integer): Future notification support
  - **Auto-migration**: Existing `scheduled_on`/`start_time` data automatically migrated
  - **Legacy Support**: Old fields kept for backward compatibility but deprecated
  - **CLI**: New scheduling options for `task create` and `task edit`
    - `--scheduled-start`, `--scheduled-end`: Set planned times (ISO 8601)
    - `--actual-start`, `--actual-end`: Record execution times
    - `--all-day`, `--no-all-day`: Toggle all-day event
  - **Web UI**:
    - TaskForm and ScheduleSection updated for new datetime fields
    - Calendar displays scheduled time with fallback to actual time
    - Completed tasks shown at their scheduled position
  - **Calendar Display Rules**:
    - Priority: scheduled_start > actual_start
    - Fallback: If no scheduled_end, use actual_end
    - All-day events displayed as date range without time

- **Safe Database Migration Command**: `mgtd db migrate` for applying migrations without data loss.
  - Automatic timestamped backup before migration
  - Dry-run mode with `--dry-run`
  - JSON output for scripting with `--json`
  - Skip backup with `--no-backup`
  - Idempotent: already applied migrations are skipped

### Bug Fixes

- **iOS Safari datetime input**: Fixed current time auto-fill issue with `autoComplete="off"` and unique input names

## 0.16.0 - 2025-12-06

### New Features

- **Image Attachments**: Upload and attach images to memos, tasks, and projects.
  - **Storage**: Images stored in flat structure at `~/.mgtd/attachments/{uuid}.{ext}` (PNG, JPEG, GIF, WebP supported, max 10MB)
  - **Web UI**: Paste images (Cmd+V) or drag & drop directly onto any textarea
    - Supported in MemoForm, TaskForm, ProjectForm, EditableContent, CommentSection
    - Visual feedback during drag and upload progress indicator
  - **API**: New attachment endpoints
    - `POST /api/attachments`: Upload image file
    - `GET /api/attachments/:filename`: Download image file
  - **CLI**: Absolute paths in markdown output for Claude Code compatibility

## 0.15.0 - 2025-11-29

### New Features

- **Task Demote to Memo**: Copy a task's content to create a new memo while keeping the original task unchanged.
  - **Database**: Added `demoteTask` function that creates a memo from task content (title, body, comments).
    - Auto-generates memo body with title as heading and comments in chronological order
    - Creates `derived_from` link from new memo to original task
    - Inherits labels, projects, and existing links from the original task
  - **CLI**: New `mgtd task demote` command with editor support.
    - `mgtd task demote <id>`: Opens editor with auto-generated content
    - `mgtd task demote <id> --no-editor`: Skip editor, use auto-generated content
    - `mgtd task demote <id> --body "content"`: Provide custom body
    - `mgtd task demote <id> --body-file notes.md`: Load body from file
    - `mgtd task demote <id> --label doc`: Override labels
  - **Web UI**: Added "Archive to Memo" button to TaskDetail page.
    - Navigate to editing screen before saving (like Promote to Task pattern)
    - Inherit labels, projects, and links with option to remove before saving
  - **API**: New `POST /api/tasks/:id/demote` endpoint.
    - Optional `bodyMd` and `labels` parameters
    - Returns original task and new memo ID
    - Automatically copies all existing links to the new memo

### Bug Fixes

- **API**: Added missing `endDate` parameter to `CreateTaskRequestSchema`.
- **Tests**: Fixed incorrect default status assertion in task creation test (expected `inbox`, not `open`).

## 0.14.0 - 2025-11-24

### New Features

- **Project Status and Schedule Management**: Complete project lifecycle tracking with status and date management.
  - **Database**: Added `status`, `start_date`, `end_date` columns to `projects` table.
    - Status options: `planned`, `active`, `paused`, `done`, `canceled`
    - Date validation triggers ensure `start_date <= end_date`
  - **CLI**: Enhanced project commands with status and schedule support.
    - `mgtd project create --status active --start-date 2025-01-01 --end-date 2025-12-31`
    - `mgtd project update <id> --status done`: New command for updating projects
    - `mgtd project list --status active`: Filter projects by status
    - `mgtd project view`: Display status and schedule information
  - **Web UI**:
    - Status selector in ProjectDetail header with custom dropdown styling
    - ProjectScheduleSection component matching TaskDetail UX pattern
    - ProjectsList status filter (defaults to 'active')
    - Removed bookmark filter from projects (not applicable to projects)
    - Shared StatusSelector component for consistent UI across Project/Task forms
  - **API**:
    - Updated project schemas with Zod validation for status and dates
    - PATCH `/api/projects/:id` supports status and schedule updates
    - OpenAPI specification updated with new fields

### Improvements

- **UI Consistency**: Created shared StatusSelector component used across ProjectDetail, TaskDetail, and forms
- **Better UX**: Status dropdown icon properly positioned with `pr-2` spacing
- **Code Quality**: Eliminated duplicate status selector implementations

## 0.13.0 - 2025-11-20

### New Features

- **Task Scheduling Enhancement**: Support for start time, end time, and duration.
  - **Database**: Added `start_time`, `end_time`, `duration` columns to `issues` table.
  - **CLI**: Added `--start`, `--end`, `--duration` flags to `task create` and `task edit`.
    - Auto-calculation of end time based on start time and duration.
    - `task view` displays formatted schedule (e.g., "2025-11-20 10:00 - 11:00 (60 min)").
  - **Web UI**:
    - `ScheduleSection` now supports time and duration inputs.
    - Visual display of full schedule details.
  - **API**:
    - Updated `Task` schema to include time fields.
    - Auto-calculation logic implemented in backend.

## 0.12.0 - 2025-11-19

### New Features

- **Inbox and Someday Task Statuses (#81)**: Complete GTD workflow support with two new task statuses
  - **New Statuses**:
    - `inbox`: For newly captured, unprocessed tasks (GTD capture phase)
    - `someday`: For deferred, non-actionable ideas (GTD someday/maybe list)
  - **CLI Enhancements**:
    - `mgtd task create --status inbox`: Create tasks in inbox for later triage
    - `mgtd task edit <id> --status someday`: Defer tasks to someday list
    - `mgtd task list --status inbox`: Filter by inbox or someday status
    - All 8 statuses now available: inbox, open, next, waiting, scheduled, someday, done, canceled
  - **Web UI**:
    - Status dropdown includes Inbox and Someday options in task edit/create forms
    - Status filter bar includes Inbox and Someday filter buttons
    - Project kanban view includes Inbox and Someday columns
    - Task list status labels include Inbox and Someday
    - Search input supports status:inbox and status:someday queries
    - URL filtering: `/tasks?status=inbox` and `/tasks?status=someday`
    - Memo promotion now defaults to status='inbox' (was 'open')
    - All validation functions updated to accept inbox/someday
  - **API**:
    - All endpoints accept inbox/someday: POST/PUT/GET `/api/tasks`
    - OpenAPI specification updated with new status values
    - Backward compatible: Existing 'open' tasks preserved unchanged
  - **GTD Workflow Order**: inbox → open → next → waiting → scheduled → someday → done → canceled
  - **User Benefits**:
    - Separate task capture from processing (inbox)
    - Park future ideas without cluttering active lists (someday)
    - Full GTD workflow compliance
    - No automatic migration (existing data unchanged)

---

## 0.11.0 - 2025-11-11

### New Features

- **Keyboard Shortcuts for Save and Comment Actions (#78)**: Add Cmd/Ctrl+Enter shortcuts for improved productivity
  - **Web UI Enhancements**:
    - Cmd+Enter (macOS) / Ctrl+Enter (Windows/Linux) keyboard shortcuts for all Save and Comment buttons
    - Works across all forms: TaskForm, MemoForm, ProjectForm, EditableContent, CommentSection
    - OS-aware tooltips showing correct shortcut (⌘+Enter or Ctrl+Enter)
    - `aria-keyshortcuts` attributes for screen reader accessibility
    - Prevents duplicate submissions during form submission
    - Respects existing form validation
  - **Core Infrastructure**:
    - Reusable `keyboard.ts` utilities for OS detection and shortcut handling
    - `useKeyboardShortcut` custom React hook for DRY implementation
    - Comprehensive test coverage (20 tests, all passing)
  - **User Benefits**:
    - Keyboard-focused workflow without mouse interaction
    - Faster task, memo, and project creation
    - Quick comment submission
    - Improved productivity for power users

### Bug Fixes

- Fixed KanbanView TypeError when navigating to newly created projects (undefined `project.items`)

### Documentation

- Added comprehensive feature specification in `specs/026-webui-save-comment/`
- Updated developer quickstart guide with keyboard shortcut implementation patterns

### Breaking Changes

None. All changes are backward compatible and additive only.

---

## 0.10.0 - 2025-11-04

### New Features

- **Label and Status Search (#71)**: Unified search and filtering across all interfaces with GitHub-style syntax
  - **Web UI**:
    - GitHub-style search input component with `label:value` and `status:value` syntax
    - Enter key submission for explicit search execution
    - Real-time syntax validation with helpful hints
    - Support for comma-separated labels with OR logic (`label:bug,enhancement`)
    - React Icons integration (IoSearch, IoClose)
    - Absolute positioning for hints to prevent layout shifts
    - Warning when using status filters on memos
    - Horizontal layout matching GitHub's design
    - English-only UI text
  - **CLI Commands**:
    - `mgtd task list --label bug,enhancement --status open` - Filter tasks by multiple labels and status
    - `mgtd memo list --label idea,meeting-notes` - Filter memos by multiple labels
    - Comma-separated labels for OR logic
    - Full backward compatibility
  - **API Endpoints**:
    - `GET /api/tasks?label=bug,enhancement&status=open` - Query parameter filtering for tasks
    - `GET /api/memos?label=idea,meeting-notes` - Query parameter filtering for memos
    - Comma-separated label parameters
    - Query parameter validation
  - **Database Layer**:
    - Multi-label filtering with OR logic using SQL `IN` clauses
    - Case-insensitive label matching
    - Efficient query optimization

### Documentation

- Added comprehensive filtering documentation:
  - `docs/cli-commands.md` - CLI filtering reference with examples
  - `docs/api-filtering.md` - API filtering guide with integration examples (Python, JavaScript, Shell)
  - `README.md` - Search and filtering section covering all interfaces
  - Feature specification in `specs/024-tasks-memos-label/`

### Bug Fixes

- Fixed infinite loop in TasksList component by using primitive dependency in useEffect
- Changed from auto-search to explicit Enter key submission to prevent focus loss
- Fixed layout shifts when validation hints appear by using absolute positioning

### Breaking Changes

None. All changes are backward compatible.

## 0.9.0 - 2025-10-25

### New Features

- **Project Management System (#19)**: Complete project management with CLI commands and API endpoints
  - **CLI Commands**:
    - `mgtd project create <name>` - Create projects with board or table views
    - `mgtd project list` - List all projects
    - `mgtd project view <id>` - View project details with items ordered by position
    - `mgtd project add <project-id> <issue-id>` - Add tasks/memos to projects
    - `mgtd project remove <project-id> <issue-id>` - Remove items from projects (with confirmation)
    - `mgtd project move <project-id> <issue-id>` - Reorder items with fractional positioning
    - `mgtd project delete <id>` - Delete projects (with confirmation)
  - **API Endpoints**:
    - `POST /api/projects` - Create project (201/409)
    - `GET /api/projects` - List all projects (200)
    - `GET /api/projects/:id` - Get project with items (200/404)
    - `POST /api/projects/:id/items` - Add item to project (201/404/409)
    - `PATCH /api/projects/:id/items/:issueId` - Update item position/column (200/404)
    - `DELETE /api/projects/:id/items/:issueId` - Remove item from project (204/404)
    - `DELETE /api/projects/:id` - Delete project (204/404)
  - **Features**:
    - Board view with customizable columns (default: To Do, In Progress, Done)
    - Table view for simple list organization
    - Fractional positioning for flexible item ordering (1.0, 1.5, 2.0, etc.)
    - Cascade deletion: deleting projects removes items but preserves issues
    - Interactive confirmation prompts with TTY detection
    - `--yes` flag for non-interactive mode (CI/CD friendly)
    - Full JSON output support for all CLI commands
    - Comprehensive error handling (duplicate names, not found, etc.)
    - OpenAPI 3.0 documentation in Swagger UI

### Database

- **Migration 002**: Added `view_meta` column to `projects` table
  - Stores JSON configuration for board/table views
  - Auto-applied on first command execution via `ensureDatabase()`

### API Changes

- Added "Projects" tag to OpenAPI documentation
- All project endpoints follow existing error response patterns

## 0.8.0 - 2025-10-24

### New Features

- **Link Management Web Interface (#43)**: Added complete link management UI to Web application
  - **View existing links (US1)**: Display all links for tasks and memos inline with collapsible section
    - Shows link type with icons (parent, child, related, derived from)
    - Displays direction indicators (outgoing/incoming)
    - Renders target issue titles as clickable links
    - Handles deleted issues with grayed-out styling
    - Auto-expand/collapse based on link count
    - Loading states and error handling with retry button
  - **Create new links (US2)**: Inline form for creating links without modal dialogs
    - Multi-step flow: Select link type → Enter target issue ID
    - Four link types: parent, child, relates, derived_from
    - Client-side validation (numeric ID, no self-reference)
    - API error handling with inline error messages
    - Disabled state during submission with loading indicator
  - **Delete links (US3)**: Inline confirmation for link deletion
    - Click [×] button to show confirmation prompt
    - Inline "Delete this link? [Confirm] [Cancel]" prompt
    - Loading state during deletion
    - Auto-refresh link list after deletion
    - Updates link count in section header
  - **Edge case handling**:
    - Deleted target issues displayed in gray without navigation link
    - Long titles truncated at 100 characters with hover tooltip
    - Empty states with appropriate messaging
    - Concurrent operation handling with disabled states

### Implementation Details

- **New Components** (packages/web/src/components/):
  - `LinkSection.tsx`: Main container for link management
  - `LinkItem.tsx`: Individual link display with delete functionality
  - `AddLinkInline.tsx`: Multi-step inline form for link creation
- **New Types** (packages/web/src/types/links.ts):
  - `LinkDisplayItem`: Link data with target issue info and direction
  - `LinkCreationState`: Form state management for creation flow
  - `LinkType`, `Direction`: Type definitions for link types and directions
- **New Utilities** (packages/web/src/utils/linkIcons.tsx):
  - `getLinkIcon()`: SVG icon components for each link type and direction
  - `getLinkLabel()`: Human-readable labels for link types
  - `getDirectionArrow()`: Direction indicator arrows
- **Integration** (packages/web/src/components/ItemDetail.tsx):
  - Added `LinkSection` between Labels and Body sections
  - Self-contained component following CommentSection pattern

### User Experience

- **GitHub-inspired UX**: Follows GitHub's sub-issues pattern with inline interactions
- **No modals**: All operations (create, delete) use inline forms and confirmations
- **Consistent styling**: Matches existing Web UI design with TailwindCSS
- **Mobile responsive**: Responsive flex layouts for all screen sizes
- **Performance**: Optimized with React hooks and minimal re-renders

### API Requirements

- Requires API server with link management endpoints (added in v0.6.0)
- Uses `/api/issues/:id/links` with target issue information (v0.7.0)
- Compatible with link type filtering and validation (v0.7.0)

## 0.7.0 - 2025-10-22

### New Features

- **Link Validation Enhancements (FR-013, FR-014)**: Enhanced link creation with hierarchy integrity validations
  - **Circular hierarchy detection (FR-013)**: Prevents creating cycles in parent-child relationships
    - Blocks circular links like A→B→C→A that would corrupt task hierarchies
    - Uses Recursive CTE to traverse ancestor chains up to 10 levels deep
    - Only applies to `parent` and `child` link types; `relates` and `derived_from` can still form cycles
    - Error message: "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy"
  - **Inverse duplicate prevention (FR-014)**: Prevents bidirectional parent-child relationships
    - Blocks inverse links like A parent of B + B parent of A
    - Provides more specific error for 2-node cycles than circular detection
    - Only applies to `parent` and `child` link types; `relates` links remain bidirectional by nature
    - Error message: "Cannot create inverse parent-child link: Issue #X is already a Y of Issue #Z"
  - **Validation order**: Self-ref → Source exists → Target exists → Duplicate → Inverse (V5) → Circular (V6)

- **API Feature Parity: Link Type Filtering**: Added `?type=` query parameter to `GET /api/issues/:id/links`
  - Filter links by type: `?type=parent`, `?type=child`, `?type=relates`, `?type=derived_from`
  - Returns 400 error for invalid type values (validated by Zod schema)
  - Achieves full feature parity with CLI `mgtd link list --type` command
  - Example: `GET /api/issues/5/links?type=parent` returns only parent links

- **API Enhancement: Target Issue Information**: Enhanced `GET /api/issues/:id/links` to include target issue details
  - Response now includes `targetIssue` object with `id`, `type`, and `title` fields
  - Eliminates need for additional API calls to fetch target issue information
  - Uses optimized single SQL query to fetch all target issues (avoids N+1 problem)
  - For tasks: title is taken from the task's title field
  - For memos: title is taken from first 100 characters of body_md
  - Enables Web UI to display linked issues with titles without separate API calls

### Implementation Details

- **Database Layer** (packages/db/src/linkRepository.ts):
  - Added `findInverseParentChildLink()`: Detects inverse parent-child relationships
  - Added `hasAncestor()`: Uses Recursive CTE to detect circular hierarchies with depth limit
  - Exported new validation functions from index.ts

- **Service Layer** (packages/core/src/linkService.ts):
  - Enhanced `create()` method with two new validations (V5, V6)
  - Validation runs only for hierarchical types (`parent`, `child`)
  - Non-hierarchical types (`relates`, `derived_from`) skip new validations

- **API Layer** (packages/api):
  - Added `ListLinksQuerySchema` for type filtering
  - Updated `listLinksHandler` to accept and apply query filters
  - Updated route schema with querystring validation and 400 error case
  - Enhanced `LinkWithDirectionSchema` to include `targetIssue` object
  - Modified `listLinksHandler` to fetch target issue information in single SQL query
  - SQL query uses `COALESCE(title, SUBSTR(body_md, 1, 100))` to handle both tasks and memos

### Tests

- **Database Layer**: 47 tests passing (added 3 hasAncestor unit tests)
- **Core Layer**: 33 tests passing (added 8 validation tests)
- **CLI Layer**: 7 tests passing
- **API Layer**: 107 tests passing (added 5 type filtering tests, 1 targetIssue test)
- **Total**: 194 tests passing ✅

### Performance

- Circular detection adds ~20-50ms per parent/child link creation (Recursive CTE query)
- Inverse duplicate check adds <5ms per parent/child link creation (direct SQL query)
- Non-hierarchical links (`relates`, `derived_from`) have no performance impact

### Breaking Changes

None. All enhancements are backward compatible:
- Existing links are grandfathered (not retroactively validated)
- New validations only apply to newly created parent/child links
- API query parameter is optional (defaults to no filtering)

## 0.6.0 - 2025-10-21

### New Features

- **Comment count in list endpoints**: Added `commentCount` field to GET /api/memos and GET /api/tasks responses
  - List endpoints now include the number of non-deleted comments for each memo/task
  - Individual endpoints (GET /api/memos/:id) do not include commentCount as comments are fetched separately
  - Implemented using efficient SQL subquery aggregation to avoid N+1 queries
  - Database layer: Updated `listMemos()` and `listTasks()` to calculate commentCount
  - API layer: Created separate schemas (`MemoListItemSchema`, `TaskListItemSchema`) for list responses
  - All tests passing (DB: 44, Core: 25, API: 101)

## 0.5.0 - 2025-10-18

### New Features

- **リンクコマンドの実装**: タスク・メモ間の関係性を管理する `mgtd link` コマンドを追加しました。
  - `mgtd link add --type <type> --source <id> --target <id>`: issue間のリンクを作成
    - 4つのリンクタイプをサポート: `parent` (親子階層), `child` (逆方向), `relates` (関連性), `derived_from` (派生)
    - バリデーション: 自己参照チェック、重複チェック、ID存在確認
    - `--json` フラグで作成されたリンク情報をJSON形式で出力
  - `mgtd link list <issue-id>`: 指定issueのリンク一覧を表示
    - 双方向検索（sourceとtargetの両方から検索）
    - 方向矢印付き表示（`→` outgoing, `←` incoming）
    - `--type <type>` フラグで特定タイプのみフィルタ
    - `--json` フラグで `direction` フィールド付きJSON配列を出力
  - `mgtd link remove <link-id>`: リンクをIDで削除
    - 対話的な確認プロンプト（リンク内容のプレビュー表示）
    - `--yes` フラグで確認プロンプトをスキップ
    - `--json` フラグで削除結果をJSON形式で出力

### Documentation

- README.md にlinkコマンドを追加
- docs/cli_requirement.md にlink add/list/remove の仕様を追加
- specs/008-https-github-com/ に詳細な設計ドキュメントを追加
  - spec.md: ユーザーストーリーと受け入れ基準
  - plan.md: 技術的実装計画
  - tasks.md: 25タスクの詳細な実装計画（23タスク完了）
  - quickstart.md: 手動テストシナリオ

### Tests

- Repository層テスト（packages/db/test/linkRepository.test.ts）: 14テスト
- Service層テスト（packages/core/test/linkService.test.ts）: 8テスト
- すべてのテストが合格 ✅

## 0.3.0 - 2025-10-15

### Breaking Changes

- **統合ラベル管理システム**: `memo label` および `task label` コマンドを廃止し、統合された `mgtd label` コマンドに置き換えました。
  - 削除されたコマンド: `memo label`, `memo label add`, `memo label set`, `memo label remove`, `task label`, `task label add`, `task label set`, `task label remove`
  - 新しいコマンド: `mgtd label list`, `mgtd label create`, `mgtd label set`, `mgtd label delete`
  - ラベルは memo と task の両方で共通して使用できるようになりました。

### New Features

- **`mgtd label list`**: データベース内の全ラベルを一覧表示します。
  - `--json` フラグで JSON 形式の出力をサポート
- **`mgtd label create <name>`**: 新しいラベルを作成します。
  - `--description` フラグでラベルの説明を追加可能
  - `--json` フラグで作成されたラベル情報を JSON 形式で出力
- **`mgtd label set <issue-id> <label-id>`**: memo または task にラベルを割り当てます。
  - issue-id は memo/task を自動判別
  - 冪等性を保証（重複割り当てでもエラーにならない）
  - `--json` フラグでラベル割り当て情報を JSON 形式で出力
- **`mgtd label delete <name>`**: ラベルを削除します。
  - CASCADE 削除により、関連する全ての issue からラベルが自動的に解除されます
  - `--json` フラグで削除結果を JSON 形式で出力

### Bug Fixes

- **`mgtd label list`**: ラベル ID を表示するように修正しました。
  - 以前は名前のみが表示されており、`mgtd label set` で必要な ID を確認できない問題がありました
  - 現在は `<id>\t<name>` の形式で表示されます（例: `1	bug`）

### Documentation

- README.md に統合ラベルコマンドを追加
- docs/cli_requirement.md のコマンドツリーを更新
- CLAUDE.md に「意味のある単位で小まめにコミットする」「ドキュメント（README.md、docs/）を更新する」の原則を追加

## 0.2.0 - 2025-10-14

### New Features

- **バージョン確認コマンドの追加**: CLIのバージョンを確認する機能を実装しました。
  - `mgtd --version` / `mgtd -v`: バージョン番号を表示
  - `mgtd version`: 詳細なバージョン情報を表示（Node.jsバージョン、プラットフォーム情報）
  - `mgtd version --json`: JSON形式で環境情報を出力

- **バージョン管理戦略のドキュメント化**: Fixed Versioning採用、SemVerルール、リリースプロセスを `docs/versioning.md` に記載しました。
  - README.mdから参照可能

### Tests

- バージョンコマンドの統合テスト（5テスト）を追加
- パフォーマンス検証：すべてのバージョンコマンドが100ms以内で完了

## 0.1.1 - 2025-10-14

### Breaking Changes

- **kebab-case フラグへの統一**: すべての memo コマンドのフラグを GitHub CLI 準拠の kebab-case に変更しました。
  - `--bodyFile` → `--body-file`
  - `--addLabel` → `--add-label`
  - `--removeLabel` → `--remove-label`
  - 旧 camelCase フラグを使用すると、適切なエラーメッセージと新しいフラグ名が表示されます。

- **`memo edit --set-label` の削除**: ラベルの完全置換は `memo label set` コマンドを使用してください。
  - `--setLabel` / `--set-label` を使用すると、移行ガイダンス付きのエラーメッセージが表示されます。

### New Features

- **エディタ起動の明示的制御**: `memo create`, `memo edit`, `memo comment add` に `--editor` / `--no-editor` フラグを追加しました。
  - `--editor`: body が指定されている場合でも強制的にエディタを起動します。
  - `--no-editor`: body が指定されていない場合でもエディタの起動を抑止します（エラーになります）。
  - 両フラグは相互排他的です。

### Tests

- kebab-case フラグの動作確認テスト（7テスト）を追加
- `--editor` / `--no-editor` フラグのテスト（13テスト）を追加
- `memo label set` コマンドの動作確認テスト（6テスト）を追加
- 全30テストが合格

## 0.1.0 - 2025-10-13

- 初期リリース: `mgtd init` / `mgtd memo` CLI を実装し、ローカル SQLite とメモ操作をサポート。
- CLI ヘルプを gh コマンド準拠のセクション構成に刷新し、スペース区切りのサブコマンドでも `--help` が動作するよう改善。
- `mgtd completion` コマンドと bash / zsh / fish 向けスクリプトを同梱し、コマンドから直接導入できるようにした。
- README とドキュメントを更新し、インストール手順・補完導入手順・テスト実行方法・パッケージ作成フローを明記。
- CLI の help / e2e テストを追加し、主要なコマンドと補完スクリプト生成を自動検証。
