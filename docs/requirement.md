# meme-gtd 要件定義

> 目的: プロダクト全体の要件（GTDワークフロー・機能要件・非機能要件）の定義
> 読むタイミング: 実装開始前（必須）。機能の仕様・意図を確認するとき
> 更新タイミング: 機能要件の追加・変更時

---

## 1. プロダクト概要

- **目的**: Getting Things Done (GTD) をベースにした個人用タスク管理を、ローカルファーストで実現する。
- **核心価値**: 思いついたアイデアや未整理事項をすぐに `memo` として取り込み、後続のトリアージで `task` として実行管理する。
- **対象ユーザー**: 開発者本人（単一ユーザー前提）。将来的にも GitHub 認証による本人限定利用を想定。
- **リファレンス**: GitHub Issues / Projects / CLI (`gh`) の利用体験をオマージュし、コマンド構造やオプション命名を踏襲する。

---

## 2. スコープと前提条件

- **クライアント**（実装済みのもの）:
  - CLI クライアント `mgtd`（`packages/cli`）。
  - 公開 API（OpenAPI 準拠、`packages/api`）。自動化や AI エージェントからの利用を想定。
  - Web UI（`packages/web`、React SPA）。API サーバーが同一ポートで配信する。
  - iOS アプリ + Safari Share Extension（`ios/MemeGTD`、SwiftUI）。
  - Chrome 拡張（`packages/extension`、Web 記事の保存用）。
- **データストア**:
  - ローカル SQLite（単一ファイル）が唯一のデータストア。CLI と API サーバーは同じ DB ファイルを共有する。
  - Web UI・iOS・拡張は API サーバー経由でアクセスする。CLI のみ API を経由せず直接 DB を操作する。
- **iOS の Storage Mode**（オフライン対応）:
  - **初期モード**: インストール直後は常に Standalone（インストール時点で URL は存在し得ない）。唯一の例外は「アプリを消さずにアップデートした既存端末」で、残っている apiUrl 設定を根拠に Server を維持する（既存サーバー利用者の挙動不変）。
  - **モード切替**: Settings のピッカーで切り替えられる。Server にするには URL を設定して切り替えるだけ（データはサーバーを直接読むため、入れ直した端末でも移行作業は不要）。Standalone→Server の切替 = 移行そのもの（トグル操作 → 確認 → 全データアップロード成功時のみモード確定。失敗時は何も変わらない・冪等）。Server→Standalone への切り替えは不可（試みると遮断ダイアログを表示。開発ビルドのみ検証用に許可）。
  - **Server モード**: サーバー連携（常時オフライン同期。設定トグルはない）。メモはオフラインで編集でき復帰時に自動同期、タスク/記事/プロジェクトはオフラインで閲覧専用。前提はサーバーが同期API対応版であること。
  - **Standalone モード**: サーバー不要。メモ機能（CRUD/ブックマーク/コメント/一覧フィルタ）、タスク機能（CRUD/ステータス遷移/スケジュール/ラベル/コメント）、記事（Safari 共有からのローカル保存・閲覧・削除）、キーワード検索（LIKE 部分一致・サーバーと同一意味論）、リンクが端末内 DB で完結する。メモ→タスク promote（プレビュー含む）もローカルで動作する（サーバーの整形ロジックの Swift 移植。仕様変更時は両実装を同時更新 — `docs/architecture.md` の設計意図を参照）。プロジェクト・セマンティック検索は段階的に対応予定（未対応機能は英語の案内を表示）。Server への切替時に端末内データが一方向移行される（非可逆・冪等。逆方向・複数端末マージは非対応）。
  - 両モードとも設定キー未設定の既存ユーザーは従来挙動のまま（全機能オプトイン）。
- **ユーザー管理**:
  - 単一ユーザー利用のため認証・権限管理は当面不要。閉域ネットワーク（Tailscale 等）での運用を前提とする。
  - 将来 GitHub OAuth を利用して本人のみがアクセスする構成を検討する。
- **CLI ポリシー**:
  - サブコマンド体系・オプション命名・UI 表示ルールは `gh` CLI に準拠する。
  - すべての一覧系コマンドは `--json` を必ず提供する。
  - CLI コマンドの現行仕様は `docs/cli-commands.md` に記載する（本書は全体要件のまとめ）。

