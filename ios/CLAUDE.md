# iOS開発ガイド

## ビルド必須ルール

**IMPORTANT: ユーザーへの報告・確認を求める前に、必ず`xcodebuild`でビルドして動作確認すること**

```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build
```

ビルドエラーや動作不良をユーザーに発見させない。

## コミットルール

**IMPORTANT: 変更を加えたら適宜コミットすること**

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
│   └── Utilities/    # DateFilter, Haptic等
├── ShareExtension/   # Safari Share Extension（記事保存）
└── Shared/           # 両ターゲット共有コード（APIClient / Settings / Colors / ArticleModels）
```

## <critical-safety>APIスキーマとの手動同期（最重要）</critical-safety>

**IMPORTANT: SwiftモデルはTypeScript APIスキーマの手書きミラーであり、自動生成されない。**
バックエンドのAPI契約が変わったら、対応するSwiftモデルを必ず手動で更新すること。
対応表とAPI変更時チェックリストは `docs/architecture.md` の「API契約の同期チェーン」を参照。

- 同期対象: `MemeGTD/Models/*.swift`（12ファイル）と `Shared/ArticleModels.swift`
- enumのraw value（例: `LinkType` の `"derived_from"`、`TaskStatus` の各値）は文字列でバックエンドと一致させる
- 日付はISO形式（`yyyy-MM-dd` / `yyyy-MM-dd'T'HH:mm:ss`）
- 検索の `label:xxx` クエリ構文はWeb（`packages/web/src/utils/queryParser.ts`）にも複製があるため、仕様変更時は両方更新

## 開発環境

- Xcode 26.0+
- iOS 26.0+（デプロイメントターゲットは `project.pbxproj` の `IPHONEOS_DEPLOYMENT_TARGET = 26.2`）
- Swift 5 言語モード（`SWIFT_VERSION = 5.0`）

## JavaScript Bundle更新

記事抽出ロジック（`packages/extension/src/content/extractor.ts`）を変更した場合：

```bash
cd packages/extension
pnpm exec esbuild src/ios-extractor.ts --bundle --format=iife --outfile=../../ios/MemeGTD/ShareExtension/Resources/extractor.bundle.js --target=es2020
```

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
