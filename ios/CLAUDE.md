# iOS開発ガイド

## ビルド必須ルール

ユーザーへの報告・確認を求める前に、必ず `xcodebuild` でビルドとユニットテストを実行すること。

```bash
# ios/MemeGTD/ で実行
xcodebuild -project MemeGTD.xcodeproj -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild test -project MemeGTD.xcodeproj -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17'
```

ビルド・デプロイの完全な手順は ios-deploy スキルを使うこと。

## コミットルール

- 機能追加・修正ごとにコミット
- feature branchで作業し、進捗に合わせてpush

## プロジェクト構成

```
ios/MemeGTD/
├── MemeGTD/          # ホストアプリ（SwiftUI）
│   ├── Models/       # APIレスポンスのCodableモデル（手書き・要同期）
│   ├── ViewModels/   # 一覧・詳細のViewModel
│   ├── Views/        # 画面 + Components/
│   ├── Stores/       # TaskStore / MemoStore / ArticleStore（EnvironmentObject）
│   ├── DataSources/  # データアクセス層（protocol + Remote実装 + DataSourceProvider）
│   └── Utilities/    # DateFilter, Haptic等
├── ShareExtension/   # Safari Share Extension（記事保存）
├── MemeGTDTests/     # ユニットテスト（XCTest、host = MemeGTDアプリ）
└── Shared/           # 両ターゲット共有コード（APIClient / Settings / Colors / ArticleModels / Database）
```

## DataSource層（データアクセスの抽象化）

ViewModelは `APIClient.shared` を直接呼ばず、`DataSources/` のprotocol経由でデータにアクセスする（オフライン対応・スタンドアロンモードで実装を差し替えるためのシーム）。

- **protocol群**: `MemoDataSource` / `TaskDataSource` / `ArticleDataSource` / `SearchDataSource` / `ProjectDataSource` / `LabelDataSource` / `IssueRelationsDataSource`（links / url-links / activity-log）
- **Remote実装**: `Remote*DataSource`（`APIClient.shared` の薄いラッパ。パス・メソッド・型は従来のViewModel直呼びと同一）
- **`DataSourceProvider`**: 実装を束ねるObservableObject。`MemeGTDApp` から `.environmentObject` で注入し、各Viewが `.task` 内で `viewModel.dataSources = dataSources` とセットする（既存の `viewModel.store = ...` と同じ注入パターン）。ViewModel側のデフォルト値はRemote固定なので未注入でも挙動は変わらない
- **ルール**: ViewModelに新しいAPI呼び出しを足すときは必ず該当protocolにメソッドを追加し、Remote実装を経由すること（`APIClient.shared` 直呼び禁止）。ShareExtension・添付画像アップロード（`uploadImage`）・接続テスト（`testConnection`）は対象外

## APIスキーマとの手動同期（最重要）

SwiftモデルはTypeScript APIスキーマの手書きミラーであり、自動生成されない。
バックエンドのAPI契約が変わったら、対応するSwiftモデルを必ず手動で更新すること（更新漏れは実行時のデコード失敗として現れる）。

- 手順: api-schema-sync スキル。Swiftファイル↔スキーマの完全な対応表は `docs/architecture.md` の「API契約の同期チェーン」
- enumのraw value（例: `LinkType` の `"derived_from"`、`TaskStatus` の各値）は文字列でバックエンドと一致させる
- 日付はISO形式（`yyyy-MM-dd` / `yyyy-MM-dd'T'HH:mm:ss`）
- 検索の `label:xxx` クエリ構文は `MemoListViewModel.parseSearchQuery` に iOS 独自実装として残っている（Web は free-text 専用に簡素化済みで、もう複製ではない）。iOS の検索 UI を Web と揃える際はここを更新する

## 開発環境

- デプロイメントターゲット: iOS 26.2（`project.pbxproj` の `IPHONEOS_DEPLOYMENT_TARGET`）
- Swift 5 言語モード
- Xcode: iOS 26.2 SDK を含むバージョン

## JavaScript Bundle更新

記事抽出ロジック（`packages/extension/src/` 配下）を変更した場合は、iOS用バンドルの再ビルドが必要。手順は extractor-rebuild スキルを使うこと（忘れるとiOSだけ古い抽出ロジックのまま動く）。

## 実装ルール

- **カラー**: `Shared/Colors.swift`の定義を使用（WebUIと統一）
- **設定**: App Group経由で共有（`group.com.memegtd.app`）
- **API通信**: `Shared/APIClient.swift`を使用
- **UI言語**: 英語で統一（WebUIと同様）

## Xcodeプロジェクト設定

Xcodeプロジェクト（.xcodeproj）はGUIで作成する必要がある。手順は`ios/README.md`を参照。

### 必須設定

1. **App Groups**: 両ターゲットに`group.com.memegtd.app`を追加
2. **ATS例外**: Info.plistで`NSAllowsArbitraryLoads`を有効化（HTTP接続用）
3. **Share Extension Activation Rule**: URLのみ有効化

## ローカルDB（GRDB）とオフライン同期

オフライン対応の基盤としてGRDB（SQLite）のローカルDBを持つ。動作は App Group 設定の2段階フラグで決まる:

