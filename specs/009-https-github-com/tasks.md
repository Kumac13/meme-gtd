# Tasks: HTTP API Server for CLI-Equivalent Operations

**Input**: Design documents from `/specs/009-https-github-com/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml
**Branch**: `009-https-github-com`
**Created**: 2025-10-20

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, Setup)
- Include exact file paths in descriptions

## Path Conventions
- Monorepo structure: `packages/api/src/`, `packages/api/test/`
- Paths are absolute from repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure that ALL user stories need

- [X] T001 [Setup] Create `packages/api` directory structure (src/, test/, scripts/)
- [X] T002 [Setup] Create `packages/api/package.json` with dependencies (fastify, @fastify/swagger, @fastify/swagger-ui, @fastify/cors, pino, zod, supertest)
- [X] T003 [Setup] Create `packages/api/tsconfig.json` extending root config
- [X] T004 [P] [Setup] Create `packages/api/README.md` with startup instructions
- [X] T005 [P] [Setup] Create `packages/api/.env.development` and `.env.production` templates

**Checkpoint**: Package structure ready for implementation

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Core Server Infrastructure

- [X] T006 [Foundation] Implement Fastify server initialization in `packages/api/src/server.ts` (buildApp function)
- [X] T007 [Foundation] Implement server entry point in `packages/api/src/index.ts` (start function with port/host config)
- [X] T008 [Foundation] Implement environment configuration in `packages/api/src/config.ts` (env vars, port, DB path, CORS origins)
- [X] T009 [Foundation] Register Zod validator and serializer compiler in `server.ts` (setValidatorCompiler, setSerializerCompiler)

### Error Handling Infrastructure

- [X] T010 [P] [Foundation] Define custom error classes in `packages/api/src/errors/index.ts` (AppError, NotFoundError, ConflictError, ValidationError)
- [X] T011 [Foundation] Implement global error handler in `packages/api/src/middleware/errorHandler.ts` (Zod errors → 400, SQLite errors → appropriate status, AppError → specified status)
- [X] T012 [Foundation] Register error handler and 404 handler in `server.ts` (setErrorHandler, setNotFoundHandler)

### Middleware & Cross-Cutting

- [X] T013 [P] [Foundation] Implement CORS middleware in `packages/api/src/middleware/cors.ts` (development/production origin config)
- [X] T014 [P] [Foundation] Register @fastify/cors plugin in `server.ts`
- [X] T015 [P] [Foundation] Configure pino logger in `server.ts` (log level, pretty print for dev)

### OpenAPI/Swagger Infrastructure

- [X] T016 [Foundation] Register @fastify/swagger plugin in `packages/api/src/server.ts` (OpenAPI 3.0.3 info, servers, jsonSchemaTransform)
- [X] T017 [Foundation] Register @fastify/swagger-ui plugin in `server.ts` (routePrefix: /api-docs, UI config)

### Testing Infrastructure

- [X] T018 [P] [Foundation] Create test server helper in `packages/api/test/helpers/testServer.ts` (buildApp with temp DB)
- [X] T019 [P] [Foundation] Create test fixtures helper in `packages/api/test/helpers/fixtures.ts` (sample data generation)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Basic HTTP Access to Memo Operations (Priority: P1) 🎯 MVP

**Goal**: Enable creating, listing, viewing, editing, deleting, promoting, bookmarking, and commenting on memos via HTTP API

**Independent Test**: Start API server, POST /api/memos to create, GET /api/memos to list, verify responses match CLI JSON format

### Schemas for User Story 1

- [X] T020 [P] [US1] Define Memo schemas in `packages/api/src/schemas/memoSchemas.ts` (CreateMemoRequestSchema, UpdateMemoRequestSchema, PromoteMemoRequestSchema, MemoSchema, MemoDetailSchema)
- [X] T021 [P] [US1] Define Comment schemas in `packages/api/src/schemas/commentSchemas.ts` (CreateCommentRequestSchema, UpdateCommentRequestSchema, CommentSchema)
- [X] T022 [P] [US1] Define error response schemas in `packages/api/src/schemas/errorSchemas.ts` (ErrorResponseSchema, ValidationErrorResponseSchema)

### Handlers for User Story 1

- [X] T023 [US1] Implement memo handlers in `packages/api/src/handlers/memoHandlers.ts` (createMemoHandler, listMemosHandler, getMemoHandler, updateMemoHandler, deleteMemoHandler, promoteMemoHandler, bookmarkMemoHandler, unbookmarkMemoHandler) - depends on T020
- [X] T024 [P] [US1] Implement memo comment handlers in `packages/api/src/handlers/commentHandlers.ts` (listMemoCommentsHandler, createMemoCommentHandler, updateMemoCommentHandler, deleteMemoCommentHandler) - depends on T021

### Routes for User Story 1

- [X] T025 [US1] Implement memo routes in `packages/api/src/routes/memos.ts` (POST/GET/PATCH/DELETE /api/memos, POST /api/memos/:id/promote, POST /api/memos/:id/bookmark, POST /api/memos/:id/unbookmark, GET/POST /api/memos/:id/comments, PATCH/DELETE /api/memos/:memoId/comments/:commentId) - depends on T023, T024
- [X] T026 [US1] Register memo routes in `server.ts` (app.register(memoRoutes)) - depends on T025

### Integration Tests for User Story 1

- [X] T027 [US1] Implement memo CRUD integration tests in `packages/api/test/integration/memos.test.ts` (POST /api/memos, GET /api/memos, GET /api/memos/:id, PATCH /api/memos/:id, DELETE /api/memos/:id) - depends on T026
- [X] T028 [P] [US1] Implement memo promote integration test in `packages/api/test/integration/memos.test.ts` (POST /api/memos/:id/promote) - depends on T026
- [X] T029 [P] [US1] Implement memo bookmark integration test in `packages/api/test/integration/memos.test.ts` (POST /api/memos/:id/bookmark, POST /api/memos/:id/unbookmark) - depends on T026
- [X] T030 [P] [US1] Implement memo comment integration tests in `packages/api/test/integration/comments.test.ts` (GET/POST/PATCH/DELETE memo comments) - depends on T026

**Checkpoint**: User Story 1 complete - memos fully manageable via HTTP API

---

## Phase 4: User Story 2 - Task Management via HTTP API (Priority: P1)

**Goal**: Enable creating, listing, filtering, updating status, closing/canceling/reopening, deleting, and bookmarking tasks via HTTP API

**Independent Test**: POST /api/tasks to create, GET /api/tasks?status=next to filter, POST /api/tasks/:id/close to change status, verify all state transitions work

### Schemas for User Story 2

- [X] T031 [P] [US2] Define Task schemas in `packages/api/src/schemas/taskSchemas.ts` (CreateTaskRequestSchema, UpdateTaskRequestSchema, TaskSchema, TaskDetailSchema, TaskStatusSchema)

### Handlers for User Story 2

- [X] T032 [US2] Implement task handlers in `packages/api/src/handlers/taskHandlers.ts` (createTaskHandler, listTasksHandler, getTaskHandler, updateTaskHandler, deleteTaskHandler, closeTaskHandler, cancelTaskHandler, reopenTaskHandler, bookmarkTaskHandler, unbookmarkTaskHandler) - depends on T031
- [X] T033 [P] [US2] Implement task comment handlers in `packages/api/src/handlers/commentHandlers.ts` (listTaskCommentsHandler, createTaskCommentHandler, updateTaskCommentHandler, deleteTaskCommentHandler) - depends on T021 (comment schema already defined in US1)

### Routes for User Story 2

- [X] T034 [US2] Implement task routes in `packages/api/src/routes/tasks.ts` (POST/GET/PATCH/DELETE /api/tasks, POST /api/tasks/:id/close, POST /api/tasks/:id/cancel, POST /api/tasks/:id/reopen, POST /api/tasks/:id/bookmark, POST /api/tasks/:id/unbookmark, GET/POST /api/tasks/:id/comments, PATCH/DELETE /api/tasks/:taskId/comments/:commentId) - depends on T032, T033
- [X] T035 [US2] Register task routes in `server.ts` (app.register(taskRoutes)) - depends on T034

### Integration Tests for User Story 2

- [X] T036 [US2] Implement task CRUD integration tests in `packages/api/test/integration/tasks.test.ts` (POST /api/tasks, GET /api/tasks with status filter, GET /api/tasks/:id, PATCH /api/tasks/:id, DELETE /api/tasks/:id) - depends on T035
- [X] T037 [P] [US2] Implement task status transition integration tests in `packages/api/test/integration/tasks.test.ts` (POST /api/tasks/:id/close, POST /api/tasks/:id/cancel, POST /api/tasks/:id/reopen) - depends on T035
- [X] T038 [P] [US2] Implement task bookmark integration tests in `packages/api/test/integration/tasks.test.ts` (POST /api/tasks/:id/bookmark, POST /api/tasks/:id/unbookmark) - depends on T035
- [X] T039 [P] [US2] Implement task comment integration tests in `packages/api/test/integration/comments.test.ts` (GET/POST/PATCH/DELETE task comments) - depends on T035

**Checkpoint**: User Story 2 complete - tasks fully manageable via HTTP API

---

## Phase 5: User Story 3 - Label and Link Management (Priority: P2)

**Goal**: Enable creating labels, assigning labels to issues, creating links between issues, and listing relationships

**Independent Test**: POST /api/labels to create, POST /api/issues/:id/labels to assign, POST /api/links to create relationships, GET /api/issues/:id/links to list

### Schemas for User Story 3

- [x] T040 [P] [US3] Define Label schemas in `packages/api/src/schemas/labelSchemas.ts` (CreateLabelRequestSchema, LabelSchema, AssignLabelRequestSchema)
- [x] T041 [P] [US3] Define Link schemas in `packages/api/src/schemas/linkSchemas.ts` (CreateLinkRequestSchema, LinkSchema, LinkWithDirectionSchema, LinkTypeSchema)

### Handlers for User Story 3

- [x] T042 [US3] Implement label handlers in `packages/api/src/handlers/labelHandlers.ts` (listLabelsHandler, createLabelHandler, deleteLabelHandler, assignLabelHandler) - depends on T040
- [x] T043 [P] [US3] Implement link handlers in `packages/api/src/handlers/linkHandlers.ts` (createLinkHandler, deleteLinkHandler, listLinksHandler) - depends on T041

### Routes for User Story 3

- [x] T044 [US3] Implement label routes in `packages/api/src/routes/labels.ts` (GET/POST /api/labels, DELETE /api/labels/:name, POST /api/issues/:issueId/labels) - depends on T042
- [x] T045 [P] [US3] Implement link routes in `packages/api/src/routes/links.ts` (POST /api/links, DELETE /api/links/:id, GET /api/issues/:id/links) - depends on T043
- [x] T046 [US3] Register label routes in `server.ts` (app.register(labelRoutes)) - depends on T044
- [x] T047 [US3] Register link routes in `server.ts` (app.register(linkRoutes)) - depends on T045

### Integration Tests for User Story 3

- [x] T048 [US3] Implement label integration tests in `packages/api/test/integration/labels.test.ts` (GET /api/labels, POST /api/labels with UNIQUE constraint test, DELETE /api/labels/:name, POST /api/issues/:id/labels idempotent test) - depends on T046
- [x] T049 [P] [US3] Implement link integration tests in `packages/api/test/integration/links.test.ts` (POST /api/links, DELETE /api/links/:id, GET /api/issues/:id/links, self-reference error test, duplicate link error test) - depends on T047

**Checkpoint**: User Story 3 complete - labels and links fully manageable via HTTP API

---

## Phase 6: User Story 4 - Server Configuration and Deployment (Priority: P2)

**Goal**: Enable starting server with custom port, database path, CORS origins, log level, and handle all error scenarios gracefully

**Independent Test**: Start server with `--port 4000 --db ~/tmp/test.db`, verify connection; send malformed JSON, verify 400 with validation details; trigger DB error, verify proper logging and HTTP status

### Enhanced Configuration

- [x] T050 [US4] Add command-line argument parsing in `packages/api/src/index.ts` (--port, --db, --config flags using minimist or commander)
- [x] T051 [US4] Enhance environment config in `packages/api/src/config.ts` to merge CLI flags > env vars > defaults
- [x] T052 [P] [US4] Implement graceful shutdown handler in `packages/api/src/index.ts` (SIGINT, SIGTERM, close DB connections)

### CORS Enhancement

- [x] T053 [US4] Update CORS middleware in `packages/api/src/middleware/cors.ts` to use CORS_ALLOWED_ORIGINS from config (comma-separated list)
- [x] T054 [P] [US4] Add CORS preflight OPTIONS handling test in `packages/api/test/integration/cors.test.ts`

### Error Handling Enhancement

- [x] T055 [US4] Verify global error handler catches all SQLite errors (SQLITE_BUSY → 503, SQLITE_CONSTRAINT_UNIQUE → 409, etc.) in `packages/api/src/middleware/errorHandler.ts`
- [x] T056 [P] [US4] Implement request size limit middleware and test 413 response for large payloads
- [x] T057 [P] [US4] Add comprehensive error handling integration tests in `packages/api/test/integration/errors.test.ts` (404, 400 validation, 409 conflict, 500 internal, 503 unavailable)

### Logging Enhancement

- [x] T058 [P] [US4] Add request/response logging hooks in `server.ts` (onRequest, onResponse with requestId, method, url, statusCode, responseTime)
- [x] T059 [P] [US4] Add structured error logging test in `packages/api/test/integration/logging.test.ts` (verify log format, level, stack traces for 5xx only)

**Checkpoint**: User Story 4 complete - server fully configurable and production-ready

---

## Phase 7: User Story 5 - OpenAPI Documentation and Client Generation (Priority: P3)

**Goal**: Serve complete API documentation via Swagger UI and enable client SDK generation from OpenAPI spec

**Independent Test**: Navigate to http://localhost:3000/api-docs, verify all 40 endpoints are documented; run openapi-generator, verify TypeScript SDK is generated

### OpenAPI Generation

- [X] T060 [US5] Implement OpenAPI spec generation script in `packages/api/scripts/generate-openapi.ts` (call app.swagger(), write to docs/api/openapi.yaml)
- [X] T061 [P] [US5] Add npm script `openapi:generate` in `packages/api/package.json`
- [X] T062 [P] [US5] Add npm script `openapi:validate` using Redocly CLI in `packages/api/package.json`

### Documentation Integration

- [X] T063 [US5] Copy generated OpenAPI spec to `docs/api/openapi.yaml` (ensure Swagger UI serves latest spec)
- [X] T064 [P] [US5] Add OpenAPI metadata tags to all routes (Memos, Tasks, Labels, Links, Comments tags)
- [X] T065 [P] [US5] Add `.describe()` annotations to all Zod schemas for better OpenAPI documentation

### Client SDK Generation (Optional)

- [X] T066 [P] [US5] Document client SDK generation process in `packages/api/README.md` (openapi-generator command, TypeScript target)
- [X] T067 [P] [US5] Create example TypeScript SDK generation workflow in `packages/api/scripts/generate-client-sdk.sh`

### Testing

- [X] T068 [US5] Add Swagger UI integration test in `packages/api/test/integration/swagger.test.ts` (GET /api-docs returns HTML, spec includes all endpoints)
- [X] T069 [P] [US5] Verify OpenAPI spec validity by running `pnpm openapi:validate` in CI

**Checkpoint**: User Story 5 complete - full API documentation available, client SDK generation enabled

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and finalize the feature

### Documentation

- [X] T070 [P] [Polish] Update `docs/requirement.md` with HTTP API server overview (endpoints, deployment, TailScale setup)
- [X] T071 [P] [Polish] Create `packages/api/README.md` with detailed startup instructions, environment variables, testing guide
- [X] T072 [P] [Polish] Validate all steps in `specs/009-https-github-com/quickstart.md` work correctly

### Code Quality

- [X] T073 [P] [Polish] Run ESLint on `packages/api/src/**/*.ts` and fix all warnings
- [X] T074 [P] [Polish] Add JSDoc comments to all public functions in handlers and middleware
- [X] T075 [P] [Polish] Ensure all error messages match CLI format exactly (use existing messages from `meme-gtd-db`)

### CI/CD Integration

- [X] T076 [Polish] Add API server tests to root `package.json` script `test` (run `pnpm --filter meme-gtd-api test`)
- [X] T077 [P] [Polish] Add API server build to root `package.json` script `build` (run `pnpm --filter meme-gtd-api build`)
- [X] T078 [P] [Polish] Create GitHub Actions workflow `.github/workflows/api-test.yml` (install, build, test, openapi validate)

### Performance & Security

- [X] T079 [P] [Polish] Enable SQLite WAL mode in config initialization (verify in `meme-gtd-db` or `meme-gtd-config`)
- [X] T080 [P] [Polish] Add request timeout configuration (default 30s) in Fastify server options
- [X] T081 [P] [Polish] Verify no sensitive information (stack traces, DB paths) leaks in production error responses

### Final Validation

- [X] T082 [Polish] Run full integration test suite (`pnpm --filter meme-gtd-api test`) - all tests pass
- [X] T083 [Polish] Start serverにて代表的なエンドポイントを手動確認
- [ ] T084 [Polish] Start server in production mode with TailScale config, verify CORS and logging work correctly
- [X] T085 [Polish] Generate OpenAPI spec, validate with Redocly, serve Swagger UI, verify all endpoints documented

### OpenAPI Polish (Follow-up)

- [X] T086 [Polish] Add `summary` and `operationId` to every documented operation (eliminate Redocly warnings)
- [X] T087 [Polish] Document representative `4xx` responses for each endpoint category
- [X] T088 [Polish] Re-run `pnpm openapi:generate && pnpm openapi:validate`; update docs once warnings reach zero

**Checkpoint**: Feature complete - HTTP API server ready for deployment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational (Phase 2) completion
- **User Story 2 (Phase 4)**: Depends on Foundational (Phase 2) completion - can run in parallel with US1
- **User Story 3 (Phase 5)**: Depends on Foundational (Phase 2) completion - can run in parallel with US1/US2
- **User Story 4 (Phase 6)**: Depends on US1/US2/US3 having routes registered (needs endpoints to test config/errors) - can enhance incrementally
- **User Story 5 (Phase 7)**: Depends on all routes being implemented (needs complete API for docs) - should be last feature
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can start after Foundational
- **User Story 2 (P1)**: Independent - can start after Foundational, can run in parallel with US1
- **User Story 3 (P2)**: Independent - can start after Foundational, can run in parallel with US1/US2
- **User Story 4 (P2)**: Requires at least one endpoint to exist (US1 or US2) for testing config/errors
- **User Story 5 (P3)**: Requires all endpoints implemented (US1+US2+US3) for complete documentation

### Within Each User Story

- Schemas before handlers (handlers use schema types)
- Handlers before routes (routes call handlers)
- Routes before tests (tests call routes)
- Tests can run in parallel if marked [P]

### Parallel Opportunities

- **Phase 1 (Setup)**: T003, T004, T005 can run in parallel
- **Phase 2 (Foundational)**: T010, T013, T014, T015, T018, T019 can run in parallel
- **Phase 3 (US1)**: T020, T021, T022 schemas can run in parallel; T024 in parallel with T023; T028, T029, T030 tests in parallel after T027
- **Phase 4 (US2)**: T031 in parallel with T033; T037, T038, T039 tests in parallel after T036
- **Phase 5 (US3)**: T040, T041 in parallel; T043 in parallel with T042; T045 in parallel with T044; T049 in parallel with T048
- **Phase 6 (US4)**: T052, T054, T056, T057, T058, T059 can run in parallel
- **Phase 7 (US5)**: T061, T062, T064, T065, T066, T067, T069 can run in parallel after T060
- **Phase 8 (Polish)**: T070, T071, T072, T073, T074, T075, T077, T078, T079, T080, T081 can run in parallel

---

## Parallel Example: User Story 1

```bash
# After T019 (Foundation complete), launch US1 schemas in parallel:
Task T020: "Define Memo schemas in packages/api/src/schemas/memoSchemas.ts"
Task T021: "Define Comment schemas in packages/api/src/schemas/commentSchemas.ts"
Task T022: "Define error response schemas in packages/api/src/schemas/errorSchemas.ts"

