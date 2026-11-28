# MCP サーバー 接続設定ガイド

> 目的: meme-gtd の MCP サーバーを Claude Code・Codex・ChatGPT に接続する設定手順（人間向け）
> 読むタイミング: MCP クライアントの新規登録・接続先の切り替え・接続トラブルシューティング時
> 更新タイミング: MCP サーバーの起動方法・環境変数・対応クライアントの設定手順の変更時

meme-gtd の MCP サーバー（`packages/mcp`）は、既存の REST API を呼び出すプログラムです。クライアントごとに「どのコマンドで起動するか」「どの API につなぐか」を登録して使います。公開するツールの一覧は [README.md](../README.md) の「MCP サーバー」を参照してください。

## 接続方式の全体像

| クライアント | 接続方式 | MCP サーバーの起動 |
|---|---|---|
| Claude Code | stdio | Claude Code がセッションごとに起動する |
| Codex（CLI・デスクトップアプリ・IDE 拡張） | stdio | Codex がセッションごとに起動する |
| ChatGPT（Web・iOS） | Secure MCP Tunnel 経由の HTTP | 自分で常時起動しておく |

MCP サーバーは認証を持ちません。HTTP は `127.0.0.1` だけで待ち受け、ポートを外部へ公開しない前提です。ChatGPT からは、同じ Mac で動かす OpenAI の `tunnel-client` が外向きの通信だけで中継します。

## 共通の準備

以降のコマンドはすべてリポジトリのルートで実行します。

### 1. ビルドする

```bash
PATH="$HOME/.asdf/shims:$PATH" pnpm install --frozen-lockfile
```

```bash
PATH="$HOME/.asdf/shims:$PATH" pnpm --filter meme-gtd-mcp... build
```

`packages/mcp/dist/index.js` ができます。クライアントの登録はこのファイルを指すため、MCP のコードを変更したらビルドし直します。

`pnpm` が `command not found` になるシェルでは、上のように先頭へ `PATH="$HOME/.asdf/shims:$PATH"` を付けます（asdf の shims が `PATH` に入っていないため）。

### 2. 接続先の API を決める

接続先は環境変数 `MGTD_API_URL` で指定します。既定値はなく、未指定では起動しません。

| 用途 | `MGTD_API_URL` | API の起動 |
|---|---|---|
| 検証 | `http://127.0.0.1:3001` | `PATH="$HOME/.asdf/shims:$PATH" pnpm server:dev`（`test-data/test.db`） |
| 本番 | `http://127.0.0.1:3000` | `PATH="$HOME/.asdf/shims:$PATH" pnpm server:start`（本番 DB） |

API サーバーが起動していないと、ツールの呼び出しは `Could not reach the meme-gtd API` で失敗します。API を更新した直後は API サーバーを再起動します（古いプロセスのままだと、新しいエンドポイントを使うツールが HTTP 404 になります）。

### 3. 読み取り専用にするか決める

`MGTD_MCP_READ_ONLY=true` を指定すると、読み取りツールだけが登録されます。指定しない場合は Task の作成・変更などの書き込みツールも使えます。

## Claude Code

### 登録する

検証用（接続先 3001）:

```bash
claude mcp add --scope user meme-gtd-test -e MGTD_API_URL=http://127.0.0.1:3001 -- "$(which node)" "$PWD/packages/mcp/dist/index.js"
```

本番用（接続先 3000）:

```bash
claude mcp add --scope user meme-gtd -e MGTD_API_URL=http://127.0.0.1:3000 -- "$(which node)" "$PWD/packages/mcp/dist/index.js"
```

読み取り専用にする場合は `-e MGTD_MCP_READ_ONLY=true` を追加します:

```bash
claude mcp add --scope user meme-gtd -e MGTD_API_URL=http://127.0.0.1:3000 -e MGTD_MCP_READ_ONLY=true -- "$(which node)" "$PWD/packages/mcp/dist/index.js"
```

各部分の意味:

- `--scope user`: どのフォルダで開いたセッションからも使える登録にします。保存先は `~/.claude.json` です。`--scope local` はコマンドを実行したフォルダ限定の登録で、作業ツリーなど別のパスで開いたセッションには出ません。
- `meme-gtd-test` / `meme-gtd`: 登録名です。ツール名は `mcp__meme-gtd__list_tasks` のように登録名を含みます。
- `-e`: MCP サーバーへ渡す環境変数です。
- `--` 以降: Claude Code が起動するコマンドです。Node と `dist/index.js` を絶対パスで登録します。