---

## 3. GTD ワークフロー対応

```
stateDiagram-v2
    direction LR

    [*] --> Captured : capture_input / store(memo_pool)
    Captured --> Inbox : promote_or_define / enqueue(inbox)

    state "Triaging" as TRI
    Inbox --> TRI : start_triage

    TRI --> Trash      : decide[actionable==false && disposition=='trash'] / discard()
    TRI --> Reference  : decide[actionable==false && disposition=='reference'] / archive(reference_repo)
    TRI --> Someday    : decide[actionable==false && disposition=='someday'] / append(someday_list)

    TRI --> DefineNA   : decide[actionable==true] / define_next_action()

    state "Define Next Action" as DefineNA
    DefineNA --> DoNow     : time_check[eta<=2min] / execute_now()
    DefineNA --> Delegate  : time_check[eta>2min && owner!='me'] / delegate(owner); add(waiting_for)
    DefineNA --> PlanSelf  : time_check[eta>2min && owner=='me']

    state "Plan (Self)" as PlanSelf
    PlanSelf --> Calendar  : date_check[has_fixed_date==true] / schedule(calendar)
    PlanSelf --> Next      : date_check[has_fixed_date==false] / enqueue(next_actions)

    Someday --> TRI   : weekly_review / re-triage()
    Reference --> Reference : weekly_review / noop
    Delegate --> TRI  : weekly_review[unblocked or completed] / re-triage()
    Next --> TRI      : weekly_review[replan or split] / re-triage()
    Calendar --> TRI  : event_due / convert_to_action()

    DoNow --> Done : completed / log(history)
    Next --> Done  : done_from_list / log(history)
    Calendar --> Done : event_completed / log(history)
    Delegate --> Done : confirm_completed / log(history)
    Done --> [*]
```

- **Captured（メモプール）**: `memo` で実現。入力されたメモはすべて Captured プール（`issues.type = memo`）に蓄積され、トリアージまで未整理状態を保つ。
- **Inbox**: 実行候補の入口。`memo promote` で `task` 化された要素、または直接 `task create` された要素が `issues.type = task` として入る。
- **Triaging**: CLI や外部クライアントで `memo` を開き、実行可能性・処理手段を評価する。
- **Define Next Action**: 実行が必要なものは `memo promote` または `task create` により `task` として明確化し、Next/Waiting/Calendar などのリストに配分する。
- **レビュー**: `task list` の各フィルタや `context` コマンドを通じて、週次レビューや状態更新を行う。
- **ログ**: 完了した `task` はヒストリ記録（`comments` や `links`）で追跡可能にする。

---

## 4. 機能要件

### 4.1 メモ（Memo）

- **役割**: アイデアや未整理事項を Captured プールとして保持し、後続のトリアージ入力になる。
- **主要データ**: `issues.type = memo`、`body_md` は必須、`title` フィールドは常に `NULL`（未使用）、`status` は未使用。
- **機能要件**:
  - 新規メモの登録（本文は Markdown テキスト）。
  - メモ一覧の取得と検索（ラベル・テキスト条件、更新日時順など）。
  - 個別メモの閲覧・更新・論理削除。
  - コメント・ラベルの付与と履歴管理。
  - メモをタスクへ昇格させ、`derived_from` リンクで元メモとの関連を保つ。
- **制約**: メモ ID で `task` レコードを参照する操作は型不一致エラーとする。
- **I/O チャネル**: CLI・API とも共通スキーマを利用し、詳細な操作フローは各インターフェイス仕様（`docs/cli-commands.md`、`packages/api/docs/api/openapi.yaml`）で定義する。

### 4.2 タスク（Task）

