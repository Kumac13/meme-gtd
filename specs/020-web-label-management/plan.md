# Implementation Plan: Web UI Label Management

**Branch**: `020-web-label-management` | **Date**: 2025-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-web-label-management/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

This feature adds comprehensive label management to the Web UI, enabling users to create, assign, remove, and delete labels through interactive interfaces. The existing label backend (REST API, database schema, services) is complete; this implementation focuses solely on building the missing Web UI components. Users will be able to manage labels directly from item detail pages, with a label selector component providing search, recent labels quick access, and label creation. The implementation uses React with TypeScript, integrating with the existing Fastify API server and auto-generated API client.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / React 19.2.0 / Node.js 22+
**Primary Dependencies**:
- Frontend: React, React Router 7.9.4, Vite 7.1.11, TailwindCSS 4.1.14
- Backend: Fastify 5.2.0, Zod 3.23.8, Better-SQLite3
- API Client: Auto-generated via openapi-typescript-codegen from OpenAPI schema
**Storage**: SQLite database (already implemented with `labels` and `issue_labels` tables)
**Testing**: Vitest for unit tests, Playwright for E2E tests
**Target Platform**: Web browsers (modern evergreen browsers)
**Project Type**: web (monorepo with separate frontend and backend packages)
**Performance Goals**:
- Label assignment UI interaction < 5 seconds (spec requirement)
- Label creation + assignment < 15 seconds (spec requirement)
- Visual feedback within 1 second (spec requirement)
**Constraints**:
- Must use existing label API endpoints (no backend changes except missing DELETE endpoint)
- Must follow existing project assignment UI patterns for consistency
- Recent labels stored in browser localStorage (no server-side storage)
- Supports typical label count < 100 (per spec assumptions)
**Scale/Scope**:
- 5 new React components (LabelSelector, LabelBadge, LabelCreationForm, LabelSearchInput, RecentLabels)
- 1 new API endpoint (DELETE /api/issues/:issueId/labels/:labelId for removing single label)
- Integration with 2 existing pages (memo detail, task detail)
- Local storage management for recent labels (max 5 items)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution file contains only template placeholders. The following gates are based on best practices for the meme-gtd project architecture.

### Gate 1: Web UI Feature (Frontend Only)
- **Status**: ✅ PASS
- **Rationale**: This feature adds Web UI components to the existing `packages/web` package. No new packages or libraries are created. The backend API already exists and is complete.

### Gate 2: API Contract Stability
- **Status**: ⚠️ MINOR VIOLATION - Justified
- **Violation**: Requires adding 1 new API endpoint: `DELETE /api/issues/:issueId/labels/:labelId`
- **Justification**: The existing API lacks the ability to remove a single label from an item (only full replacement via `setMemoLabels`/`setTaskLabels`). This endpoint is necessary for user story #3 (Remove Labels from Items - P2 priority).
- **Alternative Rejected**: Using full label replacement would require fetching current labels, removing one, and sending the entire updated list - significantly worse UX and more error-prone.

### Gate 3: Component Complexity
- **Status**: ✅ PASS
- **Rationale**: Introduces 5 new components with clear single responsibilities:
  - LabelSelector (orchestration)
  - LabelBadge (display)
  - LabelCreationForm (creation)
  - LabelSearchInput (filtering)
  - RecentLabels (quick access)
- Each component is focused and testable independently.

