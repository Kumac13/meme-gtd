# meme-gtd アーキテクチャガイド

コーディングエージェント・開発者がこのリポジトリを自律的に動き回るための「地図」。
**実装に着手する前にこのドキュメントを読み、変更が波及する範囲を把握すること。**

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

## パッケージ一覧と責務

| パッケージ | 責務 | 主要ファイル |
|-----------|------|-------------|
| `packages/shared` | ドメイン型の唯一の定義元（`Memo`/`Task`/`Article`/`Comment`/`Label`/`Link`/`Project`/ActivityLog型）。依存なし | `src/index.ts`, `src/types/` |
| `packages/config` | 設定解決（`MGTD_CONFIG_PATH`, `DB_PATH`, `~/.config/mgtd/context.json`）。Zodで検証 | `src/index.ts` |
| `packages/logger` | pinoロガーのラッパー | `src/index.ts` |
| `packages/db` | SQLiteリポジトリ層（11リポジトリ）とマイグレーション実行 | `src/*Repository.ts`, `src/migrate.ts` |
| `packages/core` | ドメインサービス（`MemoService`/`TaskService`/`LabelService`/`ArticleService` は `src/index.ts` 内、`LinkService`/`ProjectService`/`UrlLinkService` は個別ファイル）。全mutationで `ActivityLogger` によるイベント記録。embedding/ベクトル検索 | `src/index.ts`, `src/activity-log/`, `src/embedding/` |
| `packages/api` | Fastify REST APIサーバー。Zodスキーマでバリデーション、OpenAPI specを自動生成。`packages/web/dist` をSPAとして配信 | `src/routes/`, `src/handlers/`, `src/schemas/`, `src/server.ts` |
| `packages/cli` | oclif製CLI `mgtd`（57+コマンド）。**APIサーバーを経由せず core のサービスを直接呼ぶ** | `src/commands/`, `src/index.ts` |
| `packages/web` | React 19 SPA。APIクライアントは openapi.yaml から自動生成（`src/api/` は生成物） | `src/App.tsx`, `src/pages/`, `src/components/` |
| `packages/extension` | Chrome拡張（記事保存）+ iOS ShareExtension用のJS抽出バンドルのソース | `src/background/`, `src/ios-extractor.ts` |
| `ios/MemeGTD` | SwiftUI iOSアプリ + Safari ShareExtension。**SwiftモデルはAPIスキーマの手書きミラー** | `MemeGTD/Models/`, `Shared/APIClient.swift` |
| `schema/` | SQLマイグレーションファイル（連番、`packages/db` が実行） | `NNN_*.sql` |

## データフローの重要事実

1. **CLIはHTTPを使わない**: `mgtd` は `packages/core` のサービスを直接インスタンス化してDBに書き込む。API経由ではない。よってAPIだけ直しても CLI には反映されない（逆も同様）。共通ロジックは core/db に置くこと。
2. **CLIとAPIは同一DBファイルを共有**: `MgtdConfig.dbPath` で解決（本番デフォルト: `~/.local/share/mgtd/issues.db`）。WALモードで同時アクセスに対応。
3. **Web UIはAPIサーバーが配信**: `packages/api/src/server.ts` が `packages/web/dist` を `@fastify/static` で配信。Webの変更を確認するには `pnpm build:web` が必要。
4. **全mutationはActivityLogに記録**: coreのサービスがmutation時に `ActivityLogger` でイベント（`task.created` 等）を記録する。サービスを迂回してリポジトリを直接呼ぶとログが欠落するので禁止。
5. **issuesテーブルは3タイプ共用**: `type` カラムが `memo` / `task` / `article`。Articleはブラウザ拡張・ShareExtensionから保存された記事。

## API契約の同期チェーン（最重要）

API契約は次の4段階で伝播する。**上流を変えたら下流を全て更新するまで作業は完了していない。**

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

### API変更時チェックリスト

- [ ] `packages/api/src/schemas/` のZodスキーマを変更
- [ ] ルート/ハンドラを変更（`src/routes/`, `src/handlers/`）
- [ ] 統合テストを追加・更新（`packages/api/test/integration/` — テストなしのバックエンド変更は禁止）
- [ ] `pnpm --filter meme-gtd-api openapi:generate` で openapi.yaml を再生成
- [ ] `pnpm --filter meme-gtd-api openapi:validate` で検証
- [ ] Webが該当APIを使う場合: `pnpm --filter meme-gtd-web generate:api` でクライアント再生成 + UI側の対応
- [ ] iOSが該当APIを使う場合: 対応するSwiftモデルを手動更新（下表参照）+ `xcodebuild` でビルド確認
- [ ] CLIが該当機能を持つ場合: `packages/cli/src/commands/` の対応コマンドを更新
- [ ] `README.ai.md` と `docs/`（api-filtering.md / cli-commands.md 等）を更新

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
| `KeywordSearch.swift`, `SemanticSearch.swift` | `searchSchemas.ts` |
| `ActivityLogEntry.swift` | `activityLogSchemas.ts` |

