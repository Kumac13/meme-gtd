# Quick Start Guide: HTTP API Server

**Date**: 2025-10-20
**Feature**: HTTP API Server for CLI-Equivalent Operations
**Target Audience**: Developers implementing or testing the API

このガイドでは、HTTP APIサーバーの開発環境構築から基本的な動作確認までを説明します。

## 前提条件

- Node.js 22.0.0以降
- pnpm 9.0.0
- 既存の`meme-gtd`リポジトリクローン済み

---

## 1. 開発環境セットアップ

### 1.1 パッケージのインストール

```bash
# リポジトリルートで実行
cd /path/to/meme-gtd

# ワークスペース全体の依存関係をインストール
pnpm install

# 新規パッケージ（packages/api）用の依存関係を追加
cd packages/api
pnpm add fastify fastify-type-provider-zod \
  @fastify/swagger @fastify/swagger-ui @fastify/cors \
  pino pino-pretty

pnpm add -D supertest @types/supertest @redocly/cli
```

### 1.2 ディレクトリ構造の作成

```bash
# packages/apiディレクトリ作成
mkdir -p packages/api/{src/{routes,handlers,middleware,schemas},test/integration}

# 必要なファイルのスキャフォールド
touch packages/api/src/{server,config,index}.ts
touch packages/api/src/routes/{memos,tasks,labels,links}.ts
touch packages/api/package.json
touch packages/api/tsconfig.json
touch packages/api/README.md
```

### 1.3 package.jsonの作成

```json
{
  "name": "meme-gtd-api",
  "version": "0.6.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "pnpm run clean && tsc -p tsconfig.json",
    "clean": "rimraf dist",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "node --import tsx/esm --test test/**/*.test.ts",
    "test:integration": "node --import tsx/esm --test test/integration/*.test.ts",
    "lint": "eslint \"src/**/*.ts\"",
    "openapi:generate": "tsx scripts/generate-openapi.ts",
    "openapi:validate": "redocly lint docs/api/openapi.yaml"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "fastify-type-provider-zod": "^6.0.0",
    "@fastify/swagger": "^9.0.0",
    "@fastify/swagger-ui": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0",
    "meme-gtd-core": "workspace:*",
    "meme-gtd-db": "workspace:*",
    "meme-gtd-shared": "workspace:*",
    "meme-gtd-config": "workspace:*",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "tsx": "^4.15.0",
    "@types/node": "^22.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "@redocly/cli": "^1.25.0",
    "rimraf": "^5.0.7"
  }
}
```

### 1.4 tsconfig.jsonの作成

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

---

## 2. 最小限のサーバー実装

### 2.1 サーバーエントリポイント（src/index.ts）

```typescript
import { buildApp } from './server.js';

const start = async () => {
  const app = await buildApp();

  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
    console.log(`Swagger UI: http://localhost:${port}/api-docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
```

### 2.2 サーバー設定（src/server.ts）

```typescript
import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import fastifyCors from '@fastify/cors';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { setupErrorHandlers } from './middleware/errorHandler.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Zodバリデーター・シリアライザー設定
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // CORS設定
  await app.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'development' ? true : false,
  });

  // Swagger設定
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'meme-gtd API',
        version: '0.6.0',
      },
      servers: [{ url: 'http://localhost:3000' }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUI, {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
  });

  // エラーハンドラー設定
  setupErrorHandlers(app);

  // ルート登録
  app.get('/health', async () => ({ status: 'ok' }));

  return app;
}
```

---

## 3. サーバーの起動と動作確認

### 3.1 開発モードで起動

```bash
# packages/apiディレクトリで実行
pnpm dev

# またはリポジトリルートから
pnpm --filter meme-gtd-api dev
```

**期待される出力**:
```
[10:00:00.000] INFO: Server listening on http://0.0.0.0:3000
[10:00:00.001] INFO: Swagger UI: http://localhost:3000/api-docs
```

### 3.2 ヘルスチェック

```bash
curl http://localhost:3000/health

# 期待されるレスポンス
{"status":"ok"}
```

### 3.3 Swagger UIの確認

ブラウザで以下にアクセス：

```
http://localhost:3000/api-docs
```

現時点では`/health`エンドポイントのみ表示されます。

---

## 4. 最初のエンドポイント実装

### 4.1 Memoスキーマ定義（src/schemas/memoSchemas.ts）

```typescript
import { z } from 'zod';

export const CreateMemoRequestSchema = z.object({
  bodyMd: z.string().min(1, 'Body is required'),
  labels: z.array(z.string()).optional(),
});

