# meme-gtd アーキテクチャガイド

> 目的: リポジトリ全体の構造・変更の波及範囲・設計判断を示す「地図」（エージェント・開発者向け）
> 読むタイミング: 実装に着手する前（必須）。変更の影響範囲を判断するとき
> 更新タイミング: パッケージ追加、アーキテクチャ変更、APIエンドポイント追加・変更、iOS Swiftモデル追加時

## コンセプト

GTD (Getting Things Done) ベースのローカルファースト個人タスク管理ツール。

- **Memo**: 頭の中のアイデア・未整理事項を素早く取り込む（Inboxに入る前の状態）
- **Task**: トリアージ後の実行可能なアクション（`inbox → open/next/waiting/scheduled/someday → done/canceled` の8ステータス）
- **Article**: ブラウザ拡張 / iOS Share Extension で保存したWeb記事のアーカイブ
- **ローカルファースト**: SQLiteでデータ完全ローカル保持
- **単一ユーザー前提**: 認証なし、閉域ネットワーク（Tailscale等）での運用

## 全体像

```
                    ┌─────────────────────────────┐
                    │   packages/shared            │  ドメイン型の唯一の定義元
                    │   (Memo / Task / Article 等) │  （依存なし・型のみ）
                    └──────────────┬──────────────┘
                                   │
        ┌──────────────┬───────────┼───────────────┐
        ▼              ▼           ▼               ▼
  packages/config  packages/   packages/db    packages/core
  (環境変数・       logger     (SQLite        (Service層・
   context.json)   (pino)      リポジトリ層・   ActivityLogger・
                               マイグレーション)  embedding)
        │              │           │               │
        └──────────────┴─────┬─────┴───────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
        packages/cli                  packages/api
        (oclif, mgtd)                 (Fastify, REST API)
        ※HTTPを使わずcoreを直接呼ぶ      │ Zodスキーマ → openapi.yaml 自動生成
                                          │ Web UI (packages/web/dist) も配信
              ┌───────────────┬───────────┼───────────────┐
              ▼               ▼           ▼               ▼
        packages/web    ios/MemeGTD   ios/MemeGTD/   packages/extension
        (React SPA,     (SwiftUI       ShareExtension (Chrome拡張 +
         OpenAPIから      アプリ)       (Safari共有)     iOS用JS抽出バンドル)
         自動生成クライアント)
```

### クライアントとバックエンドへの経路

| クライアント | 場所 | バックエンドへの経路 |
|-------------|------|---------------------|
| CLI `mgtd` | `packages/cli` | core サービス直接呼び出し（HTTP非経由） |
| Web UI | `packages/web` | REST API（OpenAPIから自動生成したクライアント） |
| iOS アプリ + Share Extension | `ios/MemeGTD` | REST API（手書きSwiftモデル・要手動同期） |
| Chrome 拡張 | `packages/extension` | REST API（`POST /api/articles`） |

## パッケージ一覧と責務

