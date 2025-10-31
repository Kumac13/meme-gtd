# Implementation Plan: Item Detail Back Navigation with Filter Preservation

**Branch**: `022-github` | **Date**: 2025-10-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/022-github/spec.md`

## Summary

Extend PR #65's URL-based filter state management to preserve filter context when navigating from item lists (tasks, memos, projects) to detail pages and back. Users clicking "Back to [items]" will return to their filtered view instead of the default unfiltered list. Implementation uses URL parameters (`?returnFilters=...`) to store the originating list's filter state, supporting all item types with their respective filters (tasks: status + bookmarked; memos/projects: bookmarked only).

## Technical Context

**Language/Version**: TypeScript 5.5.4, React 19.2.0, Node.js 22+
**Primary Dependencies**: React Router DOM 7.9.4, Vite 7.1.11 (existing from PR #65)
**Storage**: N/A (URL-based state only, no backend changes)
**Testing**: Vitest (existing test setup from PR #65)
**Target Platform**: Web (Chrome, Firefox, Safari modern versions)
**Project Type**: Web application (monorepo with `packages/web/`)
**Performance Goals**: < 500ms navigation time (from click to fully rendered filtered list)
**Constraints**: URL length < 500 characters for typical filter combinations, XSS-safe parameter handling
**Scale/Scope**: 3 item types (tasks, memos, projects), ~5-10 affected components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: PASS (Constitution file is template-only, no active principles enforced)

**Analysis**:
- No specific constitution principles defined for this project yet
- Following existing PR #65 patterns ensures consistency
- No violations detected

**Re-check after Phase 1**: Will verify URL parameter approach aligns with any future constitution updates

## Project Structure

### Documentation (this feature)

```
specs/022-github/
├── plan.md              # This file
├── research.md          # Phase 0 output (URL encoding patterns, React Router state management)
├── data-model.md        # Phase 1 output (URL parameter schema, filter type definitions)
├── quickstart.md        # Phase 1 output (Developer guide for testing the feature)
├── contracts/           # Phase 1 output (TypeScript type definitions)
│   └── return-filters.types.ts
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```
packages/web/
├── src/
│   ├── components/
│   │   ├── ItemDetail.tsx       # MODIFY: Add returnFilters prop
│   │   └── ItemList.tsx         # MODIFY: Pass current filters to detail links
│   ├── pages/
│   │   ├── TasksList.tsx        # MODIFY: Pass filter state to links
│   │   ├── TaskDetail.tsx       # MODIFY: Extract returnFilters, pass to ItemDetail
│   │   ├── MemosList.tsx        # MODIFY: Pass filter state to links
│   │   ├── MemoDetail.tsx       # MODIFY: Extract returnFilters, pass to ItemDetail
│   │   ├── ProjectsList.tsx     # MODIFY: Pass filter state to links
│   │   └── ProjectDetail.tsx    # MODIFY: Extract returnFilters, pass to ItemDetail
│   └── utils/
│       ├── urlFilterHelpers.ts  # EXTEND: Add return filter encoding/decoding functions
│       └── returnFilterHelpers.ts # NEW: Item-type-agnostic filter preservation logic
└── tests/
    └── unit/
        ├── urlFilterHelpers.test.ts  # EXTEND: Add return filter tests
        └── returnFilterHelpers.test.ts # NEW: Test filter encoding/decoding
```

**Structure Decision**: Monorepo web application structure. All changes confined to `packages/web/` to maintain compatibility with existing backend (`packages/api/`) and CLI (`packages/cli/`). Follows PR #65 pattern of utility functions + component integration.

## Complexity Tracking

*No constitution violations - this section intentionally left empty*

## Phase 0: Research & Technical Decisions

**Objective**: Resolve technical unknowns and establish implementation patterns

### Research Tasks

1. **URL Parameter Encoding Strategy**
   - Research: Best practices for encoding nested filter parameters in URLs
   - Decision needed: Single `returnFilters` param with URL-encoded query string vs multiple params
   - Output: Encoding/decoding approach documented in `research.md`

2. **React Router State Management**
   - Research: React Router v7 URL state handling patterns
   - Verify: `useSearchParams` compatibility with nested parameter structures
   - Output: Integration pattern documented in `research.md`

3. **XSS Prevention for User-Controlled URLs**
   - Research: Security best practices for user-provided URL parameters
   - Decision needed: Sanitization approach (whitelist vs validation)
   - Output: Security validation strategy documented in `research.md`

4. **Cross-Item-Type Abstraction**
   - Research: Design patterns for shared logic across tasks/memos/projects
   - Decision needed: Generic helper vs per-type implementations
   - Output: Code structure recommendation in `research.md`

5. **Performance Impact of URL Parsing**
   - Research: Performance characteristics of `URLSearchParams` operations
   - Verify: No measurable impact on <500ms navigation goal
   - Output: Performance analysis in `research.md`

**Deliverable**: `research.md` with decisions on encoding strategy, security approach, and code structure

