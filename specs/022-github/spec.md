# Feature Specification: Item Detail Back Navigation with Filter Preservation

**Feature Branch**: `022-github`
**Created**: 2025-10-31
**Status**: Draft
**Input**: User description: "Githubに合わせるか。"
**Scope**: Tasks, Memos, and Projects

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Preserve Filter State on Back Navigation (Priority: P1)

Users who have filtered items (tasks, memos, or projects) can click on an item to view details, then use the "Back to [items]" button to return to the list with their original filters still applied. For example, viewing only "Open" tasks or bookmarked memos.

**Why this priority**: This is the core functionality that maintains user workflow continuity. Without it, users lose their filter context every time they view an item detail, causing frustration and inefficiency across all item types.

**Independent Test**: Can be fully tested by setting a filter on any item list (e.g., tasks with `?status=open`, memos with `?bookmarked=true`), clicking any item, then clicking the back button - the user should return to the filtered view.

**Acceptance Scenarios**:

1. **Given** I am viewing tasks with status filter "Open" (`/tasks/?status=open`), **When** I click on a task to view details, **Then** the detail page stores the return URL with filters
2. **Given** I am on a task detail page that I accessed from a filtered list, **When** I click "Back to tasks", **Then** I return to the task list with the same filter applied (`/tasks/?status=open`)
3. **Given** I am viewing memos with bookmark filter (`/memos/?bookmarked=true`), **When** I navigate to a memo detail and back, **Then** the bookmark filter is preserved
4. **Given** I am viewing any item type with multiple filters, **When** I navigate to item detail and back, **Then** all filters are preserved

---

### User Story 2 - Handle Direct Item Detail Access (Priority: P2)

Users who access an item detail page directly (via shared link or bookmark) for any item type (task, memo, or project) can navigate back to the default list view without errors.

**Why this priority**: Ensures robustness and prevents broken navigation when users don't arrive from a filtered list, regardless of item type.

**Independent Test**: Can be tested by directly entering any item detail URL (e.g., `/tasks/123`, `/memos/456`, `/projects/789`) in the browser address bar, then clicking the back button - should navigate to the respective default list view.

**Acceptance Scenarios**:

1. **Given** I directly access a task detail URL without filters (`/tasks/123`), **When** I click "Back to tasks", **Then** I navigate to the default task list (`/tasks/`)
2. **Given** I directly access a memo detail URL without filters (`/memos/456`), **When** I click "Back to memos", **Then** I navigate to the default memo list (`/memos/`)
3. **Given** I access any item detail via a shared link with no filter context, **When** I use the back button, **Then** the navigation works without errors

---

### User Story 3 - Shareable Item Links with Return Context (Priority: P3)

Users can share item detail links (for tasks, memos, or projects) that include the filter context, allowing recipients to return to the same filtered view when they click the back button.

**Why this priority**: Enhances collaboration by preserving the context when sharing specific items within a filtered workflow, regardless of item type.

**Independent Test**: Can be tested by copying any item detail URL that includes return filters, sharing it with another user/session, and verifying that clicking the back button navigates to the intended filtered view.

**Acceptance Scenarios**:

1. **Given** I share a task detail URL with return filter parameters (e.g., `/tasks/123?returnFilters=status%3Dopen`), **When** someone else opens that link and clicks "Back to tasks", **Then** they see the filtered task list (`/tasks/?status=open`)
2. **Given** I share a memo detail URL with return filter parameters (e.g., `/memos/456?returnFilters=bookmarked%3Dtrue`), **When** someone opens that link and clicks "Back to memos", **Then** they see the filtered memo list (`/memos/?bookmarked=true`)
3. **Given** any item detail URL with return filters, **When** I bookmark it and open it later, **Then** the back navigation still works with the preserved filters

---

### Edge Cases

- What happens when an item detail URL includes invalid or corrupted `returnFilters` parameters?
  - System should gracefully fall back to the default list for that item type (e.g., `/tasks/`, `/memos/`, `/projects/`)
  - System should log the error with details about the invalid parameter for troubleshooting
