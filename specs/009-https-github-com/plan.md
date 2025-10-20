# Implementation Plan: HTTP REST API Server for meme-gtd

**Branch**: `009-https-github-com` | **Date**: 2025-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-https-github-com/spec.md`

**Note**: This document tracks the implementation plan for the HTTP REST API server feature.

## Summary

Implement a production-ready HTTP REST API server that exposes all meme-gtd CLI functionality (memos, tasks, labels, links, comments) via RESTful endpoints. The API server will:
- Reuse existing `packages/core` services (MemoService, TaskService, LabelService, LinkService)
- Use Fastify 5.x with Zod for type-safe routing and validation
- Generate OpenAPI 3.0.3 documentation automatically via @fastify/swagger
- Support local development and Tailscale deployment modes
- Maintain 100% feature parity with CLI operations

## Technical Context

**Language/Version**: TypeScript 5.6.3 (Node.js 22.x)
**Primary Dependencies**: Fastify 5.2.0, fastify-type-provider-zod 4.0.2, Zod 3.23.8, @fastify/swagger, @fastify/swagger-ui, @fastify/cors
**Storage**: SQLite (via better-sqlite3, reusing existing meme-gtd-db)
**Testing**: Node.js test runner with tsx, Fastify inject for integration tests
**Target Platform**: Node.js server (Linux/macOS), local development + Tailscale deployment
**Project Type**: Web API server (monorepo package)
**Performance Goals**:
- 100+ requests/second for typical operations (memo/task CRUD)
- <50ms p95 latency for simple queries
- <200ms p95 latency for complex operations (promote, link creation)
**Constraints**:
- Single DB connection reuse (no connection pooling needed for SQLite)
- JSON-only responses (no HTML/XML)
- CORS configurable for development/production
- Compatible with existing CLI JSON output format
**Scale/Scope**:
- ~40 HTTP endpoints (memos, tasks, labels, links, comments)
- Personal/small team use (1-10 concurrent users)
- Existing database schema (no migrations needed)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Passed** - This feature adds a new package (`packages/api`) to the existing monorepo without modifying core business logic. Reuses existing services from `packages/core`.

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/
├── api/                 # 新規パッケージ（このフィーチャーで追加）
│   ├── src/
│   │   ├── server.ts           # Fastifyサーバー初期化（buildApp関数）
│   │   ├── index.ts            # エントリポイント（start関数）
│   │   ├── config.ts           # サーバー設定管理（環境変数、ポート、DBパス）
│   │   │
│   │   ├── routes/             # ルート定義（エンドポイント登録）
│   │   │   ├── memos.ts        # POST/GET/PATCH/DELETE /api/memos
│   │   │   ├── tasks.ts        # POST/GET/PATCH/DELETE /api/tasks + close/cancel/reopen
│   │   │   ├── labels.ts       # GET/POST/DELETE /api/labels
│   │   │   └── links.ts        # POST/DELETE /api/links
│   │   │
│   │   ├── handlers/           # リクエストハンドラ（ビジネスロジック呼び出し）
│   │   │   ├── memoHandlers.ts # createMemo, listMemos, getMemo, updateMemo, deleteMemo, promoteMemo
│   │   │   ├── taskHandlers.ts # createTask, listTasks, getTask, updateTask, closeTask, cancelTask, reopenTask
│   │   │   ├── labelHandlers.ts # listLabels, createLabel, deleteLabel, assignLabel
│   │   │   ├── linkHandlers.ts  # createLink, deleteLink, listLinks
│   │   │   └── commentHandlers.ts # listComments, createComment, updateComment, deleteComment
│   │   │
│   │   ├── middleware/         # ミドルウェア
│   │   │   ├── errorHandler.ts # グローバルエラーハンドラ（Zod/SQLite/AppError処理）
│   │   │   └── cors.ts         # CORS設定（開発/本番環境切替）
│   │   │
│   │   ├── schemas/            # Zodバリデーションスキーマ（リクエスト/レスポンス定義）
│   │   │   ├── memoSchemas.ts  # CreateMemoRequest, UpdateMemoRequest, PromoteMemoRequest, MemoSchema
│   │   │   ├── taskSchemas.ts  # CreateTaskRequest, UpdateTaskRequest, TaskSchema, TaskStatusSchema
│   │   │   ├── labelSchemas.ts # CreateLabelRequest, LabelSchema, AssignLabelRequest
│   │   │   ├── linkSchemas.ts  # CreateLinkRequest, LinkSchema, LinkWithDirectionSchema
│   │   │   ├── commentSchemas.ts # CreateCommentRequest, UpdateCommentRequest, CommentSchema
│   │   │   └── errorSchemas.ts # ErrorResponseSchema, ValidationErrorResponseSchema
│   │   │
│   │   └── errors/             # カスタムエラークラス
│   │       └── index.ts        # AppError, NotFoundError, ConflictError, ValidationError
│   │
│   ├── test/
│   │   ├── integration/        # 統合テスト（supertest使用）
│   │   │   ├── memos.test.ts   # POST/GET/PATCH/DELETE /api/memos のテスト
│   │   │   ├── tasks.test.ts   # POST/GET/PATCH/DELETE /api/tasks + status遷移テスト
│   │   │   ├── labels.test.ts  # GET/POST/DELETE /api/labels + UNIQUE制約テスト
│   │   │   ├── links.test.ts   # POST/DELETE /api/links + 自己参照エラーテスト
│   │   │   └── comments.test.ts # コメントCRUDテスト
│   │   │
│   │   └── helpers/
│   │       ├── testServer.ts   # テストサーバー起動ヘルパー（一時DB作成）
│   │       └── fixtures.ts     # テストデータ生成ヘルパー
│   │
│   ├── scripts/
│   │   └── generate-openapi.ts # OpenAPI仕様ファイル自動生成スクリプト
│   │
│   ├── package.json            # 依存: fastify, @fastify/swagger, supertest, meme-gtd-core
│   ├── tsconfig.json           # TypeScript設定（extends ../../tsconfig.json）
│   └── README.md               # パッケージ固有のREADME（起動方法、API概要）
│
├── core/                # 既存パッケージ（変更なし、再利用のみ）
│   └── src/
│       ├── index.ts            # MemoService, TaskService, LabelService エクスポート
│       └── linkService.ts      # LinkService実装
│
├── db/                  # 既存パッケージ（変更なし）
├── shared/              # 既存パッケージ（必要に応じて型定義追加）
├── config/              # 既存パッケージ（変更なし）
├── logger/              # 既存パッケージ（APIではpinoを使用）
└── cli/                 # 既存パッケージ（変更なし）

docs/
├── api/                 # 新規ディレクトリ
│   └── openapi.yaml     # OpenAPI 3.0.3仕様（Swagger UI用）
└── requirement.md       # API関連の記述を追記
```

