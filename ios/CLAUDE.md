# iOS開発ガイド

## ビルド必須ルール

ユーザーへの報告・確認を求める前に、必ず `xcodebuild` でビルドして動作確認すること（XCTestが無いため、ビルド成功が最低限の検証手段）。

```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build
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
└── Shared/           # 両ターゲット共有コード（APIClient / Settings / Colors / ArticleModels）
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

## テスト

- **XCTestターゲットは存在しない**。`xcodebuild`でのビルド成功確認 + Simulator/実機での手動確認が唯一の検証手段
- **Simulator**: Xcodeで直接実行
- **実機**: 開発者モードでインストール（7日ごとに再ビルド必要）
- **API接続テスト**: ホストアプリの「Test」ボタンで確認
- 接続先APIサーバーのURLはApp Group UserDefaults（キー`apiUrl`、デフォルト`http://localhost:3001`）で共有

## 注意事項

- Share Extensionのメモリ制限は120MB
- Tailscale VPNがiPhoneで接続されている必要がある
- `extractor.bundle.js`は`packages/extension`の依存関係に基づく
