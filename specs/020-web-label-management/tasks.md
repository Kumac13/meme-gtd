# Implementation Tasks: Web UI Label Management

**Feature**: 020-web-label-management
**Branch**: `020-web-label-management`
**Generated**: 2025-10-28

## Overview

This document provides a complete, dependency-ordered task list for implementing the Web UI Label Management feature. Tasks are organized by user story to enable independent implementation and testing.

**Total Tasks**: 45
**Estimated Duration**: 5-8 days (1 developer)

---

## Implementation Strategy

### MVP Scope (Minimum Viable Product)
**User Story 1 only** (P1 - Assign Existing Labels) provides core value:
- Users can assign/remove labels from items
- Labels display on item detail pages
- Basic modal UI for label selection

### Incremental Delivery Path
1. **MVP**: User Story 1 (P1) - Label assignment → Deployable
2. **Enhancement 1**: User Story 3 (P2) - Label removal → Deployable
3. **Enhancement 2**: User Story 2 (P2) - Label creation → Deployable
4. **Enhancement 3**: User Story 4 (P3) - Recent labels → Deployable
5. **Administrative**: User Story 5 (P4) - Global deletion → Deployable

Each increment is independently testable and deployable.

---

## User Story Dependencies

```
Phase 1 (Setup) - Infrastructure
    ↓
Phase 2 (Foundational) - Backend endpoint [BLOCKING]
    ↓
Phase 3 (US1-P1) - Label Assignment [INDEPENDENT] ✅ MVP
    ├→ Phase 5 (US3-P2) - Label Removal [DEPENDS ON US1]
    └→ Phase 6 (US4-P3) - Recent Labels [DEPENDS ON US1]
    ↓
Phase 4 (US2-P2) - Label Creation [INDEPENDENT]
    ↓
Phase 7 (US5-P4) - Global Deletion [INDEPENDENT]
    ↓
Phase 8 (Polish) - Final touches
```

**Key Insights**:
- US1 (Label Assignment) must complete first - foundation for US3 and US4
- US2 (Label Creation) is independent - can be done in parallel with US1
- US3 (Label Removal) requires US1's modal infrastructure
- US4 (Recent Labels) extends US1's assignment functionality
- US5 (Global Deletion) is fully independent

---

## Phase 1: Setup & Infrastructure

**Goal**: Prepare development environment and verify existing backend.

### Tasks

- [X] T001 Verify test database initialization with sample labels in `test-data/test.db`
- [X] T002 Verify test API server runs on port 3001 with test database
- [X] T003 Verify existing label API endpoints are functional (GET /api/labels, POST /api/labels, POST /api/issues/:id/labels)
- [X] T004 [P] Create test labels via CLI for development (`pnpm mgtd:test label create "bug"`, "feature", "urgent")
- [X] T005 [P] Create test tasks/memos with existing labels for testing label display

**Parallel Opportunities**: T004 and T005 can run in parallel (independent operations).

**Exit Criteria**:
- Test API server responds to label endpoints
- At least 3 test labels exist
- At least 2 test items exist with labels assigned

---

## Phase 2: Foundational Backend (Blocking)

**Goal**: Implement the missing DELETE endpoint required for label removal.

**⚠️ BLOCKING**: This phase must complete before User Story 3 (Remove Labels). However, User Stories 1, 2, and 5 can proceed without this endpoint.

### Tasks

- [X] T006 Implement `detachLabelFromIssue()` in `packages/db/src/labelRepository.ts` (validates issue/label exist, removes assignment)
- [X] T007 Add DELETE `/api/issues/:issueId/labels/:labelId` route handler in `packages/api/src/routes/labels.ts`
- [X] T008 [P] Add Zod schema for DELETE endpoint parameters in `packages/api/src/schemas/labelSchemas.ts`
- [X] T009 [P] Update OpenAPI spec with DELETE endpoint in `packages/api/docs/api/openapi.yaml`
- [X] T010 Add integration tests for DELETE endpoint in `packages/api/test/integration/labels.test.ts` (success, 404 errors, idempotency)
- [X] T011 Run backend integration tests to verify DELETE endpoint works (`pnpm --filter meme-gtd-api test`)
- [X] T012 Regenerate Web API client (`pnpm --filter meme-gtd-web generate:api`) to add `removeLabelFromIssue()` method

