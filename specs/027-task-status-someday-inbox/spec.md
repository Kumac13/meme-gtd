# Feature Specification: Add "inbox" and "someday" Task Statuses

**Feature Branch**: `027-task-status-someday-inbox`
**Created**: 2025-11-17
**Status**: Draft
**Input**: User description: "taskのstatusにsomedayとinboxを追加したい。"

## Clarifications

### Session 2025-11-17

- Q: メモからタスクに昇格する際のデフォルトステータスは何にすべきか？ → A: status="inbox" - メモ昇格時は"inbox"をデフォルトにして、後でトリアージを促す
- Q: inboxやsomedayから完了系ステータス（done/canceled）への直接遷移は許可すべきか？ → A: 制限なし - 任意のステータスから任意のステータスへ自由に遷移可能
- Q: プロジェクトボードでinbox/somedayステータスのタスクはどう扱うべきか？ → A: 既存と同等 - inbox/somedayステータスのタスクもプロジェクトボードに通常通り表示される
- Q: UI上でステータスを表示する際の順序は？ → A: GTDワークフロー順 - inbox, open, next, waiting, scheduled, someday, done, canceled（処理の流れに沿った配置）
- Q: 既存のstatus="open"タスクはどう扱うべきか？ → A: 変更なし - 既存のstatus="open"タスクはそのまま維持（ユーザーが必要に応じて手動で"inbox"に変更）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture Tasks to Inbox Without Classification (Priority: P1)

When a user creates a new task that hasn't been triaged yet, they want to place it in an "inbox" status to indicate it needs further review and classification. This aligns with the GTD workflow where newly captured items enter an Inbox state before being processed.

**Why this priority**: This is the entry point of the GTD workflow. Without an explicit "inbox" status, users must immediately classify tasks as "open" or another status, which breaks the GTD principle of separating capture from processing.

**Independent Test**: Can be fully tested by creating a task with status "inbox", listing tasks filtered by status=inbox, and verifying the task appears in the inbox list. Delivers immediate value by providing a holding area for unprocessed tasks.

**Acceptance Scenarios**:

1. **Given** a user wants to capture a new task idea, **When** they create a task with status "inbox", **Then** the task is stored with status="inbox" and appears in the inbox list
2. **Given** a user has tasks in inbox status, **When** they list tasks with status filter "inbox", **Then** only tasks with status="inbox" are displayed
3. **Given** a user is triaging an inbox task, **When** they update the task status from "inbox" to "next" or "waiting" or "scheduled", **Then** the task moves to the appropriate status and no longer appears in the inbox list

---

### User Story 2 - Defer Tasks to Someday List (Priority: P1)

When a user determines during triage that a task is not immediately actionable but might be relevant in the future, they want to assign it "someday" status. This corresponds to the GTD "Someday/Maybe" list.

**Why this priority**: Essential for completing the GTD workflow. Without "someday" status, users must either keep non-actionable items in active lists (cluttering their Next Actions) or delete them entirely (losing potentially valuable ideas).

**Independent Test**: Can be fully tested by updating a task to status "someday", listing tasks filtered by status=someday, and verifying the task appears in the someday list. Delivers value by providing a parking space for deferred ideas.

**Acceptance Scenarios**:

1. **Given** a user is triaging a task and decides it's not currently actionable, **When** they update the task status to "someday", **Then** the task is stored with status="someday" and removed from active task lists
2. **Given** a user wants to review deferred ideas during weekly review, **When** they list tasks with status filter "someday", **Then** only tasks with status="someday" are displayed
3. **Given** a user decides to activate a someday task, **When** they update the task status from "someday" to "next" or "scheduled", **Then** the task moves to the active list

---

### User Story 3 - Filter and Search by New Statuses in Web UI (Priority: P2)

When using the Web UI, users want to filter tasks by "inbox" and "someday" statuses through the URL-based filtering system, consistent with existing status filters.

