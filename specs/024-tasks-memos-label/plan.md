# Implementation Plan: Label and Status Search for Tasks and Memos

**Branch**: `024-tasks-memos-label` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-tasks-memos-label/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add label and status filtering capabilities to the Web UI, REST API, and CLI for tasks and memos. The database and CLI already support label filtering, but these capabilities are not exposed in the API endpoints or Web UI. This feature will:

1. **Web UI**: Add GitHub-style search input with `label:bug` and `status:open` syntax
2. **REST API**: Add `label` and `status` query parameters to existing `/api/tasks` and `/api/memos` endpoints
3. **CLI**: Extend existing `--label` and `--status` flags to support comma-separated values for OR-based filtering

The implementation leverages existing database filtering logic and extends the API/UI layers to expose these capabilities with consistent behavior across all three interfaces.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**:
- **Backend**: Fastify 5.2.0, better-sqlite3 9.0.0, Zod 3.23.8, @oclif/core 4.0.0
- **Frontend**: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11

**Storage**: SQLite database with existing schema:
- `issues` table (tasks and memos with type discriminator)
- `labels` table (shared labels)
- `issue_labels` join table (many-to-many relationship)

**Testing**:
- **CLI**: Node.js built-in test runner (`node --test`)
- **API**: Node.js test runner with Fastify injection
- **Web**: Vitest + React Testing Library, Playwright for E2E

**Target Platform**:
- **API**: Node.js server (Linux/macOS)
- **CLI**: Node.js CLI (Linux/macOS/Windows)
- **Web**: Modern browsers (Chrome, Firefox, Safari, Edge)

**Project Type**: Monorepo with separate web frontend, REST API backend, and CLI packages

**Performance Goals**:
- API responses: <500ms for 1000 items
- Web UI search: <300ms for filtering 1000 items
- CLI: <2 seconds for list commands with filtering

**Constraints**:
- Must maintain backward compatibility (no breaking changes to existing API/CLI)
- Must use existing database schema (no schema migrations required)
- Must work with existing SQLite FTS5 full-text search
- Case-insensitive label matching required

**Scale/Scope**:
- Expected dataset: Up to 1000 tasks + 1000 memos per user
- Label cardinality: Up to 50 unique labels
- Multiple labels per item: 0-10 labels per task/memo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project does not have a ratified constitution file yet (`.specify/memory/constitution.md` contains template placeholders). Based on CLAUDE.md project guidelines and common best practices, here are the implied gates:

### Implied Gates (from CLAUDE.md)

✅ **Test Environment Safety**:
- All CLI testing must use `pnpm mgtd:test` wrapper with test database
- No production database access during development
- **Status**: PASS - Implementation will use test environment for all verification

✅ **No Breaking Changes**:
- Existing API endpoints must remain backward compatible
- Existing CLI flags must continue working
- **Status**: PASS - Adding optional query parameters and extending existing flags (non-breaking)

✅ **Documentation Updates Required**:
- README.md and docs/ must be updated for new filtering capabilities
- **Status**: PASS - Plan includes documentation updates

✅ **Pre-Implementation Approval**:
- File creation/updates require user approval before execution
- **Status**: PASS - Plan will be reviewed before implementation

✅ **Incremental Commits**:
- Logical separation of changes with meaningful commit messages
- **Status**: PASS - Implementation will follow commit-per-feature pattern

### Additional Quality Gates

✅ **Cross-Interface Consistency**:
- Same filter query must produce same results across Web UI, API, and CLI
- **Status**: PASS - Implementation uses shared database layer ensuring consistency

✅ **Testing Coverage**:
- Unit tests for new API endpoints and query parameter parsing
- Integration tests for CLI flags with comma-separated values
- E2E tests for Web UI search input
- **Status**: PASS - Plan includes comprehensive test coverage

**Constitution Check Result**: ✅ **PASS** (all implied gates satisfied)

## Project Structure

### Documentation (this feature)

