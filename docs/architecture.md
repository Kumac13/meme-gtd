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

## 設計意図（変更前に理解すべき判断）

- **activity_logはappend-only**: SQLiteトリガー（`schema/009_activity_log_immutability.sql`）でUPDATE/DELETEを禁止。イベントソーシングの監査ログとして設計。
- **promote-previewはサーバ側で生成**: memo→task昇格時の本文整形（メモ本文 + `## Comments` セクション inline）は `GET /api/memos/{id}/promote-preview` が正。Web/iOS/CLIすべてこれを使ってフォーム/エディタの初期値を埋める。クライアントに整形ロジックを複製しない。昇格の実行は、Web/iOSでは preview を初期値にしたタスク作成 + `derived_from` リンク作成で構成し、CLIは `mgtd memo promote`（core直接）で行う。
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
| iOS | テストなし | `xcodebuild` でのビルド成功確認が必須の検証手段 |

Push前の必須チェックはルート `CLAUDE.md` を参照。
動作検証は必ずテスト環境で行うこと（手順: test-env スキル）。

## 変更種別ごとの影響マップ（コード追随）

| 変更内容 | 必須の追随作業（コード） | 手順 |
|---|---|---|
| DBスキーマ変更 | `schema/NNN_*.sql` 連番追加 → `packages/db` リポジトリ → `packages/shared` 型 → core → API契約チェーン | db-migration スキル |
| APIエンドポイント追加・変更 | 同期チェーン4段階すべて + テスト | api-schema-sync スキル |
| CLIコマンド追加 | `MULTIWORD_COMMANDS` 登録 + テスト + 補完 | cli-command-add スキル |
| 記事抽出ロジック変更（`packages/extension/src/`） | iOS用 `extractor.bundle.js` 再ビルド | extractor-rebuild スキル |
| 新機能・修正の完了時 | バージョンバンプ | release スキル |

ドキュメントの追随（どの変更でどのドキュメントを更新するか）は `docs/CLAUDE.md` の更新トリガー表を参照。
