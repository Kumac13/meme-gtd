# Feature Specification: PWA化 - WebUIのProgressive Web App対応

**Feature Branch**: `001-pwa-webui-progressive`
**Created**: 2025-11-26
**Status**: Draft
**Input**: User description: "PWA化 - WebUIをProgressive Web App化してホーム画面追加・オフライン対応を実現"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ホーム画面へのアプリ追加 (Priority: P1)

ユーザーとして、meme-gtdのWebUIをスマートフォンやタブレットのホーム画面に追加し、ネイティブアプリのように起動したい。これにより、ブラウザを開いてURLを入力する手間なく、アイコンをタップするだけでアプリにアクセスできる。

**Why this priority**: PWAの最も基本的かつ重要な機能。ホーム画面追加ができなければPWAとしての価値がない。iOS 26ではデフォルトでWeb App化されるため、適切なmanifestとアイコンの提供が必須。

**Independent Test**: iOSまたはAndroidデバイスで「ホーム画面に追加」を実行し、ホーム画面からアプリを起動できることを確認。ブラウザUIなしでフルスクリーン表示されれば成功。

**Acceptance Scenarios**:

1. **Given** ユーザーがSafari/Chromeでmeme-gtdにアクセスしている, **When** 「ホーム画面に追加」を選択する, **Then** アプリ名「meme-gtd」とアイコンが表示され、ホーム画面に追加される
2. **Given** ホーム画面にアプリが追加されている, **When** アイコンをタップする, **Then** ブラウザUIなしのスタンドアロンモードでアプリが起動する
3. **Given** ホーム画面からアプリを起動した, **When** アプリが表示される, **Then** ステータスバーの色がアプリのテーマカラーと一致する

---

### User Story 2 - オフライン時の基本アクセス (Priority: P2)

ユーザーとして、インターネット接続が不安定または切断されている状況でも、アプリのUIを表示したい。完全な機能は使えなくても、アプリが真っ白になったりエラー画面になったりしないようにしたい。

**Why this priority**: オフライン対応はPWAの重要な特徴だが、ユーザー要件として「最低限でいい」とのこと。静的アセットのキャッシュのみで、APIデータのオフラインキャッシュは不要。

**Independent Test**: アプリを一度読み込んだ後、機内モードにしてアプリを再起動。UIが表示されることを確認。

**Acceptance Scenarios**:

1. **Given** ユーザーが一度アプリにアクセスしている, **When** オフライン状態でアプリを開く, **Then** アプリのUI（ヘッダー、ナビゲーション等）が表示される
2. **Given** オフライン状態でアプリを開いた, **When** データ取得が必要な操作を行う, **Then** 適切なオフラインメッセージが表示される（アプリがクラッシュしない）

---

### User Story 3 - スプラッシュ画面の表示 (Priority: P3)

ユーザーとして、ホーム画面からアプリを起動した際に、ブランドを示すスプラッシュ画面が表示され、ネイティブアプリのような起動体験を得たい。

**Why this priority**: ユーザー体験の向上に寄与するが、機能的には必須ではない。manifestの設定で自動的に実現される。

**Independent Test**: ホーム画面からアプリを起動し、アプリ読み込み中にスプラッシュ画面が表示されることを確認。

**Acceptance Scenarios**:

1. **Given** ホーム画面にアプリが追加されている, **When** アイコンをタップしてアプリを起動する, **Then** アプリのアイコンとテーマカラーを使用したスプラッシュ画面が表示される

---

### Edge Cases

- オフライン状態で初めてアプリにアクセスした場合はどうなるか？→ 通常のブラウザエラー（キャッシュがないため対応不可）
- Service Workerの更新中にユーザーがアプリを使用している場合はどうなるか？→ 次回起動時に新バージョンが適用される
- ストレージ容量が不足している場合はどうなるか？→ キャッシュが保存されず、オフライン機能が動作しない（致命的ではない）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST Web App Manifestを提供し、アプリ名、アイコン、テーマカラー、表示モードを定義する
- **FR-002**: System MUST 複数サイズのPWAアイコン（192x192、512x512）を提供する
- **FR-003**: System MUST iOS向けのapple-touch-icon（180x180）を提供する
- **FR-004**: System MUST Service Workerを登録し、静的アセット（HTML、CSS、JavaScript）をキャッシュする
- **FR-005**: System MUST スタンドアロン表示モード（display: standalone）をサポートする
- **FR-006**: System MUST テーマカラーをメタタグとmanifestで定義する
- **FR-007**: System MUST iOS向けのPWAメタタグ（apple-mobile-web-app-capable等）を提供する
- **FR-008**: System MUST オフライン時に静的アセットをキャッシュから提供する
- **FR-009**: System MUST APIリクエストはキャッシュせず、常にネットワークから取得を試みる

### Key Entities

- **Web App Manifest**: アプリのメタデータを定義するJSONファイル。アプリ名、アイコン、テーマカラー、表示モード等を含む
- **Service Worker**: バックグラウンドで動作するスクリプト。キャッシュ管理とオフライン対応を担当
- **PWA Icons**: アプリを識別するためのアイコン画像。複数サイズが必要（192x192、512x512、180x180）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ユーザーがiOS/Androidでホーム画面にアプリを追加でき、スタンドアロンモードで起動できる
- **SC-002**: ホーム画面から起動したアプリがブラウザUIなしで表示される
- **SC-003**: 一度アクセスしたユーザーがオフライン時にアプリUIを表示できる（静的アセットのみ）
- **SC-004**: アプリアイコンに「M」が表示され、アプリを視覚的に識別できる
- **SC-005**: Lighthouse PWA監査で「インストール可能」の要件を満たす

## Assumptions

- テーマカラーは既存のUIで使用されている青色（#3b82f6）を採用
- アイコンデザインはシンプルな「M」文字（青背景に白文字）
- Push通知は将来対応予定のため、今回のスコープには含めない
- オフライン時のAPIキャッシュは不要（最低限の対応）
- iOS 26の「Open as Web App」デフォルト動作を考慮し、適切なmanifest設定を行う

## Out of Scope

- Push通知機能（将来対応）
- オフライン時のAPIデータキャッシュ
- バックグラウンド同期
- インストールプロンプトのカスタマイズ
