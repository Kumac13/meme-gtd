# iOSオフライン対応 実装計画書

## 1. 背景・目的

現状のiOSアプリ（`ios/MemeGTD/`、SwiftUI、デプロイターゲット iOS 26.2）は、`Shared/APIClient.swift` を経由してAPIサーバー（Fastify、Tailscale経由の自宅サーバー）に直結する**オンラインファースト設計**である。このため以下の課題がある。

- **オフライン（例: 機内）ではメモを取ることができない**
- **アプリとしてのリリース（App Store）を考えた時、外部サーバー依存は手を出しにくい**

そこで**ハイブリッド構成**を採用し、以下の4項目を実装する。

1. 現状の外部サーバー構成（サーバーモード）+ オフライン時のリカバリー
2. iOSで完全に完結するオフラインパターン（スタンドアロンモード）
3. 2から1へ移行するための手順の準備（iOSからのエクスポートとWeb版のインポート）
4. 設定画面のチュートリアル

本計画書は実装前の要件定義であり、実装は本書のタスク分解（§9）に従って実行可能単位で進める。

## 2. 前提条件

| # | 前提 | 根拠・含意 |
|---|------|-----------|
| P1 | データ規模は個人GTD（本番DB 172KB程度、数百〜数千件規模） | **全件のiOS複製が現実的**（通信量・時間ともに軽微）。「画面で読み込んだ分のみキャッシュ」という制限は設けない |
| P2 | オフライン期間は**数時間（機内）〜数日（山中）**を想定 | キュー・キャッシュはメモリ保持では不十分で**永続DB必須**。アプリ再起動・OSによる強制終了をまたいで保持し、数日分の操作キューの記録順を維持する |
| P3 | 利用者は単一だが、オフライン中にWeb側で同一データが編集される可能性はゼロではない（例: 帰宅後PCで編集→翌朝iPhoneが復帰） | 競合は稀だが、発生する前提で設計する |
| P4 | 「オフライン」には圏外だけでなく**自宅サーバー停止・Tailscale切断**も含まれる | 復帰検知はOSのネットワーク状態だけでなくAPI疎通確認も併用する |
| P5 | セマンティック検索はOllama/OpenAIのembeddingサーバーが必須 | **オフライン提供は物理的に不可**のため明示的にスコープ外 |
| P6 | 検索実装の現状: タイプ内検索=FTS5（unicode61、日本語の単語境界に弱い: Issue #76）、横断keyword検索=LIKE（日本語対応のため） | ローカル検索でも**Web版と同一の挙動**を再現する |
| P7 | `schema/001_init.sql` には当初から `sync_state` テーブル（`last_synced_at`）が存在する | データ構造はもともと同期を見据えた設計であり、本計画と整合する |

## 3. 要求

### R1: サーバーモード + オフラインリカバリー

オフライン時にできること:

- **閲覧**: オンライン時に取得していた全データ（P1により全件複製）の閲覧。数日オフラインでも全件閲覧可能
- **作成・編集**: メモ・タスクの新規作成、およびオフライン中に作成・更新したものの閲覧と**再編集**
- **返信（コメント）**: オフライン中に読み込んでいた分（サーバー由来データ）も含めた、**全ての閲覧対象**に対するコメント追加
- **ステータス変更・ブックマーク・画像添付**も同様にオフラインで操作可能

接続復帰時:

- ローカルに記録した操作を**自動でサーバーへ反映**（outboxリプレイ）。クライアント生成UUIDによる冪等化で、リトライしても二重登録されない
- **競合時（オフライン中にiOSとWebの両方が同一issueを編集）**: Last-Writer-Wins（`updated_at`比較）で新しい方を採用し、**負けた側の内容を該当issueのコメントへ退避**する（データ消失ゼロ）

### R2: スタンドアロンモード（iOS完結）

サーバーなしで、Web版と同等の機能が完全にオフラインで動作する。

**対象（すべて）**: メモ/タスクのCRUD・ステータス遷移・ブックマーク・コメント（編集履歴含む）・ラベル・issue間リンク・プロジェクトフィルタ・キーワード検索（FTS5+LIKE）・メモ→タスク昇格・**画像添付（オフライン対応）**

**対象外**: セマンティック検索（P5により物理的に不可）・記事（スコープ外として確定済み）

### R3: 移行（スタンドアロン → サーバー）