# After T023 complete, launch T024 in parallel:
Task T024: "Implement memo comment handlers"  # Different file from T023

# After T027 complete, launch all tests in parallel:
Task T028: "Implement memo promote integration test"
Task T029: "Implement memo bookmark integration test"
Task T030: "Implement memo comment integration tests"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2 Only)

1. Complete Phase 1: Setup → 5 tasks
2. Complete Phase 2: Foundational (CRITICAL) → 14 tasks
3. Complete Phase 3: User Story 1 (Memo operations) → 11 tasks
4. **STOP and VALIDATE**: Test US1 independently via integration tests
5. Complete Phase 4: User Story 2 (Task operations) → 9 tasks
6. **STOP and VALIDATE**: Test US2 independently via integration tests
7. **MVP READY**: Core GTD workflow (memos + tasks) accessible via HTTP API
8. Deploy/demo if ready

### Incremental Delivery

1. **Foundation Ready** (Phase 1+2): Server infrastructure complete → 19 tasks
2. **+User Story 1** (Phase 3): Memo management → 11 tasks → Test independently → **Memo MVP**
3. **+User Story 2** (Phase 4): Task management → 9 tasks → Test independently → **GTD Core MVP**
4. **+User Story 3** (Phase 5): Labels and links → 10 tasks → Test independently → **Organization features**
5. **+User Story 4** (Phase 6): Production config → 10 tasks → Test independently → **Production ready**
6. **+User Story 5** (Phase 7): OpenAPI docs → 10 tasks → Test independently → **Developer friendly**
7. **+Polish** (Phase 8): Final validation → 16 tasks → **Feature complete**

