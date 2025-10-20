# Quick Start Guide: HTTP API Server

**Date**: 2025-10-20  
**Feature**: HTTP API Server for CLI-Equivalent Operations  
**Target Audience**: Developers implementing or testing the API

このガイドでは、HTTP API サーバーのセットアップ、起動、テスト、OpenAPI ドキュメントの生成手順をまとめています。リポジトリには既に API パッケージが含まれているため、以下のステップだけで再現可能です。

---

## 1. 開発環境セットアップ

### 1.1 依存関係のインストール

```bash
# リポジトリルートで実行
pnpm install
```

追加のパッケージインストールやディレクトリ作成は不要です。`packages/api` 配下に実装・テスト一式が揃っています。

---

## 2. サーバーの起動とテスト

### 2.1 サーバー起動（開発モード）

```bash
pnpm --filter meme-gtd-api dev
```

- Swagger UI: http://localhost:3000/api-docs  
- OpenAPI JSON: http://localhost:3000/documentation/json

### 2.2 本番ビルド & 起動

```bash
pnpm --filter meme-gtd-api build
pnpm --filter meme-gtd-api start -- --port 4000 --db ~/tmp/mgtd.db
```

### 2.3 テスト・Lint

```bash
# 統合テスト（93ケース）
pnpm --filter meme-gtd-api test

# ESLint
pnpm --filter meme-gtd-api lint
```

### 2.4 OpenAPI 生成と検証

```bash
pnpm --filter meme-gtd-api openapi:generate
pnpm --filter meme-gtd-api openapi:validate
```

生成された仕様書は `packages/api/docs/api/openapi.yaml` に出力されます。Swagger UI の内容も自動的に更新されます。

### 2.5 代表的な API リクエスト

```bash
# メモ作成
curl -X POST http://localhost:3000/api/memos \
  -H 'content-type: application/json' \
  -d '{"bodyMd":"Hello API"}'

# メモ一覧
curl http://localhost:3000/api/memos

# タスク作成
curl -X POST http://localhost:3000/api/tasks \
  -H 'content-type: application/json' \
  -d '{"title":"Sample Task","bodyMd":"body"}'
```

必要に応じて `/api/labels`, `/api/links`, `/api/tasks/{id}/comments` なども同様に確認できます。

---

## 3. 手動検証チェックリスト

Phase 8 の polish 項目として、以下を一度確認しておくと安心です。

1. `pnpm --filter meme-gtd-api dev` でサーバーを起動し、`/api-docs` にアクセスできる。  
2. `pnpm --filter meme-gtd-api openapi:generate && pnpm --filter meme-gtd-api openapi:validate` が成功する。  
3. `pnpm --filter meme-gtd-api test` で 93/93 テストが PASS する。  
4. `pnpm --filter meme-gtd-api lint` がエラーなしで完了する。  
5. 実際にメモ/タスクの CRUD を curl 等で試し、レスポンスが CLI と整合している。  
6. `node dist/index.js --port 4000 --db ~/tmp/mgtd.db` のような本番起動でもログ・CORS 設定が期待通りに動作する。  
7. TailScale 等の閉域ネットワーク配下でリスンし、外部公開しない構成を維持できる。

---

## 4. 参考情報

- OpenAPI 仕様書: `packages/api/docs/api/openapi.yaml`  
- Swagger UI: http://localhost:3000/api-docs  
- TypeScript 型生成: `pnpm --filter meme-gtd-api sdk:generate-types`  
- CI/Automation: `.github/workflows/api-ci.yml`  
- 共有サービスレイヤー: `meme-gtd-core` / `meme-gtd-db`

