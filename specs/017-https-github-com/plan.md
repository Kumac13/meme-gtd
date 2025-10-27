# Implementation Plan: Projects Sidebar in Task/Memo Detail Pages

**Branch**: `017-https-github-com` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from [GitHub Issue #51](https://github.com/Kumac13/meme-gtd/issues/51)

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add a GitHub-style Projects sidebar section to task and memo detail pages (right sidebar, 2-column layout). Users can view associated projects, add/remove project associations via a dropdown/popover (NOT a modal dialog), search/filter projects, and access recently used projects. The feature extends the existing Web UI with new React components and leverages existing Project API endpoints.

## Technical Context

**Language/Version**: TypeScript 5.5+ (Node.js 22+)
**Primary Dependencies**:
  - Frontend: React 19, React Router 7, Vite 7, TailwindCSS 4
  - Backend: Fastify 5, Zod 3 (schema validation)
  - Database: SQLite 3 via better-sqlite3
**Storage**: SQLite database (`issues.db`) - existing tables: `projects`, `project_items`, `issues`
**Testing**:
  - Frontend: Vitest + React Testing Library
  - Backend: Node.js test runner (`tsx --test`)
  - E2E: Playwright
**Target Platform**: Web browser (modern browsers supporting ES2020+)
**Project Type**: Web application (monorepo with separate frontend/backend packages)
**Performance Goals**:
  - Dropdown open < 100ms
  - Project list rendering with 50 items < 200ms
  - Search/filter response < 50ms
  - API calls < 1 second
**Constraints**:
  - No page refresh on add/remove operations
  - Dropdown must stay open during multiple operations
  - Sidebar must ALWAYS be visible (even with 0 projects) to allow adding projects
  - 2-column layout: main content (left) + sidebar (right)
**Scale/Scope**:
  - Support 50+ projects without UI degradation
  - Recent projects limited to 2 items
  - New components: 2-column layout wrapper, Projects sidebar section, dropdown/popover component
  - API service integration via ProjectsService

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Status**: ✅ PASSED (Constitution template is placeholder - no specific project constraints defined)

Since the constitution file contains only template placeholders with no actual project-specific principles, this feature proceeds with standard web development best practices:

- **Existing Codebase Patterns**: Follow established patterns in packages/web/src/components
- **No Breaking Changes**: Purely additive feature (new component, no modifications to existing contracts)
- **Testing**: Use existing test infrastructure (Vitest for components, Playwright for E2E)
- **API Consistency**: Leverage existing `/api/projects/:id/items` endpoints (already implemented)

---

**Re-evaluation after Phase 1 Design**: ✅ PASSED

After completing Phase 1 design (research, data model, contracts), the feature design confirms:

1. **No Backend Changes Required**:
   - All APIs already exist (from feature #19)
   - No database schema changes
   - Zero breaking changes to existing contracts

2. **Frontend-Only Scope**:
   - New components in `packages/web/src/components/`
   - Follows existing component patterns (LinkSection, ItemDetail)
   - Uses established service layer pattern (ProjectsService)

3. **Architecture Compliance**:
   - Monorepo structure preserved
   - Component isolation maintained
   - State management kept simple (no global state)
   - Testing strategy aligns with existing infrastructure

4. **Performance Within Targets**:
   - <1s for all operations (validated in research)
   - Client-side filtering acceptable for 50 items
   - Optimistic updates for perceived performance

5. **Accessibility Standards**:
   - ARIA attributes for modal
   - Keyboard navigation (ESC, Tab)
   - Focus management

**Conclusion**: Feature design is architecturally sound and ready for implementation (/speckit.tasks).

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
packages/web/                           # Frontend package (React + Vite)
├── src/
│   ├── components/
│   │   ├── ProjectsSection.tsx        # NEW: Main projects sidebar component
│   │   ├── SelectProjectsModal.tsx    # NEW: Modal for project selection
│   │   └── ItemDetail.tsx             # MODIFIED: Add ProjectsSection
│   ├── api/
│   │   └── services/
│   │       └── ProjectsService.ts     # MODIFIED: Add getItemProjects method
│   ├── hooks/
│   │   └── useRecentProjects.ts       # NEW: Recent projects tracking hook
│   └── types/
│       └── project.ts                 # NEW: TypeScript interfaces
└── tests/
    ├── components/
    │   ├── ProjectsSection.test.tsx   # NEW: Component tests
    │   └── SelectProjectsModal.test.tsx # NEW: Modal tests
    └── e2e/
        └── projects-sidebar.spec.ts   # NEW: E2E tests

packages/api/                           # Backend package (existing - no changes)
├── src/
│   └── routes/
│       └── projects.ts                # EXISTING: Already has all needed endpoints
└── docs/
    └── api/
        └── openapi.yaml               # EXISTING: Documents existing endpoints

packages/db/                            # Database package (existing - no changes)
└── src/
    └── projectItemRepository.ts       # EXISTING: Already implements data access

schema/
└── 001_init.sql                       # EXISTING: Tables already created
```

**Structure Decision**: This is a **frontend-only feature** extending the existing monorepo web package. The backend API endpoints (`POST/DELETE /api/projects/:id/items/:issueId`) already exist and require no modifications. All new code is constrained to `packages/web/src/components/` with supporting hooks and types.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

**Status**: N/A - No constitutional violations or complexity justifications required. This is a standard frontend component addition following existing patterns.