| パッケージ | 責務 | 主要ファイル |
|-----------|------|-------------|
| `packages/shared` | ドメイン型の唯一の定義元（`Memo`/`Task`/`Article`/`Comment`/`Label`/`Link`/`Project`/ActivityLog型）。依存なし | `src/index.ts`, `src/types/` |
| `packages/config` | 設定解決（`MGTD_CONFIG_PATH`, `DB_PATH`, `~/.config/mgtd/context.json`）。Zodで検証 | `src/index.ts` |
| `packages/logger` | pinoロガーのラッパー | `src/index.ts` |
| `packages/db` | SQLiteリポジトリ層（`src/*Repository.ts`）とマイグレーション実行 | `src/*Repository.ts`, `src/migrate.ts` |
| `packages/core` | ドメインサービス（`MemoService`/`TaskService`/`LabelService`/`ArticleService` は `src/index.ts` 内、`LinkService`/`ProjectService`/`UrlLinkService` は個別ファイル）。全mutationで `ActivityLogger` によるイベント記録。embedding/ベクトル検索 | `src/index.ts`, `src/activity-log/`, `src/embedding/` |
| `packages/api` | Fastify REST APIサーバー。Zodスキーマでバリデーション、OpenAPI specを自動生成。`packages/web/dist` をSPAとして配信 | `src/routes/`, `src/handlers/`, `src/schemas/`, `src/server.ts` |
| `packages/cli` | oclif製CLI `mgtd`。**APIサーバーを経由せず core のサービスを直接呼ぶ** | `src/commands/`, `src/index.ts` |
| `packages/web` | React 19 SPA。APIクライアントは openapi.yaml から自動生成（`src/api/` は生成物） | `src/App.tsx`, `src/pages/`, `src/components/` |
| `packages/extension` | Chrome拡張（記事保存）+ iOS ShareExtension用のJS抽出バンドルのソース | `src/background/`, `src/ios-extractor.ts` |
| `ios/MemeGTD` | SwiftUI iOSアプリ + Safari ShareExtension。**SwiftモデルはAPIスキーマの手書きミラー** | `MemeGTD/Models/`, `Shared/APIClient.swift` |
| `schema/` | SQLマイグレーションファイル（連番、`packages/db` が実行） | `NNN_*.sql` |

## データフローの重要事実

1. **CLIはHTTPを使わない**: `mgtd` は `packages/core` のサービスを直接インスタンス化してDBに書き込む。API経由ではない。よってAPIだけ直しても CLI には反映されない（逆も同様）。共通ロジックは core/db に置くこと。
2. **CLIとAPIは同一DBファイルを共有**: `MgtdConfig.dbPath` で解決（本番デフォルト: `~/.local/share/mgtd/issues.db`）。WALモードで同時アクセスに対応。
3. **Web UIはAPIサーバーが配信**: `packages/api/src/server.ts` が `packages/web/dist` を `@fastify/static` で配信。Webの変更を確認するには `pnpm build:web` が必要。
4. **全mutationはActivityLogに記録**: coreのサービスがmutation時に `ActivityLogger` でイベント（`task.created` 等）を記録する。サービスを迂回してリポジトリを直接呼ぶとログが欠落するので禁止。
5. **issuesテーブルは3タイプ共用**: `type` カラムが `memo` / `task` / `article`。番号空間が共通なので `#id` 一つで一意に解決できる。

## API契約の同期チェーン（最重要）

API契約は次の4段階で伝播する。**上流を変えたら下流を全て更新するまで作業は完了していない。**
変更手順のチェックリストは api-schema-sync スキル（`.claude/skills/api-schema-sync/`）を使うこと。

```
[1] packages/api/src/schemas/*.ts   (Zodスキーマ = 契約の正)
     │  pnpm --filter meme-gtd-api openapi:generate
     ▼
[2] packages/api/docs/api/openapi.yaml   (自動生成・手編集禁止)
     │  pnpm --filter meme-gtd-web generate:api
     ▼
[3] packages/web/src/api/   (自動生成クライアント・手編集禁止)

[4] ios/MemeGTD/MemeGTD/Models/*.swift + ios/MemeGTD/Shared/ArticleModels.swift
     （手書き。自動生成されない。**手動で同期すること**）
```

### iOS Swiftモデル ↔ APIスキーマ対応表

