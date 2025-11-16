# Implementation Plan: Add "inbox" and "someday" Task Statuses

**Branch**: `027-task-status-someday-inbox` | **Date**: 2025-11-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/user/meme-gtd/specs/027-task-status-someday-inbox/spec.md`

## Summary

Extend the meme-gtd task management system to support GTD workflow by adding two new task statuses: "inbox" (for newly captured, unprocessed tasks) and "someday" (for deferred, non-actionable ideas). This change impacts the database schema validation, API endpoints, CLI commands, and Web UI components to ensure full support across all interfaces.

**Technical Approach**: Extend the existing TaskStatus type/enum from 6 values to 8 values, update validation schemas in shared package, modify database constraints, and ensure all UI components (CLI, API, Web) handle the new statuses consistently. No database migration is required as SQLite's TEXT column already accepts any string value; validation is handled at the application layer.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**:
- Backend: Fastify 5.2.0, better-sqlite3 9.0.0, Zod 3.23.8, Pino 9.5.0
- Frontend: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11, Tailwind CSS 4.1.14

**Storage**: SQLite database (better-sqlite3)
**Testing**: Vitest (unit tests), Node.js native test runner, Playwright (e2e tests)
**Target Platform**: Linux/macOS/Windows (CLI + API server), Web browsers (Chrome, Firefox, Safari)
**Project Type**: Monorepo with multiple packages (web + backend + CLI)
**Performance Goals**: Task creation/update operations complete in <2 seconds (SC-001)
**Constraints**:
- No breaking changes to existing data (existing "open" tasks preserved - FR-018)
- Backward compatibility with existing API consumers
- Consistent behavior across CLI, API, and Web UI interfaces

**Scale/Scope**:
- ~8 packages in monorepo
- 18 functional requirements
- 3 prioritized user stories
- Affects 4 layers: database, core logic, API, CLI, Web UI

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: This project does not yet have a fully defined constitution. Based on CLAUDE.md and existing codebase patterns, the following principles are inferred:

### Principle 1: Multi-Interface Consistency
**Status**: ✅ PASS
**Rule**: Features must be implemented consistently across CLI, API, and Web UI
**Compliance**: Spec includes functional requirements for all three interfaces (FR-007 to FR-012)

### Principle 2: Backward Compatibility
**Status**: ✅ PASS
**Rule**: Existing data and functionality must be preserved
**Compliance**: FR-018 explicitly requires existing "open" tasks remain unchanged; no automatic migration

### Principle 3: Type Safety with Zod
**Status**: ✅ PASS
**Rule**: All data validation uses Zod schemas defined in shared package
**Compliance**: TaskStatus enum will be extended in meme-gtd-shared package, used by all consumers

### Principle 4: No Direct SQL in Application Code
**Status**: ✅ PASS
**Rule**: Database access goes through meme-gtd-db package abstractions
**Compliance**: Changes will be made to db package's models and queries, not direct SQL in API/CLI

### Principle 5: Test Coverage Required
**Status**: ⚠️  PENDING (verify after Phase 1)
**Rule**: New functionality must have test coverage
**Compliance**: Will add unit tests for schema validation, integration tests for API endpoints, e2e tests for Web UI

## Project Structure

### Documentation (this feature)

```text
specs/027-task-status-someday-inbox/
├── plan.md              # This file (/speckit:plan command output)
├── spec.md              # Feature specification (already exists)
├── research.md          # Phase 0 output (/speckit:plan command)
├── data-model.md        # Phase 1 output (/speckit:plan command)
├── quickstart.md        # Phase 1 output (/speckit:plan command)
├── contracts/           # Phase 1 output (/speckit:plan command)
│   └── api.yaml         # Updated OpenAPI spec with new status values
├── checklists/          # Already exists
│   └── requirements.md  # Already exists
└── tasks.md             # Phase 2 output (/speckit:tasks command)
```

### Source Code (repository root)

```text
# Monorepo structure (existing)
packages/
├── shared/              # Shared type definitions and utilities
│   └── src/
│       └── types.ts     # ⚠️  MODIFY: Extend TaskStatus enum
│
├── db/                  # Database access layer
│   └── src/
│       ├── models/
│       │   └── task.ts  # ⚠️  MODIFY: Update task model validation
│       └── queries/
│           └── task.ts  # ⚠️  VERIFY: Ensure queries handle new statuses
│
├── core/                # Business logic
│   └── src/
│       └── task.ts      # ⚠️  MODIFY: Update task operations for new statuses
│
├── api/                 # HTTP API server
│   ├── src/
│   │   ├── routes/
│   │   │   └── task.ts  # ⚠️  MODIFY: Ensure endpoints accept new statuses
│   │   └── schemas/
│   │       └── task.ts  # ⚠️  MODIFY: Update Zod schemas
│   └── docs/api/
│       └── openapi.yaml # ⚠️  MODIFY: Document new status values
│
├── cli/                 # Command-line interface
│   └── src/
│       └── commands/
│           └── task.ts  # ⚠️  MODIFY: Add "inbox"/"someday" to status options
│
└── web/                 # Web UI (React)
    └── src/
        ├── components/
        │   └── TaskStatusSelect.tsx  # ⚠️  MODIFY: Add new status options
        ├── pages/
        │   └── Tasks.tsx              # ⚠️  VERIFY: URL filtering works with new statuses
        └── api/                       # Generated API client
            └── [auto-generated]       # ⚠️  REGENERATE: After OpenAPI update

tests/ (at package level)
├── api/test/            # API integration tests
│   └── task.test.ts     # ⚠️  ADD: Test new status filtering
├── cli/test/            # CLI integration tests (if exists)
│   └── task.test.ts     # ⚠️  ADD: Test new status commands
└── web/tests/           # E2E tests
    └── task-status.spec.ts  # ⚠️  ADD: Test new status UI interactions
```

**Structure Decision**: This is a monorepo with 8 packages. The change is primarily a **data model extension** affecting the shared types, database layer, and all three user-facing interfaces (CLI, API, Web). The monorepo structure allows us to make type-safe changes across all packages simultaneously, ensuring consistency.

## Complexity Tracking

No constitution violations. This is a straightforward enum extension with validation updates across the stack.

---

**Next Steps (Automated by /speckit:plan command)**:
- Phase 0: Generate research.md (resolve any NEEDS CLARIFICATION, research GTD status transition patterns)
- Phase 1: Generate data-model.md, contracts/api.yaml, quickstart.md
- Phase 1: Update agent context (if agent-specific guidance file exists)
- Report: List all generated artifacts and ready for /speckit:tasks