- What happens when a user modifies filters on an item list, then uses browser back to return to an item detail that has old filter parameters?
  - The back link should use the stored return filters (consistent with GitHub's behavior of not auto-updating back links)
- What happens when the URL becomes very long due to multiple filters?
  - Standard URL length limits (~2000 characters) are sufficient for filter parameters; system should handle normally across all item types
- What happens when parameter validation fails for security reasons (e.g., potential XSS attempt)?
  - System should reject the parameter, fall back to default list, and log the validation failure with details for security monitoring

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST pass current filter state from any item list (tasks, memos, projects) to the corresponding detail page via URL parameters
- **FR-002**: Item detail pages (tasks, memos, projects) MUST store the return filter parameters when accessed from a filtered list
- **FR-003**: Back navigation buttons MUST navigate to the corresponding item list URL with preserved filter parameters
- **FR-004**: System MUST handle item detail pages accessed directly (without filter context) by defaulting to the base list URL for that item type
- **FR-005**: System MUST validate and sanitize return filter parameters to prevent XSS or navigation errors across all item types
- **FR-006**: Filter preservation MUST work with all supported filter types: tasks support status and bookmarked filters; memos and projects support bookmarked filter only
- **FR-007**: System MUST maintain URL-based filter state (from PR #65) without regression
- **FR-008**: Feature MUST apply consistently to all three item types: tasks, memos, and projects
- **FR-009**: System MUST log error cases including invalid returnFilters parameters, validation failures, and fallback-to-default navigation events for troubleshooting purposes

### Key Entities

- **Task List Route**: The route (`/tasks/`) with optional query parameters (`?status=X&bookmarked=Y`)
- **Task Detail Route**: The route (`/tasks/:id`) with optional return filter parameters (`?returnFilters=...`)
- **Memo List Route**: The route (`/memos/`) with optional query parameters (`?bookmarked=Y`)
- **Memo Detail Route**: The route (`/memos/:id`) with optional return filter parameters (`?returnFilters=...`)
- **Project List Route**: The route (`/projects/`) with optional query parameters (`?bookmarked=Y`)
- **Project Detail Route**: The route (`/projects/:id`) with optional return filter parameters (`?returnFilters=...`)
- **Return Filter Context**: URL-encoded representation of the item list filters to restore on back navigation
- **Supported Filters by Item Type**:
  - Tasks: `status` (open, next, waiting, scheduled, done, canceled) and `bookmarked` (true/false)
  - Memos: `bookmarked` (true/false) only
  - Projects: `bookmarked` (true/false) only

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users navigating from filtered item lists (tasks, memos, or projects) to item details can return to the exact same filtered view in 100% of cases
- **SC-002**: Direct access to any item detail page works without errors (no broken navigation)
- **SC-003**: Filter preservation works seamlessly with browser back/forward buttons for all item types (maintains consistency with PR #65)
- **SC-004**: URL parameter length remains under 500 characters for typical filter combinations across all item types (performance and shareability)
- **SC-005**: Back navigation completes in under 500ms (from click to fully rendered filtered list) for all item types
- **SC-006**: User workflow efficiency improves by eliminating the need to reapply filters after viewing item details across all item types

## Clarifications

### Session 2025-10-31

- Q: 「Back to tasks」ナビゲーションが完了するまでの許容最大時間はどのくらいですか？ → A: 500ms未満
- Q: この「フィルター保持ナビゲーション」機能はタスクのみに適用しますか、それともメモとプロジェクトにも適用しますか？ → A: タスク、メモ、プロジェクトすべて
- Q: フィルター保持ナビゲーションの失敗や問題を検出・診断するために、システムはログやメトリクスを記録する必要がありますか？ → A: エラーケースのみ記録（無効なパラメータ、フォールバック処理）
- Q: メモとプロジェクトの一覧ページでは、どのフィルタータイプをサポートしますか？ → A: bookmarkedのみ（メモ/プロジェクト共通）