### Parallel Team Strategy

With 2-3 developers:

1. **Together**: Complete Setup (Phase 1) + Foundational (Phase 2) → 19 tasks
2. **Once Foundational is done**:
   - **Developer A**: User Story 1 (Memo operations) → 11 tasks
   - **Developer B**: User Story 2 (Task operations) → 9 tasks
   - **Developer C**: User Story 3 (Labels/Links) → 10 tasks (can start in parallel)
3. **Sequential after US1+US2+US3**:
   - **Developer A**: User Story 4 (Config/Deploy) → 10 tasks
   - **Developer B**: User Story 5 (OpenAPI) → 10 tasks
4. **Together**: Polish (Phase 8) → 16 tasks

---

## Summary

**Total Tasks**: 85 tasks

**Task Count by Phase**:
- Phase 1 (Setup): 5 tasks
- Phase 2 (Foundational): 14 tasks ⚠️ BLOCKING
- Phase 3 (US1 - Memos P1): 11 tasks 🎯 MVP
- Phase 4 (US2 - Tasks P1): 9 tasks 🎯 MVP
- Phase 5 (US3 - Labels/Links P2): 10 tasks
- Phase 6 (US4 - Config/Deploy P2): 10 tasks
- Phase 7 (US5 - OpenAPI P3): 10 tasks
- Phase 8 (Polish): 16 tasks