**Parallel Opportunities**: T008 and T009 can run in parallel (independent files).

**Exit Criteria**:
- DELETE endpoint returns 204 on success
- DELETE endpoint returns 404 for non-existent issue/label
- Integration tests pass
- API client has `removeLabelFromIssue()` method

---

## Phase 3: User Story 1 - Assign Existing Labels (P1) ✅ MVP

**User Story**: A user viewing a task or memo needs to categorize it by assigning one or more labels. They open the item detail page, select labels from an available list, and immediately see those labels appear on the item.

**Independent Test**: Open item detail → Click label selector → Choose labels from list → Verify labels appear on item.

**Value Delivered**: Core label management functionality. Users can organize items.

### 3.1 Foundation Components

- [X] T013 [P] [US1] Create `LabelBadge.tsx` in `packages/web/src/components/` (displays label with auto-generated color from name hash)
- [X] T014 [P] [US1] Add `getLabelColor()` utility function to `LabelBadge.tsx` (HSL color generation from string hash)
- [X] T015 [US1] Update `ItemDetail.tsx` in `packages/web/src/components/` to display labels using `LabelBadge` component (replace current label display)

**Parallel Opportunities**: T013 and T014 are part of same file; T015 depends on T013 completing.

### 3.2 Label Management Modal

- [X] T016 [US1] Create `LabelManagementModal.tsx` in `packages/web/src/components/` (modal container with backdrop, header, close button)
- [X] T017 [US1] Add state management to `LabelManagementModal.tsx` (allLabels, assignedLabelIds, searchQuery, loading, error, saving)
- [X] T018 [US1] Implement label fetching in `LabelManagementModal.tsx` (fetch GET /api/labels and item labels on mount)
- [X] T019 [US1] Add checkbox list rendering in `LabelManagementModal.tsx` (show all labels with checked state based on assignedLabelIds)
- [X] T020 [US1] Implement label assignment in `LabelManagementModal.tsx` (POST /api/issues/:id/labels with optimistic update and rollback on error)
- [X] T021 [US1] Add error handling and user feedback in `LabelManagementModal.tsx` (display error banner, loading state)
- [X] T022 [US1] Add ARIA attributes to `LabelManagementModal.tsx` (role="dialog", aria-modal, aria-labelledby for accessibility)

### 3.3 Search/Filter

- [X] T023 [US1] Add search input to `LabelManagementModal.tsx` (controlled input with searchQuery state)
- [X] T024 [US1] Implement client-side filtering in `LabelManagementModal.tsx` (useMemo to filter labels by name substring match)

### 3.4 Integration

- [X] T025 [US1] Add "Manage Labels" button to `ItemDetail.tsx` sidebar (opens modal on click, passes item ID and type)
- [X] T026 [US1] Connect modal to ItemDetail in `ItemDetail.tsx` (handle modal open/close state, refresh item on labels changed)

### 3.5 Verification

- [ ] T027 [US1] Manual test: Assign single label to task via modal (verify label appears immediately)
- [ ] T028 [US1] Manual test: Assign multiple labels to memo via modal (verify all labels appear with correct colors)
- [ ] T029 [US1] Manual test: Search filter in modal works correctly (verify filtering by partial name match)
- [ ] T030 [US1] Manual test: Optimistic update rollback on API error (disconnect network, verify rollback and error message)

**Acceptance Criteria (from spec.md)**:
- ✅ User clicks label selector → selects "bug" → label appears on task
- ✅ Task with "bug" label → open selector → "bug" is checked
- ✅ User selects multiple labels → both appear with consistent styling
- ✅ Task with labels in detail view → same labels visible in list view

