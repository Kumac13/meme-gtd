# iOS MemeGTD

> 目的: iOSアプリのセットアップ・ビルド・実機インストール・デザインシステムのガイド
> 読むタイミング: iOSアプリの環境構築・実機デプロイ・デザイン変更時
> 更新タイミング: iOSのビルド要件・プロジェクト構成・デザインシステム変更時

meme-gtd のネイティブiOSアプリ。メモのタイムライン・スレッド詳細ビュー・記事保存用のSafari Share Extensionを含む。

## 動作要件

- Xcode（iOS 26.2 SDK を含むバージョン）
- iOS 26.2 以上（デプロイメントターゲット。`project.pbxproj` の `IPHONEOS_DEPLOYMENT_TARGET`）
- Tailscale（API接続用）

## プロジェクト構成

```
ios/MemeGTD/
├── MemeGTD/
│   ├── Models/             # APIレスポンスのCodableモデル（手書き・要同期）
│   ├── ViewModels/         # MemoListViewModel, MemoDetailViewModel 等
│   ├── Views/
│   │   ├── Components/     # 再利用UI
│   │   │   ├── Foundation/ # モーダル、フィードバック、作成ボタン等
│   │   │   ├── Forms/      # 作成フォームの行とsegmented picker
│   │   │   ├── Issue/      # Issue共通の時刻、ラベル、バッジ、詳細カード等
│   │   │   └── Pickers/    # 選択状態、Issue候補、外部URL入力等
│   │   ├── RootView.swift  # スライドアウトサイドメニュー付きルートコンテナ
│   │   ├── MemoListView.swift
│   │   ├── MemoDetailView.swift
│   │   ├── SettingsView.swift
│   │   └── SideMenuView.swift
│   └── Utilities/          # TimelineHelpers, HapticManager, LabelColorHelper 等
├── ShareExtension/         # Safari Share Extension
└── Shared/                 # 両ターゲット共有コード（APIClient, Settings, Colors）
```

## 主な機能

- **メモタイムライン**: 日付バケット・タイムスタンプ付きのチャット風時系列ビュー
- **スレッド詳細**: メモ本文 + コメントスレッド、ラベル/プロジェクトの情報モーダル
- **サイドメニュー**: スライドアウトドロワー
- **検索**: フリーテキスト + `label:xxx` プレフィックス検索（iOS独自実装）
- **ブックマークフィルタ**: ブックマーク済みメモのみ表示
- **Markdownレンダリング**: 見出し・強調・コードブロック・リンク・リスト
- **Safari Share Extension**: Safariから記事を直接保存

## ビルド

```bash
cd ios/MemeGTD

# Simulator
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build

# 実機
xcodebuild -scheme MemeGTD -destination 'platform=iOS,id=<DEVICE_ID>' build
```

ビルド+インストールの自動化手順は `.claude/skills/ios-deploy/SKILL.md`（設定値もここが正）。

## iPhoneへのインストール

### 1. iPhoneをMacに接続

USBケーブルが必要。

### 2. Xcodeでビルド

1. `ios/MemeGTD/MemeGTD.xcodeproj` を開く
2. デバイスドロップダウンから自分のiPhoneを選択
3. 両ターゲットのSigning Teamを設定:
   - Project Navigator → MemeGTD project → Signing & Capabilities
   - TeamにApple IDを選択
   - **MemeGTD と ShareExtension の両ターゲットで設定すること**
4. Cmd+R でビルド・実行

### 3. デベロッパーモードを有効化

初回ビルド後:

1. iPhone: 設定 → プライバシーとセキュリティ → デベロッパモード（最下部）→ ON
2. 指示に従ってiPhoneを再起動

### 4. 開発者証明書を信頼

1. iPhone: 設定 → 一般 → VPNとデバイス管理
2. 「デベロッパApp」の下の自分のApple IDをタップ
3. 「信頼」をタップ

### 5. 再度実行

Xcodeから再度ビルド・実行するとインストール・起動できる。

## 使い方

1. アプリを開き、サイドメニューの歯車アイコンからAPI URLを設定
2. タイムラインビューでメモを閲覧
3. メモをタップしてスレッド表示・コメント追加
4. 検索バーで `label:book` 構文によるラベル絞り込み
5. Safariで共有 → 「MemeGTD」で記事保存

## デプロイ（Claude Code）

Apple Developer Program 未加入のため、無料開発者証明書で署名したアプリは**7日で期限切れ**になる。定期的な再ビルド・再インストールが必要。

デプロイは ios-deploy スキルで自動化されている:

```
# Claude Code に依頼するだけ:
> deploy the ios app
```

スキルの動作: Simulator/実機を**並列**ビルド → 両方成功後に**並列**インストール → Simulatorでアプリ自動起動。