| Swiftファイル（`ios/MemeGTD/MemeGTD/Models/`） | 対応するAPIスキーマ（`packages/api/src/schemas/`） |
|---|---|
| `Task.swift` | `taskSchemas.ts` |
| `Memo.swift` | `memoSchemas.ts` |
| `Article.swift`, `../Shared/ArticleModels.swift` | `articleSchemas.ts` |
| `Comment.swift` | `commentSchemas.ts` |
| `Label.swift` | `labelSchemas.ts` |
| `Link.swift`（IssueLink / UrlLink / LinkType） | `linkSchemas.ts`, `urlLinkSchemas.ts` |
| `Project.swift` | `projectSchemas.ts` |
| `KeywordSearch.swift`, `SemanticSearch.swift`, `SearchExport.swift` | `searchSchemas.ts` |
| `ActivityLogEntry.swift` | `activityLogSchemas.ts` |
| `TimelineEntry.swift` | 対応なし（iOSローカルのUI型。Comment + ActivityLogEntry の合成） |
| `../Shared/SyncModels.swift` | `syncSchemas.ts` |

ステータス値・enum raw value（例: `"derived_from"`）は文字列で一致させる必要がある。

## APIエンドポイントマップ

リソース単位の一覧（契約の正は `packages/api/docs/api/openapi.yaml`。パラメータ・レスポンス形式はそちらを参照）:

| リソース | パス |
|---|---|
| Health | `/api/health`（DB接続・スキーマバージョン。異常時503） |
| Memos | `/api/memos`, `/api/memos/{id}`, `/{id}/promote-preview`, `/{id}/bookmark`, `/{id}/unbookmark`, `/{memoId}/comments`, `/{memoId}/comments/{commentId}` |
| Tasks | `/api/tasks`, `/api/tasks/{id}`, `/{id}/close`, `/{id}/cancel`, `/{id}/reopen`, `/{id}/bookmark`, `/{id}/unbookmark`, `/{id}/demote`, `/{taskId}/comments`, `/{taskId}/comments/{commentId}` |
| Labels | `/api/labels`, `/api/labels/{name}`, `/api/issues/{issueId}/labels`, `/api/issues/{issueId}/labels/{labelId}` |
| Links | `/api/links`, `/api/links/{id}`, `/api/issues/{id}/links` |
| URL Links | `/api/issues/{id}/url-links`, `/api/url-links/{id}` |
| Projects | `/api/projects`, `/api/projects/{id}`, `/{id}/items`, `/{id}/items/{issueId}`, `/api/issues/{id}/projects` |
| Articles | `/api/articles/`, `/api/articles/{id}` |
| Attachments | `/api/attachments`（multipart画像アップロード）, `/api/attachments/{filename}`（配信） |
| Activity Log | `/api/activity-log`, `/issues/{issueId}`, `/projects/{projectId}`, `/completed-tasks` |
| Search | `/api/search/keyword`, `/api/search/semantic`, `/api/search/export` |
| Sync | `/api/sync/changes`（差分プル）, `/api/sync/push`（オフライン操作の適用） |

## 検索アーキテクチャ

| モード | 方式 | 検索対象 | 用途 |
|--------|------|---------|------|
| タイプ内一覧検索 | FTS5（`issues_fts`） | title, body_md | `mgtd task list --search`, `GET /api/tasks?search=` などの一覧フィルタ |
| 横断キーワード検索 | LIKE部分一致 | title, body_md, comments | `mgtd search keyword`, `GET /api/search/keyword` |
| セマンティック検索 | embedding + コサイン類似度 | title + body + comments 全体 | `mgtd search semantic`, `GET /api/search/semantic`（オプトイン） |

### keyword検索の設計意図

- **FTS5ではなくLIKEを採用**: FTS5のunicode61トークナイザーは日本語の単語境界を認識しないため（`packages/db/src/searchRepository.ts`）。FTS5化の提案は不要
- コメントも検索対象: mgtdのコメントは「追記メモ」として重要情報を含む
- 結果はissue単位でグルーピングし、マッチ箇所（matches配列）を切り詰めずに返す
- title/bodyMdは常に返す: マッチ内容がどのissueに属するか判断するための文脈情報

### semantic検索の設計意図

