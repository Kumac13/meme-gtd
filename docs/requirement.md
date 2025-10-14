# meme-gtd 要件定義

---

## 1. プロダクト概要

- **目的**: Getting Things Done (GTD) をベースにした個人用タスク管理を、ローカルファーストで実現する。
- **核心価値**: 思いついたアイデアや未整理事項をすぐに `memo` として取り込み、後続のトリアージで `task` として実行管理する。
- **対象ユーザー**: 開発者本人（単一ユーザー前提）。将来的にも GitHub 認証による本人限定利用を想定。
- **リファレンス**: GitHub Issues / Projects / CLI (`gh`) の利用体験をオマージュし、コマンド構造やオプション命名を踏襲する。

---

## 2. スコープと前提条件

- **クライアント**:
  - CLI クライアント `mgtd` を最初に実装する。
  - 公開 API（OpenAPI 準拠）を提供し、自動化や将来の MCP ベース AI クライアントから利用できるようにする。
  - Web UI は提供しない（バックエンドと CLI のみで運用する）。
- **データストア**:
  - ローカル SQLite（単一ファイル）とリモート Web API は別運用。プロダクト導入時にどちらを使うか決め、運用中に切り替えや同期は行わない。
  - CLI `mgtd` はローカル SQLite を前提としたインターフェイス。リモート API は自動化や外部クライアント（例: MCP 経由）向け。
- **ユーザー管理**:
  - 単一ユーザー利用のため認証・権限管理は当面不要。
  - 将来 GitHub OAuth を利用して本人のみがアクセスする構成を検討する。
- **CLI ポリシー**:
  - サブコマンド体系・オプション命名・UI 表示ルールは `gh` CLI に準拠する。
  - すべての一覧系コマンドは `--json` を必ず提供する。
  - CLI 詳細要件は `docs/cli_requirement.md` に記載する（本書は全体要件のまとめ）。

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
- **I/O チャネル**: CLI・API とも共通スキーマを利用し、詳細な操作フローは各インターフェイス仕様（例: `docs/cli_requirement.md`）で定義する。

### 4.2 タスク（Task）

- **役割**: Inbox 以降のアクション管理。Captured から昇格したメモ、または直接定義された作業項目を統一的に扱う。
- **主要データ**: `issues.type = task`、`title` 必須、`status` は `open`, `next`, `waiting`, `scheduled`, `done`, `canceled` から選択、必要に応じて `scheduled_on` を設定。
- **機能要件**:
  - タスクの生成（メモ昇格または直接作成）。生成時は Inbox（初期 `status=open`）に配置。
  - タスク一覧・フィルタリング（ステータス、ラベル、プロジェクト、検索語など）。
  - 詳細閲覧・更新（タイトル、本文、ステータス、予定日、ラベル、プロジェクト、コメント）。
  - 状態遷移（close/cancel/reopen 等）と履歴の記録。
- **制約**: 型検証により `memo` ID への誤操作を防止。論理削除を採用。
- **I/O チャネル**: CLI・API・外部クライアントが共通スキーマで操作する。具体的な操作手順は各インターフェイス仕様に委譲する。

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
- 初回セットアップ時は `mgtd init` で DB と設定ファイルを生成し、既存環境に対しては `--force` で再初期化できる（バックアップは利用者責任）。
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

- 初期導入時に「ローカルアプリ（SQLite）」か「リモート API サービス（Web）」のどちらかを選択し、運用中に切り替えや同期は行わない。
- CLI `mgtd` はローカル SQLite のみを対象にするため、リモート API を利用する場合は別クライアント（例: MCP 経由の AI エージェント）を用意する。

### 4.9 例外・エラー

- 共通エラーメッセージは CLI / API で統一。
- ネットワーク失敗時は `API unreachable` を返し、ユーザーにバックエンド切替を促す。

---

## 5. CLI インターフェイス（概要）

- ローカル環境での主要な操作窓口は `mgtd` コマンドラインとする。
- 体験方針は GitHub CLI (`gh`) に倣い、サブコマンド構造やオプション命名を踏襲する。
- 表示はテキストベースを基本とし、機械可読な JSON 形式も提供する。
- 本文編集やコメント入力など、複雑な入力は利用者のエディタ（`$EDITOR`）を起動する。
- 詳細なコマンドツリーやオプション仕様は `docs/cli_requirement.md` に委譲する。

## 6. API およびデータモデル

- **共通スキーマ**: ローカル DB とリモート API は同じデータ構造を維持する。
- **テーブル**:
  - `issues`: `id`, `type`, `title`, `body_md`, `status`, `scheduled_on`, `meta`, `created_at`, `updated_at`, `is_bookmarked`, `is_deleted`
  - `labels`, `issue_labels`, `comments`, `comment_revisions`, `links`, `projects`, `project_items`
- **ID ルール**:
  - すべてのエンティティで単一連番 ID を採用。CLI は `memo` / `task` で型チェックを実施。
  - デプロイ単位で ID の権威を決める。ローカル運用では SQLite が唯一の ID 発行源となり、リモートサービス運用では API 側が一意 ID を発行する。モードを跨いだ同期は行わない。
- **API**:
  - 基本エンドポイント `/issues`（`type` クエリでフィルタ）。
  - コメント、ラベル、リンク、プロジェクトなどは `/issues/{id}/comments`, `/issues/{id}/labels` 等で提供。
  - `POST /issues/{id}/promote` により memo → task 昇格をハンドリング。

---

## 7. 非機能要件

- **ローカル専用 CLI**: CLI はローカル SQLite に対して即時反映する。リモート環境での同期は行わない。
- **即時反映**: CLI での操作は即座に DB / API へ反映。書き込みエラー時は詳細メッセージを返す。
- **検索性能**: SQLite FTS5 を利用した全文検索を提供。
- **拡張性**: API は OpenAPI 仕様を公開し、将来のクライアントから再利用できる。
- **CLI 補完**: `fish`, `zsh` 用補完スクリプトを提供。

---

## 8. 将来検討事項 / 非対応

- Google カレンダー連携（`task` の期限をカレンダーに登録）。現状は非対応、将来要件として記載。
- GUI クライアント（Web など）の提供は現行スコープ外。必要になれば別計画で検討。
- 添付ファイル・画像管理。必要になった段階で別ストレージ戦略を検討。
- マルチユーザー・共有機能。単一ユーザーを前提とする。- MCP (Model Context Protocol) の採用検討。AI クライアントが CLI/API を安全に操作できるように、運用ポリシーと制御チャンネルを設計する（将来計画）。


---

## 9. 参照資料

- `docs/cli_requirement.md`: CLI コマンド仕様（`memo`, `task` ほか）
- GTD フロー図（本ドキュメント 3章）
- GitHub CLI 公式ドキュメント

---

## 10. 用語集

- **Inbox**: `memo` で収集された未整理事項の集合。
- **Next Actions**: 実行待ちタスク。`task` の `status=next` で表現。
- **Waiting For**: 他者依存のタスク。`status=waiting`。
- **Someday/Maybe**: 将来やるかもしれない要素。`status` またはラベル運用で実現。
- **Derived From**: `memo promote` 時に張られるリンクタイプ。元メモとの追跡に使用。

---

この文書は、`meme-gtd` プロジェクト全体の要件をまとめたものであり、CLI 専用の詳細仕様は `docs/cli_requirement.md` を参照すること。
