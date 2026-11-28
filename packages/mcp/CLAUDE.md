# mcp開発ガイド

## 責務

meme-gtd の操作を MCP ツールとして公開するサーバー。既存 REST API を HTTP で呼ぶクライアントであり、core / db には依存しない（API と同じ検証・activity log を通すため）。

```
src/
├── index.ts     # 起動（stdio / 127.0.0.1 の Streamable HTTP）
├── config.ts    # 環境変数の検証
├── server.ts    # McpServer の組み立て（instructions とツール登録）
├── http.ts      # ステートレスな /mcp エンドポイント
├── api.ts       # REST API クライアント
├── toolkit.ts   # defineTool（annotations・出力検証・エラー変換）
├── schemas.ts   # 入力の共通部品と出力スキーマ
└── tools/       # リソース別のツール定義
```

## ツールを追加・変更するとき

- 公開する操作の範囲は Task 以外を読み取り中心にする方針で決めてある。新しい書き込みツールを足す前にユーザーへ確認する（AI に任せる操作の範囲はユーザーが決めるため）
- ツール名は対応する API の operationId をスネークケースにする（`closeTask` → `close_task`）。API にない取得（`get_link` など）だけ独自の名前を付ける
- ツールは必ず `defineTool` で登録し、`kind` で副作用を表す。annotations と読み取り専用起動時の登録可否は `kind` から決まる
- 出力は `schemas.ts` のスキーマで宣言する。`defineTool` が API 応答をこのスキーマで検証し、宣言していない項目を落としてから返す。API の応答項目を増やしてもここに足さない限りモデルには渡らない
- 同じ Zod インスタンスを1つのツールの複数の引数で使わない（JSON Schema が `$ref` になり、解決しないクライアントがあるため）。共通部品は関数にして呼び出しごとに作る
- タスク限定の書き込み（解除・並び替え・表示名変更など）は `requireTask` と所属確認を通してから API を呼ぶ（API 側は種別や所属を確認しないため）
- `createLink` に `isPromotion` を渡さない（メモ→タスク昇格フロー専用のため）
- stdio では標準出力が MCP 専用。ログは `console.error` で標準エラーへ出す
- ツールを増減したら `test/server.test.ts` の `READ_TOOLS` / `WRITE_TOOLS` と、ルート `README.md` の一覧を更新する

## API 契約の変更に追随する

`schemas.ts` と各ツールの入力は API の Zod スキーマの手書きミラー。API 側を変えたら api-schema-sync スキルのチェックリストに従ってここも更新する。

## 検証

テストは実 API を一時 DB で起動して MCP クライアントから呼ぶ結合テスト（`test/helpers.ts`）。手動で動かすときは test-env スキルの検証用 API（ポート3001）を `MGTD_API_URL` に指定する。本番（ポート3000）を検証に使わない。

```bash
pnpm --filter meme-gtd-mcp lint && pnpm --filter meme-gtd-mcp test
```
