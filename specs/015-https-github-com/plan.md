# Implementation Plan: Project Management CLI Commands

**Branch**: `015-https-github-com` | **Date**: 2025-10-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-https-github-com/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement CLI commands and Web API endpoints for project management to organize tasks and memos into projects. The feature provides CRUD operations for projects and project items through both CLI (`mgtd project`) and REST API (`/api/projects`). Database tables (projects, project_items) are already implemented. This feature adds:
1. CLI layer using oclif framework
2. API layer using Fastify with OpenAPI documentation
3. Service and repository layers for business logic and data access

Following the existing monorepo architecture and patterns established by tasks, memos, and links features.

## Technical Context

**Language/Version**: TypeScript 5.5 / Node.js 22+
**Primary Dependencies**:
- CLI: @oclif/core 4.0, better-sqlite3 9.0, zod 3.23
- API: fastify 5.2, fastify-type-provider-zod 4.0, @fastify/cors 10.0
**Storage**: SQLite database (projects and project_items tables already exist in schema/001_init.sql)
**Testing**: Node.js built-in test runner (node --test), integration tests for both CLI and API
**Target Platform**:
- CLI tool for macOS/Linux/Windows
- HTTP API server (localhost development, production deployment)
**Project Type**: Monorepo with packages (cli, api, core, db, shared) - Full-stack implementation
**Performance Goals**:
- CLI: Sub-100ms response for single operations, sub-500ms for list operations
- API: Sub-200ms p95 latency for all endpoints
**Constraints**:
- Follow existing command patterns (memo, task, link)
- Follow existing API patterns (RESTful, Zod validation, OpenAPI docs)
- CLI and API must share same service/repository layer
- JSON output format must be consistent between CLI and API
**Scale/Scope**:
- 7 CLI commands (create, list, view, add, remove, move, delete)
- 7 API endpoints (POST /projects, GET /projects, GET /projects/:id, POST /projects/:id/items, DELETE /projects/:id/items/:issueId, PATCH /projects/:id/items/:issueId, DELETE /projects/:id)
- 2 repositories (projectRepository, projectItemRepository)
- 1 service (projectService)
- Integration with existing issue repository

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (No constitution file present - using project conventions)

**Architecture Compliance**:
- ✅ Follows existing monorepo structure (packages/cli, packages/core, packages/db)
- ✅ Uses established patterns (oclif commands, repository layer, service layer)
- ✅ Database schema already implemented (no new tables required)
- ✅ Integrates with existing infrastructure (config, logger, shared utilities)

**Testing Approach**:
- ✅ Node.js test runner already in use (packages/cli/test/)
- ✅ Integration tests for CLI commands (existing pattern: test/commands/*)
- ✅ Repository tests if new repository methods added

**No Constitution Violations**: Feature extends existing patterns without introducing new architectural concepts.

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
├── cli/                      # CLI commands layer (NEW FILES)
│   ├── src/
│   │   └── commands/
│   │       └── project/      # NEW: Project command namespace
│   │           ├── index.ts  # NEW: mgtd project (help/list)
│   │           ├── create.ts # NEW: mgtd project create
│   │           ├── view.ts   # NEW: mgtd project view
│   │           ├── add.ts    # NEW: mgtd project add
│   │           ├── remove.ts # NEW: mgtd project remove
│   │           ├── move.ts   # NEW: mgtd project move
│   │           └── delete.ts # NEW: mgtd project delete
│   └── test/
│       └── commands/
│           └── project/      # NEW: Integration tests for CLI
│
├── api/                      # API layer (NEW FILES)
│   └── src/
│       ├── routes/
│       │   └── projects.ts           # NEW: Project routes registration
│       ├── handlers/
│       │   └── projectHandlers.ts    # NEW: Request handlers
│       ├── schemas/
│       │   └── projectSchemas.ts     # NEW: Zod validation schemas
│       └── index.ts                  # MODIFY: Register project routes
│
├── db/                       # Repository layer (NEW FILES)
│   └── src/
│       ├── projectRepository.ts      # NEW: Project CRUD operations
│       ├── projectItemRepository.ts  # NEW: Project item operations
│       └── index.ts                  # MODIFY: Export new repositories
│
├── core/                     # Service layer (NEW FILES)
│   └── src/
│       ├── projectService.ts         # NEW: Business logic (shared by CLI+API)
│       └── index.ts                  # MODIFY: Export new service
│
└── shared/                   # Types (NEW FILES)
    └── src/
        ├── types/
        │   └── project.ts            # NEW: Project and ProjectItem types
        └── index.ts                  # MODIFY: Export new types
```

**Structure Decision**: Monorepo with layered architecture (CLI/API → Service → Repository → DB). New feature adds:
- **CLI layer**: 7 command files in packages/cli/src/commands/project/
- **API layer**: 3 files in packages/api/src/ (routes, handlers, schemas)
- **Service layer**: 1 service file in packages/core/src/
- **Repository layer**: 2 repository files in packages/db/src/
- **Types**: 1 types file in packages/shared/src/types/
- **Tests**: Integration tests for both CLI and API

This follows the established full-stack pattern used by tasks, memos, and links features.

## Complexity Tracking

*No violations - this section is empty*

