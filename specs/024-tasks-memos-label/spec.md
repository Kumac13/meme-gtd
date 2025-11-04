# Feature Specification: Label and Status Search for Tasks and Memos

**Feature Branch**: `024-tasks-memos-label`
**Created**: 2025-11-04
**Status**: Draft
**Input**: User description: "tasksとmemosにlabelで検索できる機能を作りたい。UIはGitHubと一緒。label:bugのように検索する。commaで複数選択できる。taskの場合はstatusでも同様に検索できる。APIとCLIでも同様にできないといけない。"

## Clarifications

### Session 2025-11-04

- Q: 無効なステータス値のエラー処理 - Web UI、API、CLIで無効なステータス値（例: `status:invalid`）が入力された場合、システムはどのように動作すべきか？ → A: エラーメッセージを表示し、有効なステータス値のリストを示す（Web UI: 画面上にエラー表示、API: 400 Bad Requestレスポンス、CLI: stderr出力）
- Q: ページネーションのデフォルト設定 - APIで大量の結果を返す場合のページネーション設定（デフォルトページサイズと最大ページサイズ）はどうすべきか？ → A: デフォルト: 100件、最大: 1000件（クエリパラメータ `limit` と `offset` で制御）
- Q: Web UI での無効な検索構文のエラー処理 - ユーザーが無効な検索構文（例: `label:` や `status` のみ）を入力した場合、Web UI はどのように動作すべきか？ → A: 全件を表示し、検索ボックス下に控えめなヒントを表示する（例: "Example: label:bug status:open"）。入力中のユーザー体験を妨げない
- Q: メモ検索でのステータスフィルター処理 - メモ検索画面でユーザーが `status:open` のようなステータスフィルターを入力した場合、システムはどのように動作すべきか？ → A: ステータスフィルターを無視してメモを表示し、検索ボックス下に警告を表示する（例: "Note: Status filters do not apply to memos"）。APIは `status` パラメータを無視し、CLIは警告メッセージを出力
- Q: Web UI 検索送信のトリガー - ユーザーが検索ボックスに入力する際、いつ検索を実行すべきか？ → A: Enterキー押下時のみ検索を実行。GitHubの実装と同様に、明示的な送信アクションを要求することで、ユーザーが意図しない検索処理の発生を防ぐ

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Tasks by Single Label (Priority: P1)

As a user, I want to search my tasks by a single label so that I can quickly find all tasks related to a specific category (e.g., bugs, features, documentation).

**Why this priority**: This is the core functionality that provides immediate value. Users can filter their task list by typing `label:bug` to see only bug-related tasks, which is essential for focused work sessions.

**Independent Test**: Can be fully tested by creating tasks with various labels, entering `label:bug` in the search box, and verifying only tasks with the "bug" label are displayed.

**Acceptance Scenarios**:

1. **Given** I have tasks with labels "bug", "enhancement", and "documentation", **When** I type `label:bug` in the search box and press Enter, **Then** only tasks with the "bug" label are displayed
2. **Given** I have tasks with mixed labels, **When** I type `label:enhancement` and press Enter, **Then** only tasks with the "enhancement" label are displayed
3. **Given** I type `label:nonexistent` and press Enter, **When** no tasks have this label, **Then** an empty list is displayed with a message "No tasks found"

---

### User Story 2 - Search Memos by Single Label (Priority: P1)

As a user, I want to search my memos by a single label so that I can quickly find all memos related to a specific topic.

**Why this priority**: Memos and tasks share the same label system, so this provides consistent search functionality across both item types. This is equally critical for users who rely on memos for capturing ideas and notes.

**Independent Test**: Can be fully tested by creating memos with various labels, entering `label:idea` in the memo search box, and verifying only memos with the "idea" label are displayed.

**Acceptance Scenarios**:

1. **Given** I have memos with labels "idea", "meeting-notes", and "todo", **When** I type `label:idea` in the search box and press Enter, **Then** only memos with the "idea" label are displayed
2. **Given** I have memos with different labels, **When** I type `label:meeting-notes` and press Enter, **Then** only memos with the "meeting-notes" label are displayed
3. **Given** I type `label:nonexistent` and press Enter, **When** no memos have this label, **Then** an empty list is displayed with a message "No memos found"

---

### User Story 3 - Search by Multiple Labels (Priority: P2)

As a user, I want to search for tasks or memos that have any of multiple labels by using comma-separated syntax (e.g., `label:bug,enhancement`) so that I can view items from multiple categories at once.