**Exit Criteria**: User Story 1 fully functional and manually tested. MVP is complete and deployable.

---

## Phase 4: User Story 2 - Create New Labels (P2)

**User Story**: A user needs a new label category that doesn't exist yet. From the label selector, they choose "Create new label", enter a name (required) and optional description, see a preview of how it will look, and create it.

**Independent Test**: Click "Create new label" → Enter name and description → See preview → Create → Label appears in list.

**Value Delivered**: Users can customize their organization system without admin intervention.

**Dependencies**: None (can be implemented in parallel with US1).

### 4.1 Creation Form Component

- [ ] T031 [P] [US2] Create `LabelCreationForm.tsx` in `packages/web/src/components/` (form with name input, description textarea, submit/cancel buttons)
- [ ] T032 [US2] Add form state management to `LabelCreationForm.tsx` (name, description, nameError, submitting, submitError)
- [ ] T033 [US2] Implement validation in `LabelCreationForm.tsx` (name required, trim whitespace, max length checks)
- [ ] T034 [US2] Add label preview in `LabelCreationForm.tsx` (show LabelBadge with entered name and generated color)
- [ ] T035 [US2] Implement label creation API call in `LabelCreationForm.tsx` (POST /api/labels, handle 409 duplicate error)

### 4.2 Modal Integration

- [ ] T036 [US2] Add mode toggle to `LabelManagementModal.tsx` (add 'select' | 'create' mode state)
- [ ] T037 [US2] Add "Create new label" button to `LabelManagementModal.tsx` (switches mode to 'create')
- [ ] T038 [US2] Integrate `LabelCreationForm` into `LabelManagementModal.tsx` (show form when mode is 'create', handle success/cancel)
- [ ] T039 [US2] Add newly created label to modal's label list in `LabelManagementModal.tsx` (update allLabels array on creation success)

### 4.3 Verification

- [ ] T040 [US2] Manual test: Create new label with name and description (verify preview shows correct color, label appears in list)
- [ ] T041 [US2] Manual test: Create label with empty name (verify error message "Name is required")
- [ ] T042 [US2] Manual test: Create duplicate label name (verify 409 error message shown)
- [ ] T043 [US2] Manual test: Create label and immediately assign to item (verify new label is assignable)

**Acceptance Criteria (from spec.md)**:
- ✅ User clicks "Create new label" → enters name "documentation" → preview shows with auto-generated color
- ✅ Empty name field → error "Name is required"
- ✅ Label creation succeeds → label appears immediately in available labels list
- ✅ Duplicate label name → error message shown

**Exit Criteria**: Users can create custom labels through the UI.

---

## Phase 5: User Story 3 - Remove Labels from Items (P2)

**User Story**: A user realizes a label is incorrectly assigned to an item. They open the label selector, uncheck the label, and it immediately disappears from the item.

**Independent Test**: Open item with labels → Open selector → Uncheck label → Verify label removed from item.

**Value Delivered**: Users can maintain accurate categorization as work evolves.

**Dependencies**: Requires Phase 2 (DELETE endpoint) and Phase 3 (US1 modal infrastructure).

### 5.1 Label Removal Implementation

- [ ] T044 [US3] Update checkbox toggle handler in `LabelManagementModal.tsx` to detect unchecked state (call DELETE endpoint for removal)
- [ ] T045 [US3] Implement label removal API call in `LabelManagementModal.tsx` (DELETE /api/issues/:id/labels/:labelId with optimistic update and rollback)
- [ ] T046 [US3] Update error handling in `LabelManagementModal.tsx` for removal failures (display error banner for removal errors)

### 5.2 Verification

- [ ] T047 [US3] Manual test: Remove single label from item with multiple labels (verify only target label removed)
- [ ] T048 [US3] Manual test: Remove last label from item (verify item displays with no labels)
- [ ] T049 [US3] Manual test: Remove label from one item (verify other items with same label unchanged)

