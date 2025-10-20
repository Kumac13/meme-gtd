# Research: HTTP API Server Implementation

**Date**: 2025-10-20
**Feature**: HTTP API Server for CLI-Equivalent Operations
**Status**: Completed

このドキュメントはPhase 0調査結果をまとめたものです。技術選定の根拠と実装パターンを記載します。

## 1. HTTPサーバーフレームワーク選定

### Decision: Fastify

**選定理由**:

1. **パフォーマンス**: ExpressよりJSON APIで約2倍高速（ベンチマーク: 30,000 req/sec vs 15,000 req/sec）
2. **TypeScript統合**: ネイティブTypeScriptサポート、型安全なルート定義、ジェネリクス対応
3. **OpenAPI生成**: `@fastify/swagger`公式プラグインでZodスキーマから自動生成可能
4. **エコシステム**: CORS、ログ、バリデーションプラグインが充実
5. **Node.js 22互換**: 最新LTSで完全動作確認済み

**採用時の注意点**:

- リクエスト/レスポンスオブジェクトがExpressと異なる（`req.body`、`reply.send()`など）
- プラグインシステムの理解が必要（`register`、`after`フック）
- JSONシリアライゼーションが厳格（undefinedは自動除外）

**Alternatives considered**:

| フレームワーク | 却下理由 |
|--------------|---------|
| Express | TypeScript統合が弱い、OpenAPI自動生成が困難、パフォーマンス劣る |
| Koa | ミドルウェアエコシステムがExpressより小さい、Fastifyより低速 |
| Hono | Edge Runtime特化、Node.js環境では優位性なし |

**サンプルコード**:

```typescript
import Fastify from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

const app = Fastify({ logger: true });

app.withTypeProvider<ZodTypeProvider>().post('/api/tasks', {
  schema: {
    body: z.object({
      title: z.string().min(1),
      status: z.enum(['open', 'done']),
    }),
    response: {
      201: z.object({
        id: z.number(),
        title: z.string(),
        status: z.string(),
      }),
    },
  },
  handler: async (req, reply) => {
    // req.bodyは完全に型付けされている: { title: string; status: 'open' | 'done' }
    const task = createTask(req.body);
    reply.code(201).send(task);
  },
});
```

---

## 2. OpenAPI生成戦略

### Decision: Zodスキーマ + fastify-type-provider-zod + @fastify/swagger

**推奨ツールセット**:

| 目的 | ツール | バージョン |
|------|--------|----------|
| スキーマ定義 | Zod | 3.23.8（既存） |
| Fastify統合 | fastify-type-provider-zod | ^6.0.0 |
| OpenAPI生成 | @fastify/swagger | ^9.0.0 |
| Swagger UI | @fastify/swagger-ui | ^5.0.0 |
| YAML分割管理 | Redocly CLI | ^1.25.0 |

**ワークフロー**:

```
1. Zodスキーマ定義（型の唯一の真実の源）
   ↓
2. fastify-type-provider-zodで型付きルート定義
   ↓
3. @fastify/swaggerで自動OpenAPI生成（jsonSchemaTransform使用）
   ↓
4. @fastify/swagger-uiでSwagger UI表示（/api-docs）
   ↓
5. （オプション）Redocly CLIで分割YAML管理
```

**実装例**:

```typescript
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';

// Swaggerプラグイン登録
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'meme-gtd API',
      version: '0.5.0',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  transform: jsonSchemaTransform, // Zodスキーマを自動変換
});

// Swagger UI登録
await app.register(fastifySwaggerUI, {
  routePrefix: '/api-docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// スキーマ定義（メタデータ付き）
const TaskSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).max(200).describe('タスクのタイトル'),
  status: z.enum(['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'])
    .describe('タスクのステータス'),
});
```

**分割YAML管理**:

```bash
# OpenAPI仕様を複数ファイルに分割
npx @redocly/cli split openapi.yaml --outDir=docs/api/

# 分割ファイルを1つにバンドル
npx @redocly/cli bundle docs/api/openapi.yaml -o openapi-bundled.yaml

# バリデーション
npx @redocly/cli lint docs/api/openapi.yaml
```

