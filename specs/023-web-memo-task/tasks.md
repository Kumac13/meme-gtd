# Tasks: Web UI Memo-to-Task Promotion

**Input**: Design documents from `/specs/023-web-memo-task/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/promote-memo.yaml

**API Status**: ✅ Already implemented - `POST /api/memos/:id/promote` endpoint exists
**Focus**: Frontend Web UI implementation in `packages/web/`

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- All file paths are absolute

## Path Conventions
- **Frontend**: `packages/web/src/`
- **API Tests**: `packages/api/test/`
- **E2E Tests**: `packages/web/tests/e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing infrastructure and test environment

**⚠️ CRITICAL**: ALWAYS use test environment (port 3001, test-data/test.db) - NEVER touch production

- [x] T001 Verify test database initialized: `pnpm mgtd:test init -d $PWD/test-data/test.db -f`
- [ ] T002 [P] Verify test API server runs on port 3001: `pnpm server:dev`
- [ ] T003 [P] Verify existing promote endpoint works: `curl -X POST http://localhost:3001/api/memos/1/promote -H "Content-Type: application/json" -d '{"title":"Test"}'`
- [x] T004 Create test memo for manual testing: `pnpm mgtd:test memo create --body "Test memo for promotion"`

**Checkpoint**: Test environment ready, API endpoint verified working

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: NO foundational tasks needed - all infrastructure already exists

**Status**: ✅ SKIPPED - API, database, routing, and components already implemented

**Checkpoint**: Foundation already complete - user story implementation can begin immediately

---

## Phase 3: User Story 1 - Quick Memo Promotion (Priority: P1) 🎯 MVP

**Goal**: Enable users to promote a memo to a task by clicking a button on the memo detail page, filling in a title on the pre-populated task creation form, and submitting

**Independent Test**: Create memo → Navigate to memo detail → Click "Promote to Task" → Fill title → Submit → Verify task created with memo body

**Acceptance Scenarios**:
1. Click "Promote" button → redirected to task form with memo body pre-filled
2. Enter title and submit → task created, memo deleted
3. View task → contains original memo content

### Implementation for User Story 1

- [x] T005 [US1] Add "Promote to Task" button to MemoDetail page
  - **File**: `packages/web/src/pages/MemoDetail.tsx`
  - **Action**: Add button in header next to bookmark button
  - **Code**: `<Link to={\`/tasks/new?fromMemo=${id}\`}><button>⬆️ Promote to Task</button></Link>`
  - **Style**: Match existing button styles (border, hover, spacing)

- [x] T006 [US1] Add fromMemoId prop to TaskForm component
  - **File**: `packages/web/src/components/TaskForm.tsx`
  - **Action**: Add `fromMemoId?: number` to TaskFormProps interface
  - **Action**: Import MemosService: `import { MemosService } from '../api/services/MemosService';`

- [x] T007 [US1] Implement promotion logic in TaskForm.handleSubmit
  - **File**: `packages/web/src/components/TaskForm.tsx`
  - **Action**: Detect promotion mode: `if (mode === 'create' && fromMemoId)`
  - **Action**: Call promote API: `const response = await MemosService.promoteMemo(fromMemoId.toString(), { title, status });`
  - **Action**: Navigate to task detail: `navigate(\`/tasks/${response.id}\`);`
  - **Action**: Handle errors: display in existing error banner

- [x] T008 [US1] Parse fromMemo query parameter in TaskNew page
  - **File**: `packages/web/src/pages/TaskNew.tsx`
  - **Action**: Use useSearchParams hook: `const [searchParams] = useSearchParams();`
  - **Action**: Extract memo ID: `const fromMemoId = searchParams.get('fromMemo');`

- [x] T009 [US1] Fetch memo data when fromMemo parameter present
  - **File**: `packages/web/src/pages/TaskNew.tsx`
  - **Action**: Add state: `const [memo, setMemo] = useState(null); const [loading, setLoading] = useState(false);`
  - **Action**: Add useEffect to fetch memo: `if (fromMemoId) { const data = await MemosService.getMemo(fromMemoId); setMemo(data); }`
  - **Action**: Import MemosService: `import { MemosService } from '../api/services/MemosService';`

