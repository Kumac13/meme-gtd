# meme-gtd

GTD (Getting Things Done) ベースのローカルファースト個人タスク管理ツール。
CLI（`mgtd`）・REST API・Web UI・Chrome拡張・iOSアプリからメモ / タスク / 記事を一元管理する。
iOSのServerモードでは、圏外でもメモの記入、メモ・Task・Articleへのコメント追加、白紙・取得済みTemplateからの手動Article作成ができる。アプリの実行中または次回起動時に自動同期する。
iOS ではメモ一覧やメモ・タスク・コメントの詳細画面で本文を長押しして、選んだ範囲をコピーできる。

Taskの詳細画面（Web / iOS）では、コンテクストとして残す `Archive to Article` と、同じIssueをメモへ移す `Transfer to Memo` を選べる。コメントはどちらも本文と分けて保持する。

## 動作前提

- Node.js 22 以上（`.tool-versions` 参照）
- pnpm 10 系（バージョンは `package.json` の `packageManager` に固定）

```bash
corepack enable
```

## セットアップ手順

1. 依存インストールとビルド
   ```bash
   pnpm install
   pnpm build
   ```
2. CLI のインストール／利用
   - pnpm 経由で直接実行する場合
     ```bash
     pnpm --filter meme-gtd-cli exec node dist/index.js --help
     pnpm --filter meme-gtd-cli exec node dist/index.js memo comment --help
     pnpm --filter meme-gtd-cli exec node dist/index.js init --db ~/.local/share/mgtd/issues.db --force
     ```
   - グローバルコマンドとしてインストールする場合（推奨）
     ```bash
     pnpm run mgtd:install
     # ~/.local/bin を PATH に追加していない場合は追加
     export PATH="$HOME/.local/bin:$PATH"

     mgtd --help
     mgtd init --db ~/.local/share/mgtd/issues.db --force
     mgtd memo create --body "first memo"
     mgtd memo list --json
     mgtd memo comment add 1 --body "first comment"
     mgtd memo view 1 -c
     ```

## 運用（バックアップ・常駐化・ヘルスチェック）

```bash
# DBバックアップ（WAL安全。<DBディレクトリ>/backups に世代管理付きで保存）
mgtd db backup
mgtd db backup --list

# ヘルスチェック（APIサーバー起動中）
curl http://localhost:3000/api/health
```

- APIサーバー稼働中は24時間ごとに自動バックアップされます（`MGTD_BACKUP_ENABLED=false` で無効化）
- systemd によるAPIサーバーの常駐化テンプレート: `deploy/systemd/mgtd-api.service`
- `MGTD_LOG_FILE` を設定するとログをファイルにも出力（日次ローテーション・7世代保持）

## ブラウザ拡張機能（Webクリッパー）

Web閲覧中の記事を保存するためのChrome拡張機能が利用可能です。
インストール方法の詳細は [docs/extension-setup.md](./docs/extension-setup.md) を参照してください。

## MCP サーバー

ChatGPT・Codex・Claude などの MCP クライアントから meme-gtd を操作するためのサーバー（`packages/mcp`）。既存の REST API を呼び出すため、API サーバーが起動している必要があります。

### 起動方法

```bash
pnpm --filter meme-gtd-mcp... build
```

stdio（クライアントがプロセスを起動する方式）:

```bash
MGTD_API_URL=http://127.0.0.1:3000 node packages/mcp/dist/index.js
```

Streamable HTTP（`http://127.0.0.1:3100/mcp` で待ち受け）:

```bash
MGTD_API_URL=http://127.0.0.1:3000 MGTD_MCP_TRANSPORT=http node packages/mcp/dist/index.js
```

| 環境変数 | 既定値 | 意味 |
|---|---|---|
| `MGTD_API_URL` | なし（必須） | 接続先 API の origin。本番は `http://127.0.0.1:3000`、検証は `http://127.0.0.1:3001` |
| `MGTD_MCP_READ_ONLY` | `false` | `true` にすると読み取りツールだけを公開する |
| `MGTD_MCP_TRANSPORT` | `stdio` | `stdio` または `http` |
| `MGTD_MCP_PORT` | `3100` | HTTP の待ち受けポート |

HTTP は 127.0.0.1 だけで待ち受け、認証を持ちません。ポートを外部へ公開せず、同じマシン上のクライアント（OpenAI の Secure MCP Tunnel の `tunnel-client` など）から接続してください。

### 公開するツール

Task とそのコメントは作成・変更でき、それ以外は読み取りと関連付けに限ります。