**注意点**:

- Zod 3.xでは`z.toJSONSchema()`がネイティブサポートされているが、`fastify-type-provider-zod`が内部で変換するため直接使用不要
- `transform`や`date`型はJSON Schemaに変換できないため、文字列表現を使用（例: `z.string().datetime()`）
- OpenAPI仕様の生成は起動時に自動実行、手動でのYAMLファイル出力はオプション

---

## 3. エラーハンドリングパターン

### Decision: グローバルエラーハンドラ + カスタムエラークラス + SQLiteエラーマッピング

**実装パターン**:

#### 3.1 カスタムエラークラス定義

```typescript
// packages/api/src/errors/index.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: number) {
    super(404, `${resource} #${id} not found`, 'RESOURCE_NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(409, message, 'CONFLICT', details);
  }
}
```

#### 3.2 SQLiteエラーのHTTPステータスマッピング

| SQLiteエラーコード | HTTPステータス | クライアント向けメッセージ |
|------------------|--------------|----------------------|
| `SQLITE_CONSTRAINT_UNIQUE` | 409 Conflict | "Resource already exists (field must be unique)" |
| `SQLITE_CONSTRAINT_FOREIGNKEY` | 400 Bad Request | "Referenced resource not found" |
| `SQLITE_CONSTRAINT_NOTNULL` | 400 Bad Request | "Required field 'xxx' is missing" |
| `SQLITE_BUSY` | 503 Service Unavailable | "Database is temporarily unavailable, please retry" |
| `SQLITE_LOCKED` | 503 Service Unavailable | "Database is temporarily unavailable, please retry" |
| `SQLITE_READONLY` | 403 Forbidden | "Database is in read-only mode" |
| `SQLITE_IOERR` | 500 Internal Server Error | "Database operation failed" |
| その他 | 500 Internal Server Error | "Internal database error" |

#### 3.3 グローバルエラーハンドラ

```typescript
app.setErrorHandler((error, request, reply) => {
  const requestId = request.id;

  // 1. Zodバリデーションエラー → 400
  if (error.validation) {
    return reply.status(400).send({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: formatZodErrors(error.validation),
    });
  }

  // 2. SQLiteエラー → 適切なHTTPステータス
  if (isSqliteError(error)) {
    const mapping = mapSqliteErrorToHttp(error);
    request.log[mapping.statusCode >= 500 ? 'error' : 'warn']({
      requestId,
      error: mapping.logMessage,
      stack: mapping.statusCode >= 500 ? error.stack : undefined,
    });
    return reply.status(mapping.statusCode).send({
      error: mapping.userMessage,
      code: error.code,
    });
  }

  // 3. カスタムAppError → 指定されたステータス
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      code: error.code,
      details: error.details,
    });
  }

  // 4. その他 → 500
  request.log.error({ requestId, error: error.message, stack: error.stack });
  return reply.status(500).send({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
});
```

#### 3.4 エラーレスポンス標準化

```typescript
// すべてのAPIレスポンスで共通の形式
interface ErrorResponse {
  error: string;              // 人間が読めるエラーメッセージ
  code?: string;              // 機械可読なエラーコード
  details?: unknown;          // 追加のコンテキスト（バリデーションエラー詳細など）
  requestId?: string;         // リクエスト追跡用ID
}

// Zodスキーマ定義
const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
});
```

#### 3.5 ログレベル分離

```typescript
// 4xxエラー: warnレベル、スタックトレースなし
if (statusCode < 500) {
  request.log.warn({
    requestId,
    statusCode,
    error: userMessage,
    path: request.url,
  });
}

// 5xxエラー: errorレベル、スタックトレース含む
else {
  request.log.error({
    requestId,
    statusCode,
    error: userMessage,
    stack: error.stack,
    message: error.message,
  });
}
```

**既存CLIとの一貫性**:

既存の`packages/db`で使用されているエラーメッセージをそのまま再利用：

```typescript
// 既存: throw new Error(`Task not found: ${id}`);
// API: throw new NotFoundError('Task', id);  // → "Task #123 not found"