- [x] T010 [US1] Pass memo data as initial props to TaskForm
  - **File**: `packages/web/src/pages/TaskNew.tsx`
  - **Action**: Pass props: `<TaskForm mode="create" initialBodyMd={memo?.bodyMd} fromMemoId={memo?.id} />`
  - **Action**: Update heading: `{memo ? 'Promote Memo to Task' : 'Create New Task'}`
  - **Action**: Add loading state UI: `if (loading) return <LoadingState message="Loading memo..." />;`

- [ ] T011 [US1] Manual smoke test - full promotion flow
  - **File**: Manual test in browser
  - **Steps**:
    1. Start test server: `pnpm server:dev` (port 3001)
    2. Create test memo: `pnpm mgtd:test memo create --body "Test promotion"`
    3. Open http://localhost:3001/memos (find memo ID)
    4. Click memo → Verify "Promote to Task" button appears
    5. Click button → Verify redirect to /tasks/new?fromMemo=X
    6. Verify memo body pre-filled in form
    7. Enter title "Promoted task" → Submit
    8. Verify redirect to task detail page
    9. Verify task has correct body content
  - **Expected**: All steps pass, no console errors

**Checkpoint**: User Story 1 complete - users can promote memos to tasks with basic functionality

---

## Phase 4: User Story 2 - Promoted Task with Initial Status (Priority: P2)

**Goal**: Allow users to select an initial status (open, next, waiting, scheduled) when promoting a memo

**Independent Test**: Promote memo → Select status "next" → Submit → Verify task has status "next"

**Acceptance Scenarios**:
1. Select status "next" → task created with status "next"
2. Select status "waiting" → task created with status "waiting"

### Implementation for User Story 2

- [x] T012 [US2] Show status dropdown in TaskForm during promotion
  - **File**: `packages/web/src/components/TaskForm.tsx`
  - **Action**: Update conditional: `{(mode === 'edit' || fromMemoId) && ( ... status dropdown ... )}`
  - **Action**: Change label to "Initial Status" when fromMemoId present
  - **Action**: Update help text: "Select initial status for this task"

- [x] T013 [US2] Pass initial status to promote API
  - **File**: `packages/web/src/components/TaskForm.tsx`
  - **Action**: Include status in API call: `MemosService.promoteMemo(fromMemoId.toString(), { title, status })`
  - **Note**: Status already captured from dropdown state

- [ ] T014 [US2] Manual test - status selection
  - **File**: Manual test in browser
  - **Steps**:
    1. Create memo: `pnpm mgtd:test memo create --body "Status test"`
    2. Navigate to memo detail → Click "Promote to Task"
    3. Verify status dropdown is visible (not normally shown in create mode)
    4. Select status "next"
    5. Enter title "Status test task" → Submit
    6. Verify task detail page shows status "next"
  - **Expected**: Status dropdown visible, selected status applied to task

**Checkpoint**: User Story 2 complete - users can set initial status during promotion

---

## Phase 5: User Story 3 - Data Preservation During Promotion (Priority: P2)

**Goal**: Ensure all metadata (labels, comments, links, projects, bookmarks) is transferred from memo to task during promotion

**Independent Test**: Create memo with metadata → Promote → Verify all metadata appears on task

**Acceptance Scenarios**:
1. Memo with labels → task has same labels
2. Memo with comments → task has same comments
3. Memo with links → task preserves links
4. Memo with projects → task belongs to same projects
5. Bookmarked memo → task is bookmarked

### Implementation for User Story 3

**Note**: Metadata transfer happens server-side in existing API. This phase focuses on TESTING that it works correctly.

- [ ] T015 [P] [US3] API integration test - labels transfer
  - **File**: `packages/api/test/integration/promote-memo-labels.test.ts`
  - **Create test**:
    ```typescript
    test('promote memo preserves labels', async () => {
      // Create memo
      const memoRes = await app.inject({ method: 'POST', url: '/api/memos', payload: { bodyMd: 'Test' } });
      const memo = JSON.parse(memoRes.body);

      // Add labels
      await app.inject({ method: 'POST', url: `/api/memos/${memo.id}/labels`, payload: { labels: ['urgent', 'work'] } });

      // Promote
      const promoteRes = await app.inject({ method: 'POST', url: `/api/memos/${memo.id}/promote`, payload: { title: 'Test' } });
      const task = JSON.parse(promoteRes.body);

      // Verify labels transferred
      assert.deepEqual(task.labels, ['urgent', 'work']);
    });
    ```
  - **Run**: `pnpm --filter meme-gtd-api test`