- **一回限り・不可逆の移行**である。移行先のWeb版DBは**空である前提**。空でない場合（既にサーバーを利用していた場合）は**警告を表示した上で、ユーザーが明示的に確認すれば続行できる**
- 汎用インポート機能ではなく**移行ウィザード**として設計する。重複検知・再取込は要件外
- iOS側: ローカルDBの全データ（画像同梱）をバージョン付きJSONとしてエクスポートし、ShareSheet（Files/AirDrop等）で取り出す
- Web側: 移行ウィザード画面（ファイル選択→プレビュー→実行→結果表示）+ インポートAPI

### R4: 設定画面・チュートリアル

- **初回起動はスタンドアロンモードで開始**する（モード選択画面は設けない。サーバーなしで即使え、App Store配布の想定とも整合）
- サーバーへの移行は設定画面から行う: サーバーURL設定+接続確認→移行ウィザード（エクスポート→Web取込→サーバーモード化）
- モード切替は**一方通行**（Standalone→Serverのみ）。Server→Standaloneへの切替は提供しない（「移行は不可逆」との整合、データ分裂の排除）
- サーバーモードでは同期状態を表示（最終同期時刻・未送信N件・手動同期ボタン）
- モード別のHow to use（チュートリアル）を設定画面に用意
- **UI文言はすべて英語**（CLAUDE.mdのアプリ内言語統一ルールに準拠）

## 4. 技術選定とその理由

### ローカルDB: GRDB（SQLite）

サーバーの実スキーマは素のSQLite設計である: FTS5仮想テーブル+トリガー（`schema/003_add_fts5.sql`）、`issue_labels`（多対多）、`links`（自己参照）、`project_items.position`（REAL）、`meta`（JSON）。

- **GRDB採用理由**: `schema/*.sql` をほぼそのままiOSで実行でき、FTS5検索を含めて**Web版と同一の挙動**を再現できる。エクスポート・同期もSQL行↔JSONで素直。`ValueObservation` でSwiftUIの自動更新にも対応
- **SwiftData不採用理由**: FTS5が使えず（検索は全件走査のLIKE相当のみ）、多対多・トリガーを独自モデルへ変換する層が肥大化し、サーバースキーマとの対称性が失われる（実スキーマを確認した上での判断）

### 同期方式: 自作（outboxパターン + クライアントUUID + LWW）

- 既製同期エンジン（PowerSync / ElectricSQL 等）は**Postgresバックエンド前提**であり、本プロジェクト（better-sqlite3 + 自作Fastify API）には不適合
- オフラインファーストの定石である **outboxキュー**（ローカル変更を永続キューに記録→復帰時に記録順にリプレイ）+ **クライアント生成UUIDによる冪等化** + **Last-Writer-Wins** を自作する
- 冪等化の実装: 作成系操作は `local_uuid` を `meta.clientUuid` としてサーバーへ送り、サーバー側で同一 `clientUuid` を検知した場合は既存レコードを返す

参考（調査ソース）:

