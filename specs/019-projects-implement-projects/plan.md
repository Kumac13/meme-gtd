# Implementation Plan: Project Detail Views

**Branch**: `019-projects-implement-projects` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-projects-implement-projects/spec.md`

## Summary

Implement project detail page with two view modes: Kanban board with drag-and-drop functionality and List view. Users can visualize project tasks/memos in a board layout (Kanban) or linear list (Lists), switch between views via tabs, and reorganize items by dragging cards between columns. All backend APIs are already implemented (Feature #19) - this feature focuses on frontend visualization and interaction.

**Technical Approach**:
- React Router v7 nested routes for view switching (`/projects/:id/kanban`, `/projects/:id/list`)
- @dnd-kit/core for accessible, React 19-compatible drag-and-drop
- Reuse existing components (LoadingState, ErrorState, EmptyState)
- Custom Kanban components (board columns not suited for existing ItemList)
- Single API call + client-side filtering strategy

## Technical Context

**Language/Version**: TypeScript 5.5.4, React 19.2.0
**Primary Dependencies**:
- react-router-dom v7.9.4 (routing)
- @dnd-kit/core + @dnd-kit/sortable (drag-and-drop - **NEW**)
- Tailwind CSS v4.1.14 (styling)
- Vite v7.1.11 (build tool)

**Storage**: Backend SQLite database (already implemented)
**Testing**: Vitest + React Testing Library (unit/component), Playwright (E2E)
**Target Platform**: Web (desktop + mobile responsive)
**Project Type**: Monorepo web application (packages/web frontend, packages/api backend)

**Performance Goals**:
- Page load: <2 seconds for projects with up to 100 items
- Drag-and-drop response: <100ms visual feedback
- View switching: <1 second
- API calls: <500ms (backend already optimized)

**Constraints**:
- Must use existing backend APIs (no backend changes)
- Must match existing UI patterns (TaskDetail, MemoDetail)
- Must support keyboard navigation (accessibility)
- Must handle concurrent user updates gracefully

**Scale/Scope**:
- 5 new files (components + pages)
- 3 updated files (routes, types, package.json)
- ~600-800 lines of new code
- 1 new dependency (@dnd-kit)

## Constitution Check

**Status**: ✅ PASS (No constitution violations)

**Notes**:
- Constitution file is template-only (not project-specific)
- No TDD requirement enforced by project (no tests written before implementation)
- Following existing patterns (no library-first or CLI-first requirements)
- No performance/security constraints beyond standard web practices

**Re-check after Phase 1**: N/A (no violations to track)

## Project Structure

### Documentation (this feature)

```
specs/019-projects-implement-projects/
├── plan.md              # This file (planning output)
├── spec.md              # Feature specification (user requirements)
├── research.md          # Technical research (completed)
├── data-model.md        # Data structures (completed)
├── quickstart.md        # Implementation guide (completed)
├── contracts/           # API contracts (completed)
│   └── api-endpoints.md
└── checklists/          # Quality validation
    └── requirements.md
