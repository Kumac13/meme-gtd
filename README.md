# meme-gtd

GTD (Getting Things Done) ベースのローカルファースト個人タスク管理ツール。
CLI（`mgtd`）・REST API・Web UI・Chrome拡張・iOSアプリからメモ / タスク / Web記事を一元管理する。

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
- コメント投稿・編集・削除、Bookmark、Task Status変更
- Link管理（親子関係・関連付け）、Project管理（Board/Tableビュー対応）
- カレンダー表示（予定/実績）、アクティビティログ表示
- 検索: フリーテキスト検索 + ラベル・ステータスの専用フィルタUI（ドロップダウン）

## 検索とフィルタリング

検索の入口はインターフェースごとに異なります。

| インターフェース | 使い方 | 詳細 |
|---|---|---|
| Web UI | 検索ボックスはフリーテキスト専用。ラベル・ステータスはドロップダウンで絞り込み | — |
| CLI | `--label` / `--status` / `--search` フラグ、横断検索は `mgtd search keyword` / `semantic` | [docs/cli-commands.md](./docs/cli-commands.md) |
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

## セマンティック検索（ベクトル検索）

テキストの意味的な近さでissueを検索できます（「料理」で「晩ごはんの献立を考える」がヒットする等）。オプトイン機能です。

### 設定

embeddingサーバーの接続設定は `~/.config/mgtd/.env` で管理します（`mgtd init` で自動生成）。
OpenAI互換の `/v1/embeddings` エンドポイントをサポートするプロバイダなら何でも使えます。

```bash
# Ollama（デフォルト）
MGTD_EMBEDDING_URL=http://localhost:11434/v1
MGTD_EMBEDDING_MODEL=qwen3-embedding:4b
MGTD_EMBEDDING_API_KEY=ollama

# OpenAI
# MGTD_EMBEDDING_URL=https://api.openai.com/v1
# MGTD_EMBEDDING_MODEL=text-embedding-3-small
# MGTD_EMBEDDING_API_KEY=sk-xxxxx
```

Ollamaの場合の前提: `brew install ollama` → `ollama serve` → `ollama pull qwen3-embedding:4b`

### 利用

```bash
# embedding生成（初回は全issue、2回目以降は変更分のみ。モデル変更時は全再生成）
mgtd embedding sync

# セマンティック検索（CLI）
mgtd search semantic "読書メモ" --types memo --limit 10 --json

# セマンティック検索（API。日本語は --data-urlencode で q を単独指定）
curl --get 'http://localhost:3000/api/search/semantic' \
  --data-urlencode 'q=料理' \
  -d 'limit=10' \
  -d 'types=memo,task'
```

embeddingサーバーが起動していない場合、セマンティック検索は503を返します（他の機能には影響しません）。

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