- embeddingはtitle+body_md+commentsから生成（コメントに重要情報があるため）。結果にもcomments全件を含め、embedding対象と情報を一致させる
- scoreはコサイン類似度（0-1）
- OpenAI互換 `/v1/embeddings` API（Ollama, OpenAI等）を使用。設定は `~/.config/mgtd/.env`（`MGTD_EMBEDDING_URL`, `MGTD_EMBEDDING_MODEL`, `MGTD_EMBEDDING_API_KEY`）
- 全embeddingをメモリにロードして類似度計算（~1,500件規模で実用的）。content hashで変更検知し、変わったissueのみ再生成

## 同期アーキテクチャ（iOSオフライン同期）

iOSのオフライン対応（Phase 2で導入）。iOS側はローカルDB + 保留書き込みキュー（Outbox）を持ち、**push→pull** の順で同期する。データモデル側の基盤（uuid / server_seq / tombstone、SQLiteトリガによる打刻）は `docs/er-diagram.md` の「同期基盤」を参照。

- **差分プル**: `GET /api/sync/changes?since=<server_seq>` が issues / comments / labels / issue_labels の変更を serverSeq 昇順で返す。論理削除行（`isDeleted=true`）も含めて返すためクライアントは削除を検知できる（既存の一覧エンドポイントは従来どおり `is_deleted=0` のみ）。ハード削除される labels / issue_labels は `op:'delete'` のトンボストーンとして届く。issue は type 不問で全件返す（task/article の閲覧キャッシュも同じフィードで成立）
- **push**: `POST /api/sync/push` がクライアントの保留操作（memo / comment の create / update / delete）をFIFOで適用する。op ごとに個別トランザクション（部分成功）。`opId` による冪等化（再送は記録済み結果を返す）。実装は `packages/core/src/syncService.ts`（`SyncService`）で、mutationは `MemoService` を経由するため activity log は通常どおり記録される
- **移行用 create entity**: push は `task` / `article` / `label` / `issue_label` / `link` の create-only 操作も受け付ける（iOS Standalone→Server の一方向移行用）。冪等: opId 台帳 + 自然キー（uuid / name / 組）で `alreadyApplied`、参照未解決は `skipped` + `reason`。iOS 側は `Shared/Sync/MigrationService.swift` が依存順（labels → issues → issue_labels → comments → links）・500件ページ分割・**決定的 opId**（`migrate-<entity>-<キー>`）で全件送信し、成功時のみ `appMode=server` + カーソル設定に切り替える（失敗時は Standalone のまま、再実行で重複しない）
- **競合ルール**:
  - 順序の正は `server_seq` のみ。`updatedAt` は**等値比較のみ**（大小比較禁止 — クロックスキューと秒/ミリ秒精度差を回避）
  - レコード単位 LWW。ただし**メモ本文の同時編集**はサーバー版を温存し、クライアント版を「conflicted copy」メモとして新規作成（Joplin方式・データ消失ゼロ）
  - **edit-beats-delete（双方向）**: 削除済み行への update は復活させて適用、編集済み行への stale な delete は `skipped`
  - コメントは LWW のみ（conflicted copy なし。短文で衝突頻度が低いため）
  - ブックマークのみの差分は LWW でクライアント値を適用
- クライアントは push 結果の `updatedAt` を次回編集の `baseUpdatedAt` として保存する

### iOS ローカル DB（GRDB）