### 確認する

```bash
claude mcp get meme-gtd-test
```

`Status: ✔ Connected` と表示されれば起動できています。MCP サーバーはセッション開始時に読み込まれるため、登録後に新しいセッションを開き、`/mcp` の一覧に登録名が出ることを確認します。

### 解除する

```bash
claude mcp remove meme-gtd-test -s user
```

## Codex

Codex CLI・デスクトップアプリ・IDE 拡張は、同じマシンの `~/.codex/config.toml` を共有します。iOS の Codex からリモート接続した Mac で使う場合も、その Mac の設定に登録します。

### 登録する

検証用（接続先 3001）:

```bash
codex mcp add meme-gtd-test --env MGTD_API_URL=http://127.0.0.1:3001 -- "$(which node)" "$PWD/packages/mcp/dist/index.js"
```

本番用（接続先 3000）:

```bash
codex mcp add meme-gtd --env MGTD_API_URL=http://127.0.0.1:3000 -- "$(which node)" "$PWD/packages/mcp/dist/index.js"
```

`~/.codex/config.toml` に次の形で保存されます（パスは実行した環境の絶対パスになります）。直接編集しても同じです。

```toml
[mcp_servers.meme-gtd]
command = "/opt/homebrew/bin/node"
args = ["/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/mcp/dist/index.js"]

[mcp_servers.meme-gtd.env]
MGTD_API_URL = "http://127.0.0.1:3000"
```

### 書き込みの確認と公開ツールを調整する（任意）

`config.toml` の同じブロックに追記します。

```toml
[mcp_servers.meme-gtd]
command = "/opt/homebrew/bin/node"
args = ["/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/packages/mcp/dist/index.js"]
default_tools_approval_mode = "writes"
enabled_tools = ["list_tasks", "get_task", "create_task", "update_task", "close_task", "list_task_comments", "create_task_comment", "keyword_search"]

[mcp_servers.meme-gtd.env]
MGTD_API_URL = "http://127.0.0.1:3000"
```

- `default_tools_approval_mode`: `auto` / `prompt` / `writes` / `approve`。`writes` は、読み取り専用と宣言していないツールの実行前に確認を求めます。
- `enabled_tools`: 使うツールだけを列挙します。47 ツールすべての定義は合計約 80KB あるため、文脈を節約したいときに絞ります。省略するとすべて有効です。

### 確認する

```bash
codex mcp list
```

```bash
codex mcp get meme-gtd
```

Codex のセッション内では `/mcp` で接続状態を確認できます。

### 解除する

```bash
codex mcp remove meme-gtd
```

## ChatGPT（Secure MCP Tunnel）

ChatGPT は OpenAI のサーバーから MCP サーバーへ接続するため、Mac 上の MCP サーバーには直接届きません。OpenAI の `tunnel-client` を同じ Mac で動かし、中継させます。Mac からの外向き HTTPS だけを使うので、ポートを公開する必要はありません。

この節の手順は OpenAI の公式資料に基づきます。実際の ChatGPT アカウントでの接続は未検証です（検証日: 2026-11-28 時点）。画面の項目名や手順が変わっている場合は公式資料を正とします。

