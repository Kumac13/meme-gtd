# Tasks: Markdown Copy Button for Web UI

**Input**: Design documents from `/specs/029-task/`
**Prerequisites**: plan.md (✅), spec.md (✅), research.md (✅), data-model.md (✅), contracts/ (✅), quickstart.md (✅)

**Tests**: Unit tests and E2E tests are included based on the testing requirements in the specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: `packages/web/src/`, `packages/web/tests/`
- Paths use monorepo structure per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and shared utilities

This feature uses existing infrastructure (React, TypeScript, Vite). No new project setup required.

- [x] T001 [P] Review existing EditableContent component structure in `packages/web/src/components/EditableContent.tsx`
- [x] T002 [P] Review existing CommentSection component structure in `packages/web/src/components/CommentSection.tsx`
- [x] T003 [P] Review existing ItemDetail component structure in `packages/web/src/components/ItemDetail.tsx`

**Checkpoint**: Existing component structures understood

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared components and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Shared Hooks & Utilities

- [x] T004 [US-Foundation] Create `useCopyToClipboard` custom hook in `packages/web/src/hooks/useCopyToClipboard.ts`
  - Implement `copy(text: string): Promise<boolean>` function using `navigator.clipboard.writeText()`
  - Implement `copied: boolean` state (true for 1 second, then auto-reset)
  - Implement `reset()` function for manual state reset
  - Add error handling (log to console.error, return false)
  - Export `UseCopyToClipboardReturn` interface

### Unit Tests for Foundation

- [x] T005 [P] [US-Foundation] Write unit tests for `useCopyToClipboard` hook in `packages/web/tests/unit/useCopyToClipboard.test.ts`
  - Mock `navigator.clipboard.writeText`
  - Test successful copy operation
  - Test `copied` state changes to true, then false after 1000ms (use `vi.useFakeTimers()`)
  - Test error handling when Clipboard API fails
  - Use `@testing-library/react` `renderHook` and `act`

**Checkpoint**: Foundation ready - `useCopyToClipboard` hook fully tested and working

---

## Phase 3: User Story 1 - Copy Task/Memo Body as Markdown (Priority: P1) 🎯 MVP

**Goal**: ユーザーがタスク/メモ詳細画面の本文をMarkdown形式で三点リーダーメニューからコピーできる

**Independent Test**: タスク詳細ページ（例: `/tasks/39`）を開き、本文エリアの三点リーダーメニューから「Copy」を選択。クリップボードに本文のMarkdown rawテキストがコピーされ、テキストエディタに貼り付けて元のMarkdown形式が保持されていることを確認。

### Implementation for User Story 1

- [x] T006 [US1] Modify `EditableContent` component in `packages/web/src/components/EditableContent.tsx`
  - Import `useCopyToClipboard` hook
  - Add `copied` state and `copy` function from hook
  - Add `handleCopy` async function that calls `copy(content)`
  - Add "Copy" button in dropdown menu between "Edit" and "Delete"
  - Display `{copied ? 'Copied!' : 'Copy'}` as button text
  - Apply same styling as Edit button (gray text, hover bg)

- [x] T007 [US1] Verify integration in `TaskDetail` page (`packages/web/src/pages/TaskDetail.tsx`)
  - No code changes required (EditableContent already used)
  - Verify `bodyMd` prop is passed to EditableContent

- [x] T008 [US1] Verify integration in `MemoDetail` page (`packages/web/src/pages/MemoDetail.tsx`)
  - No code changes required (EditableContent already used)
  - Verify `bodyMd` prop is passed to EditableContent

### E2E Tests for User Story 1

- [ ] T009 [US1] Write E2E test for body copy in tasks in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to `/tasks/1` (test task)
  - Grant clipboard permissions: `context.grantPermissions(['clipboard-read', 'clipboard-write'])`
  - Open three-dot menu
  - Click "Copy" menu item
  - Read clipboard: `await page.evaluate(() => navigator.clipboard.readText())`
  - Assert clipboard contains task body markdown (e.g., contains "## Start State")
  - Verify menu text changes to "Copied!"
  - Wait 1100ms and verify text reverts to "Copy"

- [ ] T010 [P] [US1] Write E2E test for body copy in memos in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to `/memos/1` (test memo)
  - Perform same menu copy test as T009
  - Assert clipboard contains memo body markdown

- [ ] T011 [P] [US1] Write E2E test for empty body edge case in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Create/navigate to task with empty `bodyMd`
  - Open menu and click "Copy"
  - Assert clipboard contains empty string `""`
  - Assert no errors occur

**Checkpoint**: User Story 1 complete - 本文コピー機能（メニュー経由）が完全に動作し、テスト済み

---

## Phase 4: User Story 2 - Copy Individual Comment as Markdown (Priority: P2)