**Acceptance Criteria (from spec.md)**:
- ✅ Task with "bug" and "urgent" labels → uncheck "urgent" → only "bug" remains
- ✅ Remove last label → item displays with no labels
- ✅ Remove label from one item → other items with same label unchanged

**Exit Criteria**: Users can remove labels from items with immediate feedback.

---

## Phase 6: User Story 4 - Quick Access to Recently Used Labels (P3)

**User Story**: A user frequently assigns the same few labels to multiple items. The label selector shows recently used labels at the top, allowing faster assignment without searching.

**Independent Test**: Assign label to item → Open another item's selector → Verify recently used label appears in "Recent" section at top.

**Value Delivered**: Efficiency improvement for power users who frequently use the same labels.

**Dependencies**: Requires Phase 3 (US1 assignment functionality).

### 6.1 Recent Labels Hook

- [ ] T050 [P] [US4] Create `useRecentLabels.ts` in `packages/web/src/hooks/` (custom hook with localStorage persistence)
- [ ] T051 [US4] Implement FIFO queue logic in `useRecentLabels.ts` (max 5 labels, deduplication, timestamp tracking)
- [ ] T052 [US4] Add `addRecentLabel()` function to `useRecentLabels.ts` (adds label to front, removes oldest if > 5)
- [ ] T053 [US4] Add `getRecentLabels()` function to `useRecentLabels.ts` (filters by existence, sorts by timestamp)
- [ ] T054 [US4] Add localStorage error handling to `useRecentLabels.ts` (graceful degradation for quota exceeded, private mode)

### 6.2 Modal Integration

- [ ] T055 [US4] Integrate `useRecentLabels` hook into `LabelManagementModal.tsx` (call hook, track label usage on assignment)
- [ ] T056 [US4] Add "Recent" section to `LabelManagementModal.tsx` (render recent labels above main list if any exist)
- [ ] T057 [US4] Update label assignment handler in `LabelManagementModal.tsx` to call `addRecentLabel()` after successful assignment

### 6.3 Verification

- [ ] T058 [US4] Manual test: Assign label to 3 items (verify label appears in "Recent" section on 4th item)
- [ ] T059 [US4] Manual test: Assign 6 different labels (verify oldest removed from recent, still in full list)
- [ ] T060 [US4] Manual test: Close and reopen browser (verify recent labels persist across sessions)

**Acceptance Criteria (from spec.md)**:
- ✅ User assigns "bug" to 3 items → "bug" appears in "Recent" section on next item
- ✅ Recent section has 5 labels → assign 6th → oldest removed from recent but remains in full list
- ✅ Recent labels stored locally → close/reopen app → recent labels still available

**Exit Criteria**: Recent labels improve assignment speed for frequent labels.

---

## Phase 7: User Story 5 - Delete Labels Globally (P4)

**User Story**: A user realizes a label is no longer needed across the entire system. They can delete the label, which removes it from all items and from the available labels list.

**Independent Test**: Select label for deletion → Confirm action → Verify label removed from all items and available list.

**Value Delivered**: Administrative cleanup capability for unused labels.

**Dependencies**: None (fully independent, uses existing DELETE /api/labels/:name endpoint).

### 7.1 Global Deletion UI

- [ ] T061 [P] [US5] Add delete button/menu to label items in `LabelManagementModal.tsx` (gear icon or context menu per label)
- [ ] T062 [US5] Create confirmation dialog component or use native confirm in `LabelManagementModal.tsx` (warn about permanent deletion)
- [ ] T063 [US5] Implement global label deletion in `LabelManagementModal.tsx` (DELETE /api/labels/:name, remove from allLabels list)

### 7.2 Verification