**Why this priority**: This enhances the basic search functionality by allowing OR-based filtering, which is common when reviewing multiple related categories (e.g., all bugs and enhancements for a sprint planning session).

**Independent Test**: Can be tested independently by creating items with various labels, entering `label:bug,enhancement` in the search box, and verifying items with either the "bug" OR "enhancement" label are displayed.

**Acceptance Scenarios**:

1. **Given** I have tasks with labels "bug", "enhancement", and "documentation", **When** I type `label:bug,enhancement` and press Enter, **Then** tasks with either "bug" OR "enhancement" labels are displayed
2. **Given** I have memos with labels "idea", "meeting-notes", and "todo", **When** I type `label:idea,todo` and press Enter, **Then** memos with either "idea" OR "todo" labels are displayed
3. **Given** I type `label:bug,nonexistent` and press Enter, **When** some items have "bug" label, **Then** only items with the "bug" label are displayed (non-existent labels are ignored)

---

### User Story 4 - Search Tasks by Status (Priority: P2)

As a user, I want to search my tasks by status (e.g., `status:open`, `status:closed`) so that I can filter my task list by completion state.

**Why this priority**: Status filtering is essential for task management workflows, allowing users to focus on active tasks or review completed work. This is task-specific functionality that complements label search.

**Independent Test**: Can be tested independently by creating tasks with different statuses, entering `status:open` in the search box, and verifying only open tasks are displayed.

**Acceptance Scenarios**:

1. **Given** I have both open and closed tasks, **When** I type `status:open` and press Enter, **Then** only open tasks are displayed
2. **Given** I have both open and closed tasks, **When** I type `status:closed` and press Enter, **Then** only closed tasks are displayed
3. **Given** I type an invalid status like `status:invalid` and press Enter, **When** the system doesn't recognize the status, **Then** an error message is displayed showing the list of valid status values (e.g., "Invalid status 'invalid'. Valid values: open, next, waiting, scheduled, done, canceled")

---

### User Story 5 - Combine Label and Status Search (Priority: P3)

As a user, I want to combine label and status filters (e.g., `label:bug status:open`) so that I can narrow down my task list to specific categories and states.

**Why this priority**: This provides advanced filtering capabilities for power users who want to combine multiple criteria. While useful, basic single-filter search provides most of the value.

**Independent Test**: Can be tested independently by creating tasks with various labels and statuses, entering `label:bug status:open`, and verifying only open tasks with the "bug" label are displayed.

**Acceptance Scenarios**:

1. **Given** I have tasks with various labels and statuses, **When** I type `label:bug status:open` and press Enter, **Then** only open tasks with the "bug" label are displayed
2. **Given** I type `label:bug,enhancement status:closed` and press Enter, **When** tasks exist matching the criteria, **Then** only closed tasks with either "bug" or "enhancement" labels are displayed
3. **Given** I type combined filters with no matches and press Enter, **When** no tasks meet all criteria, **Then** an empty list with "No tasks found" message is displayed

---

### User Story 6 - API: Filter Tasks and Memos by Label (Priority: P1)

As a developer or automation script, I want to filter tasks and memos by label via API query parameters so that I can programmatically retrieve filtered data for integrations and automated workflows.

**Why this priority**: API access is critical for automation, integrations, and third-party tools. This ensures feature parity across all interfaces (Web UI, API, CLI).

**Independent Test**: Can be fully tested by making API requests with label query parameters (e.g., `GET /api/tasks?label=bug` or `GET /api/tasks?label=bug,enhancement`) and verifying the response contains only matching items.

**Acceptance Scenarios**:

1. **Given** the database has tasks with various labels, **When** I send `GET /api/tasks?label=bug`, **Then** the API returns only tasks with the "bug" label in JSON format
2. **Given** the database has memos with various labels, **When** I send `GET /api/memos?label=idea`, **Then** the API returns only memos with the "idea" label
3. **Given** I send `GET /api/tasks?label=bug,enhancement`, **Then** the API returns tasks with either "bug" OR "enhancement" labels (OR logic for comma-separated values)
4. **Given** I send `GET /api/tasks?label=nonexistent`, **When** no tasks have this label, **Then** the API returns an empty array

---

### User Story 7 - API: Filter Tasks by Status (Priority: P1)

As a developer or automation script, I want to filter tasks by status via API query parameters so that I can programmatically retrieve open or closed tasks.

**Why this priority**: Status filtering via API is essential for building dashboards, reports, and automation tools that need to query tasks by their completion state.

