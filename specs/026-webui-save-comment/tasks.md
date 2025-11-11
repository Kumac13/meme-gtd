# Tasks: Keyboard Shortcuts for Save and Comment Actions

**Input**: Design documents from `/specs/026-webui-save-comment/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: No explicit test tasks included as tests were not explicitly requested in the feature specification. Tests will be added as part of component modification tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app monorepo**: `packages/web/src/`, `packages/web/tests/`
- All changes are isolated to the `packages/web` package

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create reusable utilities that all user stories will depend on

- [x] T001 [P] Create keyboard utility functions in `packages/web/src/utils/keyboard.ts`
  - Implement `isMacOS()`: Detect if user is on macOS
  - Implement `getShortcutHint()`: Return '⌘+Enter' or 'Ctrl+Enter' based on OS
  - Implement `isSubmitShortcut()`: Check if event is Cmd/Ctrl+Enter

- [x] T002 [P] Create unit tests for keyboard utilities in `packages/web/tests/utils/keyboard.test.ts`
  - Test OS detection (macOS vs Windows)
  - Test shortcut hint generation
  - Test keyboard event detection (Cmd+Enter, Ctrl+Enter, plain Enter)
  - Mock `navigator.platform` for testing

- [x] T003 Create custom React hook in `packages/web/src/hooks/useKeyboardShortcut.ts`
  - Implement `useKeyboardShortcut(callback, options)` hook
  - Use `isSubmitShortcut()` from keyboard utils
  - Support `disabled` option to prevent shortcuts during submission
  - Call `preventDefault()` to avoid newline insertion

- [x] T004 Create unit tests for useKeyboardShortcut hook in `packages/web/tests/hooks/useKeyboardShortcut.test.ts`
  - Test callback invocation on Cmd/Ctrl+Enter
  - Test preventDefault() is called
  - Test disabled option prevents callback
  - Use React Testing Library's `renderHook()`

**Checkpoint**: Core utilities ready - all components can now use keyboard shortcuts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No foundational tasks required - this is a UI-only feature with no database, API, or authentication dependencies

**Status**: ✅ SKIPPED - No blocking prerequisites needed

---

## Phase 3: User Story 1 - Quick Save with Keyboard Shortcut (Priority: P1) 🎯 MVP

**Goal**: Enable Cmd/Ctrl+Enter to save tasks, memos, and projects without clicking Save button

**Independent Test**: Open any form (task, memo, project), type content, press Cmd/Ctrl+Enter, verify item is saved

### Implementation for User Story 1

- [x] T005 [P] [US1] Add keyboard shortcut to TaskForm in `packages/web/src/components/TaskForm.tsx`
  - Import `useKeyboardShortcut` and `getShortcutHint`
  - Add `handleKeyDown` handler using the hook with `isSubmitting` disabled state
  - Add `onKeyDown={handleKeyDown}` to textarea element (around line 128)
  - Add `aria-keyshortcuts="Control+Enter"` to textarea for accessibility
  - Update Save button `title` attribute with `getShortcutHint()` (around line 183)
  - Add test case: saves task with Cmd/Ctrl+Enter
  - Add test case: does not save with plain Enter
  - Add test case: respects validation (empty title fails)

- [x] T006 [P] [US1] Add keyboard shortcut to MemoForm in `packages/web/src/components/MemoForm.tsx`
  - Import `useKeyboardShortcut` and `getShortcutHint`
  - Add `handleKeyDown` handler using the hook with `isSubmitting` disabled state
  - Add `onKeyDown={handleKeyDown}` to textarea element (around line 77)
  - Add `aria-keyshortcuts="Control+Enter"` to textarea for accessibility
  - Update Save button `title` attribute with `getShortcutHint()` (around line 104)
  - Add test case: saves memo with Cmd/Ctrl+Enter
  - Add test case: respects validation (empty body fails)

- [x] T007 [P] [US1] Add keyboard shortcut to EditableContent in `packages/web/src/components/EditableContent.tsx`
  - Import `useKeyboardShortcut` and `getShortcutHint`
  - Add `handleKeyDown` handler using the hook calling `handleSaveEdit()`
  - Add `onKeyDown={handleKeyDown}` to textarea element (around line 121)
  - Add `aria-keyshortcuts="Control+Enter"` to textarea for accessibility
  - Update Save button `title` attribute with `getShortcutHint()` (around line 134)
  - Add test case: saves edit with Cmd/Ctrl+Enter
  - Add test case: respects existing validation

- [x] T008 [P] [US1] Add keyboard shortcut to ProjectForm in `packages/web/src/components/ProjectForm.tsx`
  - Import `useKeyboardShortcut` and `getShortcutHint`
  - Add `handleKeyDown` handler using the hook
  - Add `onKeyDown` and `aria-keyshortcuts` to input field
  - Update Save button `title` attribute with `getShortcutHint()`
  - Add test case for project save with keyboard shortcut

**Checkpoint**: User Story 1 complete - users can now save all form types with Cmd/Ctrl+Enter

---

## Phase 4: User Story 2 - Quick Comment Submission (Priority: P2)

**Goal**: Enable Cmd/Ctrl+Enter to submit comments without clicking Comment button

**Independent Test**: Navigate to any item with comments, type a comment, press Cmd/Ctrl+Enter, verify comment is submitted and appears in list

### Implementation for User Story 2

- [x] T009 [US2] Add keyboard shortcut to CommentSection in `packages/web/src/components/CommentSection.tsx`
  - Import `useKeyboardShortcut` and `getShortcutHint`
  - Add `handleKeyDown` handler using the hook calling `handleSubmitNewComment()`
  - Add disabled state check for submission in progress
  - Add `onKeyDown={handleKeyDown}` to comment textarea (around line 109)
  - Add `aria-keyshortcuts="Control+Enter"` to textarea for accessibility
  - Update Comment button `title` attribute with `getShortcutHint()` (around line 117)
  - Add test case: submits comment with Cmd/Ctrl+Enter
  - Add test case: clears input field after submission
  - Add test case: respects validation (empty comment fails)
  - Add test case: prevents duplicate submissions

**Checkpoint**: User Story 2 complete - users can now submit comments with Cmd/Ctrl+Enter

---

## Phase 5: User Story 3 - Visual Feedback for Keyboard Actions (Priority: P3)

**Goal**: Display tooltips on Save and Comment buttons showing the keyboard shortcut

**Independent Test**: Hover over any Save or Comment button, verify tooltip shows correct shortcut (⌘+Enter on macOS, Ctrl+Enter on Windows)

### Implementation for User Story 3

**Note**: This story is already implemented as part of User Stories 1 and 2 (button `title` attributes were added)

- [ ] T010 [US3] Verify tooltip display across all components
  - Manually test TaskForm Save button tooltip shows correct shortcut
  - Manually test MemoForm Save button tooltip shows correct shortcut
  - Manually test CommentSection Comment button tooltip shows correct shortcut
  - Manually test EditableContent Save button tooltip shows correct shortcut
  - Test on both macOS and Windows (or simulate with browser DevTools)
  - Verify tooltip is readable with high contrast/accessibility modes

**Checkpoint**: User Story 3 complete - all buttons now show keyboard shortcut hints

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, edge case testing, and documentation

- [ ] T011 [P] Manual testing: Edge case validation
  - Test keyboard shortcut when focus is not on input field (should not trigger)
  - Test with multiple forms visible (verify correct form submits)
  - Test rapid key presses (verify no duplicate submissions)
  - Test in read-only fields (verify shortcut does not trigger)
  - Test with validation errors (verify same error feedback as button click)

- [ ] T012 [P] Browser compatibility testing
  - Test in Chrome (macOS and Windows)
  - Test in Firefox
  - Test in Safari (macOS)
  - Test in Edge (Windows)
  - Verify keyboard shortcut works consistently across all browsers

- [ ] T013 [P] Accessibility testing
  - Verify screen reader announces `aria-keyshortcuts` attribute
  - Test keyboard-only navigation (Tab, Shift+Tab, Enter, Escape)
  - Verify visual focus indicators are visible
  - Test tooltips are readable with high contrast mode

- [ ] T014 Run full test suite
  - Execute `pnpm test` in `packages/web`
  - Verify all new tests pass
  - Verify no regressions in existing tests
  - Fix any failing tests

- [ ] T015 [P] Update documentation
  - Add keyboard shortcut documentation to project README if applicable
  - Update CHANGELOG.md with new feature entry
  - Follow versioning guidelines from `docs/versioning.md` (likely PATCH version)

**Checkpoint**: All user stories complete and validated - feature ready for PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: SKIPPED - No blocking prerequisites needed
- **User Stories (Phase 3-5)**: All depend on Setup (Phase 1) completion
  - User Story 1 (P1): Can start after Phase 1
  - User Story 2 (P2): Can start after Phase 1 (independent of US1)
  - User Story 3 (P3): Already completed as part of US1 and US2
- **Polish (Phase 6)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends only on Phase 1 (Setup) - No dependencies on other stories
- **User Story 2 (P2)**: Depends only on Phase 1 (Setup) - Independent of US1
- **User Story 3 (P3)**: Integrated into US1 and US2 - No separate implementation needed

### Within Each User Story

- **User Story 1**: All component tasks (T005-T008) can run in parallel [P]
- **User Story 2**: Single task (T009) - no parallelization needed
- **User Story 3**: Single validation task (T010) - depends on US1 and US2

### Parallel Opportunities

- **Phase 1**: All tasks (T001-T004) can run in parallel
  - T001 (keyboard.ts) and T003 (useKeyboardShortcut.ts) can be developed simultaneously
  - T002 and T004 (tests) can be written in parallel with implementation or after
- **Phase 3 (US1)**: All component modifications (T005-T008) can run in parallel
- **Phase 6**: All polish tasks (T011-T015) can run in parallel

---

## Parallel Example: User Story 1 (4 parallel tasks)

```bash
# Launch all component modifications for User Story 1 together:
Task: "Add keyboard shortcut to TaskForm in packages/web/src/components/TaskForm.tsx"
Task: "Add keyboard shortcut to MemoForm in packages/web/src/components/MemoForm.tsx"
Task: "Add keyboard shortcut to EditableContent in packages/web/src/components/EditableContent.tsx"
Task: "(Optional) Add keyboard shortcut to ProjectForm in packages/web/src/components/ProjectForm.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004) - ~1-2 hours
2. Complete Phase 3: User Story 1 (T005-T008) - ~2-3 hours
3. **STOP and VALIDATE**: Test keyboard shortcuts in TaskForm, MemoForm, EditableContent
4. Run tests: `pnpm test`
5. Deploy/demo if ready - **Users can now save with Cmd/Ctrl+Enter!**

