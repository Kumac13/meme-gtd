# Tasks: Markdown Code Block Copy Button

**Input**: Design documents from `/specs/001-task-110-markdown/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: Included per constitution (Test-First principle in plan.md)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Monorepo structure**: `packages/web/src/`, `packages/web/tests/`
- All changes confined to `packages/web/` package

---

## Phase 1: Setup (No Changes Needed)

**Purpose**: This feature modifies existing code, no new project setup required.

**Status**: ✅ Skip - existing project structure is already in place

---

## Phase 2: Foundational (Helper Functions)

**Purpose**: Core utilities that both user stories depend on

- [x] T001 [US1] Add `extractTextFromChildren` helper function to `packages/web/src/utils/markdown.tsx`
  - Recursively extracts plain text from React children
  - Used by copy functionality to get code content

- [x] T002 [P] [US1] Add SVG icon components (ClipboardIcon, CheckIcon) to `packages/web/src/utils/markdown.tsx`
  - Inline SVG for clipboard icon (copy state)
  - Inline SVG for checkmark icon (copied state)

**Checkpoint**: Helper functions ready for CodeBlockWithCopy component

---

## Phase 3: User Story 1 - Copy Code Block with One Click (Priority: P1) 🎯 MVP

**Goal**: Users can copy fenced code block content with a single click

**Independent Test**: Create a task with a code block, click the copy button, verify code is copied to clipboard with visual feedback

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [x] T003 [US1] Write unit test: copy button renders for fenced code blocks in `packages/web/tests/unit/markdown-copy.test.tsx`
  - Test that `<MarkdownRenderer content="```js\ncode\n```" />` renders a button

- [x] T004 [P] [US1] Write unit test: copy button copies correct content in `packages/web/tests/unit/markdown-copy.test.tsx`
  - Mock navigator.clipboard.writeText
  - Verify correct text is passed when button clicked

- [x] T005 [P] [US1] Write unit test: no copy button for inline code in `packages/web/tests/unit/markdown-copy.test.tsx`
  - Test that `<MarkdownRenderer content="This is \`inline\` code" />` has no button

### Implementation for User Story 1

- [x] T006 [US1] Create `CodeBlockWithCopy` component in `packages/web/src/utils/markdown.tsx`
  - Wraps `<pre>` with relative container
  - Includes always-visible copy button in top-right corner
  - Uses `useState` for copied state
  - Calls `navigator.clipboard.writeText` on click
  - Shows CheckIcon when copied, resets after 1.5 seconds

- [x] T007 [US1] Add `pre` component override to `defaultComponents` in `packages/web/src/utils/markdown.tsx`
  - `pre: ({ children }) => <CodeBlockWithCopy>{children}</CodeBlockWithCopy>`
  - This applies the copy button to all fenced code blocks automatically

- [x] T008 [US1] Run unit tests and verify they pass
  - Command: `pnpm --filter meme-gtd-web test`

- [x] T009 [US1] Manual verification: start dev server and test copy functionality
  - Command: `pnpm dev:web`
  - Create/view a task with code block
  - Verify copy button visible, click copies content, feedback shown

**Checkpoint**: User Story 1 complete - basic copy functionality works

---

## Phase 4: User Story 2 - Visual Distinction of Copy Button (Priority: P2)

**Goal**: Users can clearly identify the copy button and understand its purpose

**Independent Test**: View code blocks and confirm button is recognizable, positioned correctly, and has proper hover/tooltip behavior

### Tests for User Story 2

- [x] T010 [US2] Write unit test: copy button has correct positioning and accessibility in `packages/web/tests/unit/markdown-copy.test.tsx`
  - Verify button has title attribute for tooltip
  - Verify button has expected CSS classes

### Implementation for User Story 2

- [x] T011 [US2] Enhance copy button styling in `packages/web/src/utils/markdown.tsx`
  - Position: `absolute top-2 right-2`
  - Background: semi-transparent `bg-gray-700 hover:bg-gray-600`
  - Text color: `text-gray-300 hover:text-white`
  - Tooltip: `title` attribute with "Copy code" / "Copied!"
  - Transition: smooth color change on hover

- [x] T012 [US2] Adjust `<pre>` padding to avoid overlap with copy button
  - Add extra top padding (`pt-10`) to code content area
  - Ensure long code blocks don't hide the button

- [x] T013 [US2] Run tests and verify styling works correctly
  - Command: `pnpm --filter meme-gtd-web test`

**Checkpoint**: User Story 2 complete - button is visually distinct and accessible

---

## Phase 5: Edge Cases & Polish

**Purpose**: Handle edge cases identified in spec.md

- [x] T014 [P] [US1] Handle empty code blocks gracefully
  - Verify copy button works (copies empty string)
  - No errors thrown

- [x] T015 [P] [US1] Handle Clipboard API unavailability
  - Add try/catch around navigator.clipboard call
  - Log error to console on failure
  - Optionally hide button if API not available (check `navigator.clipboard` existence)

- [x] T016 [P] Verify multiple code blocks work independently
  - Each code block gets its own button and state
  - Clicking one doesn't affect others

- [x] T017 Verify copy works in all contexts
  - Task body (MarkdownRenderer in ItemDetail)
  - Memo body (MarkdownRenderer in ItemDetail)
  - Comments (MarkdownRenderer in CommentSection)

**Checkpoint**: All edge cases handled, feature complete

---

## Phase 6: Final Validation

- [x] T018 Run full test suite
  - Command: `pnpm test`

- [x] T019 Run quickstart.md verification checklist
  - [x] Copy button visible on all fenced code blocks
  - [x] Button positioned in top-right corner
  - [x] Clicking copies exact code content (no fence markers)
  - [x] Visual feedback shown after copy (checkmark icon)
  - [x] Feedback resets after ~1.5 seconds
  - [x] No button on inline code
  - [x] Works in task body, memo body, and comments

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Skip - not needed
- **Phase 2 (Foundational)**: No dependencies - start here
- **Phase 3 (US1)**: Depends on Phase 2 - core functionality
- **Phase 4 (US2)**: Depends on Phase 3 - enhances styling
- **Phase 5 (Edge Cases)**: Depends on Phase 3 - handles special cases
- **Phase 6 (Validation)**: Depends on all phases

### User Story Dependencies

- **User Story 1 (P1)**: Independent - can be delivered as MVP
- **User Story 2 (P2)**: Builds on US1 styling but is independently testable

### Parallel Opportunities

- T002 (icons) can run parallel with T001 (helper function)
- T003, T004, T005 (tests) can run in parallel
- T014, T015, T016 (edge cases) can run in parallel

---

## Parallel Example: User Story 1 Tests

```bash
# Launch all tests for User Story 1 together:
Task: "Write unit test: copy button renders for fenced code blocks"
Task: "Write unit test: copy button copies correct content"
Task: "Write unit test: no copy button for inline code"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T002)
2. Complete Phase 3: User Story 1 (T003-T009)
3. **STOP and VALIDATE**: Copy button works, copies content, shows feedback
4. Can deploy MVP at this point

### Incremental Delivery

1. Foundational → Helper functions ready
2. User Story 1 → Basic copy works → **MVP!**
3. User Story 2 → Better styling/UX
4. Edge Cases → Robust handling
5. Final Validation → Production ready

---

## Notes

- All tasks modify only `packages/web/src/utils/markdown.tsx` (except tests)
- No new dependencies required
- Reuses existing patterns from `useCopyToClipboard` hook
- TDD approach: write tests first, verify they fail, then implement
- Commit after each task or logical group
