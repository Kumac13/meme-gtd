# iOS開発ガイド

## 報告前のビルド確認

ユーザーへ報告・確認を求める前に、`ios/MemeGTD/` で必ずビルドとユニットテストを通す:

```bash
xcodebuild -project MemeGTD.xcodeproj -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild test -project MemeGTD.xcodeproj -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17'
```

ビルド・デプロイの完全な手順は ios-deploy スキルを使うこと。

## ファイル追加とターゲット所属

- Xcodeプロジェクトは synchronized folders 方式。フォルダに .swift を置くだけで対応ターゲットに入る（pbxproj の手編集・Xcode GUI での追加は不要）
- 同じ理由で、synchronized folder 配下（`MemeGTD/` `Shared/` `ShareExtension/`）に置いた .md 等の非ソースファイルはリソースとしてアプリバンドルに混入する。CLAUDE.md 類のドキュメントはアプリフォルダ内に置かず、この `ios/CLAUDE.md` に集約する
- 所属はフォルダで決まる: `MemeGTD/` = アプリのみ、`Shared/` = アプリ + ShareExtension 両方、`ShareExtension/` = 拡張のみ、`MemeGTDTests/` = テストのみ
- `Shared/` に置いたファイルは ShareExtension でも必ずコンパイルされる。アプリ専用の型（View / ViewModel / ConnectivityMonitor 等）を参照するコードは `Shared/` に置けない。逆に ShareExtension も使う型（AppDatabase / Settings / LocalArticleStore の書き込み側）は `Shared/` に置く（`LocalArticleStore` が Shared の insert 側と `MemeGTD/DataSources/LocalArticleStore+App.swift` の読み取り側に分割されているのはこのため）
- MainActor のデフォルト分離はアプリターゲットだけの設定。ShareExtension と MemeGTDTests は nonisolated が既定なので、`Shared/` とDB・同期層の型は明示的に `nonisolated` か actor で宣言する
- テストターゲットは既定 nonisolated。アプリの `@MainActor` 型（ViewModel / ConnectivityMonitor）に触るテストはメソッド/クラスに `@MainActor` を付ける

## 共通コンポーネント境界（新規画面・ViewModel実装前に必ず確認）

新しい画面・ViewModel を作るとき、以下は共通実装を必ず使う。既存リソースからのコピーは禁止。所有権ルールの正は `docs/architecture.md`、構造チェックは `MemeGTDTests/ComponentBoundaryTests.swift`（Xcodeテスト）と Web側 `ComponentBoundaries.test.ts`（Web CI）が実行する:

- 一覧セル（title・検索highlight・snippet・metadata行の配置）: `IssueCellLayout`
- Label / Project の複数選択modal: `MultiSelectPickerShell`
- 一覧VMの追加読込・export feedback: `IssueListStateProviding` に準拠し `performLoadMore` / `performSearchExport` を使う
- 詳細VMのLabel/Project操作: `IssueMetadataManaging`、Issue Link/URL操作: `IssueRelationManaging` の default implementation を使う（`IssueMetadataService` / `IssueRelationService` の直接構築は `Protocols/IssueDetailManaging.swift` のみ）
- `*ListViewModel.swift` / `*DetailViewModel.swift` / `*Cell.swift` の命名は走査型チェックの対象になる前提で付ける

## DataSource層

- ViewModel は `APIClient.shared` を直接呼ばず、`DataSources/` の protocol 経由でデータにアクセスする（オフライン対応・Standalone モードで実装を差し替えるためのシーム）。新しいAPI呼び出しは該当 protocol にメソッドを追加し、`Remote*DataSource` に実装する
- 例外（直呼びのまま）: ShareExtension・添付画像アップロード（`uploadImage`）・接続テスト（`testConnection`）

## APIスキーマとの手動同期

