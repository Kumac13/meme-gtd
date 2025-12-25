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
├── ShareExtension/   # Safari Share Extension
└── Shared/           # 両ターゲット共有コード
```

## 開発環境

- Xcode 15.0+
- iOS 16.0+
- Swift 5.9

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

- **Simulator**: Xcodeで直接実行
- **実機**: 開発者モードでインストール（7日ごとに再ビルド必要）
- **API接続テスト**: ホストアプリの「Test」ボタンで確認

## 注意事項

- Share Extensionのメモリ制限は120MB
- Tailscale VPNがiPhoneで接続されている必要がある
- `extractor.bundle.js`は`packages/extension`の依存関係に基づく
