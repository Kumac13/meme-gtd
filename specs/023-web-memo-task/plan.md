# Implementation Plan: Web UI Memo-to-Task Promotion

**Branch**: `023-web-memo-task` | **Date**: 2025-11-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-web-memo-task/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable users to promote memos to tasks from the memo detail page using the existing task creation form. The promotion preserves all metadata (labels, links, comments, projects, bookmarks) and deletes the original memo upon successful task creation. Technical approach uses React Router navigation with URL parameters to pre-populate the task form, and calls the existing `/api/memos/:id/promote` endpoint.

## Technical Context

**Language/Version**: TypeScript 5.5.4, Node.js 22+
**Primary Dependencies**: React 19.2.0, React Router DOM 7.9.4, Fastify 5.2.0, better-sqlite3
**Storage**: SQLite database (already has promote endpoint implemented)
**Testing**: Vitest (frontend), Node.js test runner (API), Playwright (E2E)
**Target Platform**: Web application (browser + Node.js API server)
**Project Type**: Web (monorepo: packages/web frontend + packages/api backend)
**Performance Goals**: Promotion completes within 2 seconds, UI navigation within 200ms
**Constraints**: Must use existing task creation form (no modal), preserve 100% of metadata during promotion
**Scale/Scope**: Single-user desktop application, small codebase (~3 new components, 1 route parameter change)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Implementation Gates

- ✅ **Test Environment Only**: All verification will use test environment (port 3001, test-data/test.db)
- ✅ **No Production Access**: Will not touch production DB or production API server (port 3000)
- ✅ **Existing API Reuse**: Leveraging existing `/api/memos/:id/promote` endpoint (no new API creation)
- ✅ **Minimal Complexity**: Feature adds ~3 components, reuses existing TaskForm, no new architectural patterns
- ✅ **Documentation**: Will reference existing docs/requirements.md and update if needed
- ✅ **Monorepo Structure**: Working within existing packages/web and packages/api structure

### Compliance Notes

- Feature is UI-focused (Web UI promotion flow), API already implemented
- No new abstractions or patterns introduced
- Follows existing React Router + TaskForm patterns
- All testing via test environment per safety guidelines

## Project Structure

### Documentation (this feature)

```
specs/023-web-memo-task/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
├── checklists/          # Quality validation
│   └── requirements.md  # Specification checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Monorepo Structure - Web Application**:

```
packages/
├── api/                           # Backend API (minimal changes)
│   ├── src/
│   │   ├── handlers/
│   │   │   └── memoHandlers.ts   # Already has promoteMemoHandler
│   │   ├── routes/
│   │   │   └── memos.ts           # Already has POST /api/memos/:id/promote
│   │   └── schemas/
│   │       └── memoSchemas.ts     # Already has PromoteMemoRequestSchema
│   └── test/
│       └── integration/           # Add promotion flow tests
│
├── web/                           # Frontend (primary changes)
│   ├── src/
│   │   ├── api/services/
│   │   │   └── MemosService.ts   # Already has promoteMemo() method
│   │   ├── components/
│   │   │   └── TaskForm.tsx      # [MODIFY] Add fromMemoId prop, handle promote mode
│   │   ├── pages/
│   │   │   ├── TaskNew.tsx       # [MODIFY] Parse ?fromMemo query param, fetch memo data
│   │   │   └── MemoDetail.tsx    # [MODIFY] Add "Promote to Task" button
│   │   └── utils/
│   │       └── validation.ts     # Existing validation utilities
│   └── tests/
│       └── e2e/                  # Add promotion workflow tests
│
├── core/                          # Business logic (no changes)
│   └── src/
│       └── index.ts              # MemoService.promote() already implemented
│
└── db/                            # Database layer (no changes)
    └── src/
        └── memoRepository.ts     # promoteMemo() already implemented
```

**Structure Decision**: Web application monorepo with packages for API (backend) and web (frontend). This feature primarily modifies the frontend (packages/web) with minor additions to existing components. The API layer already has the promote endpoint implemented, requiring no backend changes. Tests will be added to both packages (integration tests in API, E2E tests in web).

## Complexity Tracking

*No violations - section not applicable*

All architecture gates passed. Feature follows existing patterns without introducing new complexity.

---

## Phase 0: Research (Completed)

**Output**: `research.md`

**Key Findings**:
- URL query parameter pattern chosen for memo ID passing
- Form pre-population strategy: fetch in TaskNew, pass as props to TaskForm
- Promote API call location: TaskForm.handleSubmit() when fromMemoId present
- Button placement: header next to bookmark button
- Status dropdown shown conditionally in create mode when promoting

**Research Status**: ✅ All unknowns resolved, no clarifications needed

---

## Phase 1: Design & Contracts (Completed)

**Outputs**:
- `data-model.md`: Entity definitions, relationships, promotion flow
- `contracts/promote-memo.yaml`: OpenAPI contract with test cases
- `quickstart.md`: Implementation guide with step-by-step instructions
- Agent context updated in `CLAUDE.md`

**Design Status**: ✅ All artifacts generated, ready for implementation

---

## Post-Design Constitution Check

*Re-evaluation after Phase 1 design completion*

### Architecture Compliance

- ✅ **No New Abstractions**: Reuses existing TaskForm, React Router patterns
- ✅ **No New Dependencies**: Uses existing packages (React Router, MemosService)
- ✅ **Existing API Reuse**: Leverages `/api/memos/:id/promote` endpoint (already implemented)
- ✅ **Test Coverage**: Integration tests (API) + E2E tests (web) specified in contracts and quickstart
- ✅ **Minimal Surface Area**: 3 file modifications (TaskForm, TaskNew, MemoDetail)

### Design Quality

- ✅ **Single Responsibility**: TaskNew handles data fetching, TaskForm handles UI/submission
- ✅ **DRY**: Reuses existing form component instead of creating new one
- ✅ **Error Handling**: Leverages existing error state patterns in TaskForm
- ✅ **Loading States**: Consistent with existing page-level loading patterns

### Final Gate Status

**All gates passed**. No violations introduced during design phase. Feature maintains existing architecture patterns and complexity levels.