- [ ] T064 [US5] Manual test: Delete label assigned to multiple items (verify removed from all items and available list)
- [ ] T065 [US5] Manual test: Delete label confirmation prompt (verify warning message about permanent deletion)
- [ ] T066 [US5] Manual test: Delete label (verify cannot be restored, permanent deletion)

**Acceptance Criteria (from spec.md)**:
- ✅ Label "old-project" assigned to 5 items → delete label → disappears from all 5 items and available list
- ✅ Attempt to delete label → confirmation prompt warns about permanent removal
- ✅ Label deleted → permanently removed, cannot be restored

**Exit Criteria**: Users can perform administrative cleanup of unused labels.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Goal**: Final touches, accessibility, and integration improvements.

### 8.1 Visual Polish

- [ ] T067 [P] Verify consistent label colors across all views (detail page, list view, Kanban cards)
- [ ] T068 [P] Add label overflow handling to list views (show max 3 labels, "+N more" indicator)
- [ ] T069 [P] Verify label badge text contrast meets WCAG AA (4.5:1 ratio for readability)

### 8.2 Accessibility

- [ ] T070 [P] Add keyboard navigation to `LabelManagementModal.tsx` (Tab, Space, Enter, Esc keys)
- [ ] T071 [P] Test modal with screen reader (verify ARIA attributes announce correctly)
- [ ] T072 [P] Add focus trap to `LabelManagementModal.tsx` (focus stays within modal when open)
- [ ] T073 [P] Verify all interactive elements have 44x44px touch targets (mobile-friendly)

### 8.3 Performance

- [ ] T074 [P] Add useMemo to filtered labels calculation in `LabelManagementModal.tsx` (prevent unnecessary re-filtering)
- [ ] T075 [P] Add useCallback to event handlers in `LabelManagementModal.tsx` (stable function references)
- [ ] T076 [P] Profile modal rendering performance (verify < 100ms for 100 labels)

### 8.4 Integration

- [ ] T077 [P] Update KanbanCard component to display labels if not already showing (consistent with ItemDetail)
- [ ] T078 [P] Update TaskListItem/MemoListItem components to display labels (consistent display across views)

### 8.5 Documentation

- [ ] T079 [P] Update CHANGELOG.md with feature description and version bump (follow docs/versioning.md SemVer rules)
- [ ] T080 [P] Add component documentation comments to all new components (JSDoc for props, behavior)
- [ ] T081 Verify all acceptance criteria from spec.md are met (go through spec.md checklist)
- [ ] T082 Create demo video or screenshots for PR (show label assignment, creation, removal workflows)

**Parallel Opportunities**: Most polish tasks can run in parallel (independent files/concerns).

**Exit Criteria**: Feature is polished, accessible, performant, and documented.

---

## Testing Strategy (Optional)

**Note**: The feature specification does not explicitly require test implementation. The following tests are OPTIONAL but recommended:

### Unit Tests (Vitest)

**If implementing tests**, add these tasks after completing the corresponding component:

- **After T013**: Write `LabelBadge.test.tsx` (test color generation, rendering)
- **After T050**: Write `useRecentLabels.test.ts` (test FIFO queue, localStorage, deduplication)
- **After T031**: Write `LabelCreationForm.test.tsx` (test validation, submission, error handling)
- **After T026**: Write `LabelManagementModal.test.tsx` (test search, assignment, optimistic updates)

### E2E Tests (Playwright)

**If implementing tests**, add these tasks in Phase 8:

- Write `label-management.spec.ts` covering:
  - User Story 1: Assign existing labels
  - User Story 2: Create new label and assign
  - User Story 3: Remove label from item
  - User Story 4: Recent labels appear at top

---

## Parallel Execution Examples

### Example 1: Phase 2 (Foundational Backend)
```bash
# Terminal 1: Schema and OpenAPI (independent)
# T008 + T009 in parallel
git checkout -b backend-delete-endpoint
# Edit labelSchemas.ts and openapi.yaml simultaneously

# Terminal 2: Repository function (depends on schema)
# T006 after T008 completes
# Edit labelRepository.ts

# Then: Route handler (T007), tests (T010), verification (T011, T012)
```