- **役割**: Inbox 以降のアクション管理。Captured から昇格したメモ、または直接定義された作業項目を統一的に扱う。
- **主要データ**: `issues.type = task`、`title` 必須、`status` は `inbox`, `open`, `next`, `waiting`, `scheduled`, `someday`, `done`, `canceled` の8値から選択。`task_kind` は `event`（予定）/ `action`（作業）の2値。
  - **スケジュール管理** (新形式 - ISO 8601):
    - `scheduled_start` (YYYY-MM-DDTHH:MM:SS): 予定開始日時
    - `scheduled_end` (YYYY-MM-DDTHH:MM:SS): 予定終了日時
    - `is_all_day` (BOOLEAN): 終日イベントかどうか
    - `actual_start` (YYYY-MM-DDTHH:MM:SS): 実際の開始日時（手動入力または自動記録）
    - `actual_end` (YYYY-MM-DDTHH:MM:SS): 実際の終了日時（手動入力または自動記録）
  - **スケジュール管理** (旧形式 - 非推奨、後方互換性のため保持):
    - `scheduled_on` (YYYY-MM-DD): タスクの開始日
    - `end_date` (YYYY-MM-DD): タスクの終了日
    - `start_time` (HH:MM): 開始時刻
    - `end_time` (HH:MM): 終了時刻
    - `duration` (INTEGER): 所要時間（分）
- **機能要件**:
  - タスクの生成（メモ昇格または直接作成）。生成時は Inbox（初期 `status=open`）に配置。
  - タスク一覧・フィルタリング（ステータス、ラベル、プロジェクト、検索語など）。
  - タスク一覧レスポンスには `projectIds`（関連プロジェクトIDの配列）と `linkIds`（関連リンクIDの配列）を含む。
  - 詳細閲覧・更新（タイトル、本文、ステータス、予定日、ラベル、プロジェクト、コメント）。
  - 状態遷移（close/cancel/reopen 等）と履歴の記録。
- **制約**: 型検証により `memo` ID への誤操作を防止。論理削除を採用。
- **I/O チャネル**: CLI・API・外部クライアントが共通スキーマで操作する。具体的な操作手順は各インターフェイス仕様に委譲する。
- **カレンダー表示ルール**:
  - **表示優先度**: 予定時間（scheduled）を実行結果時間（actual）より優先して表示する
  - **表示判定フロー**:
    1. `is_all_day = true` → 終日イベントとして表示
    2. `scheduled_start` と `scheduled_end` の両方がある → 予定時間で時間付きイベント表示
    3. `scheduled_start` のみある（`scheduled_end` なし）→ 終日イベントとして表示（`actual_end` があっても無視）
    4. `scheduled_start` がなく `actual_start` と `actual_end` の両方がある → 実績時間で時間付きイベント表示（日付をまたぐ場合も対応）
    5. `actual_start` のみある（`actual_end` なし）→ カレンダーに表示しない（進行中タスク）
    6. 上記いずれにも該当しない → カレンダーに表示しない
  - **終日イベント**: `is_all_day = true` の場合、PlainDate として表示（時刻なし）
  - **完了タスクの表示**: 完了タスクも予定時間で表示される（実際の終了時間が異なっていても位置は予定時間ベース）

### 4.3 ラベル（Label）

- ラベルは色なしテキスト。`labels` テーブルで管理。多対多は `issue_labels`。
- CLI 及び API で create/list/delete／issue への add/set/remove を提供。

### 4.4 プロジェクト（Project）

- GitHub Projects に倣ったプロジェクトボード構成。`projects` と `project_items`。
- `project_items` は `position`, `view_meta` を保持し、リストやボード表示を再現。

### 4.5 リンク（Link）

- `parent`, `child`, `relates`, `derived_from` のリンクタイプをサポート。
- `memo promote` 時は `derived_from` を自動的に記録し、インターフェイス層から任意リンクを追加できる。

### 4.6 コメント（Comment）

- コメントの追加・編集・削除。編集時は `comment_revisions` に差分を保存して履歴を追跡する。
- 操作用の API／クライアントは共通スキーマを利用し、詳細仕様は各インターフェイスに委譲する。

### 4.7 コンテキスト（Context）