```

### Source Code (repository root)

```
packages/
├── web/                           # Frontend (React)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ProjectDetail.tsx         # [NEW] Main page with tabs
│   │   │   ├── KanbanView.tsx            # [NEW] Kanban view page
│   │   │   └── ListView.tsx              # [NEW] List view page
│   │   ├── components/
│   │   │   ├── KanbanBoard.tsx           # [NEW] Kanban board component
│   │   │   ├── KanbanColumn.tsx          # [NEW] Column component
│   │   │   ├── KanbanCard.tsx            # [NEW] Draggable card
│   │   │   ├── LoadingState.tsx          # [REUSE] Loading spinner
│   │   │   ├── ErrorState.tsx            # [REUSE] Error display
│   │   │   └── EmptyState.tsx            # [REUSE] Empty message
│   │   ├── api/services/
│   │   │   └── ProjectsService.ts        # [EXISTS] API service methods
│   │   ├── types/
│   │   │   └── project.ts                # [UPDATE] Sync with shared types
│   │   ├── hooks/
│   │   │   └── useProjectDetail.ts       # [OPTIONAL] Data fetching hook
│   │   └── App.tsx                       # [UPDATE] Add routes
│   ├── package.json                      # [UPDATE] Add @dnd-kit deps
│   └── tests/
│       ├── components/
│       │   └── KanbanBoard.test.tsx      # [NEW] Component tests
│       └── e2e/
│           └── project-detail.spec.ts    # [NEW] Playwright tests
│
├── api/                                   # Backend (Fastify)
│   └── src/
│       ├── routes/
│       │   └── projects.ts               # [EXISTS] No changes needed
│       └── handlers/
│           └── projectHandlers.ts        # [EXISTS] No changes needed
│
└── shared/                                # Shared types
    └── src/types/
        └── project.ts                    # [EXISTS] Canonical types