**Parallel Opportunities**: 42 tasks marked [P] (49% can run in parallel within phases)

**Independent Test Criteria**:
- **US1**: POST /api/memos, GET /api/memos work correctly
- **US2**: POST /api/tasks, GET /api/tasks?status=next work correctly
- **US3**: POST /api/labels, POST /api/links work correctly
- **US4**: Server starts with custom config, handles all errors gracefully
- **US5**: Swagger UI at /api-docs shows all endpoints

**Suggested MVP Scope**: Phase 1 + 2 + 3 + 4 (Setup + Foundation + US1 + US2) = **44 tasks** = Memo + Task management via HTTP API

**Time Estimate** (assuming 1 developer):
- Small tasks (schemas, config): 0.5-1 hour each
- Medium tasks (handlers, routes): 1-2 hours each
- Large tasks (error handler, tests): 2-4 hours each
- **MVP (44 tasks)**: ~60-80 hours (1.5-2 weeks full-time)
- **Full feature (85 tasks)**: ~110-140 hours (3-3.5 weeks full-time)

**Critical Path**: Setup → Foundational → US1/US2 (parallel) → US4 → US5 → Polish

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Stop at any checkpoint to validate story independently
- Commit after each task or logical group
- Avoid: vague tasks, same file conflicts, cross-story dependencies

**Next Step**: `/speckit.implement` to begin executing tasks in order