## Phase 1: Design & Contracts

**Prerequisites**: `research.md` complete

### Data Model (`data-model.md`)

**Entities**:

1. **ReturnFilterContext**
   - `itemType`: 'task' | 'memo' | 'project'
   - `filters`: Map<string, string> (e.g., `{status: 'open', bookmarked: 'true'}`)
   - Encoding: URL-encoded query string format
   - Validation: Type-specific filter whitelisting

2. **ItemListRoute**
   - Base paths: `/tasks/`, `/memos/`, `/projects/`
   - Query parameters: Item-type-specific (see spec Key Entities)
   - State: Managed by existing `useSearchParams` (PR #65)

3. **ItemDetailRoute**
   - Paths: `/tasks/:id`, `/memos/:id`, `/projects/:id`
   - Query parameter: `returnFilters` (optional, URL-encoded string)
   - State: Extracted via `useSearchParams`, decoded to filters map

**State Transitions**:
- List (with filters) → Detail: Encode current filters into `returnFilters` param
- Detail → List: Decode `returnFilters`, append to list base URL
- Direct Detail Access: No `returnFilters` param → default list URL

### API Contracts (`contracts/`)

**File**: `contracts/return-filters.types.ts`

```typescript
/**
 * Item types supporting filter preservation
 */
export type ItemType = 'task' | 'memo' | 'project';

/**
 * Filter map for return navigation
 */
export type FilterMap = Record<string, string>;

/**
 * Encoded return filter context in URL
 */
export interface ReturnFilterContext {
  itemType: ItemType;
  filters: FilterMap;
}

/**
 * Validation result for return filter parameters
 */
export interface FilterValidationResult {
  valid: boolean;
  sanitizedFilters?: FilterMap;
  error?: string;
}
```

### Developer Quickstart (`quickstart.md`)

**Sections**:
1. **Testing the Feature**
   - Manual test scenarios (filter → detail → back)
   - Browser DevTools inspection of URL parameters
   - Edge case testing (invalid params, direct access)

2. **Adding Filter Support to New Item Types**
   - Step-by-step guide for extending to new types
   - Filter validation checklist

3. **Debugging Navigation Issues**
   - Common issues and solutions
   - Logging strategy for `returnFilters` errors

### Agent Context Update

Run: `.specify/scripts/bash/update-agent-context.sh claude`

**Technologies to add**:
- React Router DOM 7.9.4 (`useSearchParams` hook)
- URL parameter encoding patterns
- TypeScript discriminated unions for item types

## Phase 2: Implementation Planning (Not Executed by /speckit.plan)

**Note**: Detailed task breakdown created by `/speckit.tasks` command

**High-Level Implementation Order**:

1. **Foundation** (parallel after research)
   - Create `returnFilterHelpers.ts` utility
   - Extend `urlFilterHelpers.ts` with encoding functions
   - Write unit tests for new utilities

2. **Component Integration** (sequential after foundation)
   - Update `ItemList.tsx` to inject `returnFilters` into links
   - Update `ItemDetail.tsx` to consume `returnFilters` prop
   - Update page components (TasksList, TaskDetail, etc.)

3. **Testing & Validation** (parallel after integration)
   - Manual testing across all item types
   - Browser compatibility verification
   - Performance measurement (<500ms goal)

4. **Documentation** (final)
   - Update component prop documentation
   - Add code comments for filter encoding logic
   - Document edge case handling

**Dependencies**:
- `returnFilterHelpers.ts` must complete before component changes
- Page components can be updated in parallel (tasks/memos/projects independent)
- Testing requires all components integrated

**Performance Considerations**:
- URL parameter parsing happens once per navigation (negligible cost)
- No additional API calls required
- Target: <500ms total navigation time (measured in browser)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| URL length exceeds browser limits (2000 chars) | HIGH | Limit filter combinations, test with maximum filters |
| XSS vulnerability via malicious `returnFilters` | CRITICAL | Whitelist validation, sanitize all parameters |
| React Router v7 breaking changes | MEDIUM | Pin dependency version, test in isolation |
| Performance degradation with complex filters | MEDIUM | Measure actual impact, optimize if >500ms |
| Inconsistent behavior across item types | MEDIUM | Shared utility functions, comprehensive tests |

## Success Metrics

- **Functional**: All 9 functional requirements (FR-001 to FR-009) pass acceptance tests
- **Performance**: 95th percentile navigation time < 500ms
- **Coverage**: 100% of supported filter types work across all 3 item types
- **Security**: Zero XSS vulnerabilities in security audit
- **Regression**: Zero failures in existing PR #65 filter tests

## Open Questions (To be resolved in Phase 0)

1. Should `returnFilters` use base64 encoding or URL-encoded query string? (Security vs readability tradeoff)
2. How to handle future item types with unknown filter types? (Extensibility requirement)
3. Should we log all filter preservation events or only errors? (Observability vs performance)

**Resolution Process**: Documented in `research.md` after investigation