- **`appMode`（Storage Mode、デフォルト server）**: `standalone` にするとサーバー通信ゼロで、メモ・タスク・記事・キーワード検索・ラベル・リンクが端末内DBで完結する（`LocalMemo/LocalTask/LocalArticle/LocalSearch/LocalLabel/LocalIssueRelationsDataSource`、Outboxなし）。ShareExtension も `appMode` を読み、standalone なら抽出記事を App Group の GRDB に直接保存する（`Shared/Database/LocalArticleStore.swift` — ShareExtension から参照するため Shared 所属）。未対応ドメイン（プロジェクト/セマンティック検索/promote）は `StandaloneDataSources.swift` 等の安全実装（空レスポンス + 英語エラー）。ローカルCRUD本体は `LocalMemoStore` / `LocalTaskStore` / `LocalCommentStore` / `LocalArticleStore`（Outboxを知らない）として OfflineFirst 実装と共有
- **Standalone のキーワード検索はサーバーと同じ LIKE 部分一致**（`LocalSearchDataSource`）。FTS5 は使わない — unicode61 が日本語の単語境界を扱えず、サーバー側も意図的に LIKE を採用しているため（`packages/db/CLAUDE.md`）
- **`offlineSyncEnabled`（Offline Sync Beta、serverモード内・デフォルトOFF）**: ONでメモのCRUDがローカルDB + Outbox経由になり、`Shared/Sync/` の SyncEngine（actor、push→pull）がサーバーと収束させる。OFFでは従来のオンライン専用挙動のまま

- **同期層**: `SyncTransport`（通信protocol、テストはモック）/ `SyncEngine`（push→pull、カーソル管理）/ `SyncChangeApplier`（変更フィードのGRDB適用）/ `SyncScheduler`（起動・オンライン復帰・書き込み後・pull-to-refreshでトリガ、直列化。失敗またはOutbox残ありの実行後は指数バックオフで自動再試行 — VPN復帰がネットワーク復帰イベントより遅れるため）。競合ルールとサーバー仕様は `docs/architecture.md` の「同期アーキテクチャ」が正
- **ID規約**: ViewModelが扱う整数IDは、同期済み行 = `server_id`、未同期のローカル行 = `-rowid`（負数）。UI層はこの区別を意識しない
- **注意**: DB・同期層の型はapp targetのMainActorデフォルト分離を避けるため `nonisolated`（または actor）で宣言する
- **タスク/記事/プロジェクトは閲覧専用キャッシュ**（`OfflineFirstTask/Article/ProjectDataSource`）: 読みはリモート優先、`APIError.networkError` のときのみローカルフォールバック。書き込みは到達不能時に `OfflineReadOnlyError` を投げる。設計理由（issues への REST 書き戻し禁止、projects のスナップショット方式）は `docs/architecture.md` の「iOS ローカル DB」が正
- **オフラインUI**: `Views/Components/OfflineBanner.swift` の `ConnectivityMonitor`（@MainActor、NWPathMonitor）+ `OfflineBanner`。タスク/記事画面は `offlineSyncEnabled && isOffline` のときバナー表示 + 編集UI無効化（メモ画面は編集可のため出さない）

- **配置**: App Groupコンテナ内 `Library/Application Support/MemeGTD/local.sqlite`（ShareExtensionと共有するため。アクセスはWALの`DatabasePool`）
- **アクセス層**: `Shared/Database/AppDatabase.swift`（両ターゲット所属）。テストは`AppDatabase.makeInMemory()`でin-memory DBを使う
- **マイグレーション規約**: `DatabaseMigrator`に`001_initial`形式の番号付きで登録。**登録済みマイグレーションの変更は禁止、追加のみ**（サーバー`schema/`と同じ規約）
- **スキーマ方針**: サーバーのテーブル・カラム名を1:1ミラー。ただしPKはクライアント生成UUIDv7の`uuid`列で、`server_id`を併設（詳細は実装計画のS1参照）
- Simulator上のDB確認: `xcrun simctl get_app_container booted name.kumac.MemeGTD groups` でコンテナパスを取得し `sqlite3 <path>/Library/Application\ Support/MemeGTD/local.sqlite ".tables"`

## テスト

- **ユニットテスト**: `MemeGTDTests`ターゲット（XCTest、host = MemeGTDアプリ）。実行コマンド:

```bash
# ios/MemeGTD/ で実行
xcodebuild test -project MemeGTD.xcodeproj -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17'
```

- テストファイルは `ios/MemeGTD/MemeGTDTests/` 配下に置くだけで自動認識される（synchronized folder）
- UI・API連携はSimulator/実機での手動確認が引き続き必要
- **Simulator**: Xcodeで直接実行
- **実機**: 開発者モードでインストール（7日ごとに再ビルド必要）
- **API接続テスト**: ホストアプリの「Test」ボタンで確認
- 接続先APIサーバーのURLはApp Group UserDefaults（キー`apiUrl`、デフォルト`http://localhost:3001`）で共有

## 注意事項

- Share Extensionのメモリ制限は120MB
- Tailscale VPNがiPhoneで接続されている必要がある
- `extractor.bundle.js`は`packages/extension`の依存関係に基づく