**Independent Test**: Can be fully tested by making API requests with status query parameters (e.g., `GET /api/tasks?status=open`) and verifying the response contains only matching tasks.

**Acceptance Scenarios**:

1. **Given** the database has both open and closed tasks, **When** I send `GET /api/tasks?status=open`, **Then** the API returns only open tasks
2. **Given** the database has both open and closed tasks, **When** I send `GET /api/tasks?status=closed`, **Then** the API returns only closed tasks
3. **Given** I send `GET /api/tasks?label=bug&status=open`, **When** combining label and status filters, **Then** the API returns only open tasks with the "bug" label (AND logic for different filter types)

---

### User Story 8 - CLI: Filter Tasks and Memos by Label (Priority: P1)

As a command-line user, I want to filter tasks and memos by label using CLI flags so that I can quickly query filtered data from the terminal.

**Why this priority**: CLI is a primary interface for power users and automation scripts. Consistent filtering capabilities across all interfaces (Web, API, CLI) is essential for user experience.

**Independent Test**: Can be fully tested by running CLI commands with label filters (e.g., `mgtd task list --label bug` or `mgtd task list --label bug,enhancement`) and verifying the output shows only matching items.

**Acceptance Scenarios**:

1. **Given** I have tasks with various labels, **When** I run `mgtd task list --label bug`, **Then** the CLI displays only tasks with the "bug" label
2. **Given** I have memos with various labels, **When** I run `mgtd memo list --label idea`, **Then** the CLI displays only memos with the "idea" label
3. **Given** I run `mgtd task list --label bug,enhancement`, **Then** the CLI displays tasks with either "bug" OR "enhancement" labels (OR logic for comma-separated values)
4. **Given** I run `mgtd task list --label nonexistent`, **When** no tasks have this label, **Then** the CLI displays an empty list or "No tasks found" message

---

### User Story 9 - CLI: Filter Tasks by Status (Priority: P1)

As a command-line user, I want to filter tasks by status using CLI flags so that I can quickly view open or closed tasks from the terminal.

**Why this priority**: Status filtering is a fundamental task management feature that must be available in the CLI for consistency and usability.

**Independent Test**: Can be fully tested by running CLI commands with status filters (e.g., `mgtd task list --status open`) and verifying the output shows only matching tasks.

**Acceptance Scenarios**:

1. **Given** I have both open and closed tasks, **When** I run `mgtd task list --status open`, **Then** the CLI displays only open tasks
2. **Given** I have both open and closed tasks, **When** I run `mgtd task list --status closed`, **Then** the CLI displays only closed tasks
3. **Given** I run `mgtd task list --label bug --status open`, **When** combining label and status filters, **Then** the CLI displays only open tasks with the "bug" label (AND logic for different filter types)

---

### Edge Cases

