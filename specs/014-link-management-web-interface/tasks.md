# Tasks: Link Management Web Interface

**Input**: Design documents from `/specs/014-link-management-web-interface/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/links-api.yaml

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Following TDD approach - tests are written before implementation.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and prepare for implementation

- [x] T001 [P] Verify API client exists: Check that `packages/web/src/api/services/LinksService.ts` is generated from OpenAPI spec
- [x] T002 [P] Verify API models exist: Check that `packages/web/src/api/models/Link.ts` contains link type definitions
- [x] T003 [P] Setup test infrastructure: Ensure Vitest and @testing-library/react are configured in `packages/web/vitest.config.ts`

**Checkpoint**: API client and test infrastructure verified

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core type definitions and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 [P] Create UI type definitions in `packages/web/src/types/links.ts`:
  - LinkDisplayItem interface
  - LinkCreationState interface
  - DeleteConfirmationState interface
  - LinkType union type
  - Direction union type
- [x] T005 [P] Create icon utility in `packages/web/src/utils/linkIcons.tsx`:
  - getLinkIcon() function (returns JSX for SVG icons)
  - getLinkLabel() function (returns human-readable label)
  - Icon components: IconParent, IconChild, IconRelated, IconDerivedFrom
  - Direction-aware icon rendering (outgoing/incoming arrows)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - View Existing Links (Priority: P1) 🎯 MVP

**Goal**: Display existing links inline between Labels and Body with icons, direction, and target titles

**Independent Test**: Navigate to task/memo detail page with existing links, verify Links section appears between Labels and Body with correct count and link details

### Tests for User Story 1 (TDD - write first, fail, then implement)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T006 [P] [US1] Write component test for LinkSection in `packages/web/tests/components/LinkSection.test.tsx`:
  - Test: Renders loading state initially
  - Test: Fetches links on mount via LinksService.listIssueLinks()
  - Test: Displays correct link count in section header
  - Test: Renders LinkItem for each link in response
  - Test: Shows empty state when no links exist
  - Test: Handles API errors gracefully
- [ ] T007 [P] [US1] Write component test for LinkItem in `packages/web/tests/components/LinkItem.test.tsx`:
  - Test: Renders link with correct icon (parent/child/relates/derived_from)
  - Test: Shows direction indicator (outgoing/incoming)
  - Test: Displays target issue title and ID
  - Test: Renders link to target issue detail page
  - Test: Shows [×] delete button
  - Test: Handles deleted target issues (grayed out, disabled link)
- [ ] T008 [P] [US1] Write test for collapsible behavior in LinkSection.test.tsx:
  - Test: Section defaults to expanded when links exist
  - Test: Section defaults to collapsed when no links exist
  - Test: Clicking header toggles expanded/collapsed state
  - Test: Chevron icon rotates on expand/collapse
- [ ] T009 [P] [US1] Write test for long title truncation in LinkItem.test.tsx:
  - Test: Titles >100 characters are truncated with ellipsis
  - Test: Full title appears in hover tooltip

### Implementation for User Story 1

- [x] T010 [P] [US1] Create LinkItem component in `packages/web/src/components/LinkItem.tsx`:
  - Import types from `src/types/links.ts`
  - Accept props: link (LinkDisplayItem), onDelete callback
  - Render icon from linkIcons utility based on linkType + direction
  - Render target issue title with link to `/memos/:id` or `/tasks/:id`
  - Render [×] delete button (functionality added in US3)
  - Apply TailwindCSS styling consistent with Labels section
  - Handle long titles with CSS text-overflow: ellipsis
  - Handle deleted issues (gray text, no link)
- [x] T011 [US1] Create LinkSection component in `packages/web/src/components/LinkSection.tsx` (depends on T010):
  - Import LinksService from `src/api/services/LinksService`
  - Accept props: itemId (number), itemType ('memo' | 'task')
  - Implement fetchLinks() using LinksService.listIssueLinks(String(itemId))
  - Manage state: links array, loading, error, isExpanded
  - Implement collapsible header with chevron icon
  - Render link count in header: "Links (N)"
  - Map links array to LinkItem components
  - Show loading state: "Loading links..."
  - Show empty state: "No links yet"
  - Show error state with retry button
- [x] T012 [US1] Integrate LinkSection into ItemDetail.tsx in `packages/web/src/components/ItemDetail.tsx`:
  - Import LinkSection component
  - Add LinkSection between Labels section (line ~135) and Body section (line ~150)
  - Pass itemId={item.id} and itemType={itemType} props
  - Maintain existing layout and spacing
- [x] T013 [US1] Add loading indicators in LinkSection.tsx:
  - Show spinner or skeleton in section header during initial fetch
  - Disable [+ Add] button while loading
  - Show inline loading text: "Loading links..."
- [x] T014 [US1] Add error handling in LinkSection.tsx:
  - Catch API errors from LinksService.listIssueLinks()
  - Display user-friendly error message: "Failed to load links"
  - Add [Retry] button to re-fetch links
  - Log errors to console for debugging
- [x] T015 [US1] Style components with TailwindCSS:
  - Match existing ItemDetail.tsx section styling (border-b, padding, margins)
  - Use consistent text sizes (text-sm for labels, text-xs for metadata)
  - Apply hover states to interactive elements
  - Ensure mobile responsiveness (responsive flex layouts)
  - Add smooth transitions for collapse/expand animation

**Checkpoint**: User can view all links for a task/memo with proper icons, direction, and target titles

---

## Phase 4: User Story 2 - Create New Links Inline (Priority: P2)

**Goal**: Add links via inline form with type selection and target ID input

**Independent Test**: Click [+ Add], select type, enter ID, verify link is created and appears in list

### Tests for User Story 2 (TDD - write first, fail, then implement)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T016 [P] [US2] Write test for AddLinkInline form in `packages/web/tests/components/AddLinkInline.test.tsx`:
  - Test: Renders type selection buttons initially
  - Test: Shows 4 type options (parent, child, relates, derived_from)
  - Test: Clicking type shows ID input field
  - Test: Shows [Cancel] button at all stages
- [ ] T017 [P] [US2] Write test for link creation flow in AddLinkInline.test.tsx:
  - Test: Entering valid ID and clicking [Add] calls onAdd callback
  - Test: Shows loading state during submission (disabled inputs)
  - Test: Clears form after successful creation
  - Test: Validates numeric input (rejects non-numeric values)
- [ ] T018 [P] [US2] Write test for error scenarios in LinkSection.test.tsx:
  - Test: 404 error shows "Issue not found" message inline
  - Test: Circular hierarchy error shows appropriate message
  - Test: Duplicate link error shows "Link already exists" message
  - Test: Error message disappears on retry
- [ ] T019 [P] [US2] Write test for form cancellation in AddLinkInline.test.tsx:
  - Test: Clicking [Cancel] closes form and resets state
  - Test: Form closes after successful link creation

### Implementation for User Story 2

- [ ] T020 [US2] Create AddLinkInline component in `packages/web/src/components/AddLinkInline.tsx`:
  - Accept props: sourceIssueId, onAdd callback, onCancel callback, creationState, setCreationState
  - Render multi-step form:
    - Step 1: Type selection buttons (parent/child/relates/derived_from)
    - Step 2: Target ID input field with [Add] [Cancel] buttons
  - Implement client-side validation (non-empty, numeric)
  - Show loading state during submission
  - Display error messages inline below input
  - Apply TailwindCSS styling (bg-gray-50, border, rounded, padding)
- [ ] T021 [US2] Add form state management to LinkSection.tsx:
  - Add creationState: LinkCreationState to component state
  - Implement handleAddClick() to show AddLinkInline form
  - Implement handleCancelAdd() to hide form and reset state
  - Pass creationState and setCreationState to AddLinkInline
- [ ] T022 [US2] Implement link creation API call in LinkSection.tsx:
  - Create handleAddLink(targetId: number, linkType: string) function
  - Call LinksService.createLink() with sourceIssueId, targetIssueId, linkType
  - Handle API response: 201 Created = success
  - Set isSubmitting state during API call
  - Parse error responses (400 validation, 404 not found)
- [ ] T023 [US2] Add inline error display in AddLinkInline.tsx:
  - Show error message below input field when creationState.error is set
  - Use red text color (text-red-600) and warning icon (⚠️)
  - Clear error when user changes input or cancels
- [ ] T024 [US2] Add form validation in AddLinkInline.tsx:
  - Validate target ID is non-empty before enabling [Add] button
  - Validate target ID is numeric (HTML input type="number")
  - Prevent submission with invalid input
  - Show disabled state on [Add] button when invalid
- [ ] T025 [US2] Refresh links list after creation in LinkSection.tsx:
  - After successful LinksService.createLink(), call fetchLinks()
  - Update link count in section header
  - Scroll new link into view if needed
  - Close AddLinkInline form and reset creationState

**Checkpoint**: User can create new links inline with proper validation and error handling

---

## Phase 5: User Story 3 - Delete Links with Confirmation (Priority: P3)

**Goal**: Delete links with inline confirmation prompt

**Independent Test**: Click [×], confirm deletion, verify link is removed from list

### Tests for User Story 3 (TDD - write first, fail, then implement)

**NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T026 [P] [US3] Write test for delete button in `packages/web/tests/components/LinkItem.test.tsx`:
  - Test: [×] button renders for each link
  - Test: Clicking [×] shows confirmation prompt
  - Test: Confirmation replaces [×] button with [Confirm] [Cancel]
- [ ] T027 [P] [US3] Write test for delete confirmation in LinkItem.test.tsx:
  - Test: Shows "Delete this link?" message
  - Test: [Confirm] button triggers delete API call
  - Test: Shows loading state during deletion (disabled buttons)
  - Test: [Cancel] button hides confirmation and keeps link
- [ ] T028 [P] [US3] Write test for successful deletion in LinkSection.test.tsx:
  - Test: After successful delete, link is removed from list
  - Test: Link count updates in section header
  - Test: Empty state shows if last link deleted
- [ ] T029 [P] [US3] Write test for deletion errors in LinkItem.test.tsx:
  - Test: 404 error shows "Link not found" inline message
  - Test: Error message appears next to the link being deleted
  - Test: Other links remain unaffected by error

### Implementation for User Story 3

- [x] T030 [US3] Add delete button to LinkItem in `packages/web/src/components/LinkItem.tsx`:
  - Add [×] button next to target issue title
  - Style as subtle gray icon, red on hover
  - Position on the right side of LinkItem
  - Hide when delete confirmation is showing
- [x] T031 [US3] Add delete confirmation state to LinkItem.tsx:
  - Add local state: deleteState (DeleteConfirmationState)
  - Implement handleDeleteClick() to set deleteState.linkId
  - Show confirmation UI when deleteState.linkId matches link.id
  - Render inline prompt: "Delete this link? [Confirm] [Cancel]"
- [x] T032 [US3] Implement delete API call in LinkItem.tsx:
  - Create handleConfirmDelete() function
  - Set deleteState.isConfirming = true
  - Call LinksService.deleteLink(String(link.id))
  - On success: call props.onDelete(link.id) callback
  - On error: show error message inline, reset deleteState
  - On cancel: reset deleteState to idle
- [x] T033 [US3] Add inline confirmation UI to LinkItem.tsx:
  - Replace link display with confirmation prompt when deleteState.linkId is set
  - Show message: "Delete this link?"
  - Render [Confirm] button (red bg, white text)
  - Render [Cancel] button (gray text)
  - Disable buttons during API call (isConfirming = true)
- [x] T034 [US3] Refresh links list after deletion in LinkSection.tsx:
  - Implement handleDeleteLink(linkId: number) callback
  - Remove deleted link from links state array
  - Update link count in section header
  - If last link deleted, show empty state
- [x] T035 [US3] Update link count after deletion in LinkSection.tsx:
  - Decrement count in "Links (N)" header
  - If count reaches 0, keep section visible but collapsed by default
  - Maintain isExpanded state across deletions

**Checkpoint**: User can delete links with confirmation and proper error handling

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, performance, and documentation

- [x] T036 [P] Add edge case handling for deleted issues in LinkItem.tsx:
  - Detect deleted issues from API response (targetIssue.title contains "(deleted)")
  - Show grayed-out text: "Issue #X (deleted)"
  - Disable navigation link (render as plain text, not anchor)
  - Still allow deletion of link
- [x] T037 [P] Add edge case handling for long titles in LinkItem.tsx:
  - Apply CSS: `text-overflow: ellipsis`, `overflow: hidden`, `white-space: nowrap`
  - Add `title` attribute with full text for hover tooltip
  - Truncate at 100 characters max
- [x] T038 [P] Add loading indicators for all operations in LinkSection.tsx:
  - Fetch: Show spinner in header during initial load
  - Create: Disable [+ Add] button during submission
  - Delete: Show loading state in LinkItem during deletion
  - Use consistent loading UI patterns (spinner or "Loading..." text)
- [x] T039 [P] Performance optimization in LinkSection.tsx:
  - Memoize getLinkIcon() and getLinkLabel() utility functions
  - Use React.memo() for LinkItem component to prevent unnecessary re-renders
  - Optimize re-fetching: only fetch when itemId changes
- [ ] T040 Run manual testing from quickstart.md:
  - Test on test environment (http://localhost:3001)
  - Verify all acceptance scenarios from spec.md
  - Test edge cases (deleted issues, long titles, concurrent deletions)
  - Verify mobile responsiveness
- [ ] T041 Update CHANGELOG.md:
  - Add entry for Link Management Web Interface feature
  - List user stories completed (US1, US2, US3)
  - Note breaking changes (none expected)
  - Document any API version requirements

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies - can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 completion - BLOCKS all user stories
- **Phase 3 (US1 - View Links)**: Depends on Phase 2 completion - MVP story
- **Phase 4 (US2 - Create Links)**: Depends on Phase 2 completion, builds on US1 UI
- **Phase 5 (US3 - Delete Links)**: Depends on Phase 2 completion, extends US1 components
- **Phase 6 (Polish)**: Depends on completion of desired user stories

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 - No dependencies on other stories - **MVP PRIORITY**
- **User Story 2 (P2)**: Can start after Phase 2 - Integrates with US1 (adds to LinkSection) but independently testable
- **User Story 3 (P3)**: Can start after Phase 2 - Extends US1 (adds to LinkItem) but independently testable

**Note**: While US2 and US3 extend US1 components, they add distinct functionality that can be tested independently. US1 provides the view-only MVP, US2 adds creation, US3 adds deletion.

### Within Each User Story

- **Tests MUST be written first** (TDD approach per plan.md)
- Tests MUST FAIL before implementation begins
- Models/types before components
- Child components (LinkItem, AddLinkInline) before parent (LinkSection)
- Core implementation before integration into ItemDetail
- Story complete and tested before moving to next priority

### Parallel Opportunities

**Phase 1 (Setup)**:
- All 3 tasks (T001, T002, T003) can run in parallel

**Phase 2 (Foundational)**:
- T004 (types) and T005 (icons) can run in parallel

**Phase 3 (US1 - View Links)**:
- Tests (T006, T007, T008, T009) can ALL run in parallel - different test files
- Implementation: T010 (LinkItem) can run in parallel with other setup tasks
- After T010 completes, T011 (LinkSection) depends on it
- T013 (loading), T014 (errors), T015 (styling) can run in parallel after T011

**Phase 4 (US2 - Create Links)**:
- Tests (T016, T017, T018, T019) can ALL run in parallel
- Implementation: T020 (AddLinkInline), T021 (form state), T022 (API call) are sequential
- T023 (error display) and T024 (validation) can run in parallel after T020

**Phase 5 (US3 - Delete Links)**:
- Tests (T026, T027, T028, T029) can ALL run in parallel
- Implementation: T030 (delete button) → T031 (confirmation state) → T032 (API call) are sequential
- T033 (UI), T034 (refresh), T035 (count) can run in parallel after T032

**Phase 6 (Polish)**:
- All tasks (T036, T037, T038, T039) can run in parallel
- T040 (manual testing) should run after implementation tasks
- T041 (changelog) can run anytime

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together (TDD - fail first):
Task T006: "Write component test for LinkSection in packages/web/tests/components/LinkSection.test.tsx"
Task T007: "Write component test for LinkItem in packages/web/tests/components/LinkItem.test.tsx"
Task T008: "Write test for collapsible behavior in LinkSection.test.tsx"
Task T009: "Write test for long title truncation in LinkItem.test.tsx"

# Then implement in order:
Task T010: "Create LinkItem component in packages/web/src/components/LinkItem.tsx"
Task T011: "Create LinkSection component in packages/web/src/components/LinkSection.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T005) - CRITICAL - blocks all stories
3. Complete Phase 3: User Story 1 (T006-T015) - View existing links
4. **STOP and VALIDATE**: Test US1 independently
   - Navigate to task/memo detail pages with existing links
   - Verify links display correctly with icons, direction, titles
   - Verify collapsible section works
   - Verify empty state and error handling
5. Deploy/demo if ready (MVP complete!)

### Incremental Delivery

1. **Foundation** (Phase 1 + 2): API client verified, types and icons created
2. **MVP** (Phase 3): View existing links → Test independently → Deploy/Demo
3. **Enhancement 1** (Phase 4): Create new links → Test independently → Deploy/Demo
4. **Enhancement 2** (Phase 5): Delete links → Test independently → Deploy/Demo
5. **Polish** (Phase 6): Edge cases, performance, documentation
6. Each phase adds value without breaking previous functionality

### Parallel Team Strategy

With multiple developers:

1. Team completes Phase 1 + 2 together (foundation)
2. Once Phase 2 is done:
   - **Developer A**: Phase 3 (US1 - View Links) - MVP PRIORITY
   - **Developer B**: Phase 4 (US2 - Create Links) - Can start in parallel
   - **Developer C**: Phase 5 (US3 - Delete Links) - Can start in parallel
3. Each developer writes tests first (TDD), then implements their story
4. Stories integrate independently into LinkSection/LinkItem components
5. Manual integration testing after all stories complete

**Note**: While parallel development is possible, sequential implementation (US1 → US2 → US3) ensures each story is fully validated before moving forward. This is recommended for solo developers or small teams.

---

## Notes

- **[P] tasks**: Different files, no dependencies, can run in parallel
- **[Story] labels**: Map tasks to user stories (US1/US2/US3) for traceability
- **TDD approach**: All tests MUST be written first and FAIL before implementation
- **Component hierarchy**: LinkItem and AddLinkInline are child components of LinkSection
- **Integration point**: LinkSection is added to ItemDetail.tsx between Labels and Body
- **Test environment**: Always use test API server (port 3001) and test database
- **Exact file paths**: All tasks include complete absolute paths starting from packages/web/
- **Commit strategy**: Commit after each task or logical group (e.g., all tests for a story)
- **Checkpoints**: Stop at any checkpoint to validate story independently
- **Avoid**: Vague tasks, same file conflicts, cross-story dependencies that break independence