- 配置: App Group `group.com.memegtd.app` コンテナ内 `Library/Application Support/MemeGTD/local.sqlite`（ShareExtension も同一 DB に書けるようにするため）。アクセス層は `ios/MemeGTD/Shared/Database/AppDatabase.swift`（`DatabasePool` + WAL、app / ShareExtension 両ターゲット所属）
- スキーマはサーバー `schema/` のテーブル・カラム名を 1:1 ミラー。ただし PK はクライアント生成 UUIDv7 の `uuid TEXT PRIMARY KEY`、`server_id INTEGER UNIQUE` を併設（オフライン作成時に ID が確定し、push 後の数値 ID 再マッピングが不要）
- マイグレーションは GRDB の `DatabaseMigrator` に `001_initial` 形式で番号登録（`schema/` と同じ「既存変更禁止・追加のみ」規約）
- Outbox は `pending_operations` テーブル、同期カーソル等は `sync_meta`。iOS のユニットテストは `MemeGTDTests` ターゲット（in-memory DB でテスト可能）
- **タスク/記事/プロジェクトは閲覧専用キャッシュ**（メモだけがオフラインで読み書き可）。読みはリモート優先で、サーバー到達不能（ネットワークエラー）のときのみローカルフォールバック。書き込みは到達不能時にエラーとし、UI は編集操作を無効化して Read-only ピルを表示する。task/article の行は差分プルが `issues` に保存するためフォールバック元は同期フィードそのもの（REST レスポンスの書き戻しはしない — 同期の帳簿と矛盾させないため）
- **Storage Mode（Server / Standalone）**: iOS は App Group 設定 `appMode` で動作モードが決まる。初回解決は「インストール直後 = standalone。ただしアプリを消さずアップデートした既存端末（apiUrl が残存）= server」で、解決結果を永続化する。切替は Settings のピッカーで行う。Standalone→Server の切替は移行そのもの（確認後に端末内データを全件バルクアップロードし、成功時のみモード確定。失敗時は Standalone のまま。冪等・一方向で、端末内データが無ければ実質切替のみ）。Server→Standalone への切替は不可（遮断ダイアログを表示。開発ビルドのみ検証用に許可）。Standalone はサーバー通信ゼロで、メモ・タスク・キーワード検索・ラベル・リンクが端末内 DB で完結する。ローカル CRUD 本体は `LocalMemoStore` / `LocalTaskStore` / `LocalCommentStore`（Outbox を知らない純粋なローカル CRUD 層）として OfflineFirst 実装と共有する。未対応ドメイン（記事/プロジェクト/セマンティック検索）は空レスポンス + 英語エラーの安全実装。Standalone の削除はハード削除（サーバー到達経路がなく tombstone の回収先がないため — Standalone→Server 移行の設計時に要考慮）
- **Standalone のキーワード検索はサーバーの LIKE 実装をミラー**（コメント本文含む、issue 単位グルーピング）。FTS5 は採用しない — サーバー自身が日本語対応のため意図的に LIKE を使っている（`packages/db/CLAUDE.md`）ので、ローカルも同じ意味論に揃える
- projects / project_items は change-feed 対象外（サーバー側ハード削除）のため、REST レスポンスのスナップショットを別テーブルにキャッシュする（`GET /api/projects` 成功ごとに全量入れ替え、所属プロジェクトは issue 単位入れ替え）

## 設計意図（変更前に理解すべき判断）