export const MemoSchema = z.object({
  id: z.number().int().positive(),
  type: z.literal('memo'),
  bodyMd: z.string(),
  isBookmarked: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### 4.2 Memoハンドラ（src/handlers/memoHandlers.ts）

```typescript
import type { FastifyRequest, FastifyReply } from 'fastify';
import { MemoService } from 'meme-gtd-core';
import { loadConfig } from 'meme-gtd-config';
import type { z } from 'zod';
import type { CreateMemoRequestSchema } from '../schemas/memoSchemas.js';

type CreateMemoRequest = z.infer<typeof CreateMemoRequestSchema>;

export async function createMemoHandler(
  request: FastifyRequest<{ Body: CreateMemoRequest }>,
  reply: FastifyReply
) {
  const config = loadConfig();
  const memoService = new MemoService({ config });

  const memo = memoService.create({
    bodyMd: request.body.bodyMd,
    labels: request.body.labels,
  });

  reply.code(201).send(memo);
}

export async function listMemosHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const config = loadConfig();
  const memoService = new MemoService({ config });

  const memos = memoService.list();
  reply.send(memos);
}
```

### 4.3 Memoルート（src/routes/memos.ts）

```typescript
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { CreateMemoRequestSchema, MemoSchema } from '../schemas/memoSchemas.js';
import { createMemoHandler, listMemosHandler } from '../handlers/memoHandlers.js';

export async function memoRoutes(app: FastifyInstance) {
  app.withTypeProvider<ZodTypeProvider>().post('/api/memos', {
    schema: {
      body: CreateMemoRequestSchema,
      response: {
        201: MemoSchema,
      },
    },
    handler: createMemoHandler,
  });

  app.get('/api/memos', {
    handler: listMemosHandler,
  });
}
```

### 4.4 ルートの登録（src/server.ts）

```typescript
// buildApp関数内、ヘルスチェックの後に追加
import { memoRoutes } from './routes/memos.js';

// ...

// ルート登録
await app.register(memoRoutes);

app.get('/health', async () => ({ status: 'ok' }));
```

---

## 5. エンドポイントのテスト

### 5.1 cURLでのテスト

```bash
# メモ作成
curl -X POST http://localhost:3000/api/memos \
  -H "Content-Type: application/json" \
  -d '{"bodyMd": "Test memo from API"}'

# 期待されるレスポンス
{
  "id": 1,
  "type": "memo",
  "bodyMd": "Test memo from API",
  "isBookmarked": false,
  "createdAt": "2025-10-20T10:00:00.000Z",
  "updatedAt": "2025-10-20T10:00:00.000Z"
}

# メモ一覧取得
curl http://localhost:3000/api/memos
```

### 5.2 統合テストの作成

```typescript
// test/integration/memos.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import supertest from 'supertest';
import { buildApp } from '../../src/server.js';

describe('Memo API', () => {
  let app;
  let request;
  let testDir;

  before(async () => {
    testDir = mkdtempSync(join(tmpdir(), 'mgtd-api-test-'));
    const dbPath = join(testDir, 'test.db');
    const configPath = join(testDir, 'context.json');

    process.env.MGTD_DB_PATH = dbPath;
    process.env.MGTD_CONFIG_PATH = configPath;

    app = await buildApp();
    await app.ready();
    request = supertest(app.server);
  });

  after(async () => {
    await app.close();
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should create memo via POST /api/memos', async () => {
    const response = await request
      .post('/api/memos')
      .send({ bodyMd: 'Test memo' })
      .expect('Content-Type', /json/)
      .expect(201);

    assert.ok(response.body.id);
    assert.strictEqual(response.body.bodyMd, 'Test memo');
    assert.strictEqual(response.body.type, 'memo');
  });

  it('should list memos via GET /api/memos', async () => {
    const response = await request
      .get('/api/memos')
      .expect(200);

    assert.ok(Array.isArray(response.body));
  });

  it('should return 400 for empty bodyMd', async () => {
    const response = await request
      .post('/api/memos')
      .send({ bodyMd: '' })
      .expect(400);

    assert.strictEqual(response.body.code, 'VALIDATION_ERROR');
  });
});
```

### 5.3 テストの実行

```bash
# 統合テスト実行
pnpm test:integration

# 期待される出力
✔ Memo API > should create memo via POST /api/memos (45ms)
✔ Memo API > should list memos via GET /api/memos (12ms)
✔ Memo API > should return 400 for empty bodyMd (8ms)
```

---

## 6. 環境変数

### 6.1 開発環境（.env.development）

```bash
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug
MGTD_CONFIG_PATH=~/.config/mgtd/context.json
CORS_ALLOWED_ORIGINS=*
```

### 6.2 本番環境（.env.production）

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
MGTD_CONFIG_PATH=/path/to/production/context.json
CORS_ALLOWED_ORIGINS=http://192.168.1.100:8080,http://iphone.local:8080
```

### 6.3 環境変数の読み込み

```typescript
// src/config.ts
import { config } from 'dotenv';
import { z } from 'zod';

// .envファイル読み込み
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';

config({ path: envFile });

// 環境変数スキーマ
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MGTD_CONFIG_PATH: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
```

---

## 7. 次のステップ

### 7.1 残りのエンドポイント実装

1. **Task endpoints** (`src/routes/tasks.ts`)
   - POST /api/tasks
   - GET /api/tasks
   - GET /api/tasks/:id
   - PATCH /api/tasks/:id
   - DELETE /api/tasks/:id
   - POST /api/tasks/:id/close
   - POST /api/tasks/:id/cancel
   - POST /api/tasks/:id/reopen
   - POST /api/tasks/:id/bookmark
   - POST /api/tasks/:id/unbookmark

2. **Label endpoints** (`src/routes/labels.ts`)
   - GET /api/labels
   - POST /api/labels
   - DELETE /api/labels/:name
   - POST /api/issues/:issueId/labels

3. **Link endpoints** (`src/routes/links.ts`)
   - POST /api/links
   - DELETE /api/links/:id
   - GET /api/issues/:id/links

4. **Comment endpoints**
   - GET /api/{memos|tasks}/:id/comments
   - POST /api/{memos|tasks}/:id/comments
   - PATCH /api/{memos|tasks}/:id/comments/:commentId
   - DELETE /api/{memos|tasks}/:id/comments/:commentId

### 7.2 エラーハンドリングの完全実装

`src/middleware/errorHandler.ts`を実装：
- Zodバリデーションエラー → 400
- SQLiteエラー → 適切なHTTPステータス
- カスタムAppError → 指定されたステータス
- 未知のエラー → 500

### 7.3 OpenAPI仕様の自動生成

```bash
# OpenAPI仕様ファイルを生成
pnpm openapi:generate

# 生成されたファイルをバリデーション
pnpm openapi:validate
```

### 7.4 CI/CDへの統合

```yaml
# .github/workflows/api-test.yml
name: API Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm --filter meme-gtd-api build
      - run: pnpm --filter meme-gtd-api test:integration
      - run: pnpm --filter meme-gtd-api openapi:validate
```

---

## 8. トラブルシューティング

### 8.1 ポート衝突エラー

```bash
# エラー: EADDRINUSE: address already in use :::3000
# 解決: 既存プロセスを終了するか、別ポートを使用
PORT=3001 pnpm dev
```

### 8.2 DBファイルが見つからない

```bash
# エラー: SQLITE_CANTOPEN: unable to open database file
# 解決: mgtd initでDBを初期化
pnpm --filter meme-gtd-cli exec mgtd init -d ~/tmp/test.db -f
```

### 8.3 Zodバリデーションエラーが適切に返らない

```typescript
// server.tsでvalidatorCompilerを設定しているか確認
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);
```

### 8.4 CORS エラー

```bash
# ブラウザコンソール: Access to fetch at 'http://localhost:3000/api/memos'
# from origin 'http://localhost:8080' has been blocked by CORS policy

# 解決: .env.developmentにオリジンを追加
CORS_ALLOWED_ORIGINS=http://localhost:8080
```

---

## 9. 参考資料

### ドキュメント
- [OpenAPI仕様](./contracts/openapi.yaml)
- [データモデル](./data-model.md)
- [調査結果](./research.md)
- [実装計画](./plan.md)

### 外部リソース
- [Fastify公式ドキュメント](https://fastify.dev/)
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod)
- [Zod公式ドキュメント](https://zod.dev/)
- [Swagger UI](https://swagger.io/tools/swagger-ui/)

### 既存コード
- `packages/core/src/index.ts` - 再利用するサービス層
- `packages/db/src/` - DB操作関数
- `packages/cli/test/integration/` - テストパターンの参考

---

## まとめ

このクイックスタートガイドに従うことで、以下が達成できます：

1. ✅ HTTP APIサーバーの開発環境構築
2. ✅ 最小限のサーバー起動とヘルスチェック
3. ✅ 最初のエンドポイント（Memo作成・一覧）実装
4. ✅ 統合テストの作成と実行
5. ✅ Swagger UIでのAPI確認

次は、残りの37エンドポイントを順次実装し、エラーハンドリング・認証・ログ機能を強化していきます。

**Phase 2（タスク分解）**は`/speckit.tasks`コマンドで生成されます。