- [ ] T016 [P] [US3] API integration test - comments transfer
  - **File**: `packages/api/test/integration/promote-memo-comments.test.ts`
  - **Test**: Create memo → Add 3 comments → Promote → Verify task has 3 comments
  - **Run**: `pnpm --filter meme-gtd-api test`

- [ ] T017 [P] [US3] API integration test - bookmark transfer
  - **File**: `packages/api/test/integration/promote-memo-bookmark.test.ts`
  - **Test**: Create memo → Bookmark it → Promote → Verify task is bookmarked
  - **Run**: `pnpm --filter meme-gtd-api test`

- [ ] T018 [US3] Manual verification - labels visible in Web UI
  - **File**: Manual test in browser
  - **Steps**:
    1. Create memo: `pnpm mgtd:test memo create --body "Label test"`
    2. Add labels via CLI or Web UI
    3. Promote memo to task
    4. Navigate to task detail page
    5. Verify labels appear on task
  - **Expected**: Labels displayed correctly in Web UI

**Checkpoint**: User Story 3 complete - metadata transfer verified working

---

## Phase 6: User Story 4 - Error Handling and Feedback (Priority: P3)

**Goal**: Display clear, user-friendly error messages when promotion fails (API error, network error, validation error)

**Independent Test**: Simulate API error → Verify error message displayed, memo not deleted

**Acceptance Scenarios**:
1. API returns error → error banner shown, memo preserved
2. Network error → user-friendly message with retry option

### Implementation for User Story 4

- [ ] T019 [US4] Verify validation error display in TaskForm
  - **File**: `packages/web/src/components/TaskForm.tsx`
  - **Verify**: Existing validation error logic handles promotion mode
  - **Test**: Leave title empty → Submit → Verify error banner: "Title is required"
  - **No code changes needed** - existing error handling already covers this

- [ ] T020 [US4] Verify API error display in TaskForm
  - **File**: `packages/web/src/components/TaskForm.tsx`
  - **Verify**: Existing try/catch in handleSubmit displays promotion errors
  - **Test manually**: Promote with invalid memo ID (99999) → Verify error: "Memo not found"
  - **No code changes needed** - existing error handling already covers this

- [ ] T021 [US4] Manual test - validation error (missing title)
  - **File**: Manual test in browser
  - **Steps**:
    1. Create memo and start promotion
    2. Leave title field empty
    3. Click "Create Task"
    4. Verify red error banner appears: "Title is required"
    5. Verify form not submitted
  - **Expected**: Error shown, form stays on page

- [ ] T022 [US4] Manual test - API error (memo not found)
  - **File**: Manual test in browser
  - **Steps**:
    1. Navigate to /tasks/new?fromMemo=99999 (non-existent ID)
    2. Verify loading state
    3. Verify error message: "Failed to load memo" or "Memo not found"
  - **Expected**: User-friendly error displayed

**Checkpoint**: User Story 4 complete - error handling verified working

---

## Phase 7: E2E Testing (Cross-Cutting)

**Purpose**: End-to-end tests for complete promotion workflows

