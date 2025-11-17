# Tasks: Markdown-Rendered First Line Display for Memos

**Input**: Design documents from `/specs/028-memos-project-kanban-body/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-changes.md

**Tests**: Not explicitly requested in specification - tests are OPTIONAL for this feature

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1 = User Story 1, US2 = User Story 2)
- Include exact file paths in descriptions

## Path Conventions
- **Web app**: Monorepo with `packages/web/`, `packages/shared/`, `packages/db/`, `packages/api/`
- All paths are relative to repository root `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Foundational utilities needed by both user stories

This phase provides shared markdown rendering utilities that both list and kanban views will use.

- [ ] T001 [P] Add `extractFirstLine()` utility function to `packages/web/src/utils/markdown.tsx`
  - Extract text before first `\n` character
  - Support optional `maxLength` parameter for truncation
  - Add ellipsis (`...`) when truncated
  - Return empty string for empty/null input

- [ ] T002 Add `InlineMarkdownRenderer` component to `packages/web/src/utils/markdown.tsx`
  - Create custom component mapping for inline display (headings→strong, paragraphs→span, etc.)
  - Use react-markdown with remarkGfm plugin
  - Remove block-level margins via inline component mappings
  - Handle all edge cases: headings, bold, italic, code, links, lists, blockquotes

- [ ] T003 [P] Add `bodyMd: string` field to `ProjectItemWithIssue.issue` type in `packages/shared/src/types/project.ts`
  - Makes kanban API type-safe for accessing memo body

- [ ] T004 [P] Build shared package: `pnpm --filter meme-gtd-shared build`
  - Ensures type changes propagate to dependent packages

**Checkpoint**: Shared utilities and types ready - both user stories can now proceed in parallel

---

## Phase 2: User Story 1 - Markdown-Rendered First Line in List View (Priority: P1) 🎯 MVP

**Goal**: Display memo first line with markdown formatting in `/memos` list view

**Independent Test**: Navigate to http://localhost:3001/memos, create memo with `# Heading\nSecond line`, verify only "Heading" displays with heading style (bold, larger text)

### Implementation for User Story 1

- [ ] T005 [US1] Update ItemList component to use InlineMarkdownRenderer for memos in `packages/web/src/components/ItemList.tsx`
  - Import `InlineMarkdownRenderer` and `extractFirstLine` from `../utils/markdown`
  - Replace line ~160: `{truncateMarkdown(item.bodyMd, 150)}`
  - With: `{item.bodyMd && item.bodyMd.trim() ? <InlineMarkdownRenderer content={extractFirstLine(item.bodyMd, 150)} /> : <span className="text-gray-500">Memo #{item.id}</span>}`
  - Handle empty body case with fallback "Memo #[ID]"

- [ ] T006 [US1] Build web package: `pnpm --filter meme-gtd-web build`
  - Compile updated ItemList component

- [ ] T007 [US1] Manual verification: Test list view
  - Start test server: `pnpm server:dev` (port 3001)
  - Navigate to http://localhost:3001/memos
  - Create test memo with `# お金について\nDetails...`
  - Verify: Only "お金について" shows with heading style (bold, larger)
  - Create test memo with `**重要** メモ\n詳細...`
  - Verify: "重要" appears bold
  - Create test memo with empty body
  - Verify: Shows "Memo #[ID]" fallback

**Checkpoint**: User Story 1 complete - `/memos` list now shows formatted first lines

---

## Phase 3: User Story 2 - Markdown-Rendered First Line in Kanban View (Priority: P1)

**Goal**: Display memo first line with markdown formatting in `/project/:id/kanban` cards

**Independent Test**: Navigate to http://localhost:3001/projects/[id]/kanban, add memo with `# Title\nBody`, verify card shows "Title" with heading style

**Note**: This story depends on backend changes to provide `bodyMd` field

### Backend Implementation for User Story 2

- [ ] T008 [US2] Update projectItemRepository SQL query in `packages/db/src/projectItemRepository.ts`
  - Find `getProjectItemsWithIssues()` function
  - Add `i.body_md as issue_body_md` to SELECT statement (after `i.title as issue_title`)
  - Update row mapping to include `bodyMd: row.issue_body_md` in issue object

- [ ] T009 [US2] Build db package: `pnpm --filter meme-gtd-db build`
  - Compile updated repository

- [ ] T010 [US2] Build api package: `pnpm --filter meme-gtd-api build`
  - Ensure API returns bodyMd in project responses

### Frontend Implementation for User Story 2

- [ ] T011 [US2] Update KanbanCard component to use InlineMarkdownRenderer for memos in `packages/web/src/components/KanbanCard.tsx`
  - Import `InlineMarkdownRenderer` and `extractFirstLine` from `../utils/markdown`
  - Replace line ~58: `{item.issue.title}`
  - With conditional:
    ```typescript
    {item.issue.type === 'memo' ? (
      item.issue.bodyMd && item.issue.bodyMd.trim() ? (
        <InlineMarkdownRenderer content={extractFirstLine(item.issue.bodyMd, 80)} />
      ) : (
        <span className="text-gray-500">Memo #{item.issueId}</span>
      )
    ) : (
      item.issue.title || `Task #{item.issueId}`
    )}
    ```
  - Use 80 character limit for kanban (smaller cards)
  - Handle empty body case with fallback

- [ ] T012 [US2] Build web package: `pnpm --filter meme-gtd-web build`
  - Compile updated KanbanCard component

- [ ] T013 [US2] Manual verification: Test kanban view
  - Start test server: `pnpm server:dev` (port 3001)
  - Navigate to http://localhost:3001/projects/4/kanban (or any project)
  - Add test memo with `# お金について\n## Rule - Suica...`
  - Verify: Card shows "お金について" with heading style
  - Add test memo with `**Bold** text\nMore text`
  - Verify: Card shows "Bold text" with bold formatting
  - Add empty memo
  - Verify: Card shows "Memo #[ID]" fallback
  - Test long first line truncation (80+ chars)
  - Verify: Truncates with ellipsis