```

**Structure Decision**: Monorepo web application (existing structure)
- **Frontend**: packages/web (React TypeScript SPA)
- **Backend**: packages/api (Fastify API server)
- **Shared**: packages/shared (shared types/utilities)

All new code goes in `packages/web` - backend already complete.

## Complexity Tracking

*No complexity violations - section not applicable*

---

## Phase 0: Research & Decisions ✅ COMPLETE

**Status**: ✅ Complete
**Output**: [research.md](./research.md)

### Key Findings

1. **Frontend Stack Confirmed**:
   - React 19.2.0, React Router v7.9.4, TypeScript 5.5.4
   - Tailwind CSS v4, Vite v7
   - Component-level state (no Redux/Zustand)

2. **Reusable Components Identified**:
   - ✅ LoadingState, ErrorState, EmptyState - Ready to use
   - ✅ FilterBar - Can adapt if needed
   - ❌ ItemList - Not suitable for Kanban (vertical list only)
   - ❌ ItemDetail - Not suitable (different context)

3. **Backend APIs Verified**:
   - ✅ All endpoints exist and implemented (Feature #19)
   - ✅ GET /api/projects/:id (project detail with items)
   - ✅ PATCH /api/projects/:id/items/:issueId (update item)
   - ✅ POST /api/projects/:id/items (add item)
   - ✅ DELETE /api/projects/:id/items/:issueId (remove item)

4. **Type System Issue**:
   - ⚠️ Web types outdated (Feature 017 legacy)
   - ✅ Shared types current (Feature 019)
   - **Action**: Update web types to re-export from shared

5. **Technology Decisions**:
   - **Drag-and-Drop**: @dnd-kit/core (React 19 compatible, TypeScript-first, 10KB, accessible)
   - **Routing**: Nested routes with React Router v7 (shareable URLs)
   - **View State**: URL-driven (single source of truth)
   - **Data Fetching**: Single API call + client-side filtering
   - **Item Rendering**: Custom card components (not reusing ItemList)

---

## Phase 1: Design & Contracts ✅ COMPLETE

**Status**: ✅ Complete
**Outputs**:
- [data-model.md](./data-model.md)
- [contracts/api-endpoints.md](./contracts/api-endpoints.md)
- [quickstart.md](./quickstart.md)

### Data Model Summary

**Core Entities** (all existing, no new entities):
- `Project`: Container with viewMeta configuration
- `ViewMeta`: { viewType: 'board' | 'table', columns?: string[] }
- `ProjectItem`: Association with position and column metadata
- `ProjectItemWithIssue`: Extended with issue info (task/memo)
- `ProjectDetail`: Complete project + items array

**Key Relationships**:
- Project → hasMany → ProjectItem → references → Issue (task/memo)

**State Transitions**:
- Item movement: Optimistic update → API call → Success (keep) / Failure (revert)
- View switching: URL-driven (no state sync needed)

### API Contract Summary

All endpoints **already implemented** (Feature #19):

1. **GET /api/projects/:id** → ProjectDetail
   - Returns project with items array
   - Single call provides all data for both views

2. **PATCH /api/projects/:id/items/:issueId** → ProjectItem
   - Body: `{ column?: string, position?: number }`
   - Used for drag-and-drop

3. **POST /api/projects/:id/items** → ProjectItem
   - Body: `{ issueId: number, column?: string, position?: number }`
   - Used for adding items

4. **DELETE /api/projects/:id/items/:issueId** → void
   - Removes item from project

### Quickstart Guide

Comprehensive implementation guide created with:
- Step-by-step implementation phases (5 phases)
- Code examples for all components
- Testing checklist
- Common issues & solutions
- Development tips and resources

---

## Phase 2: Task Breakdown (NOT PART OF /speckit.plan)

**Status**: ⏭️ Run `/speckit.tasks` to generate

**Note**: Task generation is a separate command (`/speckit.tasks`) and not part of the planning phase. The plan provides all necessary context for task generation:
- Research decisions documented
- Data model defined
- API contracts specified
- Implementation guide prepared

Tasks will break down the implementation into:
- Dependency installation
- Type synchronization
- Route setup
- Kanban components (board, column, card)
- List view component
- Testing and validation

---

## Dependencies & Prerequisites

### New Dependencies

**To Install**:
```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities --filter meme-gtd-web
```

**Rationale**: Only actively maintained React 19-compatible drag-and-drop library with TypeScript support.

### No Backend Changes

All backend APIs already exist - no new dependencies or changes required.

### Type System Sync

**Required Action**: Update `/packages/web/src/types/project.ts` to re-export shared types:
```typescript
export type {
  Project,
  ProjectItem,
  ProjectItemWithIssue,
  ProjectDetail,
  ViewMeta,
  ViewType
} from 'meme-gtd-shared';
```

---

## Risk Assessment

### Low Risks ✅

1. **Backend APIs**: ✅ Already implemented and tested
2. **Component Patterns**: ✅ Follow existing TaskDetail/MemoDetail patterns
3. **Type Safety**: ✅ TypeScript catches issues at compile time
4. **Routing**: ✅ React Router v7 well-established

### Medium Risks ⚠️

1. **Drag-and-Drop Complexity**:
   - **Risk**: @dnd-kit learning curve, edge cases
   - **Mitigation**: Extensive documentation, simple initial implementation

2. **Performance with Large Projects**:
   - **Risk**: Slow rendering with 100+ items
   - **Mitigation**: useMemo, potential virtual scrolling later

3. **Type Sync Issues**:
   - **Risk**: Web types out of sync with shared types
   - **Mitigation**: Update types as first task

### Assumptions

1. Projects will have <100 items (per spec: SC-005)
2. Network latency acceptable for optimistic updates
3. Users understand drag-and-drop UI patterns
4. Kanban columns defined at project creation (backend responsibility)

---

## Success Criteria

From [spec.md](./spec.md) - Success Criteria section:

- **SC-001**: ✅ Page load <2s (single API call)
- **SC-002**: ✅ Drag response <100ms (optimistic update)
- **SC-003**: ✅ 95% drag ops succeed (error handling + revert)
- **SC-004**: ✅ View switch <1s (client-side only)
- **SC-005**: ✅ 100 items responsive (architecture supports)
- **SC-006**: ✅ Status at a glance (column organization)

All success criteria are achievable with the proposed architecture.

---

## Next Steps

1. **Run `/speckit.tasks`** to generate task breakdown
2. **Implement** following tasks.md order
3. **Test** according to quickstart.md checklist
4. **Review** against spec.md requirements
5. **Deploy** and gather user feedback

**Planning Phase Complete** ✅

All design artifacts ready for implementation:
- ✅ Research decisions documented
- ✅ Data model defined
- ✅ API contracts specified
- ✅ Implementation guide prepared
- ✅ Quality validated (requirements.md checklist)
