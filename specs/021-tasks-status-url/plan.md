# Implementation Plan: Tasks Page URL State Synchronization

**Branch**: `021-tasks-status-url` | **Date**: 2025-10-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-tasks-status-url/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Synchronize task list filter state (status and bookmark filters) with URL query parameters to enable bookmarking, sharing, and browser navigation support. The implementation will modify the existing `TasksList.tsx` component to use React Router's `useSearchParams` hook for bidirectional URL state synchronization, replacing the current local state management for filters.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / React 19.2.0 / Node.js 22+
**Primary Dependencies**: React Router DOM 7.9.4, Vite 7.1.11
**Storage**: N/A (URL-based state only, no backend changes)
**Testing**: Vitest 1.6.0 (unit), Playwright 1.56.1 (E2E)
**Target Platform**: Modern web browsers (Chrome, Firefox, Safari, Edge - latest 2 versions)
**Project Type**: Web application (monorepo package: packages/web)
**Performance Goals**: URL update within 100ms of filter change (SC-005 requirement)
**Constraints**: Must preserve existing filter functionality, maintain backward compatibility with existing routes
**Scale/Scope**: Single component modification (TasksList.tsx), estimated 50-100 LOC change

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Constitution Status**: No constitution file found (.specify/memory/constitution.md is placeholder template). Proceeding with standard best practices:
- Test-first development required
- Integration tests for URL parameter handling
- Backward compatibility maintained
- No breaking changes to existing API

## Project Structure

### Documentation (this feature)

```
specs/021-tasks-status-url/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
├── checklists/
│   └── requirements.md  # Spec quality validation (already created)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
packages/web/
├── src/
│   ├── pages/
│   │   └── TasksList.tsx          # PRIMARY: Modify to use useSearchParams
│   ├── components/
│   │   └── FilterBar.tsx           # May need minor prop updates
│   └── api/
│       └── services/
│           └── TasksService.ts     # No changes needed
└── tests/
    ├── unit/
    │   └── TasksList.test.tsx      # NEW: URL parameter handling tests
    └── e2e/
        └── tasks-filters.spec.ts   # NEW: E2E tests for filter persistence
```

**Structure Decision**: This is a frontend-only change within the existing monorepo web package. The primary modification is to `packages/web/src/pages/TasksList.tsx` (L36-37) to replace `useState` with `useSearchParams` for filter state management. No backend (packages/api) or database (packages/db) changes are required since filters are client-side UI state only.

## Complexity Tracking

*No violations detected - feature adheres to standard practices*

---

## Phase 0 Completion ✅

**Artifacts Generated**:
- [research.md](./research.md) - Technical decisions and alternatives analysis
  - React Router v7 useSearchParams pattern selected
  - URL parameter validation strategy defined
  - Browser history management approach chosen
  - Multi-layer testing strategy (Vitest + Playwright)

**All NEEDS CLARIFICATION items resolved**:
- ✅ URL state management approach
- ✅ Parameter validation strategy
- ✅ History management behavior
- ✅ Testing methodology

---

## Phase 1 Completion ✅

**Artifacts Generated**:
- [data-model.md](./data-model.md) - URL parameter schema and validation rules
  - Status filter: enum validation with 'all' default
  - Bookmark filter: boolean representation ('true' or absent)
  - Combined parameter handling strategy
  - Client-side state shape definition
- [contracts/url-params.schema.json](./contracts/url-params.schema.json) - JSON Schema for URL parameters
- [contracts/url-params.types.ts](./contracts/url-params.types.ts) - TypeScript type definitions and helper functions
- [quickstart.md](./quickstart.md) - Developer implementation guide

**Agent Context Updated**:
- CLAUDE.md updated with new technologies (React Router DOM 7.9.4, Vite 7.1.11)

**Constitution Check Re-evaluation** (Post-Design):
- ✅ No new dependencies introduced (React Router already in use)
- ✅ Test-first development planned (unit + E2E tests)
- ✅ Backward compatibility maintained (existing routes work)
- ✅ No breaking API changes
- ✅ Single component modification (minimal scope)
- ✅ Performance goals achievable (URL updates <10ms, well under 100ms requirement)

**Status**: All design artifacts complete. Ready for Phase 2 (Task Generation).

---

## Next Steps

**For Implementation**:

Run the `/speckit.tasks` command to generate the dependency-ordered tasks.md file:
```bash
/speckit.tasks
```

This will create `specs/021-tasks-status-url/tasks.md` with actionable implementation steps based on the design artifacts generated in Phases 0 and 1.

**Manual Verification Before Implementation**:
1. Review [quickstart.md](./quickstart.md) for implementation steps
2. Verify [data-model.md](./data-model.md) aligns with existing TasksList.tsx structure
3. Ensure test environment is ready (pnpm server:dev, pnpm dev:web)

---

## Planning Summary

| Phase | Status | Artifacts | Key Decisions |
|-------|--------|-----------|---------------|
| Phase 0: Research | ✅ Complete | research.md | useSearchParams, validation fallbacks, history pushState, Vitest+Playwright |
| Phase 1: Design | ✅ Complete | data-model.md, contracts/, quickstart.md | URL schema, TypeScript types, helper functions, developer guide |
| Phase 2: Tasks | ⏳ Pending | tasks.md | Run `/speckit.tasks` to generate |

**Estimated Implementation Time**: 2-3 hours (per quickstart.md)
**Testing Coverage**: Unit tests (urlFilterHelpers) + E2E tests (browser navigation, persistence)
**Files Modified**: 1 primary (TasksList.tsx), 1 new (urlFilterHelpers.ts), tests (new)