```
specs/024-tasks-memos-label/
├── spec.md                  # Feature specification (completed)
├── plan.md                  # This file (/speckit.plan command output)
├── research.md              # Phase 0 output (to be generated)
├── data-model.md            # Phase 1 output (to be generated)
├── quickstart.md            # Phase 1 output (to be generated)
├── contracts/               # Phase 1 output (to be generated)
│   ├── api-updates.yaml    # OpenAPI spec updates for query parameters
│   └── cli-flags.md        # CLI flag specifications
├── checklists/
│   └── requirements.md      # Specification quality checklist (completed)
└── tasks.md                 # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

This is a **monorepo web application** with separate packages for backend API, frontend web UI, CLI, and shared libraries.

```
meme-gtd/
├── packages/
│   ├── api/                           # REST API server (Fastify)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── tasks.ts          # MODIFY: Add label query param to GET /api/tasks
│   │   │   │   └── memos.ts          # MODIFY: Add label query param to GET /api/memos
│   │   │   ├── handlers/
│   │   │   │   ├── taskHandlers.ts   # MODIFY: Parse and pass label filter to service
│   │   │   │   └── memoHandlers.ts   # MODIFY: Parse and pass label filter to service
│   │   │   ├── schemas/
│   │   │   │   ├── taskSchemas.ts    # MODIFY: Add label to TaskQuerySchema
│   │   │   │   └── memoSchemas.ts    # MODIFY: Add label to MemoQuerySchema
│   │   │   └── index.ts
│   │   ├── test/
│   │   │   ├── routes/
│   │   │   │   ├── tasks.test.ts     # MODIFY: Add tests for label filtering
│   │   │   │   └── memos.test.ts     # MODIFY: Add tests for label filtering
│   │   │   └── integration/          # ADD: Integration tests for filter combinations
│   │   └── docs/api/
│   │       └── openapi.yaml          # MODIFY: Update with new query parameters
│   │
│   ├── cli/                           # Command-line interface (oclif)
│   │   ├── src/commands/
│   │   │   ├── task/
│   │   │   │   └── list.ts           # MODIFY: Support comma-separated --label flag
│   │   │   └── memo/
│   │   │       └── list.ts           # MODIFY: Support comma-separated --label flag
│   │   └── test/commands/
│   │       ├── task/
│   │       │   └── list.test.js      # MODIFY: Add tests for comma-separated labels
│   │       └── memo/
│   │           └── list.test.js      # MODIFY: Add tests for comma-separated labels
│   │
│   ├── web/                           # React web UI (Vite + React Router)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── SearchInput.tsx   # ADD: GitHub-style search input component
│   │   │   │   ├── FilterBar.tsx     # MODIFY: Replace with SearchInput
│   │   │   │   └── ItemList.tsx      # VERIFY: Already displays labels (no changes)
│   │   │   ├── pages/
│   │   │   │   ├── TasksPage.tsx     # MODIFY: Add search input, URL state for filters
│   │   │   │   └── MemosPage.tsx     # MODIFY: Add search input, URL state for filters
│   │   │   ├── hooks/
│   │   │   │   ├── useSearchQuery.ts # ADD: Parse label:bug status:open syntax
│   │   │   │   └── useUrlFilters.ts  # ADD: Sync filters with URL search params
│   │   │   └── utils/
│   │   │       └── queryParser.ts    # ADD: Parse GitHub-style query syntax
│   │   └── test/
│   │       ├── components/
│   │       │   └── SearchInput.test.tsx  # ADD: Unit tests for search input
│   │       ├── utils/
│   │       │   └── queryParser.test.ts   # ADD: Unit tests for query parser
│   │       └── e2e/
│   │           ├── tasks-filter.spec.ts  # ADD: E2E tests for task filtering
│   │           └── memos-filter.spec.ts  # ADD: E2E tests for memo filtering
│   │
│   ├── db/                            # Database layer (better-sqlite3)
│   │   ├── src/
│   │   │   ├── taskRepository.ts     # MODIFY: Support comma-separated labels (OR logic)
│   │   │   └── memoRepository.ts     # MODIFY: Support comma-separated labels (OR logic)
│   │   └── test/
│   │       ├── taskRepository.test.ts  # MODIFY: Add tests for multiple label filtering
│   │       └── memoRepository.test.ts  # MODIFY: Add tests for multiple label filtering
│   │
│   ├── core/                          # Business logic services
│   │   └── src/
│   │       ├── TaskService.ts        # VERIFY: Passes filters through (no changes needed)
│   │       └── MemoService.ts        # VERIFY: Passes filters through (no changes needed)
│   │
│   └── shared/                        # Shared types and utilities
│       └── src/
│           └── types.ts              # VERIFY: FilterInterfaces already defined
│
├── docs/
│   ├── cli-commands.md               # MODIFY: Document comma-separated label syntax
│   └── api-filtering.md              # ADD: Document API query parameters for filtering
│
└── test-data/
    └── test.db                        # Test database for development
```

**Structure Decision**:

This project uses a **monorepo web application** structure with clear separation:
- `packages/api/` - Fastify REST API server
- `packages/web/` - React SPA with Vite
- `packages/cli/` - oclif-based CLI
- `packages/db/` - SQLite database access layer (shared by all packages)
- `packages/core/` - Business logic services (shared by all packages)
- `packages/shared/` - TypeScript types and interfaces

The database layer (`packages/db/`) already implements label filtering logic. This feature primarily involves:
1. **API surface changes**: Exposing existing database capabilities through API query parameters
2. **Web UI additions**: Adding search input component and query parser
3. **CLI enhancements**: Extending existing `--label` flag to support comma-separated values

No database schema changes are required - this is purely an interface/presentation layer feature leveraging existing data structures.

## Complexity Tracking

*This section is empty because there are no Constitution violations requiring justification.*

The implementation follows all best practices:
- Uses existing database layer (no new abstraction layers)
- Adds minimal new components (SearchInput, queryParser)
- Extends existing API/CLI patterns (query params, flags)
- Maintains backward compatibility
- No architectural complexity introduced