### Example 2: Phase 3 (User Story 1) + Phase 4 (User Story 2) in Parallel
```bash
# Developer A: US1 - Label Assignment
# T013-T026 (foundation and modal)

# Developer B: US2 - Label Creation (independent)
# T031-T035 (creation form component)

# After both complete: Integrate US2 into US1's modal (T036-T039)
```

### Example 3: Phase 8 (Polish - Highly Parallel)
```bash
# Terminal 1: Visual polish (T067-T069)
# Terminal 2: Accessibility (T070-T073)
# Terminal 3: Performance (T074-T076)
# Terminal 4: Integration (T077-T078)
# Terminal 5: Documentation (T079-T082)

# All 5 can run simultaneously
```

---

## Task Summary

| Phase | Task Range | Count | Parallel Tasks | Dependencies |
|-------|------------|-------|----------------|--------------|
| Phase 1: Setup | T001-T005 | 5 | 2 (T004, T005) | None |
| Phase 2: Backend | T006-T012 | 7 | 2 (T008, T009) | None |
| Phase 3: US1 (P1) ✅ MVP | T013-T030 | 18 | 3 (T013, T014; T015 after) | Phase 2 for US3 |
| Phase 4: US2 (P2) | T031-T043 | 13 | 1 (T031) | None |
| Phase 5: US3 (P2) | T044-T049 | 6 | 0 | Phase 2, Phase 3 |
| Phase 6: US4 (P3) | T050-T060 | 11 | 1 (T050) | Phase 3 |
| Phase 7: US5 (P4) | T061-T066 | 6 | 2 (T061, T062) | None |
| Phase 8: Polish | T067-T082 | 16 | 15 (most tasks) | Phases 3-7 |
| **Total** | T001-T082 | **82** | **26** (32%)| - |

---

## Critical Path

The critical path for MVP (User Story 1) completion:

```
T001-T003 (Setup) → T006-T012 (Backend) → T013-T015 (Badge) →
T016-T022 (Modal) → T023-T024 (Search) → T025-T026 (Integration) →
T027-T030 (Verification)

Estimated: 3-4 days
```

For full feature completion (all user stories + polish):

```
Critical Path + Phase 4 (US2) + Phase 5 (US3) + Phase 6 (US4) +
Phase 7 (US5) + Phase 8 (Polish)

Estimated: 5-8 days
```

---

## Validation Checklist

✅ **Format Validation**:
- All tasks start with `- [ ]` checkbox
- All tasks have sequential Task ID (T001-T082)
- All user story tasks have [US#] label
- All parallelizable tasks have [P] marker
- All tasks include file path in description

✅ **Completeness Validation**:
- Each user story has complete implementation tasks
- Each user story has independent test criteria
- Dependencies are clearly documented
- Parallel opportunities identified

✅ **User Story Coverage**:
- User Story 1 (P1): T013-T030 ✅
- User Story 2 (P2): T031-T043 ✅
- User Story 3 (P2): T044-T049 ✅
- User Story 4 (P3): T050-T060 ✅
- User Story 5 (P4): T061-T066 ✅

---

## Next Steps

1. **Start with MVP**: Implement Phase 1-3 (User Story 1) for core functionality
2. **Incremental delivery**: Add user stories 2-5 incrementally
3. **Parallel development**: Use parallel opportunities to speed up development
4. **Test continuously**: Manually verify each phase's acceptance criteria
5. **Polish last**: Save Phase 8 for final touches before PR

---

**Document Version**: 1.0
**Generated**: 2025-10-28
**Related Documents**:
- Feature specification: `spec.md`
- Implementation plan: `plan.md`
- Research findings: `research.md`
- Data model: `data-model.md`
- API contracts: `contracts/remove-label-from-issue.yaml`
- Developer guide: `quickstart.md`