**Goal**: ユーザーが個々のコメントをMarkdown形式で三点リーダーメニューからコピーできる

**Independent Test**: コメントがあるタスク詳細ページ（例: `/tasks/39`）を開き、コメントセクションの各コメントの三点リーダーメニューから「Copy」を選択。特定のコメントのMarkdownテキストだけがクリップボードにコピーされることを確認。

### Implementation for User Story 2

- [x] T012 [US2] Verify `CommentSection` uses `EditableContent` for each comment in `packages/web/src/components/CommentSection.tsx`
  - No code changes required (already uses EditableContent)
  - Verify each comment's `bodyMd` is passed to EditableContent
  - Copy menu item is automatically added by T006 changes to EditableContent

### E2E Tests for User Story 2

- [ ] T013 [US2] Write E2E test for individual comment copy in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to task/memo with multiple comments (e.g., `/tasks/39`)
  - Locate first comment's three-dot menu (use nth selector or data-testid)
  - Open menu and click "Copy"
  - Assert clipboard contains only first comment's markdown text
  - Open second comment's menu and click "Copy"
  - Assert clipboard now contains only second comment's markdown text

- [ ] T014 [P] [US2] Write E2E test for comment copy with multiple comments in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to task with 3+ comments
  - Click different comment "Copy" menu items sequentially
  - Assert each click copies only the corresponding comment's markdown

**Checkpoint**: User Story 2 complete - コメント個別コピー機能（メニュー経由）が完全に動作し、テスト済み

---

## Phase 5: User Story 3 - Copy All Content as Markdown (Priority: P3)

**Goal**: ユーザーがタイトル・本文・全コメントを構造化されたMarkdown形式で一度にコピーできる

**Independent Test**: タスク詳細ページのヘッダーにある「すべてコピー」ボタンをクリック。クリップボードに構造化されたMarkdown（H1タイトル + 本文 + H2 Comments + 各コメント）がコピーされることを確認。

### Implementation for User Story 3

- [x] T015 [US3] Create `markdownFormatter` utility in `packages/web/src/utils/markdownFormatter.ts`
  - Export `formatAllContent` function
  - Accept params: `title: string | null`, `bodyMd: string`, `comments: Array<{bodyMd: string, createdAt: string}>`, `itemId?: number`
  - Generate H1 title (`# ${title}` or `# Memo #${itemId}` if title is null)
  - Append body markdown
  - If comments exist, add `## Comments` section
  - For each comment, add `### Comment ${index + 1} (${createdAt})` + comment body
  - Return formatted markdown string (trimmed)

- [x] T016 [P] [US3] Write unit tests for `markdownFormatter` in `packages/web/tests/unit/markdownFormatter.test.ts`
  - Test task with title, body, and comments → correct H1/H2/H3 structure
  - Test memo (title = null) with itemId → default title `# Memo #${id}`
  - Test empty comments array → no "## Comments" section
  - Test special characters in content → preserved as-is (no escaping)

- [x] T017 [US3] Modify `ItemDetail` component in `packages/web/src/components/ItemDetail.tsx`
  - Import `CopyButton` and `formatAllContent`
  - Import `CommentsService` from `../api/services/CommentsService`
  - Add `useState<Comment[]>` for comments
  - Add `useEffect` to fetch comments (`CommentsService.listTaskComments` or `listMemoComments`)
  - Generate `allContentMarkdown` using `formatAllContent({ title: item.title, bodyMd: item.bodyMd, comments, itemId: item.id })`
  - In header actions div (next to bookmark button), add `<CopyButton text={allContentMarkdown} ariaLabel="Copy all content" className="border border-gray-300 bg-white" />`

### E2E Tests for User Story 3

- [ ] T018 [US3] Write E2E test for "copy all" with comments in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to task with title, body, and comments (e.g., `/tasks/39`)
  - Click `[aria-label="Copy all content"]` button in header
  - Read clipboard content
  - Assert starts with `# ${title}`
  - Assert contains body markdown
  - Assert contains `## Comments`
  - Assert contains `### Comment 1 (${ISO8601 date})`
  - Assert contains comment body texts

- [ ] T019 [P] [US3] Write E2E test for "copy all" without comments in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to task/memo with no comments
  - Click "Copy all content" button
  - Assert clipboard contains title + body only
  - Assert does NOT contain `## Comments`

- [ ] T020 [P] [US3] Write E2E test for "copy all" with memo (no title) in `packages/web/tests/e2e/copy-functionality.spec.ts`
  - Navigate to memo (e.g., `/memos/123`)
  - Click "Copy all content" button
  - Assert clipboard starts with `# Memo #123`
  - Assert contains memo body

**Checkpoint**: User Story 3 complete - すべてコピー機能が完全に動作し、テスト済み

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T021 [P] Run all unit tests (`pnpm --filter meme-gtd-web test`)
  - Verify all tests pass
  - Check test coverage for new files (hook, formatter)