- [Designing Efficient Local-First Architectures with SwiftData](https://medium.com/@gauravharkhani01/designing-efficient-local-first-architectures-with-swiftdata-cc74048526f2)
- [Offline-First Mobile App Architecture: Syncing, Caching, and Conflict Resolution](https://dev.to/odunayo_dada/offline-first-mobile-app-architecture-syncing-caching-and-conflict-resolution-518n)
- [ElectricSQL vs PowerSync](https://powersync.com/blog/electricsql-vs-powersync)
- [Key Considerations Before Using SwiftData](https://fatbobman.com/en/posts/key-considerations-before-using-swiftdata/)

## 5. アーキテクチャ

**両モードとも、UIの読み書きは常にローカルDB（GRDB）に対して行う。** サーバーモードのみ、同期エンジンが裏でローカルDBとサーバーを同期する。これによりUI・ViewModelは両モードで完全共通となり、二重実装を回避する。

```
ViewModel ── IssueRepository 等 (protocol) ── LocalStore (GRDB)   ← 両モードでUIの読み書き先
                                                  ↑
                            サーバーモード時のみ: SyncEngine
                              ├─ Pull: 全件差分複製（updated_since、sync_state.last_synced_at）
                              └─ Push: outboxを記録順にリプレイ（UUID冪等、競合処理）
                                                  ↕
                                            APIClient（既存を流用）
```

### iOS側ローカルスキーマ

`schema/001_init.sql`・`003_add_fts5.sql`（FTS5仮想テーブル+トリガー）および後続マイグレーションの該当分（007 calendar fields・010 type check・012 task_kind 等）をiOS用にバンドルして流用する。iOS専用の拡張:

- 各行に `local_uuid TEXT UNIQUE`（クライアント生成UUID。冪等性・移行・IDマッピングの基盤）と `server_id INTEGER NULL`（サーバーモードで複製した行のサーバーID。スタンドアロンではNULL）
- `outbox` テーブル: 操作種別（create / update / delete / status / comment / label / link / attachment）、payload（JSON）、`base_updated_at`（競合判定用: 操作時点での対象のupdated_at）、状態、リトライ回数、記録順
- `local_attachments` テーブル: オフライン保存画像（App Groupコンテナ内のファイルパス、アップロード済みURL）
- 既存の `sync_state` テーブルを `last_synced_at` 管理に使用（P7）

DBファイルはApp Groupコンテナ（`group.com.memegtd.app`）に配置し、ShareExtensionと共有可能にする。

### 復帰検知と同期トリガー

- `NWPathMonitor`（ネットワーク状態）+ **APIヘルスチェック**（P4: サーバー停止・Tailscale切断の検出）
- アプリのフォアグラウンド復帰時にも同期を実行

### 競合処理の手順（R1）

1. outboxのPATCH系操作のリプレイ前に、サーバーの現在の `updated_at` と outboxの `base_updated_at` を比較
2. サーバー側が更新されていた場合、**上書きされる側**（LWWで負ける側）の内容を該当issueへのコメントとして退避
3. その後、新しい `updated_at` を持つ側の内容を適用（LWW）

### 画像添付のオフライン対応

- オフライン中はApp Groupコンテナに画像を保存し、本文Markdownにローカル参照を埋め込む
- 復帰時に `/api/attachments` へアップロードし、本文中の参照をサーバーURLへ書き換える

### 制約

- ShareExtension（記事保存）は本計画のスコープ外だが、`Shared/Settings.swift`・App Group構成の変更で**壊さないこと**

## 6. エクスポートフォーマット仕様（formatVersion: 1）

```jsonc
{
  "formatVersion": 1,
  "exportedAt": "2026-06-11T00:00:00Z",
  "source": "memegtd-ios",
  "issues": [
    {
      "uuid": "...",              // local_uuid
      "type": "memo",             // 'memo' | 'task'
      "title": "...",
      "bodyMd": "...",
      "status": "inbox",          // taskのみ
      "taskKind": "action",       // taskのみ
      "scheduledStart": null, "scheduledEnd": null, "isAllDay": false,
      "actualStart": null, "actualEnd": null,
      "isBookmarked": false,
      "createdAt": "...", "updatedAt": "...",
      "labels": ["label-name"]
    }
  ],
  "comments": [
    { "uuid": "...", "issueUuid": "...", "bodyMd": "...", "createdAt": "...", "updatedAt": "..." }
  ],
  "labels": [ { "name": "...", "description": null } ],
  "links": [ { "sourceUuid": "...", "targetUuid": "...", "linkType": "relates" } ],
  "projects": [ { "name": "...", "description": null, "status": "...", "startDate": null, "endDate": null } ],
  "projectItems": [ { "projectName": "...", "issueUuid": "...", "position": 1.0 } ],
  "attachments": [ { "fileName": "...", "mimeType": "image/png", "base64": "..." } ]
}
```

- リレーションはすべて `uuid` 参照で表現する（サーバーIDはインポート時に新規採番）
- 画像はbase64で同梱する（R2で画像添付をオフライン対応とするため、移行にも画像を含める）

## 7. API変更仕様

**CLAUDE.mdの規定により、バックエンド（API/DB）の変更には必ず対応するテストを書く。**

| 変更 | 内容 |
|------|------|
| `GET /api/memos` / `GET /api/tasks` | `updated_since` クエリパラメータを追加（差分Pull用。`updated_at > updated_since` の件を返す） |
| POST系（issues・comments作成） | `meta.clientUuid` を受領し、同一 `clientUuid` の既存レコードがあれば新規作成せず既存を返す（冪等化） |
| `POST /api/import`（新設） | 移行ウィザード用。Zodで formatVersion: 1 のエクスポートJSONを検証。**DBが空でない場合（削除済みを除くissueが存在する場合）は確認フラグ（`confirmNonEmpty: true`）がない限り409で拒否し、非空である旨と件数を返す**。Web側で警告表示の上、ユーザーが明示的に確認すればフラグ付きで続行可能。トランザクションで issues / comments / labels / issue_labels / links / projects / project_items / 添付画像を一括投入し、`activity_log` に移行イベントを記録 |
| OpenAPI spec | `packages/api/docs/api/openapi.yaml` を更新し `openapi:validate` を通す |

## 8. Web変更仕様

- 新ルート `/import`（移行ウィザード）を `packages/web/src/App.tsx` に追加し、ナビゲーションに導線を置く
- フロー: ファイル選択 → クライアント側でパース+件数プレビュー → `POST /api/import` → 結果表示（成功件数 / エラー理由）
- DB非空の応答（409）を受けた場合は**警告ダイアログ**（既存データ件数と「移行は空のデータベースを前提としています」の旨）を表示し、ユーザーが明示的に確認した場合のみ `confirmNonEmpty: true` で再実行する（文言は英語）

## 9. 実行可能単位のタスク分解

1タスク = 1コミット相当。各マイルストーン完了時点でアプリが動作する状態を保つ。

### M1: ローカルDB基盤 + スタンドアロンコア（R2前半）

| ID | タスク | 主な変更対象 | 完了条件 |
|----|--------|-------------|---------|
| T1-1 | GRDBをSPMで追加（ホストアプリ+ShareExtension両ターゲット） | `MemeGTD.xcodeproj/project.pbxproj` | シミュレータビルド通過 |
| T1-2 | バンドルスキーマSQL（schema/001・003・007・010・012相当 + `local_uuid`/`server_id`列 + `outbox`/`local_attachments`テーブル）と DatabaseManager（App Groupコンテナ、WAL） | `Shared/Database/`（新規） | 起動時にDB初期化・マイグレーション実行 |
| T1-3 | Record型（Issue/Label/Comment/Link/Project等）+ LocalStoreのCRUD | `Shared/Database/` | CRUDがGRDB経由で動作 |
| T1-4 | Repositoryプロトコル定義、Memo系ViewModel（List/Create/Detail）をRepository経由に置換 | `MemeGTD/ViewModels/Memo*`, `Stores/MemoStore.swift` | スタンドアロンでメモCRUD動作 |
| T1-5 | Task系ViewModel置換 + ステータス遷移・ブックマーク | `MemeGTD/ViewModels/Task*`, `Stores/TaskStore.swift` | スタンドアロンでタスクCRUD・遷移動作 |
| T1-6 | ローカル検索（FTS5タイプ内 + LIKE横断。日本語挙動をWebと一致） | `Shared/Database/`, 検索系ViewModel | Web版と同等の検索結果 |
| T1-7 | モードのSettings永続化（App Group、既定値=Standalone）。初回起動からサーバーなしで全画面が動作 | `Shared/Settings.swift`, `MemeGTD/Views/RootView.swift` | 初回起動が選択画面なしでスタンドアロンとして動作 |

### M2: スタンドアロン完成（R2完了）

| ID | タスク | 主な変更対象 |
|----|--------|-------------|
| T2-1 | コメント（作成・編集・削除・comment_revisions）ローカル対応 | `Shared/Database/`, Detail系ViewModel |
| T2-2 | ラベル（付与/解除/一覧）ローカル対応 | 同上 |
| T2-3 | issue間リンクのローカル対応 | 同上 |
| T2-4 | プロジェクト（フィルタ・一覧）ローカル対応 | 同上 |
| T2-5 | メモ→タスク昇格（Web/CLIと同一フォーマッタ挙動）のローカル実装 | `Shared/Database/`, Memo系ViewModel |
| T2-6 | 画像添付のローカル保存（App Groupコンテナ、本文にローカル参照） | `Shared/Database/local_attachments`, 添付UI |
| T2-7 | SettingsView拡張（モード表示）+ モード別チュートリアル文言（英語） | `Views/SettingsView.swift` |

### M3: 同期エンジン（R1完了）

| ID | タスク | 主な変更対象 |
|----|--------|-------------|
| T3-1 | バックエンド: `updated_since`（memos/tasks）+ テスト + OpenAPI | `packages/api/src/routes/`, `packages/db/src/*Repository.ts`, テスト |
| T3-2 | バックエンド: `meta.clientUuid` 冪等化 + テスト | 同上 |
| T3-3 | iOS Pull（全件差分複製: issues/comments/labels/links/projects、`sync_state` 更新） | `Shared/Sync/`（新規） |
| T3-4 | 書き込み時のoutbox記録（サーバーモード時、`base_updated_at` 保存） | `Shared/Database/`, `Shared/Sync/` |
| T3-5 | Push（記録順リプレイ、UUID冪等、`server_id` 反映、失敗時リトライ） | `Shared/Sync/` |
| T3-6 | 競合処理（LWW + 負けた側をコメント退避） | `Shared/Sync/` |
| T3-7 | 画像の遅延アップロード（`/api/attachments`）と本文URL書き換え | `Shared/Sync/` |
| T3-8 | 復帰検知（NWPathMonitor + APIヘルスチェック + フォアグラウンド復帰） | `Shared/Sync/` |
| T3-9 | 同期状態UI（最終同期時刻・未送信N件・手動同期ボタン） | `Views/SettingsView.swift` |

### M4: 移行ウィザード（R3完了）

| ID | タスク | 主な変更対象 |
|----|--------|-------------|
| T4-1 | iOSエクスポート（formatVersion: 1 のJSON生成 + ShareSheet） | `Shared/Export/`（新規）, `Views/SettingsView.swift` |
| T4-2 | `POST /api/import`（Zod、非空DBガード409+`confirmNonEmpty`フラグ、トランザクション、activity_log、テスト） | `packages/api/src/routes/`, `packages/core/`, テスト |
| T4-3 | OpenAPI更新 + `openapi:validate` 通過 | `packages/api/docs/api/openapi.yaml` |
| T4-4 | Web `/import` 移行ウィザード画面（ファイル選択→プレビュー→実行→結果） | `packages/web/src/App.tsx`, 新規ページ |
| T4-5 | iOS側の移行導線（エクスポート→Web取込案内→サーバーURL設定+接続確認→サーバーモード切替→初回Pull） | `Views/SettingsView.swift`, `Shared/Settings.swift` |

### M5: 仕上げ

| ID | タスク |
|----|--------|
| T5-1 | `docs/requirement.md`・`README.md`・`README.ai.md`・`CHANGELOG.md` 更新 |
| T5-2 | minorバージョンバンプ + タグ（実装コミットと分離した `chore: bump version to vX.Y.Z` コミット） |

## 10. 検証シナリオ（受け入れ条件）

| # | シナリオ | 期待結果 |
|---|---------|---------|
| a | 機内モード数時間: オフラインでメモ作成→閲覧→再編集→コメント→復帰 | 自動同期され、二重登録なし |
| b | 数日オフライン: アプリ強制終了・再起動をまたぐ | キュー・データが保持され、全件閲覧可能 |
| c | 競合: オフライン中にWeb側で同一issueを編集→復帰 | LWW適用、負けた側の内容が該当issueのコメントに退避されている |
| d | サーバー由来issueへのオフラインコメント | 復帰時にサーバーへ反映 |
| e | スタンドアロン: サーバー未設定 | 全機能（検索・画像含む）が動作 |
| f | 移行: エクスポート→空のテストDBへWeb取込 | 件数・リレーション・画像が一致 |
| g | 移行: 非空のテストDBへ取込 | 警告が表示され、明示的確認なしでは取り込まれない。確認後は取込が完了する |

### 検証環境の厳守事項

- 検証は**必ずテスト環境**を使用: APIサーバーはポート3001（`pnpm server:dev`、`test-data/test.db`）、CLIは `pnpm mgtd:test`
- **本番DB（`~/.local/share/mgtd/issues.db`）・本番サーバー（ポート3000）には一切触れない**
- iOSはシミュレータビルド（`xcodebuild -scheme MemeGTD`）+ ネットワーク遮断/テストサーバー停止でオフラインを再現
- push前チェック（毎回）:

```bash
pnpm --filter meme-gtd-api lint && pnpm --filter meme-gtd-api openapi:validate && pnpm --filter meme-gtd-api test && pnpm build && pnpm knip
```

## 11. リスク・注意点

- **ViewModel置換の影響範囲が広い**（7 ViewModel + 3 Store）→ M1で画面単位（メモ→タスク）に段階置換し、各タスク完了時点で動作を保つ
- **iOSバンドルスキーマと `schema/*.sql` の将来乖離** → スキーマ変更時はiOS側バンドルSQLも更新する運用を `schema/CLAUDE.md` に追記する（T5-1に含める）
- **FTS5の日本語制約**はWeb版と同等（既知の制約、Issue #76）。横断検索はLIKEで補う
- **モード切替は一方通行**のため、誤ってサーバーモードへ移行した場合の救済はサーバー側データが正となる（移行前にエクスポートファイルが手元に残ることが実質のバックアップ）