**Structure Decision**:

Monorepo構造を維持し、`packages/api`として新規パッケージを追加します。既存の`packages/core`、`packages/db`、`packages/shared`を依存関係として再利用し、ビジネスロジックの重複を避けます。APIサーバーは独立したプロセスとして起動し、CLIとは別のエントリポイントを持ちます。

**責任分離**:
- `routes/`: エンドポイントURLとスキーマ定義のみ
- `handlers/`: リクエスト処理とサービス層呼び出し
- `schemas/`: Zodスキーマ定義（型安全性の単一ソース）
- `errors/`: カスタムエラークラス
- `middleware/`: 横断的関心事（エラーハンドリング、CORS）

**既存資産の完全再利用**:
- `meme-gtd-core`: MemoService, TaskService, LabelService, LinkServiceをそのまま使用
- `meme-gtd-db`: DB操作はcoreサービス層経由でのみアクセス
- `meme-gtd-shared`: 共通型定義（TaskStatus, LinkType等）を再利用

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

N/A - No violations. This implementation follows monorepo patterns and reuses existing packages.

---

## Implementation Phases

### Phase 1: Setup (T001-T005) ✅ COMPLETE
**Goal**: Initialize `packages/api` structure and dependencies

**Approach**:
- Create package directory with standard TypeScript setup
- Install Fastify, Zod, testing dependencies
- Configure tsconfig, package.json scripts
- Create basic README and .env.example

**Checkpoint**: `pnpm install` succeeds, TypeScript compiles without errors

---

### Phase 2: Foundational (T006-T019) ✅ COMPLETE
**Goal**: Build server infrastructure and testing foundation

**Approach**:
- Implement Fastify server initialization (`server.ts`)
- Configure DB connection lifecycle (single shared connection via decorate)
- Create error handling middleware (convert DB/Zod errors to HTTP responses)
- Implement CORS middleware with environment-based configuration
- Create custom error classes (NotFoundError, ValidationError, etc.)
- Build test helpers (testServer.ts with temporary DB)

**Checkpoint**: Server starts successfully, error middleware catches and formats errors correctly, test infrastructure ready

---

### Phase 3: User Story 1 - Memo Operations (T020-T030) ✅ COMPLETE
**Goal**: Implement HTTP API for all memo operations (MVP)

**Approach**:
- Define Zod schemas for memos and comments (aligned with DB layer types)
- Implement memo handlers (create, list, get, update, delete, promote, bookmark, unbookmark)
- Implement comment handlers for memos
- Register memo routes in server.ts
- Write integration tests (23 tests covering all endpoints)