- SwiftモデルはTypeScript APIスキーマの手書きミラーで自動生成されない。API契約が変わったら対応するSwiftモデルを手動更新する（手順: api-schema-sync スキル、対応表: `docs/architecture.md`）。enum の raw value と ISO日付形式（`yyyy-MM-dd` / `yyyy-MM-dd'T'HH:mm:ss`）は文字列でバックエンドと一致させる
- 検索の `label:xxx` クエリ構文は `MemoListViewModel.parseSearchQuery` の iOS 独自実装（Web は free-text 専用に簡素化済み）。iOS の検索 UI を Web と揃える際はここを更新する

## Storage Mode（appMode）の規約

- `appMode` は初回読み取り時に解決して永続化する: インストール直後 = `standalone`、アプリを消さずアップデートした既存端末（apiUrl 残存）のみ `server`。この解決順を変えない
- Server モードは常時同期で、設定トグルはない。前提はサーバーが同期API対応版（migration 014 適用済み）であること — 旧サーバー相手では同期だけが失敗・再試行になる
- Server への切替は移行そのもの: 端末内データの全件アップロードが成功したときだけモードが確定する（失敗時は Standalone のまま。決定的 opId により再実行しても重複しない）

## ローカルDB（GRDB）と同期の規約

- GRDBマイグレーションは `001_initial` 形式の番号で `DatabaseMigrator` に登録。登録済みマイグレーションは変更せず追加のみ（サーバー `schema/` と同じ規約）
- ID規約: ViewModel が扱う整数IDは、同期済み行 = `server_id`、未同期ローカル行 = `-rowid`（負数）。UI層にこの区別を持ち込まない
- Standalone のキーワード検索はサーバーと同じ LIKE 部分一致。FTS5 にしない（unicode61 が日本語の単語境界を扱えず、サーバー側も同じ理由で LIKE を採用 — `packages/db/CLAUDE.md`）
- タスク/記事/プロジェクトは閲覧専用キャッシュ（メモだけがオフライン読み書き可）。**ただしコメントは例外で、task / article でもオフライン作成・編集・削除ができる**（sync の comment 操作は親 issue の uuid で解決され issue type を問わないため、memo コメントと同じ Outbox 経路に載る）。実装は `MemeGTD/DataSources/CommentOutbox.swift` に一元化し、memo / task / article の 3 データソースが共有する。オンライン時は従来どおりサーバー直行で、到達不能時のみ Outbox に積む。未 push のコメント（負の id）はオンラインでも編集・削除をローカルに留める（サーバーに id が無いため）。設計理由と競合ルールは `docs/architecture.md`「同期アーキテクチャ」「iOS ローカル DB」が正
- **オフライン判定の設計根拠は Apple 公式（下記）に置く。ここを変えるときは公式の記述に当たること（好みで決めない）**:
  - [Designing for Real-World Networks](https://developer.apple.com/library/archive/documentation/NetworkingInternetWeb/Conceptual/NetworkingOverview/WhyNetworkingIsHard/WhyNetworkingIsHard.html) — 「Always attempt to make a connection. Do not attempt to guess whether network service is available, and do not cache that determination.」「reachability API は preflight の手段ではない。接続を試みて判定し、失敗したら原因の診断に使う」「transient な失敗は再試行、host unreachable なら reachability のコールバックを待って自動再試行」
  - [Apple DTS: Check if iPhone has an active internet connection](https://developer.apple.com/forums/thread/733178) — 「"active internet connection" などというものは無い。NWPathMonitor が経路ありと言っても特定ホストに繋がる保証はない。特定サービス向けアプリは、そのサービスへの接続試行の結果で判断せよ（推奨）。URLSession なら `waitsForConnectivity` + `urlSession(_:taskIsWaitingForConnectivity:)` で UI を駆動せよ」
  - [Apple DTS: Checking for internet connection](https://developer.apple.com/forums/thread/99142) — 「preflight するな。ユーザーに試させてエラーを処理せよ」「reachability は false positive も false negative もある」
  - [Apple DTS: Avoiding Preflight Checks](https://developer.apple.com/forums/thread/106344) — リクエストが stall したと分かった**後**なら、サーバーへ HEAD を撃って到達性を見るのは preflight ではない
  - [QA1941](https://developer.apple.com/library/archive/qa/qa1941/_index.html) — `networkConnectionLost` は再試行対象の transient 障害。再試行は「time based / ユーザー操作 / reachability 変化」等でバックオフさせる
- オフライン読み取り専用の判定は `ConnectivityMonitor.isOfflineReadOnly`（Serverモード かつ サーバー到達不能）に一元化（`MemeGTD/Services/ConnectivityMonitor.swift`）。「オフライン」の**判定はサーバー到達性のみ**で行い、端末のネットワーク状態（NWPathMonitor）を判定に使わない: 主シグナルは実APIリクエストの結果（`APIClient` が `.apiServerReachable` / `.apiServerUnreachable` を通知。HTTPレスポンス受信=到達可、トランスポート失敗=到達不能、キャンセルは判定外）。トランスポート失敗は Apple の transient / host-unreachable の区分で扱う: **host unreachable 相当**（接続拒否・名前解決失敗・経路なし・機内モード等。`userInfo[APIClient.definitiveFailureKey]`）はそれ自体が証拠なので即座にオフラインへ反転し、**transient**（タイムアウト・接続の途中断）は `HEAD /api/health` プローブの失敗で確認してから反転する（遅いサーバーへのタイムアウト1回で全体が編集不可になるのを防ぐ）。プローブは失敗後・オフライン中にのみ撃ち、リクエスト前には撃たない（preflight 禁止の一線）。プローブ専用 URLSession は `waitsForConnectivity = true` + ephemeral + `.reloadIgnoringLocalCacheData` で、経路が無い端末は `urlSession(_:taskIsWaitingForConnectivity:)`（Apple が UI 駆動に名指しするコールバック）が即座に知らせる。**アプリのデータ通信側は `waitsForConnectivity` を使わない**: 読みはローカルミラーへ、memo / コメント書き込みは Outbox（プロセス終了をまたぐ、より強い「接続待ち」）へ落とす方が良いため（この逸脱は意図的、理由もここに置く）。オフライン中の復帰検知は自走ループのバックオフ（2/5/15/30/60秒）で行う。サーバー停止は経路イベントを生まないため時間ベースが唯一の手段（QA1941 が許容する形）。ConnectivityMonitor 自身の NWPathMonitor と `sceneDidBecomeActive()`（`MemeGTDApp` から呼ぶ）は即時プローブを撃つ「トリガー」であって判定ではない（SyncScheduler の NWPathMonitor が同期の試行トリガーであるのと同じ関係。混同しない）。サスペンド中は自走ループもリクエストも動かないため、フォアグラウンド復帰時の再判定は必須。Standalone は全機能ローカルなので読み取り専用にしない。メモ画面はオフラインでも編集可のためピルを出さない。ピルの表記は「Offline」（コメントは書けるので「Read-only」とは書かない）
- テストは `AppDatabase.makeInMemory()` を使い、通信は `SyncTransport` のモックで差し替える。テストファイルは `MemeGTDTests/` に置くだけで認識される

## 記事抽出バンドル

`packages/extension/src/` の抽出ロジックを変更したら iOS 用 `extractor.bundle.js` の再生成が必要（手順: `packages/extension/CLAUDE.md`）。忘れると iOS だけ古い抽出ロジックで動く。

## 環境メモ

- デプロイメントターゲット iOS 26.2 / Swift 5 言語モード
- App Group `group.com.memegtd.app`（設定・ローカルDBの共有）。接続先APIサーバーURLは App Group UserDefaults キー `apiUrl`（デフォルト `http://localhost:3001`）
- カラーは `Shared/Colors.swift` の定義を使用、UI文言は英語（Webと統一）
- ShareExtension のメモリ上限 120MB。実機での API 接続は Tailscale VPN が前提（実機は無料証明書のため7日ごとに再ビルドが必要）
- Simulator の DB 確認: `xcrun simctl get_app_container booted name.kumac.MemeGTD groups` でコンテナパスを取得し `sqlite3 <path>/Library/Application\ Support/MemeGTD/local.sqlite ".tables"`