- **What happens when a search query is empty?** All items (tasks or memos) should be displayed without any filtering
- **What happens when a user types an invalid search syntax in Web UI?** User can continue typing without interruption. When they submit (press Enter), display all items without filtering and show a subtle hint below the search box with example syntax (e.g., "Example: label:bug status:open"). Hint is positioned absolutely to prevent layout shifts
- **What happens when a user types an invalid status value?** System should display an error message with the list of valid status values (e.g., "Invalid status 'invalid'. Valid values: open, next, waiting, scheduled, done, canceled")
- **How does the system handle case sensitivity in label names?** Search should be case-insensitive (e.g., `label:BUG` matches items with "bug" label)
- **What happens when a task/memo has multiple labels and user searches for one?** The item should appear in results if it has at least one matching label
- **What happens when combining status filters with memo search?** Status filter is ignored for memos (since memos don't have status) and a warning is displayed to inform the user (Web UI: subtle warning below search box, API: silently ignores parameter, CLI: warning message to stderr)
- **What happens with leading/trailing spaces in search query?** System should trim whitespace and treat `label: bug` the same as `label:bug`
- **What happens when a label name contains special characters or spaces?** System should handle quoted labels (e.g., `label:"needs review"`) or escape special characters
- **What happens when API receives invalid query parameter values?** API should return appropriate HTTP error status (e.g., 400 Bad Request) with error details in response body
- **What happens when API receives multiple conflicting filters?** API should apply all filters with AND logic (e.g., `?label=bug&status=open` means bugs AND open)
- **What happens when CLI receives unknown flag options?** CLI should display helpful error message showing valid flag options
- **What happens when API/CLI filtering results in very large result sets?** API supports pagination with default limit of 100 items (maximum 1000 items per request). CLI respects existing `--limit` flag (if available) or returns all matching results with performance warning for large datasets
- **How should API handle URL encoding for label names with special characters?** API should properly decode URL-encoded query parameters (e.g., `label=needs%20review`)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a search box in both Tasks and Memos views that accepts text input for filtering
- **FR-002**: System MUST support `label:labelname` syntax for filtering items by a single label
- **FR-003**: System MUST support comma-separated label syntax `label:label1,label2,label3` for OR-based filtering (items matching ANY of the specified labels)
- **FR-004**: System MUST support `status:statusvalue` syntax for filtering tasks by status (e.g., `status:open`, `status:closed`)
- **FR-005**: System MUST allow combining label and status filters in a single search query (e.g., `label:bug status:open`)
- **FR-006**: System MUST perform case-insensitive matching for label names (e.g., `label:BUG` matches "bug")
- **FR-007**: System MUST ignore status filters when applied to memos (status is task-specific) and display a warning to the user (Web UI: subtle warning below search box, CLI: warning to stderr)
- **FR-008**: System MUST display all items when the search box is empty
- **FR-009**: System MUST display an appropriate message when no items match the search criteria
- **FR-010**: System MUST share the same label system between tasks and memos (labels are common/shared)
- **FR-011**: System MUST execute search only when user explicitly submits (Enter key press) to prevent unintended search operations during typing
- **FR-012**: System MUST preserve the search query in the URL so that users can bookmark or share filtered views
- **FR-013**: System MUST handle whitespace gracefully by trimming leading/trailing spaces from search terms
- **FR-014**: System MUST support label names containing spaces using quoted syntax (e.g., `label:"needs review"`)
- **FR-015**: Search interface MUST follow GitHub-style UI patterns:
  - Search input with integrated search icon (left side) using React Icons
  - Clear button icon (right side) using React Icons when input has value
  - Search input and action button (e.g., "New Task") on the same horizontal line
  - English text for UI elements (placeholders, hints, buttons)
  - No emoji characters in production UI
  - Input submits on Enter key press only (no auto-search during typing)
- **FR-015a**: Web UI MUST display an error message when an invalid status value is entered, showing the list of valid status values
- **FR-015b**: Web UI MUST display all items (without filtering) when invalid search syntax is entered, with a subtle hint showing example syntax below the search box (e.g., "Example: label:bug status:open")
- **FR-015c**: Web UI MUST position validation hints absolutely to prevent layout shifts when hint appears/disappears
- **FR-015d**: Web UI MUST NOT block or interrupt user input with error dialogs during typing (graceful degradation approach)

#### API Requirements

- **FR-016**: API MUST support `label` query parameter for filtering tasks and memos (e.g., `GET /api/tasks?label=bug`)
- **FR-017**: API MUST support comma-separated values in `label` query parameter for OR-based filtering (e.g., `GET /api/tasks?label=bug,enhancement`)
- **FR-018**: API MUST support `status` query parameter for filtering tasks (e.g., `GET /api/tasks?status=open`)
- **FR-019**: API MUST support combining `label` and `status` query parameters with AND logic (e.g., `GET /api/tasks?label=bug&status=open`)
- **FR-020**: API MUST perform case-insensitive matching for label names in query parameters
- **FR-021**: API MUST properly decode URL-encoded query parameter values
- **FR-022**: API MUST return 400 Bad Request with error details for invalid query parameters, including a description of the error and list of valid values (e.g., `{"error": "Invalid status value", "details": "status must be one of: open, next, waiting, scheduled, done, canceled"}`)
- **FR-023**: API MUST return empty array when no items match the filter criteria (not an error)
- **FR-024**: API MUST silently ignore `status` query parameter for memo endpoints (status is task-specific) and return memos based on other filters without error
- **FR-024a**: API MUST support `limit` query parameter to control the number of results returned (default: 100, maximum: 1000)
- **FR-024b**: API MUST support `offset` query parameter for pagination (default: 0)
- **FR-024c**: API MUST return pagination metadata in response headers or body (e.g., `X-Total-Count`, `X-Page-Size`, `X-Offset`)

#### CLI Requirements

- **FR-025**: CLI `task list` command MUST support `--label` flag for filtering by label (e.g., `mgtd task list --label bug`)
- **FR-026**: CLI `memo list` command MUST support `--label` flag for filtering by label (e.g., `mgtd memo list --label idea`)
- **FR-027**: CLI MUST support comma-separated values in `--label` flag for OR-based filtering (e.g., `mgtd task list --label bug,enhancement`)
- **FR-028**: CLI `task list` command MUST support `--status` flag for filtering by status (e.g., `mgtd task list --status open`)
- **FR-029**: CLI MUST support combining `--label` and `--status` flags with AND logic (e.g., `mgtd task list --label bug --status open`)
- **FR-030**: CLI MUST perform case-insensitive matching for label names in flag values
- **FR-031**: CLI MUST display helpful error message for invalid flag values, including the list of valid options (e.g., "Error: Invalid status 'invalid'. Valid options: open, next, waiting, scheduled, done, canceled")
- **FR-032**: CLI MUST display appropriate message when no items match the filter criteria (e.g., "No tasks found")
- **FR-033**: CLI MUST respect existing output format flags (e.g., `--json`) when filtering results
- **FR-033a**: CLI MUST output a warning message to stderr when `--status` flag is used with `mgtd memo list` command (e.g., "Warning: --status flag is ignored for memos")

### Key Entities

- **Task**: Work items with title, description, status (open/closed), labels (zero or more), and other metadata
- **Memo**: Note items with body text, labels (zero or more), and other metadata
- **Label**: Shared categorization tags with name and color properties that can be applied to both tasks and memos
- **Search Query**: User input string containing filter expressions (e.g., `label:bug status:open`) that determines which items are displayed

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can filter tasks by a single label and see results in under 1 second for lists up to 1000 items
- **SC-002**: Users can filter memos by a single label and see results in under 1 second for lists up to 1000 items
- **SC-003**: Users can combine multiple labels using comma syntax and see accurate OR-based filtering results
- **SC-004**: Users can filter tasks by status and see only items matching the specified status
- **SC-005**: Users can combine label and status filters in tasks view and see items matching all specified criteria
- **SC-006**: 95% of search queries return results instantly without perceivable delay (under 300ms after Enter key press)
- **SC-007**: Search functionality reduces time to find specific items by at least 70% compared to manual scrolling through lists
- **SC-008**: Zero data loss or corruption when applying filters (filtering is read-only operation)
- **SC-009**: Users can bookmark filtered views and return to the same filtered state when accessing the bookmark
- **SC-010**: Search interface is visually consistent with GitHub's issue search UI:
  - Search icon integrated into input field (left side)
  - Clear button appears when input has value (right side)
  - Search input and "New Task" button on same horizontal line
  - All text in English
  - No emoji characters in UI
  - Validation hints positioned absolutely to prevent layout shifts
- **SC-011**: API returns filtered results in under 500ms for datasets up to 1000 items
- **SC-012**: API correctly filters tasks and memos by label with 100% accuracy (no false positives or false negatives)
- **SC-013**: API correctly combines label and status filters with AND logic (all specified criteria must match)
- **SC-014**: CLI commands with filter flags execute and display results in under 2 seconds for datasets up to 1000 items
- **SC-015**: CLI correctly filters tasks and memos by label with 100% accuracy (no false positives or false negatives)
- **SC-016**: CLI provides consistent output format when filtering (filtered results match unfiltered output structure)
- **SC-017**: Filtering functionality is consistent across all three interfaces (Web UI, API, CLI) - same query produces same results
- **SC-018**: API supports pagination for large result sets with default page size of 100 items, maximum 1000 items per request, and returns results within performance targets (under 500ms for 1000 items)
- **SC-019**: Zero breaking changes to existing API endpoints or CLI commands (backward compatibility maintained)
- **SC-020**: Documentation clearly explains filter syntax for all three interfaces (Web, API, CLI) with examples

### Assumptions

- Labels already exist in the system and can be assigned to both tasks and memos
- Task statuses follow standard values like "open", "closed" (or equivalent states defined in the system)
- The existing UI framework supports dynamic filtering and URL state management
- Performance is acceptable for typical user data volumes (up to 1000 items per view)
- Users are familiar with GitHub-style search syntax or can learn it quickly through examples/documentation
- API endpoints already exist for listing tasks and memos (`GET /api/tasks`, `GET /api/memos`)
- CLI commands already exist for listing tasks and memos (`mgtd task list`, `mgtd memo list`)
- Database schema supports efficient querying by labels and status (indexed appropriately)
- API framework supports query parameter parsing and validation
- CLI framework supports flag parsing and validation (e.g., using a standard argument parser)
- Existing API pagination implementation can be extended to support filtered result sets (with default limit of 100 items, maximum 1000 items)
- System maintains consistent data model across all interfaces (Web, API, CLI)