| 対象 | 読み取り | 書き込み |
|---|---|---|
| Task | `list_tasks` `get_task` | `create_task` `update_task` `delete_task` `close_task` `cancel_task` `reopen_task` `bookmark_task` `unbookmark_task` |
| コメント | `list_task_comments` `list_memo_comments` `list_article_comments` | `create_task_comment` `update_task_comment` `delete_task_comment` |
| Memo・Article・Template | `list_memos` `get_memo` `list_articles` `get_article` `list_templates` `get_template` | なし |
| Project | `list_projects` `get_project` `get_projects_for_issue` | `add_project_item`、Task のみ `update_project_item` `remove_project_item` |
| Issue リンク | `list_issue_links` `get_link` `get_links_graph` | `create_link`、Task のみ `delete_link` |
| 外部 URL | `list_url_links` `get_url_link` | `create_url_link`、Task のみ `update_url_link` `delete_url_link` |
| Label | `list_labels` | `assign_label_to_issue`、Task のみ `remove_label_from_issue` |
| Activity・検索 | `list_activity_log` `get_issue_activity_log` `get_project_activity_log` `get_completed_tasks` `get_activity_log_entry` `keyword_search` | なし |

## Web UI

### 起動方法

1. 全パッケージをビルド
   ```bash
   pnpm install
   pnpm build
   ```
2. APIサーバーを起動
   ```bash
   pnpm run server:start
   ```
3. ブラウザで `http://localhost:3000` にアクセス

### 機能

- Memo/Task/Article 一覧・詳細・作成・編集・削除（Markdown表示）
- Web と iOS の Task 詳細で、本文とコメントの Markdown 表を表示
- Task / Article の作成時テンプレート
- コメント投稿・編集・削除、Bookmark、Task Status変更
- Link管理（親子関係・関連付け）、Project管理（Board/Tableビュー対応）
- Web・iOS の詳細で、本文とコメントの内部参照に Links と同じタイトルを表示
- Links タブで Task・Memo・Article の関係をグラフ表示。詳細の Show Links から起点を指定し、Depth や検索、ラベル、プロジェクト、ブックマークで絞り込み
- カレンダー表示（予定/実績）、アクティビティログ表示（リンク先の種別・ID・タイトル、メモは本文の先頭30文字）
- 検索: フリーテキスト検索 + ラベル・ステータスの専用フィルタUI（ドロップダウン）

## 検索とフィルタリング

検索の入口はインターフェースごとに異なります。

| インターフェース | 使い方 | 詳細 |
|---|---|---|
| Web UI | 検索ボックスはフリーテキスト専用。ラベル・ステータスはドロップダウンで絞り込み | — |
| CLI | `--label` / `--status` / `--search` フラグ、横断検索は `mgtd search keyword` | [docs/cli-commands.md](./docs/cli-commands.md) |
| API | クエリパラメータ（`?label=` / `?status=` / `?search=`）、横断検索は `/api/search/*` | [docs/api-filtering.md](./docs/api-filtering.md) |

検索方式は2種類あります（設計背景は [docs/architecture.md](./docs/architecture.md) の「検索アーキテクチャ」）:

- **一覧内検索**（`--search` / `?search=`）: SQLite FTS5 による全文検索。複数語AND、前方一致は `語*`（日本語では推奨）
- **横断キーワード検索**（`search keyword` / `/api/search/keyword`）: memo/task/article を横断し、コメントも含めて LIKE 部分一致で検索（日本語対応のため）

```bash
# CLI例
mgtd task list --label bug --status open --search "authentication"
mgtd search keyword "郡司ペギオ" --types memo,task --limit 5 --json

# API例
curl "http://localhost:3000/api/tasks?search=OAuth&label=bug&status=open"
```

## テスト実行

```bash
pnpm test
```

## ヘルプの参照

- すべてのコマンドで `--help` / `-h` を利用可能。サブコマンドは GitHub CLI と同様にスペース区切りで指定できる
- コマンドツリーと全オプションのリファレンスは [docs/cli-commands.md](./docs/cli-commands.md) を参照

## 補完スクリプト

- `mgtd completion --shell <bash|zsh|fish>` で組み込みスクリプトを出力できます。
- インストール例:
  ```bash
  # bash
  mgtd completion --shell bash --target ~/.local/share/mgtd/completions/mgtd.bash
  echo 'source ~/.local/share/mgtd/completions/mgtd.bash' >> ~/.bashrc

  # zsh
  target="$HOME/.local/share/mgtd/completions/mgtd.zsh"
  mgtd completion --shell zsh --target "$target"
  echo 'fpath=("$HOME/.local/share/mgtd/completions" $fpath)' >> ~/.zshrc
  echo 'autoload -Uz compinit && compinit' >> ~/.zshrc

  # fish
  mgtd completion --shell fish --target ~/.config/fish/completions/mgtd.fish
  ```
- `--print-path` を付けると、バンドル済みスクリプトの格納場所を確認できます

## 開発

- アーキテクチャ・変更の波及範囲: [docs/architecture.md](./docs/architecture.md)
- 要件定義: [docs/requirement.md](./docs/requirement.md)
- バージョン管理ポリシー: [docs/versioning.md](./docs/versioning.md)
- リリースパッケージ生成: `pnpm mgtd:pack`（`pnpm build` 実行後に `meme-gtd-cli-<version>.tgz` を生成）
