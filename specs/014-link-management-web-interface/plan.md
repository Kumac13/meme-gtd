# Implementation Plan: Link Management Web Interface

**Branch**: `014-link-management-web-interface` | **Date**: 2025-10-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-link-management-web-interface/spec.md`

## Summary

Add inline link management UI to Web interface (task/memo detail pages) that allows users to view, create, and delete issue relationships without using CLI or modal dialogs. The UI follows GitHub's sub-issues pattern with collapsible sections positioned between Title/Labels and Body.

**Technical Approach**: Implement as React components integrated into existing `ItemDetail.tsx` component. Use Vite + React 19 + TypeScript with TailwindCSS styling. Leverage existing API client structure (generated from OpenAPI) and follow patterns from Labels section for consistent UI.

## Technical Context

**Language/Version**: TypeScript 5.5+ (React 19.2)
**Primary Dependencies**:
- React 19.2 + React DOM 19.2
- React Router DOM 7.9 (routing)
- Vite 7.1 (build tool)
- TailwindCSS 4.1 (styling)
- OpenAPI TypeScript Codegen (API client generation)

**Storage**: N/A (backend API handles persistence)
**Testing**:
- Vitest 1.6 (unit tests)
- @testing-library/react 16.3 (component tests)
- Playwright 1.56 (E2E tests - optional for this feature)

**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge - ES6+ support)
**Project Type**: Web application (packages/web)
**Performance Goals**:
- Link section loads in <2 seconds for up to 20 links
- UI remains responsive during API operations (<16ms frame time)
- Inline error display within <1 second of API response

**Constraints**:
- Must match existing UI patterns (ItemDetail.tsx, Labels section)
- Must use generated API client (`packages/web/src/api/`)
- No modal dialogs (inline-only UI)
- Must support both task and memo detail pages

**Scale/Scope**:
- 3 new React components (LinkSection, LinkItem, AddLinkInline)
- Integrate into 1 existing component (ItemDetail.tsx)
- 3 API endpoints (GET, POST, DELETE)
- ~500-800 lines of TypeScript code
- 10-15 unit/component tests

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ NO CONSTITUTIONAL VIOLATIONS

This feature is a pure UI enhancement to an existing monorepo package (`packages/web`). The constitution template appears to be empty/placeholder, but standard best practices apply:

- ✅ **Library-First**: Web UI is already a standalone package with clear boundaries
- ✅ **Test-First**: Following TDD - tests will be written before implementation
- ✅ **Integration Testing**: Component tests for React components, E2E tests optional
- ✅ **Simplicity**: Inline UI without modals, reusing existing patterns
- ✅ **No New Dependencies**: All required dependencies already in package.json

**Re-check after Phase 1**: Will verify component design doesn't introduce unnecessary complexity.

## Project Structure

### Documentation (this feature)

```
specs/014-link-management-web-interface/
├── spec.md              # Feature specification (completed)
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (component patterns, API integration)
├── data-model.md        # Phase 1 output (UI state models, API contracts)
├── quickstart.md        # Phase 1 output (manual testing guide)
├── contracts/           # Phase 1 output (API endpoint contracts)
│   └── links-api.yaml   # OpenAPI schema for link endpoints
├── checklists/
│   └── requirements.md  # Specification quality checklist (completed)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created yet)
```

### Source Code (repository root)

```
packages/web/
├── src/
│   ├── components/
│   │   ├── ItemDetail.tsx          # MODIFY: Add LinkSection integration
│   │   ├── LinkSection.tsx         # NEW: Main link management container
│   │   ├── LinkItem.tsx            # NEW: Individual link display + delete
│   │   └── AddLinkInline.tsx       # NEW: Inline add link form
│   ├── api/
│   │   ├── services/
│   │   │   └── LinksService.ts     # VERIFY: Generated from OpenAPI (should exist)
│   │   └── models/
│   │       └── Link.ts             # VERIFY: Generated link type definitions
│   ├── utils/
│   │   └── linkIcons.ts            # NEW: Link type icon mapping helpers
│   └── types/
│       └── links.ts                # NEW: TypeScript types for UI state
└── tests/
    ├── components/
    │   ├── LinkSection.test.tsx    # NEW: LinkSection component tests
    │   ├── LinkItem.test.tsx       # NEW: LinkItem component tests
    │   └── AddLinkInline.test.tsx  # NEW: AddLinkInline component tests
    └── integration/
        └── link-management.test.tsx # NEW: Full flow integration test (optional)