**Deliverables**:
- 12 memo endpoints fully functional
- All tests passing (23/23)
- Schemas match DB layer structure (includes all fields: meta, isDeleted, etc.)

**Checkpoint**: `pnpm test` passes all memo tests, manual testing via `curl` confirms JSON format matches CLI

---

### Phase 4: User Story 2 - Task Management (T031-T039) ✅ COMPLETE
**Goal**: Implement HTTP API for task operations (MVP)

**Approach**:
- Define Zod schemas for tasks (TaskStatus enum, all fields from DB layer)
- Implement task handlers (create, list, get, update, delete, close, cancel, reopen, bookmark, unbookmark)
- Implement comment handlers for tasks
- Register task routes in server.ts
- Write integration tests (25 tests covering CRUD, status transitions, bookmarks, comments)

**Deliverables**:
- 14 task endpoints fully functional
- All tests passing (25/25, total 48/48)
- Status transition logic working (open → next → done, cancel, reopen)

**Checkpoint**: `pnpm test` shows 48/48 tests passing, task status filtering works via query params

---

### Phase 5: User Story 3 - Label/Link Management (T040-T049) ✅ COMPLETE
**Goal**: Implement label and link APIs

**Approach**:
- Define Zod schemas for labels and links
- Implement label handlers (list, create, delete, assign to issues)
- Implement link handlers (create bidirectional links, delete, list with direction)
- Handle UNIQUE constraints (label names) and validation (no self-links)
- Write integration tests for both label and link operations

**Deliverables**:
- Label endpoints: GET/POST/DELETE /api/labels, POST /api/issues/:id/labels (4 endpoints)
- Link endpoints: POST/DELETE /api/links, GET /api/issues/:id/links (3 endpoints)
- 17 integration tests (7 label tests + 10 link tests)

**Checkpoint**: ✅ Labels enforce UNIQUE constraint (409 CONFLICT), links prevent self-references, direction field added, all tests passing (64/64)

---

### Phase 6: User Story 4 - Config/Deploy (T050-T059) ✅ COMPLETE
**Goal**: Production configuration and deployment setup

**Approach**:
- Add CLI argument parsing for port, host, DB path, CORS origins
- Implement startup script with graceful shutdown
- Configure production logging (pino, JSON format)
- Add request body size limits
- Comprehensive error handling and CORS tests

**Deliverables**:
- CLI argument parsing: `--port`, `--host`, `--db`, `--config` (already implemented)
- Graceful shutdown on SIGINT/SIGTERM
- Request/response logging with requestId and responseTime
- 10MB body size limit (413 Payload Too Large)
- 18 new tests (CORS: 5, errors: 10, logging: 3)

**Checkpoint**: ✅ Server starts with custom config, graceful shutdown works, all error scenarios tested, 82/82 tests passing

---

### Phase 7: User Story 5 - OpenAPI Enhancement (T060-T069) ⏳ PENDING
**Goal**: Complete OpenAPI documentation

**Approach**:
- Verify all Zod schemas generate correct OpenAPI specs
- Add operation descriptions, tags, examples
- Configure Swagger UI theme and branding
- Generate static openapi.yaml file
- Add redoc alternative documentation

**Deliverables**:
- /api-docs serves Swagger UI with all 40 endpoints
- openapi.yaml validates with Redocly
- Examples included for all request/response types

**Checkpoint**: Swagger UI loads successfully, all endpoints documented, examples work

---

### Phase 8: Polish (T070-T085) ⏳ PENDING
**Goal**: Final validation and quality improvements

**Approach**:
- Run ESLint and fix warnings
- Add JSDoc comments to all public functions
- Verify error messages match CLI format exactly
- Add API tests to CI/CD pipeline
- Performance testing (100+ req/s target)
- Security audit (no stack traces in production, request timeout)

**Deliverables**:
- Clean lint output
- Complete inline documentation
- CI integration
- Performance validated

**Checkpoint**: All 85 tasks complete, feature ready for deployment

---

## Current Status

**Completed**: Phases 1-6 (59/87 tasks = 68%)
- ✅ Phase 1: Setup
- ✅ Phase 2: Foundational infrastructure
- ✅ Phase 3: Memo API (12 endpoints, 23 tests)
- ✅ Phase 4: Task API (14 endpoints, 25 tests)
- ✅ Phase 5: Label/Link API (7 endpoints, 17 tests)
- ✅ Phase 6: Config/Deploy (graceful shutdown, logging, error handling, 18 tests)

**Total Endpoints**: 33 endpoints implemented
**Test Status**: 82/82 integration tests passing (100%)

**Next**: Phase 7 (OpenAPI Enhancement) or Phase 8 (Polish)
