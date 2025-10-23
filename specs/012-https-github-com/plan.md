# Implementation Plan: Add Comment Count to API List Responses

**Branch**: `012-https-github-com` | **Date**: 2025-10-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-https-github-com/spec.md`

## Summary

Add `commentCount` field to GET /api/memos and GET /api/tasks list endpoints. The field will contain the number of non-deleted comments for each item, calculated efficiently via SQL COUNT aggregation in the database layer. This enables the Web UI to display comment activity without additional API calls.

**Technical Approach**: Extend the database repository layer to include comment count aggregation using SQL LEFT JOIN and COUNT, propagate the field through the service layer, update API schemas to include the field, and ensure all tests validate the new field.

## Technical Context

**Language/Version**: TypeScript (ES Modules), Node.js >= 22.0.0
**Primary Dependencies**: better-sqlite3 (database), Fastify (API server), Zod (schema validation)
**Storage**: SQLite database with `issues` and `comments` tables
**Testing**: Vitest (unit tests), integration tests for API endpoints
**Target Platform**: Node.js server (API package), CLI (uses core/db packages)
**Project Type**: Monorepo with multiple packages (pnpm workspace)
**Performance Goals**: List endpoint response times must not degrade by more than 10%
**Constraints**: Must exclude soft-deleted comments (is_deleted = 1), must maintain backward compatibility (additive change only)
**Scale/Scope**: Affects 3 packages (db, core, api) and 2 endpoints (memos, tasks)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: No formal constitution file exists for this project. Based on the project documentation (`docs/requirement.md`), the following principles apply:

### Monorepo Structure (Package Organization)
✅ **PASS**: This change follows the existing layered architecture:
- Database layer (`packages/db`) for data access
- Core layer (`packages/core`) for business logic services
- API layer (`packages/api`) for HTTP endpoints
- No new packages required

### CLI Interface Compatibility
✅ **PASS**: This change does not affect CLI behavior or output. CLI commands use the core service layer directly and do not require comment counts in list operations (per spec's "Out of Scope" section).

### Test Coverage
✅ **PASS**: Feature requires:
- Database repository tests for comment count aggregation
- Service layer tests for field propagation
- API integration tests for schema validation
- All existing tests must continue to pass (backward compatibility)

### API Design Principles
✅ **PASS**:
- Follows existing patterns (extend list responses with computed fields, similar to how labels are added)
- Maintains OpenAPI schema compliance
- Backward compatible (additive change)
- Uses Zod for validation

**Constitution Status**: ✅ All applicable principles satisfied. No violations requiring justification.

## Project Structure

### Documentation (this feature)

```
specs/012-https-github-com/
├── spec.md              # Feature specification
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (SQL aggregation patterns)
├── data-model.md        # Phase 1 output (comment count field addition)
├── quickstart.md        # Phase 1 output (developer guide)
├── contracts/           # Phase 1 output (updated OpenAPI schemas)
│   ├── memo-schema.yaml
│   └── task-schema.yaml
├── checklists/          # Quality validation
│   └── requirements.md  # Spec validation checklist (already created)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

This is a monorepo managed by pnpm with multiple packages:

```
packages/
├── db/                  # Database layer (PRIMARY CHANGE LOCATION)
│   ├── src/
│   │   ├── memoRepository.ts      # Add comment count to listMemos()
│   │   ├── taskRepository.ts      # Add comment count to listTasks()
│   │   └── index.ts               # Export updated types
│   └── test/
│       ├── memoRepository.test.ts # Test comment count aggregation
│       └── taskRepository.test.ts # Test comment count aggregation
│
├── core/                # Business logic layer (SECONDARY CHANGE LOCATION)
│   ├── src/
│   │   └── index.ts               # MemoService.list() and TaskService.list()
│   └── test/
│       └── index.test.ts          # Test service layer propagation
│
├── api/                 # HTTP API layer (TERTIARY CHANGE LOCATION)
│   ├── src/
│   │   ├── schemas/
│   │   │   ├── memoSchemas.ts     # Update MemoSchema with commentCount
│   │   │   └── taskSchemas.ts     # Update TaskSchema with commentCount
│   │   ├── handlers/
│   │   │   ├── memoHandlers.ts    # listMemosHandler (no change needed)
│   │   │   └── taskHandlers.ts    # listTasksHandler (no change needed)
│   │   └── routes/
│   │       ├── memos.ts           # Route definition (verify schema)
│   │       └── tasks.ts           # Route definition (verify schema)
│   └── test/
│       ├── integration/
│       │   ├── memos.test.ts      # Test GET /api/memos includes commentCount
│       │   └── tasks.test.ts      # Test GET /api/tasks includes commentCount
│
├── shared/              # Shared types (MINOR UPDATE)
│   └── src/
│       └── types.ts               # Update Memo/Task types if needed
│
├── cli/                 # CLI package (NO CHANGES REQUIRED)
├── config/              # Configuration package (NO CHANGES REQUIRED)
├── logger/              # Logging package (NO CHANGES REQUIRED)
└── web/                 # Web UI package (CONSUMER - NO CHANGES IN THIS FEATURE)
```

**Structure Decision**: This is a monorepo with 10 packages managed by pnpm workspaces. The feature follows the established layered architecture:
1. **Database layer** (`packages/db`) implements SQL aggregation
2. **Core layer** (`packages/core`) exposes the field via services
3. **API layer** (`packages/api`) validates and serves the field
4. **Shared layer** (`packages/shared`) provides common types

The change is purely additive and backward compatible, affecting only list operations for memos and tasks.

## Complexity Tracking

*No Constitution violations - this section is not applicable.*

This feature follows all established patterns and requires no justification for complexity.

## Phase 0: Research (COMPLETED)

✅ **Status**: Research complete
✅ **Output**: `research.md`

**Key Decisions**:
1. **SQL Pattern**: Subquery in SELECT (not LEFT JOIN with GROUP BY)
2. **Type System**: Optional commentCount in shared types, required in API schemas
3. **Performance**: Use existing FK index, no explicit index needed initially
4. **Soft Deletes**: Exclude deleted comments with `WHERE is_deleted = 0`

See [research.md](./research.md) for detailed analysis.

## Phase 1: Design & Contracts (COMPLETED)

✅ **Status**: Design artifacts generated
✅ **Outputs**:
- `data-model.md` - Complete data model with type definitions
- `contracts/memo-schema.yaml` - OpenAPI schema for memo endpoint
- `contracts/task-schema.yaml` - OpenAPI schema for task endpoint
- `quickstart.md` - Developer implementation guide

**Design Summary**:
- Database layer: Add correlated subquery to `listMemos()` and `listTasks()`
- Core layer: No changes needed (field propagates automatically)
- API layer: Update Zod schemas to include required `commentCount` field
- Types: Optional field in shared types, required in API responses

### Constitution Re-Check (Post-Design)

✅ **PASS**: All design decisions comply with project principles

**Validation**:
- ✅ Layered architecture preserved (db → core → api)
- ✅ No new packages or abstractions added
- ✅ Test coverage plan includes all layers
- ✅ Backward compatibility maintained (additive change)
- ✅ Follows existing patterns (similar to how labels are added)

**Agent Context Updated**: ✅
- Added SQLite subquery patterns
- Added Fastify + Zod validation context
- Preserved manual additions in CLAUDE.md

## Phase 2: Task Generation (NOT YET STARTED)

⏳ **Status**: Awaiting `/speckit.tasks` command

The planning phase is complete. Next step is to run `/speckit.tasks` to generate the actionable task list for implementation.