**Checkpoint**: User Story 2 complete - Kanban cards now show formatted first lines for memos

---

## Phase 4: Polish & Verification

**Purpose**: Final checks and cleanup

- [ ] T014 [P] Verify TypeScript compilation across all packages: `pnpm build`
  - Ensures no type errors from changes

- [ ] T015 Test environment verification
  - Start test API: `pnpm server:dev`
  - Access http://localhost:3001/memos
  - Access http://localhost:3001/projects/4/kanban
  - Create various test memos (headings, bold, italic, lists, empty)
  - Verify formatting in both list and kanban views
  - Verify no layout shifts or visual glitches
  - Verify "Memo #[ID]" fallback for empty memos

- [ ] T016 [P] API response verification (optional)
  - `curl http://localhost:3001/api/projects/4 | jq '.items[].issue | {type, title, bodyMd}'`
  - Verify `bodyMd` field present for all issues
  - Verify non-empty for memos

- [ ] T017 Clean test data (if needed)
  - Remove any test memos created during verification
  - Restore original test environment state

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - creates shared utilities
- **User Story 1 (Phase 2)**: Depends on T001, T002, T003, T004 from Phase 1
- **User Story 2 (Phase 3)**: Depends on T001, T002, T003, T004 from Phase 1
  - User Stories 1 and 2 can proceed in parallel after Phase 1 completes
- **Polish (Phase 4)**: Depends on completion of desired user stories

### Task Dependencies

**Phase 1 (Setup)**:
- T001, T002, T003 can run in parallel [P] - different concerns
- T004 depends on T003 (must build after type changes)

**Phase 2 (User Story 1)**:
- T005 depends on T001, T002 (needs utilities)
- T006 depends on T005 (must edit before building)
- T007 depends on T006 (must build before testing)

**Phase 3 (User Story 2)**:
- T008 is independent (backend SQL change)
- T009 depends on T008 (must edit before building)
- T010 depends on T009 (must build db before api)
- T011 depends on T001, T002, T003 (needs utilities and types)
- T012 depends on T011 (must edit before building)
- T013 depends on T010, T012 (needs both backend and frontend changes)

**Phase 4 (Polish)**:
- T014, T015, T016 can run in parallel [P]
- T017 depends on completion of testing

### Parallel Opportunities

```bash
# Phase 1: All setup tasks in parallel
Task: "Add extractFirstLine() utility" [T001]
Task: "Add InlineMarkdownRenderer component" [T002]
Task: "Add bodyMd to ProjectItemWithIssue type" [T003]
# Then build: [T004]

# After Phase 1 completes:
# User Story 1 and User Story 2 can work in parallel
# (US1: T005→T006→T007 in one stream)
# (US2: T008→T009→T010→T011→T012→T013 in another stream)

# Phase 4: Verification tasks in parallel
Task: "TypeScript build verification" [T014]
Task: "Manual testing in browser" [T015]
Task: "API response check" [T016]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: User Story 1 (T005-T007)
3. **STOP and VALIDATE**: Test `/memos` list independently
4. If satisfied, optionally proceed to User Story 2

**Result**: `/memos` shows formatted first lines, ready to demo/deploy

### Full Feature (Both Stories)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: User Story 1 (T005-T007)
3. Complete Phase 3: User Story 2 (T008-T013)
4. Complete Phase 4: Polish (T014-T017)

**Result**: Both `/memos` and kanban show formatted first lines

### Parallel Team Strategy

With 2 developers:

1. Both work on Phase 1 together (T001-T004)
2. Once Phase 1 completes:
   - Developer A: User Story 1 (T005-T007)
   - Developer B: User Story 2 (T008-T013)
3. Stories complete independently, integrate seamlessly

---

## Summary

**Total Tasks**: 17
- Phase 1 (Setup): 4 tasks
- Phase 2 (User Story 1): 3 tasks
- Phase 3 (User Story 2): 6 tasks
- Phase 4 (Polish): 4 tasks

**Parallel Opportunities**: 6 tasks marked [P]

**Independent Test Criteria**:
- **User Story 1**: Navigate to `/memos`, verify formatted first lines
- **User Story 2**: Navigate to `/project/:id/kanban`, verify formatted cards

**MVP Scope**: Phase 1 + Phase 2 (7 tasks total)

**Estimated Time**:
- Phase 1: 30-45 minutes (utilities + types)
- Phase 2: 20-30 minutes (list view)
- Phase 3: 45-60 minutes (backend + kanban view)
- Phase 4: 15-20 minutes (verification)
- **Total**: 2-3 hours

**Files Modified**: 5
- `packages/web/src/utils/markdown.tsx` (T001, T002)
- `packages/shared/src/types/project.ts` (T003)
- `packages/web/src/components/ItemList.tsx` (T005)
- `packages/db/src/projectItemRepository.ts` (T008)
- `packages/web/src/components/KanbanCard.tsx` (T011)

**New Files**: 0

**Breaking Changes**: None (additive changes only)