**Estimated MVP Time**: 3-5 hours

### Incremental Delivery

1. **Foundation**: Complete Phase 1 → Utilities ready (~1-2 hours)
2. **MVP**: Add User Story 1 → Test independently → Deploy/Demo (~2-3 hours)
3. **Enhancement**: Add User Story 2 → Test independently → Deploy/Demo (~1-2 hours)
4. **Polish**: User Story 3 already done, run Phase 6 validation (~2-3 hours)
5. Each story adds value without breaking previous functionality

**Total Estimated Time**: 6-10 hours

### Parallel Team Strategy

With multiple developers:

1. **Team completes Phase 1 together** (~1-2 hours)
2. Once Phase 1 is done:
   - **Developer A**: TaskForm + MemoForm (T005, T006)
   - **Developer B**: EditableContent + ProjectForm (T007, T008)
   - **Developer C**: CommentSection (T009)
3. Stories complete and integrate independently
4. **Team completes Phase 6 together** (~2-3 hours)

**Parallel Estimated Time**: 4-6 hours (with 2-3 developers)

---

## Notes

- **[P] tasks**: Different files, no dependencies - can run in parallel
- **[Story] label**: Maps task to specific user story for traceability
- **No explicit test phase**: Tests are integrated into component modification tasks
- **Independent stories**: Each user story can be completed and tested independently
- **Commit strategy**: Commit after each task or logical group (e.g., after each component)
- **Stop at any checkpoint**: Validate story independently before proceeding
- **UI-only feature**: No backend/API changes required
- **Zero breaking changes**: Additive feature only, all existing functionality preserved

---

## Task Summary

**Total Tasks**: 15 tasks across 6 phases

**Tasks per User Story**:
- User Story 1 (P1): 4 tasks (T005-T008) - Core Save functionality
- User Story 2 (P2): 1 task (T009) - Comment submission
- User Story 3 (P3): 1 task (T010) - Tooltip validation (already implemented)

**Parallel Opportunities**:
- Phase 1: 4 tasks can run in parallel
- Phase 3 (US1): 4 tasks can run in parallel
- Phase 6: 5 tasks can run in parallel

**MVP Scope**: Phase 1 + Phase 3 (User Story 1 only) = 8 tasks, 3-5 hours

**Independent Test Criteria**:
- **US1**: Open any form, type content, press Cmd/Ctrl+Enter → item saves
- **US2**: Navigate to comments, type comment, press Cmd/Ctrl+Enter → comment submits
- **US3**: Hover over Save/Comment button → tooltip shows keyboard shortcut