- ローカルモードでは SQLite ファイルの所在やワークスペースごとの設定を保持する。
- 設定値は `~/.config/mgtd/context.json` などのコンフィグに記録し、インターフェイス層が起動時に読み込む。
- 操作用のコマンド/API 詳細は各インターフェイス仕様で定義する。
- 初回セットアップ時は `mgtd init` で DB と設定ファイルを生成する。
- 既存 DB に新しいマイグレーションを適用するには `mgtd db migrate` を使用する（自動バックアップ付き）。
- `mgtd init --force` は DB を削除して再作成するため、既存データを保持したい場合は `mgtd db migrate` を推奨。
- **context.json スキーマの詳細**:
  - 例:
    ```json
    {
      "dbPath": "/Users/<name>/.local/share/mgtd/issues.db",
      "mode": "local",
      "schemaVersion": "001_init",
      "updatedAt": "2025-10-09T12:00:00.000Z"
    }
    ```
  - 優先順位: `CLIフラグ > 環境変数(MGTD_CONFIG_PATH, MGTD_DB_PATH, MGTD_MODE) > config > 既定値`。
  - `mode` は現状 `local` 固定。将来 `remote` を追加する場合も schemaVersion が同期の基準。
  - CLI は読み込み後に `zod` でバリデーションし、欠損値をデフォルト値で補完する。
  - `mgtd init` 実行時に最新マイグレーションを適用し、`schemaVersion` と `updatedAt` を更新する。

### 4.8 バックエンド運用ポリシー

- ローカル SQLite が唯一のデータストア。API サーバーと CLI は同じ DB ファイル（WAL モード）を共有する。
- Web UI・iOS アプリ・ブラウザ拡張は API サーバー（閉域ネットワーク上）経由でアクセスする。

### 4.9 例外・エラー

- 共通エラーメッセージは CLI / API で統一。
- ネットワーク失敗時は `API unreachable` を返し、ユーザーにバックエンド切替を促す。

### 4.10 記事（Article）

- **役割**: ブラウザ拡張（Chrome）や iOS Safari Share Extension から保存した Web 記事のアーカイブ。
- **主要データ**: `issues.type = article`、`title` 必須、`meta` に `originalUrl`（必須）、`siteName`、`archivedAt` を JSON で保持。本文は Readability で抽出した Markdown。
- **機能要件**: 保存（`POST /api/articles`）、一覧・詳細・削除、コメント・ラベル・プロジェクト・リンクの付与。

### 4.11 検索（keyword / semantic）

- **keyword 検索**: title / body_md / コメントを対象とした LIKE 部分一致。日本語の単語境界に対応するため FTS5 ではなく LIKE を採用。マッチ箇所を issue 単位でグルーピングして返す。
- **semantic 検索**: ベクトル埋め込み（title + body + comments）のコサイン類似度。OpenAI 互換 `/v1/embeddings` API（Ollama 等）で生成し、`mgtd embedding sync` で同期する（オプトイン機能）。
- CLI（`mgtd search keyword/semantic`）・API（`/api/search/*`）・Web・iOS の全クライアントから利用可能。

### 4.12 添付ファイル（画像）

- 画像アップロード（`POST /api/attachments`、multipart）と配信（`GET /api/attachments/{filename}`）を提供。
- Web UI・iOS から Markdown 本文への画像埋め込みに使用する。

### 4.13 アクティビティログ

- 全 mutation を `activity_log` テーブルにイベントとして記録する（イベントソーシング、append-only）。
- SQLite トリガーで UPDATE / DELETE を禁止し、不変性を保証する。
- 更新系イベントは `{ old, new }` 形式の差分を保持。操作元（`cli`/`api`/`system`）を記録する。
- `GET /api/activity-log` で参照でき、Web・iOS のタイムライン表示に使用する。

---

## 5. CLI インターフェイス（概要）

- ローカル環境での主要な操作窓口は `mgtd` コマンドラインとする。
- 体験方針は GitHub CLI (`gh`) に倣い、サブコマンド構造やオプション命名を踏襲する。
- 表示はテキストベースを基本とし、機械可読な JSON 形式も提供する。
- 本文編集やコメント入力など、複雑な入力は利用者のエディタ（`$EDITOR`）を起動する。
- 詳細なコマンドツリーやオプション仕様は `docs/cli-commands.md` に委譲する。

## 6. API およびデータモデル