- [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)
- [tunnel-client](https://github.com/openai/tunnel-client)
- [Connect and test your plugin](https://developers.openai.com/apps-sdk/deploy/connect-chatgpt)

公式資料に記載がなく、実機で確認が必要な点:

- 個人アカウント（Plus / Pro）でカスタム MCP サーバーと Tunnel を使えるか
- 認証を持たないサーバーに対して、追加画面の認証設定で何を選ぶか
- iOS アプリから書き込みツールを実行できるか（Web で追加したものはモバイルでも「アカウントで利用できるプラグイン」として使える、という記載のみ）

### 1. MCP サーバーを HTTP で起動しておく

```bash
MGTD_API_URL=http://127.0.0.1:3000 MGTD_MCP_TRANSPORT=http node packages/mcp/dist/index.js
```

`meme-gtd MCP listening on http://127.0.0.1:3100/mcp` と表示されます。ChatGPT から使う間は起動したままにします。ポートは `MGTD_MCP_PORT` で変更できます。自動起動の仕組みはこのリポジトリには含まれていません。

### 2. tunnel-client を入れる

```bash
brew install openai/tools/tunnel-client
```

```bash
tunnel-client --version
```

### 3. Tunnel と実行用 API キーを用意する

1. [Platform の Tunnel 設定](https://platform.openai.com/settings/organization/tunnels) で Tunnel を作成し、`tunnel_id`（`tunnel_` で始まる ID）を控えます。作成・編集には Tunnels の Read と Manage の権限が必要です。
2. [API キーの設定](https://platform.openai.com/settings/organization/api-keys) で実行用の API キーを作成します。Tunnels の Read と Use の権限が必要です。管理者キーは使いません。
3. 個人アカウントの場合は、そのアカウントに属する個人の Platform 組織を使います。ワークスペースで使う場合は、Tunnel を対象の ChatGPT ワークスペースに関連付けます。

### 4. プロファイルを作って接続する

キーは環境変数で渡します（コマンドの引数に書きません）。`sk-...` と `tunnel_...` は手順 3 で用意した値に置き換えます。

```bash
export CONTROL_PLANE_API_KEY="sk-..."
```

```bash
tunnel-client init --sample sample_mcp_remote_no_auth --profile meme-gtd --tunnel-id tunnel_0123456789abcdef0123456789abcdef --mcp-server-url http://127.0.0.1:3100/mcp
```

```bash
tunnel-client doctor --profile meme-gtd --explain
```

```bash
tunnel-client run --profile meme-gtd
```

`tunnel-client run` は起動したままにします。止まっている間、ChatGPT からの呼び出しは失敗します。プロファイルは `~/.config/tunnel-client/meme-gtd.yaml` に保存されます。

`sample_mcp_remote_no_auth` は「OAuth の情報を公開しない HTTP の MCP サーバー」向けのサンプルです。公式資料の例はリモートのホストで、`127.0.0.1` での利用は明記されていません。`doctor` が失敗する場合は公式資料の `sample_mcp_with_dcr` の例も試してください。

ログイン中に常駐させる方法は、tunnel-client の README にある `brew services start openai/tools/tunnel-client` の手順に従います（プロファイルの置き場所とキーの渡し方が上と異なります）。

### 5. ChatGPT に追加する

1. [ChatGPT の Plugins](https://chatgpt.com/plugins) を開きます。
2. 「+」から **Add custom MCP server** を選びます。
3. 名前と説明を入力します。
4. **Connection** で **Tunnel** を選び、手順 3 の Tunnel を選ぶか `tunnel_id` を入力します。
5. 認証を設定し、リスクの警告を確認して **I understand and want to continue** を選びます。
6. **Create as a plugin** を選び、検出されたツールを確認します。
7. プラグインをインストールし、新しい会話で `@` からプラグインを選んで試します。

### 6. MCP サーバーを更新したとき

MCP サーバーを再ビルドして再起動し、[ChatGPT の Plugins](https://chatgpt.com/plugins) で該当の接続を開いて **Refresh** を選びます。その後、新しい会話で試します。

### 上限

Tunnel 経由の 1 リクエストは 120 秒以内、要求・応答はそれぞれ 10MiB 以内です。

## トラブルシューティング

- **`pnpm: command not found`**: コマンドの先頭に `PATH="$HOME/.asdf/shims:$PATH"` を付けます。
- **Claude Code の `/mcp` に出ない**: `--scope local` で登録していないか確認します（`claude mcp get <登録名>` の Scope）。`--scope user` で登録し直し、新しいセッションを開きます。
- **`Invalid meme-gtd MCP configuration. MGTD_API_URL: Required`**: 登録に `MGTD_API_URL` がありません。環境変数を付けて登録し直します。
- **`Could not reach the meme-gtd API`**: 接続先の API サーバーが起動していません。
- **特定のツールだけ `HTTP 404` になる**: API サーバーが古いコードのまま動いています。API サーバーを再起動します。
- **ツールの内容が古い**: `packages/mcp` を再ビルドし、Claude Code・Codex は新しいセッションを開きます。ChatGPT は **Refresh** を選びます。
- **ChatGPT で Tunnel が選択肢に出ない**: Tunnel が対象のワークスペース（または個人の Platform 組織）に関連付いているか、操作するアカウントに Tunnels の Use 権限があるかを確認します。権限の反映には最大 30 分かかります。
- **ChatGPT でツールの検出や呼び出しが失敗する**: `tunnel-client run` と MCP サーバー（HTTP）の両方が起動しているか確認し、`tunnel-client doctor --profile meme-gtd --explain` を再実行します。