```

**Structure Decision**: Web application structure (Option 2 adapted). Feature is isolated to `packages/web` with new components in `src/components/` following existing patterns. API client code is generated via `pnpm generate:api` from OpenAPI specs.

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

N/A - No constitutional violations detected.

---

## Phase 0: Research & Technical Decisions

**Objective**: Resolve all technical unknowns and establish implementation patterns.

### Research Tasks

#### RT-001: Component Structure Patterns
**Question**: How should LinkSection components integrate with ItemDetail.tsx?
**Focus Areas**:
- Review existing Labels section implementation (lines 120-135 in ItemDetail.tsx)
- Identify state management pattern (local state vs. lifting state up)
- Determine prop drilling requirements
- Review collapsible UI patterns in codebase

**Decision Criteria**:
- Minimize changes to ItemDetail.tsx
- Follow existing component composition patterns
- Ensure testability of new components

#### RT-002: API Client Integration
**Question**: How to use generated API client for link operations?
**Focus Areas**:
- Verify LinksService exists in `packages/web/src/api/services/`
- Review OpenAPI codegen output structure
- Identify error handling patterns in existing services (MemosService, TasksService)
- Determine loading state management pattern

**Decision Criteria**:
- Use existing fetch-based API client
- Follow error handling patterns from MemosService/TasksService
- Ensure proper TypeScript typing

#### RT-003: Icon Display Strategy
**Question**: How to render emoji icons (📤/📥/🔗/⚡) reliably across browsers?
**Focus Areas**:
- Test emoji rendering in target browsers
- Consider alternatives (SVG icons, icon libraries)
- Review existing icon usage in codebase (bookmark icon in ItemDetail.tsx)

**Decision Criteria**:
- Prefer native emoji for simplicity
- Fall back to SVG if rendering issues detected
- Must be accessible (ARIA labels)

#### RT-004: Collapsible Section Implementation
**Question**: Should we use `<details>` element or custom React component?
**Focus Areas**:
- Evaluate `<details>` element browser support and styling
- Review existing collapsible patterns in codebase
- Consider animation requirements (smooth expand/collapse)

**Decision Criteria**:
- Prefer native `<details>` for accessibility
- Use CSS for smooth animations
- Must support controlled state (expanded/collapsed)

#### RT-005: Inline Form UX Pattern
**Question**: How to handle link type selection + target ID input flow?
**Focus Areas**:
- Review GitHub's sub-issues UI flow
- Determine if dropdown + input should be separate steps or combined
- Consider mobile responsiveness

**Decision Criteria**:
- Two-step flow: select type → enter ID (matches GitHub pattern)
- Mobile-friendly input sizes
- Clear visual feedback for active form

### Research Deliverables

**Output File**: `research.md`

**Required Sections**:
1. **Component Integration Pattern**
   - Decision: How LinkSection integrates with ItemDetail
   - Rationale: Why this pattern chosen
   - Code example: Integration point

2. **API Client Usage**
   - Decision: How to call LinksService methods
   - Rationale: Error handling approach
   - Code example: Fetch + error handling

3. **Icon Rendering Approach**
   - Decision: Emoji vs SVG icons
   - Rationale: Browser compatibility, accessibility
   - Code example: Icon component/helper

4. **Collapsible UI Implementation**
   - Decision: `<details>` vs custom component
   - Rationale: Accessibility, styling control
   - Code example: Collapsible section

5. **Inline Form Flow**
   - Decision: UX flow for adding links
   - Rationale: User experience, mobile compatibility
   - Code example: Form state management

---

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete with all decisions finalized

### 1.1 Data Model

**Objective**: Define UI state models and type definitions.

**Output File**: `data-model.md`

**Required Content**:

#### UI State Models

1. **Link Display Item**
   ```typescript
   interface LinkDisplayItem {
     id: number;
     sourceIssueId: number;
     targetIssueId: number;
     linkType: 'parent' | 'child' | 'relates' | 'derived_from';
     direction: 'outgoing' | 'incoming';
     targetIssue: {
       id: number;
       type: 'task' | 'memo';
       title: string;
     };
     createdAt: string;
   }
   ```

2. **Link Creation Form State**
   ```typescript
   interface LinkCreationState {
     isAdding: boolean;
     selectedType: 'parent' | 'child' | 'relates' | 'derived_from' | null;
     targetId: string;
     error: string | null;
     isSubmitting: boolean;
   }
   ```

3. **Delete Confirmation State**
   ```typescript
   interface DeleteConfirmationState {
     linkId: number | null;
     isConfirming: boolean;
   }
   ```

#### API Response Types

Document expected API response shapes (from OpenAPI generated types):

1. **GET /api/issues/:id/links Response**
2. **POST /api/links Request/Response**
3. **DELETE /api/links/:id Response**

#### State Transitions

1. **Link Creation Flow**
   - idle → type_selected → entering_id → submitting → success/error → idle

2. **Link Deletion Flow**
   - idle → confirming → deleting → success/error → idle

### 1.2 API Contracts

**Objective**: Document API endpoints used by feature.

**Output Directory**: `contracts/`

**File**: `contracts/links-api.yaml`

**Content**: Extract relevant sections from `packages/api/docs/api/openapi.yaml`:

```yaml
paths:
  /api/issues/{id}/links:
    get:
      summary: List links for an issue
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: List of links with target issue information
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/LinkWithDirection'

  /api/links:
    post:
      summary: Create a new link
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateLinkRequest'
      responses:
        '201':
          description: Link created
        '400':
          description: Validation error
        '404':
          description: Issue not found

  /api/links/{id}:
    delete:
      summary: Delete a link
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: Link deleted
        '404':
          description: Link not found