- **共通スキーマ**: ローカル DB とリモート API は同じデータ構造を維持する。
- **テーブル**:
  - `issues`（memo / task / article 共用）:
    - 基本: `id`, `type`, `title`, `body_md`, `status`, `meta`, `created_at`, `updated_at`, `is_bookmarked`, `is_deleted`, `task_kind`
    - スケジュール (新形式): `scheduled_start`, `scheduled_end`, `is_all_day`, `actual_start`, `actual_end`, `notify_before_minutes`
    - スケジュール (旧形式/非推奨): `scheduled_on`, `start_time`, `end_date`, `end_time`, `duration`
  - `labels`, `issue_labels`, `comments`, `comment_revisions`, `links`, `url_links`, `projects`, `project_items`, `activity_log`, `issues_fts`, `issue_embeddings`
  - カラム定義・enum値の詳細は `docs/er-diagram.md`（データモデルの正）、マイグレーション SQL は `schema/` を参照。
- **ID ルール**:
  - すべてのエンティティで単一連番 ID を採用。CLI は `memo` / `task` / `article` で型チェックを実施。
  - SQLite が唯一の ID 発行源。
- **API**: エンドポイント一覧は `docs/architecture.md` のAPIエンドポイントマップ、契約の正は `packages/api/docs/api/openapi.yaml` を参照。
  - `GET /api/tasks` のレスポンスには各タスクの `projectIds` と `linkIds` を含み、AIエージェントが関連情報を参照可能。

---

## 7. 非機能要件

- **ローカル専用 CLI**: CLI はローカル SQLite に対して即時反映する。リモート環境での同期は行わない。
- **即時反映**: CLI での操作は即座に DB / API へ反映。書き込みエラー時は詳細メッセージを返す。
- **検索性能**: 横断 keyword 検索は LIKE（日本語対応のため意図的に FTS5 不使用）、semantic 検索はベクトル類似度（4.11 参照）。
- **拡張性**: API は OpenAPI 仕様を公開し、将来のクライアントから再利用できる。
- **CLI 補完**: `fish`, `zsh` 用補完スクリプトを提供。

---

## 8. 将来検討事項 / 非対応

- Google カレンダー連携（`task` の期限をカレンダーに登録）。現状は非対応、将来要件として記載。
- マルチユーザー・共有機能。単一ユーザーを前提とする。
- アプリケーションレベルの認証（GitHub OAuth 等）。現状は閉域ネットワーク前提。

## 9. HTTP API サーバー概要

- **目的**: CLI と同等の機能を REST API として公開し、自動化や外部クライアント（MCP ベースのエージェント等）から利用できるようにする。
- **構成**: `packages/api` 配下に Fastify 5 系で実装。既存の `meme-gtd-core` / `meme-gtd-db` サービスを再利用し、CLI と同じビジネスロジックを共有する。
- **エンドポイント分類**: `docs/architecture.md` のAPIエンドポイントマップを参照。
- **ドキュメント**: `pnpm openapi:generate` で `packages/api/docs/api/openapi.yaml` を生成。Swagger UI は `/api-docs` で提供。`pnpm openapi:validate` で Redocly 検証を実施。
- **運用想定**: 単一ユーザー／閉域ネットワーク（Tailscale 等）上で稼働。アプリケーションレベルの認証は今後の拡張事項とする。
- **Web UI 配信**: API サーバーが `packages/web/dist` を同一ポートで静的配信する（SPA フォールバック付き）。

---

## 10. 参照資料

- `docs/architecture.md`: リポジトリ全体のアーキテクチャと変更の波及範囲
- `docs/cli-commands.md`: CLI コマンドリファレンス
- `docs/api-filtering.md`: API フィルタリング仕様
- GTD フロー図（本ドキュメント 3章）
- GitHub CLI 公式ドキュメント

---

## 11. 用語集

- **Inbox**: `memo` で収集された未整理事項の集合。
- **Next Actions**: 実行待ちタスク。`task` の `status=next` で表現。
- **Waiting For**: 他者依存のタスク。`status=waiting`。
- **Someday/Maybe**: 将来やるかもしれない要素。`status` またはラベル運用で実現。
- **Derived From**: `memo promote` 時に張られるリンクタイプ。元メモとの追跡に使用。

---

この文書は、`meme-gtd` プロジェクト全体の要件をまとめたものであり、CLI コマンドの詳細仕様は `docs/cli-commands.md` を、実装アーキテクチャは `docs/architecture.md` を参照すること。