**Why this priority**: Important for user experience consistency across interfaces, but secondary to having the core functionality in CLI and API. Users can still access these tasks without URL filtering.

**Independent Test**: Can be tested by navigating to URLs with status=inbox or status=someday query parameters and verifying correct filtering. Delivers value by providing quick access to inbox and someday lists via bookmarkable URLs.

**Acceptance Scenarios**:

1. **Given** a user navigates to `/tasks?status=inbox` in the Web UI, **When** the page loads, **Then** only tasks with status="inbox" are displayed
2. **Given** a user navigates to `/tasks?status=someday` in the Web UI, **When** the page loads, **Then** only tasks with status="someday" are displayed
3. **Given** a user is viewing a task in the Web UI, **When** they change the status dropdown to "inbox" or "someday", **Then** the task status is updated and the UI reflects the change

---

### Edge Cases

- When a task is promoted from a memo, it defaults to status="inbox" (not "open")
- Existing tasks with status="open" remain unchanged; users distinguish them from new inbox items by filtering
- Tasks can transition directly from any status (including "inbox" and "someday") to any other status (including "done" and "canceled") without restrictions
- Tasks with "inbox" or "someday" status are displayed in project board views with the same behavior as other statuses
- What validation prevents invalid status values in the database?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow tasks to have status value "inbox"
- **FR-002**: System MUST allow tasks to have status value "someday"
- **FR-003**: System MUST accept "inbox" and "someday" as valid status values in task creation API
- **FR-004**: System MUST accept "inbox" and "someday" as valid status values in task update API
- **FR-005**: System MUST allow filtering tasks by status="inbox" via API query parameter
- **FR-006**: System MUST allow filtering tasks by status="someday" via API query parameter
- **FR-007**: CLI MUST accept "inbox" and "someday" as valid status options in task create command
- **FR-008**: CLI MUST accept "inbox" and "someday" as valid status options in task update command
- **FR-009**: CLI MUST accept "inbox" and "someday" as valid status filter values in task list command
- **FR-010**: Web UI MUST display "inbox" and "someday" options in task status dropdown
- **FR-011**: Web UI MUST support URL filtering with status=inbox parameter
- **FR-012**: Web UI MUST support URL filtering with status=someday parameter
- **FR-013**: System MUST allow tasks to transition from any status to any other status without workflow restrictions (e.g., "inbox" → "done" is permitted)
- **FR-014**: Default status for newly created tasks via direct creation SHOULD remain "open" (existing behavior maintained unless explicitly changed to "inbox")
- **FR-015**: When a memo is promoted to a task, the default status MUST be "inbox"
- **FR-016**: Project board views MUST display tasks with "inbox" and "someday" statuses with the same functionality as other statuses (filtering, sorting, status updates)
- **FR-017**: UI components (dropdowns, filters, lists) SHOULD display statuses in GTD workflow order: inbox, open, next, waiting, scheduled, someday, done, canceled
- **FR-018**: Existing tasks with status="open" MUST remain unchanged; no automatic migration to "inbox" status is performed

### Key Entities

- **Task**: Existing entity with `status` attribute that must now accept two additional enumerated values: "inbox" and "someday"
- **TaskStatus**: Type definition/enum that defines the complete set of valid status values, expanded from current six values to eight values

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create tasks with "inbox" status and retrieve them via status filter in under 2 seconds
- **SC-002**: Users can update existing tasks to "someday" status and verify the change persists through CLI, API, and Web UI
- **SC-003**: All task list interfaces (CLI, API, Web UI) correctly filter and display tasks with "inbox" and "someday" statuses
- **SC-004**: 100% of existing task functionality (create, read, update, status transitions) works identically with the new status values as with existing status values
- **SC-005**: Users can distinguish between unprocessed tasks (inbox) and deferred tasks (someday) when reviewing their task lists
- **SC-006**: All existing tasks with status="open" remain unchanged after the feature deployment, preserving data integrity