### Gate 4: Data Storage
- **Status**: ✅ PASS
- **Rationale**: Uses existing SQLite database for label data. Recent labels feature uses browser localStorage (appropriate for per-user UI state that doesn't need server persistence).

### Gate 5: Testing Requirements
- **Status**: ✅ PASS
- **Rationale**:
  - Backend endpoint has integration test coverage (existing + new DELETE endpoint)
  - Frontend components will have Vitest unit tests
  - E2E tests with Playwright for critical user flows (label assignment, creation)

**Overall Assessment**: Approved with justified minor violation. The new DELETE endpoint is a minimal backend change that completes the RESTful API design.

---

### Post-Phase 1 Re-evaluation

After completing Phase 1 design (research.md, data-model.md, contracts/, quickstart.md), re-evaluating constitution compliance:

#### Updated Assessment

**Gate 1: Web UI Feature** - ✅ PASS (unchanged)
- Confirmed: All new components go into existing `packages/web/src/components/`
- No new packages created

**Gate 2: API Contract Stability** - ⚠️ MINOR VIOLATION - Justified (unchanged)
- Single new endpoint: `DELETE /api/issues/:issueId/labels/:labelId`
- Fully specified in `contracts/remove-label-from-issue.yaml`
- Backend implementation: ~30 lines of code (repository function + handler)
- Alternative approaches remain inferior (race conditions, complexity)

**Gate 3: Component Complexity** - ✅ PASS (unchanged)
- Design confirms 5 focused components
- Each component has clear single responsibility
- Composition pattern follows existing `ProjectManagementModal`
- State management remains local (no Context API needed)

**Gate 4: Data Storage** - ✅ PASS (confirmed)
- Existing SQLite schema unchanged
- Recent labels use localStorage (appropriate for UI optimization)
- No new database migrations required

**Gate 5: Testing Requirements** - ✅ PASS (detailed)
- Integration tests specified in `contracts/remove-label-from-issue.yaml`
- Unit test structure in `quickstart.md`
- E2E test scenarios in `data-model.md`
- Accessibility testing checklist in `research.md`

**New Consideration: Performance** - ✅ PASS
- Research confirms no virtualization needed for <100 labels
- useMemo/useCallback usage guidelines established
- localStorage performance negligible (~200 bytes)
- Client-side filtering sufficient

**New Consideration: Accessibility** - ✅ PASS
- Manual ARIA implementation (no external library needed)
- WCAG 2.2 AA compliance guidelines in `research.md`
- Keyboard navigation specified
- Screen reader support via proper ARIA attributes

**Final Assessment**: Design phase complete. All gates remain PASS or justified violations. Implementation can proceed to Phase 2 (tasks.md generation).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── api/                          # Backend API (Fastify)
│   ├── src/
│   │   ├── routes/
│   │   │   └── labels.ts         # ✏️ ADD: DELETE /issues/:id/labels/:labelId endpoint
│   │   ├── schemas/
│   │   │   └── labelSchemas.ts   # ✏️ UPDATE: Add schema for new endpoint
│   │   └── handlers/
│   │       └── labelHandlers.ts  # ✏️ ADD: Handler for removing single label
│   ├── test/integration/
│   │   └── labels.test.ts        # ✏️ UPDATE: Add tests for new endpoint
│   └── docs/api/
│       └── openapi.yaml          # ✏️ UPDATE: Document new endpoint
│
├── web/                          # Web UI (React + Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ItemDetail.tsx    # ✏️ UPDATE: Integrate LabelSelector
│   │   │   ├── LabelSelector.tsx # ✨ NEW: Main label management component
│   │   │   ├── LabelBadge.tsx    # ✨ NEW: Label display with color
│   │   │   ├── LabelCreationForm.tsx  # ✨ NEW: Form for creating labels
│   │   │   ├── LabelSearchInput.tsx   # ✨ NEW: Search/filter labels
│   │   │   └── RecentLabels.tsx  # ✨ NEW: Recent labels quick access
│   │   ├── hooks/
│   │   │   └── useRecentLabels.ts # ✨ NEW: localStorage hook for recent labels
│   │   └── api/
│   │       └── services/          # ♻️ REGENERATE: After OpenAPI update
│   │           └── LabelsService.ts
│   └── test/
│       ├── components/            # ✨ NEW: Vitest unit tests
│       │   ├── LabelSelector.test.tsx
│       │   ├── LabelCreationForm.test.tsx
│       │   └── useRecentLabels.test.ts
│       └── e2e/                   # ✨ NEW: Playwright E2E tests
│           └── label-management.spec.ts
│
├── db/                           # Database layer
│   └── src/
│       ├── labelRepository.ts    # ✏️ UPDATE: Add detachLabelFromIssue() function
│       └── schema/
│           └── 001_init.sql      # ✅ NO CHANGE: Schema already supports feature
│
└── shared/                       # Shared types
    └── src/
        └── index.ts               # ✅ NO CHANGE: Label type already defined
```

**Structure Decision**: Web application (monorepo with separate packages). This feature primarily adds new React components to `packages/web/src/components/` and one new API endpoint to `packages/api/src/routes/labels.ts`. The existing project structure is preserved; no new packages are created.

**Legend**:
- ✨ NEW: New file to be created
- ✏️ UPDATE: Existing file to be modified
- ✏️ ADD: New functionality added to existing file
- ♻️ REGENERATE: Auto-generated from OpenAPI schema
- ✅ NO CHANGE: File exists and requires no modifications

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New API endpoint: DELETE /api/issues/:issueId/labels/:labelId | Remove single label from item without affecting other labels. Required for user story #3 (P2 priority). | Full label replacement (PUT with entire label list) would require: (1) fetching current labels, (2) client-side removal logic, (3) race conditions if labels change between fetch and update, (4) more network traffic and complexity. Single-purpose DELETE endpoint is RESTful, safer, and simpler for clients. |
