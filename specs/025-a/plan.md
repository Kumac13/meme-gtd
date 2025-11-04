# Implementation Plan: Fuzzy Search for Tasks and Memos

**Branch**: `025-a` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-a/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add free-text search capability to Tasks and Memos pages, plus link creation UI. Users can search task titles and memo bodies using partial text matching (case-insensitive substring), combined with existing structured filters (label:, status:). Link creation switches from ID-only input to search-based selection using the same search UI pattern as main list pages.

**Primary approach**: Extend existing query parser (`packages/web/src/utils/queryParser.ts`) to extract free-text terms. Add `search` parameter to TaskQuerySchema/MemoQuerySchema. Implement SQL LIKE queries in repository layer (`taskRepository.ts`, `memoRepository.ts`). Reuse existing SearchInput component for link search UI.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**:
- Backend: Fastify 5.2.0, better-sqlite3 9.0.0, Zod 3.23.8
- Frontend: React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11

**Storage**: SQLite (better-sqlite3) - existing `issues` table
**Testing**:
- Backend: Node.js native test runner (`tsx --test`)
- Frontend: Vitest (unit), Playwright (E2E)

**Target Platform**:
- API: Node.js server (Fastify)
- Web: Modern browsers (ES2020+), served via Vite
- CLI: Node.js 22+ (not affected by this feature)

**Project Type**: Web application (monorepo with separate backend/frontend packages)
**Performance Goals**: Search results within 1 second for databases up to 10,000 items
**Constraints**:
- Case-insensitive search with Unicode support
- Maximum 20 results displayed in link search
- 50-character preview limit for memo body text

**Scale/Scope**:
- Up to 10,000 tasks/memos (performance target)
- 4 packages affected: `db`, `api`, `web`, `shared` (types only)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (Constitution template is placeholder-only; no specific principles defined for this project)

**Notes**:
- No project-specific constitution found in `.specify/memory/constitution.md`
- Following standard best practices for the existing codebase:
  - Monorepo structure with clear package boundaries (db → core → api → web)
  - Type safety with Zod schemas and TypeScript
  - OpenAPI contract generation from Zod schemas
  - Test coverage for new features

## Project Structure

### Documentation (this feature)

```
specs/025-a/
├── spec.md             # Feature specification
├── plan.md             # This file (/speckit.plan command output)
├── research.md         # Phase 0 output (next step)
├── data-model.md       # Phase 1 output
├── quickstart.md       # Phase 1 output
├── contracts/          # Phase 1 output (OpenAPI fragments)
└── tasks.md            # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```
packages/
├── db/                             # Database layer
│   ├── src/
│   │   ├── taskRepository.ts       # 🔧 MODIFY: Add search parameter to listTasks()
│   │   ├── memoRepository.ts       # 🔧 MODIFY: Add search parameter to listMemos()
│   │   └── index.ts                # Re-exports
│   └── test/
│       ├── taskRepository.test.ts  # ✅ ADD: Tests for search functionality
│       └── memoRepository.test.ts  # ✅ ADD: Tests for search functionality
│
├── shared/                         # Shared types
│   └── src/
│       └── types.ts                # 🔧 MODIFY: Add search to query filter types (if needed)
│
├── api/                            # HTTP API layer
│   ├── src/
│   │   ├── schemas/
│   │   │   ├── taskSchemas.ts      # 🔧 MODIFY: Add search to TaskQuerySchema
│   │   │   └── memoSchemas.ts      # 🔧 MODIFY: Add search to MemoQuerySchema
│   │   ├── handlers/
│   │   │   ├── taskHandlers.ts     # 🔧 MODIFY: Pass search param to service
│   │   │   └── memoHandlers.ts     # 🔧 MODIFY: Pass search param to service
│   │   └── routes/
│   │       ├── tasks.ts            # Updated via schema (no direct change)
│   │       └── memos.ts            # Updated via schema (no direct change)
│   └── test/integration/
│       ├── tasks.test.ts           # ✅ ADD: Integration tests for search endpoint
│       └── memos.test.ts           # ✅ ADD: Integration tests for search endpoint
│
└── web/                            # React frontend
    ├── src/
    │   ├── utils/
    │   │   └── queryParser.ts      # 🔧 MODIFY: Extract free-text from query
    │   ├── api/services/
    │   │   ├── TasksService.ts     # 🔧 MODIFY: Add search param to listTasks()
    │   │   └── MemosService.ts     # 🔧 MODIFY: Add search param to listMemos()
    │   ├── pages/
    │   │   ├── TasksList.tsx       # 🔧 MODIFY: Pass search text to API
    │   │   └── MemosList.tsx       # 🔧 MODIFY: Pass search text to API
    │   └── components/
    │       ├── AddLinkInline.tsx   # 🔧 MODIFY: Replace ID input with search UI
    │       └── LinkSection.tsx     # 🔧 MODIFY: Handle search-based link creation
    └── test/
        └── components/             # ✅ ADD: Component tests for new link search UI
```

**Structure Decision**: Existing web application structure (monorepo). Changes span 4 packages following established data flow: DB layer → API handlers → Web UI. No new packages required. Modifications align with current architecture patterns (repository pattern, Zod schemas, service layer).

## Complexity Tracking

*No constitution violations detected. This section is not applicable.*

---

## Phase 0: Research (Next Step)

The following research tasks will be documented in `research.md`:

### 🔍 Research Tasks

1. **SQLite LIKE query patterns for Unicode support**
   - **Question**: How to implement case-insensitive LIKE queries that work correctly with Japanese, emoji, and other Unicode characters in SQLite?
   - **Context**: FR-006 requires case-insensitive search across different character sets (Latin, Japanese, emoji)
   - **Output**: Best practices for SQLite text search with Unicode

2. **Multi-word contiguous matching strategy**
   - **Question**: How to implement "login screen" matches "screen login" (contiguous but flexible order) using SQL LIKE?
   - **Context**: Clarification Q1 specified contiguous phrase matching with flexible word order
   - **Output**: SQL query pattern or helper function approach

3. **Preview text extraction with search context**
   - **Question**: How to extract 50-character preview around search term location in memo body?
   - **Context**: FR-015 requires context preview showing where search term appears
   - **Output**: Algorithm or library for context-aware text preview

4. **Performance considerations for LIKE queries**
   - **Question**: What are SQLite index strategies for partial text matching? Are there performance implications for 10K rows?
   - **Context**: SC-004 requires results within 1 second for 10K items
   - **Output**: Index recommendations, potential optimizations

5. **Link search UI component reuse**
   - **Question**: Can existing SearchInput component be reused in LinkSection context? What adaptations needed?
   - **Context**: Clarification Q4 specified reusing same UI pattern as Tasks/Memos pages
   - **Output**: Component integration strategy

**Output**: `research.md` with decisions, rationale, and alternatives for each question

---

## Phase 1: Design & Contracts (After Research)

Will generate:
- `data-model.md`: Extended query filter models (no new entities; existing issues table)
- `contracts/`: OpenAPI schema fragments for updated query parameters
- `quickstart.md`: Developer guide for implementing search queries
- Updated agent context via `.specify/scripts/bash/update-agent-context.sh`

---

*This plan stops after Phase 2 planning. Use `/speckit.tasks` to generate task breakdown after reviewing research and design outputs.*