- [ ] T023 [P] E2E test - basic promotion flow
  - **File**: `packages/web/tests/e2e/promote-memo-basic.spec.ts`
  - **Test**:
    ```typescript
    test('promote memo to task flow', async ({ page }) => {
      // Create memo via API
      const memoRes = await page.request.post('http://localhost:3001/api/memos', { data: { bodyMd: 'E2E test' } });
      const memo = await memoRes.json();

      // Navigate to memo detail
      await page.goto(`http://localhost:3001/memos/${memo.id}`);

      // Click promote button
      await page.click('text=Promote to Task');

      // Verify URL
      await expect(page).toHaveURL(/\/tasks\/new\?fromMemo=/);

      // Fill title and submit
      await page.fill('input#title', 'E2E Test Task');
      await page.click('button:has-text("Create Task")');

      // Verify navigation to task detail
      await expect(page).toHaveURL(/\/tasks\/\d+/);
      await expect(page.locator('h1')).toContainText('E2E Test Task');
    });
    ```
  - **Run**: Start test server → `pnpm --filter meme-gtd-web test:e2e`

- [ ] T024 [P] E2E test - promotion with status selection
  - **File**: `packages/web/tests/e2e/promote-memo-status.spec.ts`
  - **Test**: Promote memo → Select status "next" → Verify task has status "next"
  - **Run**: `pnpm --filter meme-gtd-web test:e2e`

**Checkpoint**: E2E tests passing

---

## Phase 8: Polish & Documentation

**Purpose**: Final improvements and documentation updates

- [ ] T025 [P] Update CHANGELOG.md with feature description
  - **File**: `CHANGELOG.md`
  - **Action**: Add entry under "Unreleased" section:
    ```markdown
    ### Added
    - Web UI: Memo-to-Task promotion feature (#66)
      - "Promote to Task" button on memo detail pages
      - Task creation form pre-populated with memo content
      - Initial status selection during promotion
      - Metadata preservation (labels, comments, links, projects, bookmarks)
    ```

- [ ] T026 [P] Verify no production database contamination
  - **File**: Production database check
  - **Action**: Check production DB size: `ls -lh ~/.local/share/mgtd/issues.db`
  - **Expected**: File size unchanged from before testing (should be ~172KB or original size)
  - **If changed**: Restore from backup immediately

- [ ] T027 Final manual smoke test - all user stories
  - **File**: Manual test in browser
  - **Steps**:
    1. Start test server: `pnpm server:dev`
    2. Create memo with labels and bookmark
    3. Navigate to memo detail
    4. Click "Promote to Task"
    5. Verify heading: "Promote Memo to Task"
    6. Verify body pre-filled
    7. Verify status dropdown visible
    8. Enter title, select status "next"
    9. Submit form
    10. Verify task created with correct title, body, status
    11. Verify labels transferred
    12. Verify bookmark transferred
    13. Navigate back to memos list
    14. Verify promoted memo no longer appears
  - **Expected**: All steps pass, smooth user experience

**Checkpoint**: Feature complete and ready for PR

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately ✅
- **Foundational (Phase 2)**: ✅ SKIPPED - already complete
- **User Story 1 (Phase 3)**: Can start immediately (no foundational blockers)
- **User Story 2 (Phase 4)**: Depends on Phase 3 (extends TaskForm from US1)
- **User Story 3 (Phase 5)**: Independent - can run parallel with US2 (only tests API)
- **User Story 4 (Phase 6)**: Depends on Phase 3 (tests error handling in TaskForm)
- **E2E Tests (Phase 7)**: Depends on Phases 3-6 complete
- **Polish (Phase 8)**: Depends on all previous phases

### User Story Dependencies

- **User Story 1 (P1)**: ✅ Can start immediately - Core functionality
- **User Story 2 (P2)**: ⚠️ Depends on US1 - Extends TaskForm with status dropdown
- **User Story 3 (P2)**: ✅ Independent - Can run parallel with US2 (API tests only)
- **User Story 4 (P3)**: ⚠️ Depends on US1 - Tests error handling in TaskForm

### Within Each User Story

**User Story 1** (T005-T011):
- T005 (MemoDetail button) [P] T006 (TaskForm prop) [P] T008 (TaskNew query param) can run in parallel
- T007 (promotion logic) depends on T006
- T009 (fetch memo) depends on T008
- T010 (pass props) depends on T009
- T011 (smoke test) depends on T005, T007, T010

**User Story 2** (T012-T014):
- T012 (status dropdown) depends on T006/T007 from US1
- T013 (pass status to API) depends on T012
- T014 (manual test) depends on T013

**User Story 3** (T015-T018):
- T015, T016, T017 can run in parallel [P] (different test files)
- T018 (manual test) depends on T015-T017

**User Story 4** (T019-T022):
- T019, T020 can run in parallel [P] (verification only)
- T021, T022 can run in parallel [P] (manual tests)

### Parallel Opportunities

```bash
# Setup (all parallel)
T001 && T002 && T003 && T004

# User Story 1 initial tasks (parallel start)
T005 & T006 & T008  # MemoDetail, TaskForm prop, TaskNew query param
wait

# User Story 1 dependent tasks (sequential)
T007  # Promotion logic (needs T006)
T009  # Fetch memo (needs T008)
T010  # Pass props (needs T009)
T011  # Smoke test (needs all above)

# User Story 3 tests (all parallel)
T015 & T016 & T017  # Labels, comments, bookmark tests
wait
T018  # Manual verification

# E2E tests (parallel)
T023 & T024
```

---

## Parallel Example: User Story 1 Initial Tasks

```bash
# Launch these 3 tasks together:
Task T005: "Add Promote button to MemoDetail" (packages/web/src/pages/MemoDetail.tsx)
Task T006: "Add fromMemoId prop to TaskForm" (packages/web/src/components/TaskForm.tsx)
Task T008: "Parse fromMemo query param in TaskNew" (packages/web/src/pages/TaskNew.tsx)

# All touch different files, no dependencies between them
```

---

## Implementation Strategy

### MVP First (User Story 1 Only) - Recommended

1. ✅ Complete Phase 1: Setup (verify test environment)
2. ✅ Skip Phase 2: Foundational (already done)
3. Complete Phase 3: User Story 1 (T005-T011)
4. **STOP and VALIDATE**: Run T011 smoke test
5. **Demo/Review**: Show working promotion flow
6. If approved, continue to US2/US3/US4

**MVP Scope**: ~2-3 hours, delivers core value

### Full Feature Implementation

1. Complete Setup (Phase 1)
2. Complete User Story 1 (Phase 3) - Test independently
3. Complete User Story 2 (Phase 4) - Test status selection
4. Complete User Story 3 (Phase 5) in parallel - Test metadata transfer
5. Complete User Story 4 (Phase 6) - Test error handling
6. Complete E2E tests (Phase 7)
7. Polish (Phase 8)

**Full Scope**: ~4.5 hours (per quickstart.md estimate)

### Parallel Team Strategy

With 2 developers:

1. Both complete Setup
2. Developer A: User Story 1 (T005-T011)
3. Wait for US1 checkpoint ✓
4. Developer A: User Story 2 (T012-T014) | Developer B: User Story 3 (T015-T018)
5. Developer A: User Story 4 (T019-T022)
6. Both: E2E tests (T023, T024)
7. Developer A: Polish (T025-T027)

---

## Task Summary

**Total Tasks**: 27
- Setup: 4 tasks
- User Story 1 (P1): 7 tasks (T005-T011)
- User Story 2 (P2): 3 tasks (T012-T014)
- User Story 3 (P2): 4 tasks (T015-T018)
- User Story 4 (P3): 4 tasks (T019-T022)
- E2E Testing: 2 tasks (T023-T024)
- Polish: 3 tasks (T025-T027)

**Tasks per User Story**:
- US1: 7 tasks (core promotion functionality)
- US2: 3 tasks (status selection)
- US3: 4 tasks (metadata transfer validation)
- US4: 4 tasks (error handling validation)

**Parallel Opportunities**:
- Setup: 4 tasks can run in parallel
- US1 initial: 3 tasks can run in parallel (T005, T006, T008)
- US3 tests: 3 tasks can run in parallel (T015, T016, T017)
- US4 tests: 4 tasks can run in parallel (T019-T022)
- E2E: 2 tasks can run in parallel (T023, T024)
- Polish: 2 tasks can run in parallel (T025, T026)

**Independent Test Criteria**:
- US1: Create memo → Click Promote → Fill title → Submit → Verify task exists
- US2: Promote memo → Select status "next" → Verify task has status "next"
- US3: Create memo with labels → Promote → Verify task has labels
- US4: Promote with empty title → Verify error shown, form stays on page

**Suggested MVP**: User Story 1 only (T001-T011) = 11 tasks, ~2-3 hours

---

## Notes

- **[P] tasks**: Different files, can run in parallel
- **[Story] label**: Maps task to specific user story (US1, US2, US3, US4)
- **API already implemented**: No backend changes needed
- **Test environment only**: Always use port 3001, test-data/test.db
- **Manual tests included**: Several tasks require manual browser testing
- **Checkpoints**: After each user story phase, validate independently
- **Commit strategy**: Commit after each task or logical group (e.g., after T007+T010)
- **MVP delivery**: Stop after US1 for fastest value delivery

---

## Quickstart Reference

For detailed implementation guidance, see:
- **Implementation steps**: `specs/023-web-memo-task/quickstart.md`
- **Code examples**: Each phase in quickstart.md has working code snippets
- **Testing procedures**: Manual smoke test steps in quickstart.md
- **Troubleshooting**: Common issues and solutions in quickstart.md
