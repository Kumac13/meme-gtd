# meme-gtd MCP サンプル

> 目的: 既存REST APIを包むMCPサンプルの設計・起動方法・接続境界を示す
> 読むタイミング: MCPを起動・接続する前、公開ツールを追加・変更するとき
> 更新タイミング: MCPツール・設定・接続方式の変更時

## 構成と提供範囲

`packages/mcp` は公式TypeScript SDK v2を使う独立クライアント。DBやcoreには依存せず、既存APIへHTTPでアクセスする。API契約自体は変更しない。

```text
ChatGPT → Secure MCP Tunnel → Mac内のMCP → 既存REST API
Codex / Claude → stdio または localhostのStreamable HTTP → 同じMCP
人間 → Tailscale → 同じAPIサーバーが配信するWeb UI
```

| リソース | 閲覧 | 作成・更新 | 削除 |
|---|---|---|---|
| Task | `list_tasks`, `get_task` | `create_task`, `update_task`, `complete_task` | 提供しない |
| Article | `list_articles`, `get_article` | `create_article`, `update_article` | 提供しない |
| Memo | `list_memos`, `get_memo` | 提供しない | 提供しない |

Articleの更新は既存APIと同じくmanual記事だけ。web記事は読み取り専用。`create_article` は渡されたMarkdownを保存し、URLの取得・本文抽出はしない。コメント・ラベル管理・プロジェクト管理はこのサンプルの対象外。

## 採用した設計

- 用途がわかる名前・説明とZodの厳密な入力スキーマを持つ小さなツールを登録する。任意URL・HTTPメソッド・シェルコマンドをモデルに指定させない。
- `outputSchema` と `structuredContent` を返す。保証する出力フィールドだけを検証し、APIの内部フィールドやエラー本文はそのまま返さない。
- 一覧は件数制限とページングを持ち、Taskの日時には `Asia/Tokyo` の壁時計時刻であることを明示する。
- 読み取り・変更・非冪等操作のannotationsを付ける。これらはクライアント向けのヒントであり、認可処理の代わりにはならない。
- stdioの標準出力はMCP専用。ログはstderrへ出す。HTTPはステートレスなfactoryを使い、loopbackに限定してHost/Originを検証する。
- API呼び出しに10秒のタイムアウトとキャンセルを設定する。リダイレクト追従・書き込みの自動再試行は行わない。失敗した書き込みは保存済みの可能性があるため、再実行前に検索して確認する。
- 書き込みは起動設定で有効にした場合だけツール一覧に登録する。Memoの書き込みと全削除ツールは、設定によらず登録しない。

根拠: [公式SDKのtools設計](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/servers/tools.md)、[HTTP factoryとHost/Origin検証](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)、[stdioの出力規則](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md)、[公式SDKによる結合テスト](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/testing.md)。

## ローカルで試す

検証環境の準備はtest-envスキルを使う。本番APIには検証リクエストを送らない。

リポジトリルートからビルドする:

```bash
pnpm install
pnpm --filter meme-gtd-mcp build
pnpm --filter meme-gtd-mcp lint
pnpm --filter meme-gtd-mcp test
```

別のターミナルでテストAPIを起動する:

```bash
pnpm server:dev
```

HTTPでサンプルを起動する。これはテストAPIに接続し、Task・Articleの書き込みも有効にする:

```bash
MGTD_API_URL=http://127.0.0.1:3001 MGTD_MCP_ALLOW_WRITES=true MGTD_MCP_TRANSPORT=http pnpm --filter meme-gtd-mcp start
```

MCPクライアントの接続先は `http://127.0.0.1:3100/mcp`。普通のWeb画面ではなく、MCPのinitialize・tools/list・tools/callを受け付けるエンドポイント。

stdioで起動する場合は、クライアントまたはtunnel-clientに次のプロセスを起動させる:

```bash
MGTD_API_URL=http://127.0.0.1:3001 MGTD_MCP_ALLOW_WRITES=true node "$PWD/packages/mcp/dist/index.js"
```

| 環境変数 | 既定値 | 意味 |
|---|---|---|
| `MGTD_API_URL` | `http://127.0.0.1:3001` | APIのorigin。ユーザー情報・パス・クエリは禁止 |
| `MGTD_MCP_ALLOW_WRITES` | `false` | `true` の場合のみTask・Articleの変更ツールを登録 |
| `MGTD_MCP_TRANSPORT` | `stdio` | `stdio` または `http` |
| `MGTD_MCP_PORT` | `3100` | HTTPのloopbackポート |

日常利用で本番データを操作する際は、`MGTD_API_URL` に `http://127.0.0.1:3000` を明示する。開発・検証では引き続き3001を使用する。

## 既存APIから引き継ぐ日時検索の制約

2026-11-19の一時DB検証で、`scheduledStart=2026-11-20T15:00:00` のTaskが `scheduledFrom=2026-11-20` / `scheduledTo=2026-11-20` の検索に含まれないことを確認した。既存APIのSQLがオフセットのない時刻へSQLiteの `localtime` 変換を適用するため、サーバーのタイムゾーンによって日付が変わる。MCPはAPIの検索結果をそのまま返し、ここではAPI実装を変更していない。

厳密な日別レビューでは日付フィルターを省略してページングし、各Taskの `scheduledStart` を確認する。ツール説明にもこの制約を含める。

## ChatGPTへの接続

このサンプルはMCP実装まで。アカウントの変更、Tunnel作成・認証情報登録、iOSでの実呼び出しは別の導入工程であり、サンプルのテスト成功だけで接続済みとは扱わない。

Mac上のMCPをOpenAIの `tunnel-client` へstdioコマンドまたはローカルHTTP URLとして設定する。stdioの場合、上記のAPI URL・書き込み設定をそのプロセスへ渡す。Macからの外向きHTTPSで接続するので、3000や3100を公開する必要はない。

Web版ChatGPTのPluginsからカスタムMCPを追加し、ConnectionにTunnelを選んで登録・インストールする。PlatformのトンネルとChatGPTワークスペースの関連付け・利用権限が必要。登録は[Secure MCP Tunnel公式手順](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)に従う。

[公式のモバイル対応範囲](https://learn.chatgpt.com/docs/plugins)ではChat/Workでアカウントに提供されたプラグインを利用できる。実際のアカウントで表示されることと、iOSから読み取りツールを呼べることを導入時に確認する。

HTTPサンプルにはOAuth認証を実装していないため、loopbackと認証されたトンネルの内側で使う。Claudeのクラウド側などから直接接続する公開HTTPSサーバーとして使う場合は、別途MCP準拠の認証を実装する。
