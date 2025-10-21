# Implementation Plan: Include Labels in API Responses

**Branch**: `011-https-github-com` | **Date**: 2025-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-https-github-com/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add `labels` array field to API responses for memos and tasks, enabling Web UI to display label information. This involves modifying list and detail endpoints in the API package to include label data by joining the `issue_labels` and `labels` tables. The CLI package will also be updated to include labels in JSON output.

## Technical Context

**Language/Version**: TypeScript 5.5+ (Node.js 22.0+)
**Primary Dependencies**:
- API: Fastify 5, Zod, better-sqlite3
- Core: meme-gtd-db (existing DB layer)
- CLI: oclif 4, chalk, inquirer
**Storage**: SQLite (better-sqlite3) - existing `issue_labels` and `labels` tables
**Testing**: Node.js native test runner, supertest (API integration tests), vitest (unit tests)
**Target Platform**: Node.js server (API), CLI (local)
**Project Type**: Monorepo (pnpm workspaces) with multiple packages
**Performance Goals**: API response time increase <50ms when including labels
**Constraints**:
- Must maintain backward compatibility with existing API endpoints
- Must not break existing Web UI or CLI functionality
**Scale/Scope**:
- 4 API endpoints to modify (GET /api/memos, GET /api/memos/:id, GET /api/tasks, GET /api/tasks/:id)
- 4 CLI commands to modify (memo list, memo view, task list, task view)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS

**Analysis**:
- No new libraries or packages required - modifying existing `api`, `core`, and `cli` packages
- Uses existing database schema (no schema changes)
- Follows existing patterns for API responses and CLI output
- Maintains backward compatibility
- Test coverage required for modified endpoints (integration tests already exist)

**Constitution File**: No project-specific constitution found (.specify/memory/constitution.md is template). Using general best practices:
- Existing test patterns followed
- No breaking changes
- Incremental enhancement to existing functionality

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
├── api/                          # HTTP REST API server (Fastify)
│   ├── src/
│   │   ├── handlers/            # Request handlers (modify: memoHandlers.ts, taskHandlers.ts)
│   │   ├── schemas/             # Zod schemas (modify: MemoSchema, TaskSchema)
│   │   └── routes/              # Endpoint definitions
│   └── test/
│       └── integration/         # API integration tests (modify: memos.test.ts, tasks.test.ts)
│
├── core/                         # Business logic layer
│   └── src/
│       └── index.ts             # Service classes (MemoService, TaskService) - modify list/show methods
│
├── db/                          # Database layer (SQLite)
│   └── src/
│       ├── memoRepository.ts    # Memo DB operations (modify: listMemos, getMemo)
│       ├── taskRepository.ts    # Task DB operations (modify: listTasks, getTask)
│       └── labelRepository.ts   # Label DB operations (use existing: listMemoLabels, listTaskLabels)
│
├── cli/                         # CLI application (oclif)
│   ├── src/
│   │   └── commands/
│   │       ├── memo/            # Memo commands (modify: list.ts, view.ts)
│   │       └── task/            # Task commands (modify: list.ts, view.ts)
│   └── test/
│       └── commands/            # CLI command tests
│
└── web/                         # React Web UI (no changes in this feature)
    └── src/api/                 # Auto-generated API client (will be regenerated after API changes)
```

**Structure Decision**: Monorepo with pnpm workspaces. Changes isolated to:
- `packages/api`: Add labels to response schemas and handlers
- `packages/core`: Update service methods to include labels
- `packages/db`: Use existing label query functions
- `packages/cli`: Update JSON output formatting

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: No violations - no complexity tracking needed

**Post-Design Re-evaluation**:
- ✅ No new packages added
- ✅ Uses existing database functions (`listMemoLabels`, `listTaskLabels`)
- ✅ Follows existing patterns in service layer
- ✅ Additive API changes only (backward compatible)
- ✅ Test coverage maintained/extended

**Complexity Assessment**: Low
- Simple map operations in service layer
- Reuses existing, well-tested DB functions
- No new abstractions introduced
- Straightforward implementation following established patterns

