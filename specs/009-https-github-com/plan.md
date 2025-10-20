# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [single/web/mobile - determines source structure]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

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

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