ステータス値・enum raw value（例: `"derived_from"`）は文字列で一致させる必要がある。

## 変更種別ごとの影響マップ

| 変更内容 | 必須の追随作業 |
|---|---|
| DBスキーマ変更 | `schema/NNN_*.sql` を連番で追加（既存ファイルの変更禁止）→ `packages/db` のリポジトリ → `packages/shared` の型 → core → API契約チェーン（上記） |
| APIエンドポイント追加・変更 | 上記「API変更時チェックリスト」全項目 |
| CLIコマンド追加 | `packages/cli/src/index.ts` の `MULTIWORD_COMMANDS` に登録（忘れるとスペース区切り構文が動かない）+ `docs/cli-commands.md` 更新 |
| 記事抽出ロジック変更（`packages/extension/src/`） | iOS用バンドルを再ビルドして `ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js` を更新（手順は `ios/CLAUDE.md`） |
| 新機能追加全般 | `README.md` / `README.ai.md` / 関連 `docs/` 更新 + バージョンバンプ（`docs/versioning.md`） |
| ドキュメントのみの変更 | バージョンバンプ不要 |

## 設計意図（変更前に理解すべき判断）

- **keyword検索はFTS5ではなくLIKE**: FTS5のunicode61トークナイザーが日本語の単語境界を扱えないため意図的にLIKEを採用（`packages/db/src/searchRepository.ts`）。FTS5化の提案は不要。
- **activity_logはappend-only**: SQLiteトリガー（`schema/009_activity_log_immutability.sql`）でUPDATE/DELETEを禁止。イベントソーシングの監査ログとして設計。
- **promote-previewはサーバ側で生成**: memo→task昇格時の本文整形は `GET /api/memos/{id}/promote-preview` が正。クライアント（Web/iOS/CLI）に整形ロジックを複製しない。
- **スケジュールフィールドは新形式を使う**: `scheduledStart`/`scheduledEnd`/`isAllDay`/`actualStart`/`actualEnd` が現行。`scheduledOn`/`startTime`/`endTime`/`endDate`/`duration` は非推奨（後方互換のため残存）。新規コードで旧形式を使わない。
- **embedding はオプトイン**: `mgtd embedding sync` 実行後のみセマンティック検索が機能する。設定は `~/.config/mgtd/.env`（`MGTD_EMBEDDING_URL` 等）。
- **Zodスキーマとsharedの型は意図的に別物**: sharedはドメイン型（純粋なinterface）、apiのZodはHTTP契約（バリデーションルール・ページネーション等を含む）。統合しないこと。

## テストと検証

| 対象 | 場所 | 実行コマンド |
|---|---|---|
| API統合テスト（21ファイル） | `packages/api/test/integration/` | `pnpm --filter meme-gtd-api test` |
| CLI E2E/ユニット | `packages/cli/test/` | `pnpm --filter meme-gtd-cli test` |
| Webユニット（ユーティリティ中心） | `packages/web/tests/` | `pnpm --filter meme-gtd-web test` |
| iOS | **テストなし** | `xcodebuild` でのビルド成功確認が必須の検証手段 |

Push前の必須チェックはルート `CLAUDE.md` の「Push前のローカル検証」を参照。
動作検証は必ずテスト環境（ポート3001 / `test-data/test.db` / `pnpm mgtd:test`）で行うこと（ルート `CLAUDE.md` のAI Safetyセクション参照）。

## ドキュメントの読み分け

| 知りたいこと | 参照先 |
|---|---|
| リポジトリ全体の構造・変更の波及範囲 | 本ドキュメント |
| データモデル・API一覧・検索設計（AI向け要約） | `README.ai.md` |
| プロダクト要件 | `docs/requirement.md` |
| CLIコマンドの使い方 | `docs/cli-commands.md` |
| APIフィルタリング仕様 | `docs/api-filtering.md` |
| API契約の詳細（正） | `packages/api/docs/api/openapi.yaml`（自動生成） |
| バージョニングルール | `docs/versioning.md` |
| パッケージ固有の開発ルール | 各パッケージの `CLAUDE.md` |