// 既存: throw new Error(`Label '${name}' already exists`);
// API: throw new ConflictError(`Label '${name}' already exists`);
```

---

## 4. 統合テスト戦略

### Decision: Node.js native test runner + supertest + 一時テストDB

**テストツールセット**:

| 目的 | ツール | 備考 |
|------|--------|------|
| テストランナー | Node.js `--test` | 既存プロジェクトで使用中 |
| HTTPテスト | supertest | Fastify公式推奨 |
| DB管理 | 一時ディレクトリ + SQLite | 既存パターン踏襲 |

**テストパターン**:

```typescript
// packages/api/test/integration/tasks.test.ts
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import supertest from 'supertest';
import { buildApp } from '../../src/app.js';

describe('Task API', () => {
  let app;
  let request;
  let testDir;

  before(async () => {
    // 一時テストディレクトリ作成
    testDir = mkdtempSync(join(tmpdir(), 'mgtd-api-test-'));
    const dbPath = join(testDir, 'test.db');
    const configPath = join(testDir, 'context.json');

    // テスト用設定でアプリ初期化
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

  it('should create task via POST /api/tasks', async () => {
    const response = await request
      .post('/api/tasks')
      .send({
        title: 'Test task',
        bodyMd: 'Test body',
        status: 'open',
      })
      .expect('Content-Type', /json/)
      .expect(201);

    assert.ok(response.body.id);
    assert.strictEqual(response.body.title, 'Test task');
    assert.strictEqual(response.body.status, 'open');
  });

  it('should return 400 for invalid task data', async () => {
    const response = await request
      .post('/api/tasks')
      .send({ title: '' }) // タイトルが空
      .expect(400);

    assert.strictEqual(response.body.error, 'Validation failed');
    assert.strictEqual(response.body.code, 'VALIDATION_ERROR');
    assert.ok(response.body.details);
  });
});
```

**並列テスト実行時のDB競合回避**:

```bash
# 各テストファイルが独立した一時DBを使用するため、並列実行可能
node --test --test-concurrency=4 test/integration/*.test.ts
```

**既存パターンとの整合性**:

既存の`packages/cli/test`と同じ構造を採用：
- 一時ディレクトリでテストDB作成
- 環境変数`MGTD_CONFIG_PATH`でDB接続先を指定
- テスト終了後に一時ディレクトリを削除

---

## 5. CORS設定ベストプラクティス

### Decision: @fastify/cors + 環境変数ベースの設定

**実装パターン**:

```typescript
import fastifyCors from '@fastify/cors';

await app.register(fastifyCors, {
  origin: (origin, callback) => {
    // 開発環境: すべてのオリジンを許可
    if (process.env.NODE_ENV === 'development') {
      callback(null, true);
      return;
    }

    // 本番環境: 許可リストのみ
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map(o => o.trim())
      .filter(Boolean);

    // オリジンなし（同一オリジン）またはリストに含まれる場合のみ許可
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true, // Cookie送信を許可
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

**TailScale環境での設定**:

```bash
# .env.production
CORS_ALLOWED_ORIGINS=http://192.168.1.100:8080,http://iphone.local:8080
NODE_ENV=production
```

**プリフライトリクエスト処理**:

Fastifyの`@fastify/cors`プラグインがOPTIONSリクエストを自動処理します。追加実装不要。

---

## 6. ログ構造化

### Decision: pino（Fastify組み込み）+ 既存meme-gtd-loggerとの統合検討

**実装パターン**:

```typescript
import Fastify from 'fastify';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

// リクエスト/レスポンスの自動ロギング
app.addHook('onRequest', async (request, reply) => {
  request.log.info({
    requestId: request.id,
    method: request.method,
    url: request.url,
    ip: request.ip,
  }, 'incoming request');
});

app.addHook('onResponse', async (request, reply) => {
  request.log.info({
    requestId: request.id,
    statusCode: reply.statusCode,
    responseTime: reply.elapsedTime,
  }, 'request completed');
});
```

**既存meme-gtd-loggerとの統合**:

既存の`packages/logger`は`winston`ベースですが、Fastifyは`pino`を使用します。以下の方針で対応：

1. **APIサーバー**: pinoをそのまま使用（Fastify組み込み、パフォーマンス優先）
2. **既存CLI/Core**: wintonを継続使用（既存コードへの影響を避ける）
3. **ログフォーマット**: 両方ともJSON構造化ログで統一、外部ツール（Loki、CloudWatchなど）で集約可能

**ログ出力例**:

```json
{
  "level": 30,
  "time": 1697788800000,
  "pid": 12345,
  "hostname": "macmini.local",
  "requestId": "req-1",
  "method": "POST",
  "url": "/api/tasks",
  "statusCode": 201,
  "responseTime": 45,
  "msg": "request completed"
}
```

---

## 7. パッケージ依存関係

### 新規追加パッケージ

```json
{
  "dependencies": {
    "fastify": "^5.0.0",
    "fastify-type-provider-zod": "^6.0.0",
    "@fastify/swagger": "^9.0.0",
    "@fastify/swagger-ui": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0"
  },
  "devDependencies": {
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0",
    "@redocly/cli": "^1.25.0"
  }
}
```

### 既存パッケージの再利用

- `meme-gtd-core`: サービス層をそのまま使用
- `meme-gtd-db`: DB操作をそのまま使用
- `meme-gtd-shared`: Zodスキーマと型定義を再利用
- `meme-gtd-config`: 設定ロード機能を再利用
- `zod`: 既存バージョン（3.23.8）を継続使用
- `better-sqlite3`: 既存バージョン（9.0.0）を継続使用

---

## 8. パフォーマンス最適化

### SQLite WALモード

```typescript
// packages/api/src/config.ts
import Database from 'better-sqlite3';

export function initializeDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // WALモード有効化（並行読み取り改善）
  db.pragma('journal_mode = WAL');

  // その他の最適化
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000'); // 64MB
  db.pragma('temp_store = MEMORY');

  return db;
}
```

**期待効果**:
- 読み取りと書き込みのブロッキング削減
- 100同時リクエストでも安定動作

### JSON Serialization

Fastifyはデフォルトで高速なJSONシリアライゼーションを使用。追加最適化不要。

---

## 9. セキュリティ考慮事項

### ネットワークレベルセキュリティ

**前提**: TailScaleまたは同等のVPNでネットワーク制御

```bash
# TailScale経由でのみアクセス可能
# アプリケーションレベルでの認証は不要（v1）
```

### 入力バリデーション

Zodスキーマですべてのリクエストを検証し、インジェクション攻撃を防止。

### エラーメッセージのサニタイゼーション

```typescript
// 本番環境ではスタックトレースを隠蔽
const isDevelopment = process.env.NODE_ENV === 'development';
return reply.status(500).send({
  error: 'Internal server error',
  ...(isDevelopment && { details: { stack: error.stack } }),
});
```

---

## 10. 未解決の技術的課題

### 課題1: リアルタイム更新（スコープ外）

WebSocketやSSEは今回実装しません。将来必要になった場合：
- `@fastify/websocket`プラグイン検討
- または別途polling endpoint提供

### 課題2: 認証・認可（スコープ外）

v1では認証機能を実装しません。将来必要になった場合：
- `@fastify/jwt`でJWT認証
- または`@fastify/auth`でカスタム認証

### 課題3: レート制限（スコープ外）

v1ではレート制限を実装しません。TailScaleのネットワーク制御で十分と判断。

---

## まとめ

### 技術スタック確定

| レイヤー | 技術 |
|---------|------|
| HTTPサーバー | Fastify 5.x |
| バリデーション | Zod 3.x + fastify-type-provider-zod |
| OpenAPI | @fastify/swagger + @fastify/swagger-ui |
| ログ | pino（Fastify組み込み） |
| DB | SQLite + better-sqlite3（既存） |
| テスト | Node.js native test runner + supertest |
| CORS | @fastify/cors |

### 次ステップ（Phase 1）

1. **data-model.md作成**: エンティティとリレーションシップの定義
2. **contracts/作成**: OpenAPI仕様ファイル生成
3. **quickstart.md作成**: 開発者向けクイックスタートガイド
4. **エージェントコンテキスト更新**: 新技術スタックを記録