```

### 1.3 Component Design

**Objective**: Define component interfaces and responsibilities.

**Output**: Added to `data-model.md` under "Component Architecture" section

**Components**:

1. **LinkSection.tsx**
   - Props: `issueId: number`, `issueType: 'memo' | 'task'`
   - State: links array, loading, error, creation state, delete state
   - Responsibilities: Fetch links, orchestrate create/delete, render LinkItem children

2. **LinkItem.tsx**
   - Props: `link: LinkDisplayItem`, `onDelete: (linkId: number) => void`
   - State: local delete confirmation
   - Responsibilities: Display link with icon, handle delete button click

3. **AddLinkInline.tsx**
   - Props: `sourceIssueId: number`, `onAdd: (targetId: number, type: LinkType) => void`, `onCancel: () => void`
   - State: selected type, target ID input, validation errors
   - Responsibilities: Render dropdown + input, validate input, call onAdd

### 1.4 Manual Testing Guide

**Objective**: Provide step-by-step manual testing scenarios.

**Output File**: `quickstart.md`

**Structure**:

1. **Prerequisites**
   - API server running (pnpm server:dev)
   - Web UI running (pnpm --filter meme-gtd-web dev)
   - Test data: at least 3 tasks/memos with some existing links

2. **Test Scenario 1: View Existing Links (P1)**
   - Steps to navigate to task/memo detail page
   - Expected: Links section visible with correct count
   - Expected: Each link shows icon, direction, target title

3. **Test Scenario 2: Create New Link (P2)**
   - Steps to click [+ Add], select type, enter ID, click [Add]
   - Expected: Link appears in list immediately
   - Test error cases: invalid ID, circular link, duplicate

4. **Test Scenario 3: Delete Link (P3)**
   - Steps to click [×], confirm deletion
   - Expected: Link removed, count updates

5. **Edge Cases**
   - Deleted target issue
   - Very long title truncation
   - Many links (10+)

### 1.5 Agent Context Update

**Objective**: Update Claude Code agent context with new technologies/patterns.

**Action**: Run agent context update script

```bash
.specify/scripts/bash/update-agent-context.sh claude
```

**Expected Updates**:
- Add LinkSection component pattern to agent memory
- Add inline form UI pattern
- Add collapsible section implementation
- Preserve existing manual additions

---

## Phase 2: Task Breakdown (NOT DONE BY THIS COMMAND)

**Note**: This phase is executed by the `/speckit.tasks` command, NOT by `/speckit.plan`.

The tasks.md file will be generated after this plan is complete, breaking down implementation into granular, testable tasks following TDD principles.

---

## Deliverables Checklist

After running `/speckit.plan`, the following files must exist:

- [x] `specs/014-link-management-web-interface/plan.md` (this file)
- [x] `specs/014-link-management-web-interface/research.md` (Phase 0 output - 17KB)
- [x] `specs/014-link-management-web-interface/data-model.md` (Phase 1 output - 14KB)
- [x] `specs/014-link-management-web-interface/quickstart.md` (Phase 1 output - 17KB)
- [x] `specs/014-link-management-web-interface/contracts/links-api.yaml` (Phase 1 output - 9.9KB)
- [x] `CLAUDE.md` (agent context updated with TypeScript/React patterns)

**Status**: ✅ Phase 0 and Phase 1 COMPLETE

**Next Command**: `/speckit.tasks` (to generate task breakdown for implementation)