- **activity_logはappend-only**: SQLiteトリガー（`schema/009_activity_log_immutability.sql`）でUPDATE/DELETEを禁止。イベントソーシングの監査ログとして設計。
- **promote-previewはサーバ側で生成（例外: iOS Standalone）**: memo→task昇格時の本文整形（メモ本文 + `## コメント` セクション inline）は `GET /api/memos/{id}/promote-preview` が正。Web/iOS（Serverモード）/CLIすべてこれを使ってフォーム/エディタの初期値を埋める。昇格の実行は、Web/iOSでは preview を初期値にしたタスク作成 + `derived_from` リンク作成で構成し、CLIは `mgtd memo promote`（core直接）で行う。**唯一の例外は iOS Standalone モード**: サーバーが存在しないため `ios/MemeGTD/Shared/Promote/PromoteEngine.swift` に同一仕様の Swift 実装を持つ（TS 実行出力とのパリティを XCTest で固定）。**promote 整形の仕様（`buildPromoteBody` 等）を変更するときは TS と Swift の両実装 + パリティテストを同時に更新すること。** `memo.promoted` イベントは `LinkService.create` の `isPromotion` オプション（`POST /api/links` の同名フィールド）で記録する。昇格経路だけがこれを渡し、手動リンク作成や sync 移行時のリンク再作成は渡さない（リンクの形状で判定すると手動 task→memo `derived_from` を昇格と誤検出するため、呼び出し元の意図で判定する）。
- **スケジュールフィールドは新形式を使う**: `scheduledStart`/`scheduledEnd`/`isAllDay`/`actualStart`/`actualEnd` が現行。`scheduledOn`/`startTime`/`endTime`/`endDate`/`duration` は非推奨（後方互換のため残存）。新規コードで旧形式を使わない。
- **embedding はオプトイン**: `mgtd embedding sync` 実行後のみセマンティック検索が機能する。
- **Zodスキーマとsharedの型は意図的に別物**: sharedはドメイン型（純粋なinterface）、apiのZodはHTTP契約（バリデーションルール・ページネーション等を含む）。統合しないこと。
- **自動 `#id` メンション**: 本文・コメント保存時、`#123` は core サービス層（`rewriteIssueMentions`）が `[#123](/<type>/123)` に書き換え、同時に `relates` リンクを作成する。コードブロック・インラインコード・既存リンク内・`\#id`（エスケープ）・存在しないid・自己参照は変換対象外。一度作られたリンクは本文編集で `#id` が消えても残る（GitHubと同じ流儀）。
- **インタラクティブMarkdownチェックボックス（Task限定）**: Taskの本文・コメント内の `- [ ]` / `- [x]` は表示画面のままトグルできる。書き換えはクライアント側完結（Web: `packages/web/src/utils/todoMarkdown.ts`、iOS: `ios/.../Utilities/TodoMarkdown.swift`）。トグル結果は既存の `PATCH /api/tasks/{id}` 等で全文置換保存される。**インタラクティブ操作は activity log を積まない** — core層の `isInteractiveTodoChange` が old/new bodyMd を比較してログ呼び出しを抑止する。Memo・Articleは対象外。

## テストと検証

| 対象 | 場所 | 実行コマンド |
|---|---|---|
| API統合テスト | `packages/api/test/integration/` 配下 | `pnpm --filter meme-gtd-api test` |
| CLI E2E/ユニット | `packages/cli/test/` | `pnpm --filter meme-gtd-cli test` |
| Webユニット（ユーティリティ中心） | `packages/web/tests/` | `pnpm --filter meme-gtd-web test` |
| iOS ユニットテスト（DB・同期層） | `ios/MemeGTD/MemeGTDTests/` | `xcodebuild test -project MemeGTD.xcodeproj -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17'`（作業ディレクトリ `ios/MemeGTD/`） |
| iOS UI | テストなし | `xcodebuild` でのビルド成功確認 + Simulator/実機での手動確認 |

Push前の必須チェックはルート `CLAUDE.md` を参照。
動作検証は必ずテスト環境で行うこと（手順: test-env スキル）。

## 変更種別ごとの影響マップ（コード追随）

| 変更内容 | 必須の追随作業（コード） | 手順 |
|---|---|---|
| DBスキーマ変更 | `schema/NNN_*.sql` 連番追加 → `packages/db` リポジトリ → `packages/shared` 型 → core → API契約チェーン | db-migration スキル |
| APIエンドポイント追加・変更 | 同期チェーン4段階すべて + テスト | api-schema-sync スキル |
| CLIコマンド追加 | `MULTIWORD_COMMANDS` 登録 + テスト + 補完 | `packages/cli/CLAUDE.md` のチェックリスト |
| 記事抽出ロジック変更（`packages/extension/src/`） | iOS用 `extractor.bundle.js` 再ビルド | `packages/extension/CLAUDE.md` |
| 新機能・修正の完了時 | バージョンバンプ | release スキル |

ドキュメントの追随（どの変更でどのドキュメントを更新するか）は `docs/CLAUDE.md` の更新トリガー表を参照。
