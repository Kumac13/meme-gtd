# meme-gtd-api

meme-gtd の REST API サーバー。Fastify 5 ベースで、`meme-gtd-core` のサービス層を再利用してCLIと同一のビジネスロジックを提供する。
`packages/web/dist` を同一ポートでSPAとして配信する。

## 特徴

- **OpenAPI 3.0.3**: Zodスキーマから自動生成、Swagger UI付き
- **型安全**: リクエスト/レスポンスをZodでバリデーション
- **構造化ログ**: Pino（JSON）
- **統合テスト**: `test/integration/` 配下

## 起動

```bash
# 開発サーバー（ホットリロード・ポート3001・テストDB — 検証はこちらを使う）
pnpm server:dev

# 本番サーバー（ポート3000・本番DB）
pnpm build
pnpm server:start
```

エージェントによる検証は必ずテスト環境（ポート3001）を使うこと（test-env スキル参照）。

```bash
curl http://localhost:3001/api/health
```

## APIドキュメント

- エンドポイント一覧: `docs/architecture.md` のAPIエンドポイントマップ
- 契約の正: `docs/api/openapi.yaml`（自動生成・手編集禁止）
- Swagger UI: サーバー起動中に `http://localhost:3001/api-docs`
- フィルタ・検索パラメータの使い方: `docs/api-filtering.md`

## OpenAPI spec の生成・検証

```bash
pnpm openapi:generate   # Zodスキーマから docs/api/openapi.yaml を生成
pnpm openapi:validate   # Redocly でspecを検証（コミット前に実行）
pnpm openapi:bundle     # $ref を解決した単一ファイルを生成
```

APIスキーマを変更したら api-schema-sync スキルの同期チェーン（Webクライアント再生成・iOS Swiftモデル手動更新）まで完了させること。

## テスト

```bash
pnpm test          # 統合テスト実行
pnpm test:watch    # watchモード
```

バックエンド変更にはテストが必須（`packages/api/CLAUDE.md` 参照）。

## 環境変数

`docs/operations.md` の環境変数一覧を参照。

## 構成

```
src/
├── server.ts           # Fastify app初期化
├── index.ts            # エントリポイント
├── config.ts           # 設定管理
├── routes/             # ルート定義
├── handlers/           # リクエストハンドラ
├── schemas/            # Zodバリデーションスキーマ（契約の正）
├── middleware/         # CORS・エラーハンドリング
└── errors/             # カスタムエラークラス
```

## セキュリティ

アプリケーションレベルの認証は持たない。Tailscaleネットワーク内での単一ユーザー運用を前提とする（`docs/remote-access.md` 参照）。