前提条件:
- iPhoneがUSBでMacに接続されている
- 両ターゲットのXcode署名設定済み（初回のみ）
- Device ID が `.claude/skills/ios-deploy/SKILL.md` に設定済み

## デザインシステム

### コンポーネントの責務

同じ意味と見た目を持つ UI は `Views/Components/` の一箇所を正とする。現在の基礎コンポーネントは次の責務に分かれる。

- `Foundation/ModalHeader`: dismiss / confirm / create のモーダルヘッダー
- `Foundation/FloatingCreateButton`: 一覧画面の作成ボタン
- `Foundation/FeedbackViews`: 一時フィードバックとローディング表示
- `Forms/FormComponents`: フォーム遷移行、空選択表示、segmented picker
- `Issue/IssueVisualComponents`: 相対時刻、ラベルチップ、Issue 種別バッジ、詳細カード、タイムライン接続線
- `Pickers/PickerComponents`: 選択インジケーター、セクション見出し、Issue 候補、外部 URL 入力

リソース別画面は共通部品を合成し、データ取得、画面遷移、シートの状態、リソース固有操作を所有する。共通部品へ `task` / `article` 等の分岐を追加して画面全体を汎用化せず、固有部分は `@ViewBuilder` の呼び出し側か個別 View に残す。

Task / Article / Template の作成画面は `CreateIssueModalHeader`、`CreateIssueTextFields`、`CreateIssueMetadataSection` を共有する。Task の schedule / links や Template の target など、リソース固有フィールドは共通フォームの間へ個別 View として差し込む。単一選択は `SingleChoiceFilterSheet`、複数選択は Label / Project picker を使い、独自のシート行をコピーしない。

一時的な UI 状態は、それを必要とする View 群の最小共通祖先が所有する。子 View へは読み取り値、`Binding`、操作 callback の順に必要最小限だけ渡す。

### Liquid Glass（iOS 26）

浮遊UI要素はすべて iOS 26 の Liquid Glass 深度エフェクトを使う。2つのプリミティブで構成:

#### `PillSurface`（ViewModifier）

浮遊要素の外観の単一情報源。任意のビューに `.modifier(PillSurface(radius:))` で適用する。

- `.glassEffect(.regular)` を使用 — 背景ブラー・エッジハイライト・深度を自動で提供
- 背景色・ボーダー・シャドウの手動指定は不要
- 適用済み: `FloatingComposer`、`BottomBar` のピル、情報サークルボタン

新しい浮遊要素（Taskアクションボタン、Projectカード等）を追加する際は `PillSurface` を使って視覚的一貫性を保つこと。

#### `safeAreaBar` + `scrollEdgeEffectStyle`（レイアウトパターン）

ボトムバーは `ZStack` オーバーレイではなく `.safeAreaBar(edge: .bottom)` 内に置く。これにより safe area インセットの自動管理・スクロールエッジの漸進ブラー・下層コンテンツの適切な背景ブラーが得られる。

新しいリストビュー（TaskListView, ProjectListView 等）を作る際はこのパターンに従う:

```swift
ScrollView {
    LazyVStack(spacing: 0) {
        // ... content ...
        Color.clear.frame(height: 1).id("bottom")
    }
}
.scrollEdgeEffectStyle(.soft, for: .bottom)
.safeAreaBar(edge: .bottom) {
    // bottom bar content here
    YourBottomBar()
        .padding(.horizontal, 16)
        .padding(.bottom, 10)
}
```

### サイドメニュー

クリーム背景（`#F5F0E8`）とコンテンツの不透明度フェードを持つスライドアウトドロワー。`SideMenuView.swift` と `RootView.swift` に実装。

## 注意事項

- **7日ルール**: 無料開発者証明書は7日で期限切れ。再ビルド・再インストールが必要
- **Tailscale**: API接続にはiPhoneでTailscale VPN接続が必要
- **Share Extensionのメモリ制限**: 120MB
- **ダークモード**: 非対応（ライトモード固定）

## JavaScript Bundleの更新

記事抽出ロジック（`packages/extension/src/` 配下）を変更した場合は、iOS用バンドルの再ビルドが必要。手順は `packages/extension/CLAUDE.md` を参照。

## トラブルシューティング

### 「信頼されていないデベロッパ」

設定 → 一般 → VPNとデバイス管理 → デベロッパApp → 信頼

### 「API URL is not configured」

アプリを開く → サイドメニュー → 歯車アイコン → API URLを設定。

### 「Network error」

- iPhoneでTailscale VPNが接続されているか確認
- APIサーバーが起動しているか確認
- URLが正しいか確認（`http://` プレフィックスを含める）

### 共有メニューにExtensionが出ない

設定 → 一般 → 共有シート → MemeGTD を有効化