- [ ] T022 [P] Run all E2E tests (`pnpm --filter meme-gtd-web test:e2e`)
  - Verify tests pass on Chrome, Firefox, Safari
  - Check mobile browsers (iOS Safari, Android Chrome) if available

- [ ] T023 [P] Manual testing checklist from `quickstart.md`
  - Test on http://localhost:3001 (dev server)
  - Verify三点リーダーメニューに「Copy」が表示
  - Verify 1秒間「Copied!」テキスト表示
  - Verify モバイルでメニュータップ動作
  - Verify HTTPS以外でconsole.logエラー出力（エラーハンドリング）

- [ ] T024 [P] Accessibility review
  - Verify menu items have proper keyboard navigation
  - Test keyboard navigation (Tab key to menu, Enter to activate)
  - Test with screen reader (VoiceOver/NVDA) if available

- [ ] T025 Code cleanup and linting
  - Run `pnpm --filter meme-gtd-web lint`
  - Fix any linting errors
  - Remove unused imports
  - Add JSDoc comments to public functions (optional)

- [ ] T026 Performance validation
  - Measure copy operation time in DevTools Performance tab (target: <200ms)
  - Test with large markdown content (e.g., 10KB body + 50 comments)
  - Verify no memory leaks (check DevTools Memory tab after 50+ copy operations)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Reuses CopyButton from US1 foundation, independent implementation
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Uses CopyButton from foundation, adds formatting utility, independent implementation

### Within Each User Story

- Implementation before E2E tests (tests verify working feature)
- Core component changes before integration verification
- All tasks for a story must complete before moving to next priority

### Parallel Opportunities

- **Phase 1 (Setup)**: All 3 tasks [P] can run in parallel
- **Phase 2 (Foundation)**: Single task T004, then T005 test
- **Phase 3 (US1)**: T010, T011 [P] can run in parallel (different E2E test scenarios)
- **Phase 4 (US2)**: T013, T014 [P] can run in parallel (different E2E test scenarios)
- **Phase 5 (US3)**: T016, T019, T020 [P] can run in parallel (unit test + E2E tests in different files)
- **Phase 6 (Polish)**: T021, T022, T023, T024 [P] can run in parallel (different validation tasks)
- **Cross-Story Parallelism**: After Phase 2, US1, US2, US3 can be developed in parallel by different team members

---

## Parallel Example: User Story 1 (Phase 3)

```bash
# Launch E2E tests for US1 in parallel:
Task: "Write E2E test for body copy in memos"  # T010
Task: "Write E2E test for empty body edge case"  # T011
```

## Parallel Example: User Story 3 (Phase 5)

```bash
# Launch tests for US3 in parallel:
Task: "Write unit tests for markdownFormatter"  # T016
Task: "Write E2E test for 'copy all' without comments"  # T019
Task: "Write E2E test for 'copy all' with memo (no title)"  # T020
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (understand existing components) - ~30 min
2. Complete Phase 2: Foundational (hook + tests) - ~1 hour
3. Complete Phase 3: User Story 1 (menu copy + tests) - ~2 hours
4. **STOP and VALIDATE**: Test User Story 1 independently (manual + E2E)
5. Deploy/demo if ready - Users can now copy task/memo bodies from menu!

**Total MVP time**: ~3.5 hours

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (~1.5 hours)
2. Add User Story 1 → Test independently → Deploy (MVP!) (~2 hours)
3. Add User Story 2 → Test independently → Deploy (~0.5 hour - automatic via EditableContent)
4. Add User Story 3 → Test independently → Deploy (~2 hours - adds formatter)
5. Polish & validate → Final release (~1.5 hours)

**Total feature time**: ~7.5 hours

### Parallel Team Strategy

With 3 developers:

1. Team completes Setup + Foundational together (~1.5 hours)
2. Once Foundational is done:
   - Developer A: User Story 1 (本文コピー - メニュー追加) - ~2 hours
   - Developer B: User Story 2 (コメントコピー - 検証のみ) - ~0.5 hour
   - Developer C: User Story 3 (すべてコピー) - ~2 hours
3. Stories complete and integrate independently
4. Team reviews Polish tasks together (~1.5 hours)

**Total parallel time**: ~4.5 hours (vs 7.5 hours sequential)

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
  - `[US1]` = User Story 1: Copy Body
  - `[US2]` = User Story 2: Copy Comment
  - `[US3]` = User Story 3: Copy All
  - `[US-Foundation]` = Shared foundation for all stories
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All E2E tests use Playwright with clipboard permissions
- All unit tests use Vitest with mocked Clipboard API
- No new dependencies required (uses existing Clipboard API)
- No backend changes required (UI-only feature)
- Total tasks: 26 (reduced from CopyButton-based approach)

