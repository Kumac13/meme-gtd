# Changelog

## 0.19.1 - 2025-12-22

### Bug Fixes

- **Search Console**: Fixed critical issues with search functionality.
  - Resolved a race condition where search input was ignored/cleared immediately.
  - Fixed filtering logic to correctly search across all statuses (e.g. Inbox) when a label or search term is present, instead of being restricted to "Next" tasks by default.
  - Removed strict blocking on validation errors to allow forced search submission.

## 0.18.0 - 2025-12-11

### New Features

- **Activity Log (Event Sourcing)**: Track all user actions as immutable event log.
  - **Database**: New `activity_log` table with append-only design
    - Generated columns for efficient filtering (`issue_id`, `project_id`, `label_id`)
    - SQLite triggers enforce immutability (UPDATE/DELETE blocked)
  - **Event Types**: 20+ event types covering all entities
    - Task: `task.created`, `task.updated`, `task.status_changed`, `task.deleted`, `task.bookmarked`
    - Memo: `memo.created`, `memo.updated`, `memo.promoted`, `memo.deleted`, `memo.bookmarked`
    - Project: `project.created`, `project.updated`, `project.deleted`, `project.item_added`, `project.item_removed`
    - Label: `label.created`, `label.deleted`, `label.assigned`, `label.removed`
    - Link: `link.created`, `link.deleted`
    - Comment: `comment.created`, `comment.updated`, `comment.deleted`
  - **Diff Logging**: Update events capture `{ old, new }` values for change tracking
  - **Full Text Storage**: Complete body text stored (no truncation)
  - **Snapshotting**: Related entity names captured at event time
  - **API**: New `GET /api/activity-log` endpoint with filtering
    - Filter by: `issueId`, `projectId`, `labelId`, `eventType`, `sourceType`
    - Date range: `from`, `to`
    - Pagination: `limit`, `offset`, `order`
  - **Core Integration**: ActivityLogger integrated into all services
    - MemoService, TaskService, ProjectService, LabelService, LinkService
    - Transaction boundaries ensure consistency

## 0.17.0 - 2025-12-07

### New Features

- **Calendar Datetime Separation**: Separate scheduled (planned) times from actual (executed) times.
  - **Database Migration**: New fields in `issues` table:
    - `scheduled_start`, `scheduled_end` (ISO 8601 datetime): Planned schedule
    - `is_all_day` (boolean): All-day event flag
    - `actual_start`, `actual_end` (ISO 8601 datetime): Actual execution times
    - `notify_before_minutes` (integer): Future notification support
  - **Auto-migration**: Existing `scheduled_on`/`start_time` data automatically migrated
  - **Legacy Support**: Old fields kept for backward compatibility but deprecated
  - **CLI**: New scheduling options for `task create` and `task edit`
    - `--scheduled-start`, `--scheduled-end`: Set planned times (ISO 8601)
    - `--actual-start`, `--actual-end`: Record execution times
    - `--all-day`, `--no-all-day`: Toggle all-day event
  - **Web UI**:
    - TaskForm and ScheduleSection updated for new datetime fields
    - Calendar displays scheduled time with fallback to actual time
    - Completed tasks shown at their scheduled position
  - **Calendar Display Rules**:
    - Priority: scheduled_start > actual_start
    - Fallback: If no scheduled_end, use actual_end
    - All-day events displayed as date range without time

- **Safe Database Migration Command**: `mgtd db migrate` for applying migrations without data loss.
  - Automatic timestamped backup before migration
  - Dry-run mode with `--dry-run`
  - JSON output for scripting with `--json`
  - Skip backup with `--no-backup`
  - Idempotent: already applied migrations are skipped

### Bug Fixes

- **iOS Safari datetime input**: Fixed current time auto-fill issue with `autoComplete="off"` and unique input names

## 0.16.0 - 2025-12-06

### New Features

- **Image Attachments**: Upload and attach images to memos, tasks, and projects.
  - **Storage**: Images stored in flat structure at `~/.mgtd/attachments/{uuid}.{ext}` (PNG, JPEG, GIF, WebP supported, max 10MB)
  - **Web UI**: Paste images (Cmd+V) or drag & drop directly onto any textarea
    - Supported in MemoForm, TaskForm, ProjectForm, EditableContent, CommentSection
    - Visual feedback during drag and upload progress indicator
  - **API**: New attachment endpoints
    - `POST /api/attachments`: Upload image file
    - `GET /api/attachments/:filename`: Download image file
  - **CLI**: Absolute paths in markdown output for Claude Code compatibility

## 0.15.0 - 2025-11-29

### New Features

- **Task Demote to Memo**: Copy a task's content to create a new memo while keeping the original task unchanged.
  - **Database**: Added `demoteTask` function that creates a memo from task content (title, body, comments).
    - Auto-generates memo body with title as heading and comments in chronological order
    - Creates `derived_from` link from new memo to original task
    - Inherits labels, projects, and existing links from the original task
  - **CLI**: New `mgtd task demote` command with editor support.
    - `mgtd task demote <id>`: Opens editor with auto-generated content
    - `mgtd task demote <id> --no-editor`: Skip editor, use auto-generated content
    - `mgtd task demote <id> --body "content"`: Provide custom body
    - `mgtd task demote <id> --body-file notes.md`: Load body from file
    - `mgtd task demote <id> --label doc`: Override labels
  - **Web UI**: Added "Archive to Memo" button to TaskDetail page.
    - Navigate to editing screen before saving (like Promote to Task pattern)
    - Inherit labels, projects, and links with option to remove before saving
  - **API**: New `POST /api/tasks/:id/demote` endpoint.
    - Optional `bodyMd` and `labels` parameters
    - Returns original task and new memo ID
    - Automatically copies all existing links to the new memo

### Bug Fixes

- **API**: Added missing `endDate` parameter to `CreateTaskRequestSchema`.
- **Tests**: Fixed incorrect default status assertion in task creation test (expected `inbox`, not `open`).

## 0.14.0 - 2025-11-24

### New Features

- **Project Status and Schedule Management**: Complete project lifecycle tracking with status and date management.
  - **Database**: Added `status`, `start_date`, `end_date` columns to `projects` table.
    - Status options: `planned`, `active`, `paused`, `done`, `canceled`
    - Date validation triggers ensure `start_date <= end_date`
  - **CLI**: Enhanced project commands with status and schedule support.
    - `mgtd project create --status active --start-date 2025-01-01 --end-date 2025-12-31`
    - `mgtd project update <id> --status done`: New command for updating projects
    - `mgtd project list --status active`: Filter projects by status
    - `mgtd project view`: Display status and schedule information
  - **Web UI**:
    - Status selector in ProjectDetail header with custom dropdown styling
    - ProjectScheduleSection component matching TaskDetail UX pattern
    - ProjectsList status filter (defaults to 'active')
    - Removed bookmark filter from projects (not applicable to projects)
    - Shared StatusSelector component for consistent UI across Project/Task forms
  - **API**:
    - Updated project schemas with Zod validation for status and dates
    - PATCH `/api/projects/:id` supports status and schedule updates
    - OpenAPI specification updated with new fields

### Improvements

- **UI Consistency**: Created shared StatusSelector component used across ProjectDetail, TaskDetail, and forms
- **Better UX**: Status dropdown icon properly positioned with `pr-2` spacing
- **Code Quality**: Eliminated duplicate status selector implementations

## 0.13.0 - 2025-11-20

### New Features

- **Task Scheduling Enhancement**: Support for start time, end time, and duration.
  - **Database**: Added `start_time`, `end_time`, `duration` columns to `issues` table.
  - **CLI**: Added `--start`, `--end`, `--duration` flags to `task create` and `task edit`.
    - Auto-calculation of end time based on start time and duration.
    - `task view` displays formatted schedule (e.g., "2025-11-20 10:00 - 11:00 (60 min)").
  - **Web UI**:
    - `ScheduleSection` now supports time and duration inputs.
    - Visual display of full schedule details.
  - **API**:
    - Updated `Task` schema to include time fields.
    - Auto-calculation logic implemented in backend.

## 0.12.0 - 2025-11-19

### New Features

- **Inbox and Someday Task Statuses (#81)**: Complete GTD workflow support with two new task statuses
  - **New Statuses**:
    - `inbox`: For newly captured, unprocessed tasks (GTD capture phase)
    - `someday`: For deferred, non-actionable ideas (GTD someday/maybe list)
  - **CLI Enhancements**:
    - `mgtd task create --status inbox`: Create tasks in inbox for later triage
    - `mgtd task edit <id> --status someday`: Defer tasks to someday list
    - `mgtd task list --status inbox`: Filter by inbox or someday status
    - All 8 statuses now available: inbox, open, next, waiting, scheduled, someday, done, canceled
  - **Web UI**:
    - Status dropdown includes Inbox and Someday options in task edit/create forms
    - Status filter bar includes Inbox and Someday filter buttons
    - Project kanban view includes Inbox and Someday columns
    - Task list status labels include Inbox and Someday
    - Search input supports status:inbox and status:someday queries
    - URL filtering: `/tasks?status=inbox` and `/tasks?status=someday`
    - Memo promotion now defaults to status='inbox' (was 'open')
    - All validation functions updated to accept inbox/someday
  - **API**:
    - All endpoints accept inbox/someday: POST/PUT/GET `/api/tasks`
    - OpenAPI specification updated with new status values
    - Backward compatible: Existing 'open' tasks preserved unchanged
  - **GTD Workflow Order**: inbox → open → next → waiting → scheduled → someday → done → canceled
  - **User Benefits**:
    - Separate task capture from processing (inbox)
    - Park future ideas without cluttering active lists (someday)
    - Full GTD workflow compliance
    - No automatic migration (existing data unchanged)

---

## 0.11.0 - 2025-11-11

### New Features

- **Keyboard Shortcuts for Save and Comment Actions (#78)**: Add Cmd/Ctrl+Enter shortcuts for improved productivity
  - **Web UI Enhancements**:
    - Cmd+Enter (macOS) / Ctrl+Enter (Windows/Linux) keyboard shortcuts for all Save and Comment buttons
    - Works across all forms: TaskForm, MemoForm, ProjectForm, EditableContent, CommentSection
    - OS-aware tooltips showing correct shortcut (⌘+Enter or Ctrl+Enter)
    - `aria-keyshortcuts` attributes for screen reader accessibility
    - Prevents duplicate submissions during form submission
    - Respects existing form validation
  - **Core Infrastructure**:
    - Reusable `keyboard.ts` utilities for OS detection and shortcut handling
    - `useKeyboardShortcut` custom React hook for DRY implementation
    - Comprehensive test coverage (20 tests, all passing)
  - **User Benefits**:
    - Keyboard-focused workflow without mouse interaction
    - Faster task, memo, and project creation
    - Quick comment submission
    - Improved productivity for power users

### Bug Fixes

- Fixed KanbanView TypeError when navigating to newly created projects (undefined `project.items`)

### Documentation

- Added comprehensive feature specification in `specs/026-webui-save-comment/`
- Updated developer quickstart guide with keyboard shortcut implementation patterns

### Breaking Changes

None. All changes are backward compatible and additive only.

---

## 0.10.0 - 2025-11-04

### New Features

- **Label and Status Search (#71)**: Unified search and filtering across all interfaces with GitHub-style syntax
  - **Web UI**:
    - GitHub-style search input component with `label:value` and `status:value` syntax
    - Enter key submission for explicit search execution
    - Real-time syntax validation with helpful hints
    - Support for comma-separated labels with OR logic (`label:bug,enhancement`)
    - React Icons integration (IoSearch, IoClose)
    - Absolute positioning for hints to prevent layout shifts
    - Warning when using status filters on memos
    - Horizontal layout matching GitHub's design
    - English-only UI text
  - **CLI Commands**:
    - `mgtd task list --label bug,enhancement --status open` - Filter tasks by multiple labels and status
    - `mgtd memo list --label idea,meeting-notes` - Filter memos by multiple labels
    - Comma-separated labels for OR logic
    - Full backward compatibility
  - **API Endpoints**:
    - `GET /api/tasks?label=bug,enhancement&status=open` - Query parameter filtering for tasks
    - `GET /api/memos?label=idea,meeting-notes` - Query parameter filtering for memos
    - Comma-separated label parameters
    - Query parameter validation
  - **Database Layer**:
    - Multi-label filtering with OR logic using SQL `IN` clauses
    - Case-insensitive label matching
    - Efficient query optimization

### Documentation

- Added comprehensive filtering documentation:
  - `docs/cli-commands.md` - CLI filtering reference with examples
  - `docs/api-filtering.md` - API filtering guide with integration examples (Python, JavaScript, Shell)
  - `README.md` - Search and filtering section covering all interfaces
  - Feature specification in `specs/024-tasks-memos-label/`

### Bug Fixes

- Fixed infinite loop in TasksList component by using primitive dependency in useEffect
- Changed from auto-search to explicit Enter key submission to prevent focus loss
- Fixed layout shifts when validation hints appear by using absolute positioning

### Breaking Changes

None. All changes are backward compatible.

## 0.9.0 - 2025-10-25

### New Features

- **Project Management System (#19)**: Complete project management with CLI commands and API endpoints
  - **CLI Commands**:
    - `mgtd project create <name>` - Create projects with board or table views
    - `mgtd project list` - List all projects
    - `mgtd project view <id>` - View project details with items ordered by position
    - `mgtd project add <project-id> <issue-id>` - Add tasks/memos to projects
    - `mgtd project remove <project-id> <issue-id>` - Remove items from projects (with confirmation)
    - `mgtd project move <project-id> <issue-id>` - Reorder items with fractional positioning
    - `mgtd project delete <id>` - Delete projects (with confirmation)
  - **API Endpoints**:
    - `POST /api/projects` - Create project (201/409)
    - `GET /api/projects` - List all projects (200)
    - `GET /api/projects/:id` - Get project with items (200/404)
    - `POST /api/projects/:id/items` - Add item to project (201/404/409)
    - `PATCH /api/projects/:id/items/:issueId` - Update item position/column (200/404)
    - `DELETE /api/projects/:id/items/:issueId` - Remove item from project (204/404)
    - `DELETE /api/projects/:id` - Delete project (204/404)
  - **Features**:
    - Board view with customizable columns (default: To Do, In Progress, Done)
    - Table view for simple list organization
    - Fractional positioning for flexible item ordering (1.0, 1.5, 2.0, etc.)
    - Cascade deletion: deleting projects removes items but preserves issues
    - Interactive confirmation prompts with TTY detection
    - `--yes` flag for non-interactive mode (CI/CD friendly)
    - Full JSON output support for all CLI commands
    - Comprehensive error handling (duplicate names, not found, etc.)
    - OpenAPI 3.0 documentation in Swagger UI

### Database

- **Migration 002**: Added `view_meta` column to `projects` table
  - Stores JSON configuration for board/table views
  - Auto-applied on first command execution via `ensureDatabase()`

### API Changes

- Added "Projects" tag to OpenAPI documentation
- All project endpoints follow existing error response patterns

## 0.8.0 - 2025-10-24

### New Features

- **Link Management Web Interface (#43)**: Added complete link management UI to Web application
  - **View existing links (US1)**: Display all links for tasks and memos inline with collapsible section
    - Shows link type with icons (parent, child, related, derived from)
    - Displays direction indicators (outgoing/incoming)
    - Renders target issue titles as clickable links
    - Handles deleted issues with grayed-out styling
    - Auto-expand/collapse based on link count
    - Loading states and error handling with retry button
  - **Create new links (US2)**: Inline form for creating links without modal dialogs
    - Multi-step flow: Select link type → Enter target issue ID
    - Four link types: parent, child, relates, derived_from
    - Client-side validation (numeric ID, no self-reference)
    - API error handling with inline error messages
    - Disabled state during submission with loading indicator
  - **Delete links (US3)**: Inline confirmation for link deletion
    - Click [×] button to show confirmation prompt
    - Inline "Delete this link? [Confirm] [Cancel]" prompt
    - Loading state during deletion
    - Auto-refresh link list after deletion
    - Updates link count in section header
  - **Edge case handling**:
    - Deleted target issues displayed in gray without navigation link
    - Long titles truncated at 100 characters with hover tooltip
    - Empty states with appropriate messaging
    - Concurrent operation handling with disabled states

### Implementation Details

- **New Components** (packages/web/src/components/):
  - `LinkSection.tsx`: Main container for link management
  - `LinkItem.tsx`: Individual link display with delete functionality
  - `AddLinkInline.tsx`: Multi-step inline form for link creation
- **New Types** (packages/web/src/types/links.ts):
  - `LinkDisplayItem`: Link data with target issue info and direction
  - `LinkCreationState`: Form state management for creation flow
  - `LinkType`, `Direction`: Type definitions for link types and directions
- **New Utilities** (packages/web/src/utils/linkIcons.tsx):
  - `getLinkIcon()`: SVG icon components for each link type and direction
  - `getLinkLabel()`: Human-readable labels for link types
  - `getDirectionArrow()`: Direction indicator arrows
- **Integration** (packages/web/src/components/ItemDetail.tsx):
  - Added `LinkSection` between Labels and Body sections
  - Self-contained component following CommentSection pattern

### User Experience

- **GitHub-inspired UX**: Follows GitHub's sub-issues pattern with inline interactions
- **No modals**: All operations (create, delete) use inline forms and confirmations
- **Consistent styling**: Matches existing Web UI design with TailwindCSS
- **Mobile responsive**: Responsive flex layouts for all screen sizes
- **Performance**: Optimized with React hooks and minimal re-renders

### API Requirements

- Requires API server with link management endpoints (added in v0.6.0)
- Uses `/api/issues/:id/links` with target issue information (v0.7.0)
- Compatible with link type filtering and validation (v0.7.0)

## 0.7.0 - 2025-10-22

### New Features

- **Link Validation Enhancements (FR-013, FR-014)**: Enhanced link creation with hierarchy integrity validations
  - **Circular hierarchy detection (FR-013)**: Prevents creating cycles in parent-child relationships
    - Blocks circular links like A→B→C→A that would corrupt task hierarchies
    - Uses Recursive CTE to traverse ancestor chains up to 10 levels deep
    - Only applies to `parent` and `child` link types; `relates` and `derived_from` can still form cycles
    - Error message: "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy"
  - **Inverse duplicate prevention (FR-014)**: Prevents bidirectional parent-child relationships
    - Blocks inverse links like A parent of B + B parent of A
    - Provides more specific error for 2-node cycles than circular detection
    - Only applies to `parent` and `child` link types; `relates` links remain bidirectional by nature
    - Error message: "Cannot create inverse parent-child link: Issue #X is already a Y of Issue #Z"
  - **Validation order**: Self-ref → Source exists → Target exists → Duplicate → Inverse (V5) → Circular (V6)

- **API Feature Parity: Link Type Filtering**: Added `?type=` query parameter to `GET /api/issues/:id/links`
  - Filter links by type: `?type=parent`, `?type=child`, `?type=relates`, `?type=derived_from`
  - Returns 400 error for invalid type values (validated by Zod schema)
  - Achieves full feature parity with CLI `mgtd link list --type` command
  - Example: `GET /api/issues/5/links?type=parent` returns only parent links

- **API Enhancement: Target Issue Information**: Enhanced `GET /api/issues/:id/links` to include target issue details
  - Response now includes `targetIssue` object with `id`, `type`, and `title` fields
  - Eliminates need for additional API calls to fetch target issue information
  - Uses optimized single SQL query to fetch all target issues (avoids N+1 problem)
  - For tasks: title is taken from the task's title field
  - For memos: title is taken from first 100 characters of body_md
  - Enables Web UI to display linked issues with titles without separate API calls

### Implementation Details

- **Database Layer** (packages/db/src/linkRepository.ts):
  - Added `findInverseParentChildLink()`: Detects inverse parent-child relationships
  - Added `hasAncestor()`: Uses Recursive CTE to detect circular hierarchies with depth limit
  - Exported new validation functions from index.ts

- **Service Layer** (packages/core/src/linkService.ts):
  - Enhanced `create()` method with two new validations (V5, V6)
  - Validation runs only for hierarchical types (`parent`, `child`)
  - Non-hierarchical types (`relates`, `derived_from`) skip new validations

- **API Layer** (packages/api):
  - Added `ListLinksQuerySchema` for type filtering
  - Updated `listLinksHandler` to accept and apply query filters
  - Updated route schema with querystring validation and 400 error case
  - Enhanced `LinkWithDirectionSchema` to include `targetIssue` object
  - Modified `listLinksHandler` to fetch target issue information in single SQL query
  - SQL query uses `COALESCE(title, SUBSTR(body_md, 1, 100))` to handle both tasks and memos

### Tests

- **Database Layer**: 47 tests passing (added 3 hasAncestor unit tests)
- **Core Layer**: 33 tests passing (added 8 validation tests)
- **CLI Layer**: 7 tests passing
- **API Layer**: 107 tests passing (added 5 type filtering tests, 1 targetIssue test)
- **Total**: 194 tests passing ✅

### Performance

- Circular detection adds ~20-50ms per parent/child link creation (Recursive CTE query)
- Inverse duplicate check adds <5ms per parent/child link creation (direct SQL query)
- Non-hierarchical links (`relates`, `derived_from`) have no performance impact

### Breaking Changes

None. All enhancements are backward compatible:
- Existing links are grandfathered (not retroactively validated)
- New validations only apply to newly created parent/child links
- API query parameter is optional (defaults to no filtering)

## 0.6.0 - 2025-10-21

### New Features

- **Comment count in list endpoints**: Added `commentCount` field to GET /api/memos and GET /api/tasks responses
  - List endpoints now include the number of non-deleted comments for each memo/task
  - Individual endpoints (GET /api/memos/:id) do not include commentCount as comments are fetched separately
  - Implemented using efficient SQL subquery aggregation to avoid N+1 queries
  - Database layer: Updated `listMemos()` and `listTasks()` to calculate commentCount
  - API layer: Created separate schemas (`MemoListItemSchema`, `TaskListItemSchema`) for list responses
  - All tests passing (DB: 44, Core: 25, API: 101)

## 0.5.0 - 2025-10-18

### New Features

- **リンクコマンドの実装**: タスク・メモ間の関係性を管理する `mgtd link` コマンドを追加しました。
  - `mgtd link add --type <type> --source <id> --target <id>`: issue間のリンクを作成
    - 4つのリンクタイプをサポート: `parent` (親子階層), `child` (逆方向), `relates` (関連性), `derived_from` (派生)
    - バリデーション: 自己参照チェック、重複チェック、ID存在確認
    - `--json` フラグで作成されたリンク情報をJSON形式で出力
  - `mgtd link list <issue-id>`: 指定issueのリンク一覧を表示
    - 双方向検索（sourceとtargetの両方から検索）
    - 方向矢印付き表示（`→` outgoing, `←` incoming）
    - `--type <type>` フラグで特定タイプのみフィルタ
    - `--json` フラグで `direction` フィールド付きJSON配列を出力
  - `mgtd link remove <link-id>`: リンクをIDで削除
    - 対話的な確認プロンプト（リンク内容のプレビュー表示）
    - `--yes` フラグで確認プロンプトをスキップ
    - `--json` フラグで削除結果をJSON形式で出力

### Documentation

- README.md にlinkコマンドを追加
- docs/cli_requirement.md にlink add/list/remove の仕様を追加
- specs/008-https-github-com/ に詳細な設計ドキュメントを追加
  - spec.md: ユーザーストーリーと受け入れ基準
  - plan.md: 技術的実装計画
  - tasks.md: 25タスクの詳細な実装計画（23タスク完了）
  - quickstart.md: 手動テストシナリオ

### Tests

- Repository層テスト（packages/db/test/linkRepository.test.ts）: 14テスト
- Service層テスト（packages/core/test/linkService.test.ts）: 8テスト
- すべてのテストが合格 ✅

## 0.3.0 - 2025-10-15

### Breaking Changes

- **統合ラベル管理システム**: `memo label` および `task label` コマンドを廃止し、統合された `mgtd label` コマンドに置き換えました。
  - 削除されたコマンド: `memo label`, `memo label add`, `memo label set`, `memo label remove`, `task label`, `task label add`, `task label set`, `task label remove`
  - 新しいコマンド: `mgtd label list`, `mgtd label create`, `mgtd label set`, `mgtd label delete`
  - ラベルは memo と task の両方で共通して使用できるようになりました。

### New Features

- **`mgtd label list`**: データベース内の全ラベルを一覧表示します。
  - `--json` フラグで JSON 形式の出力をサポート
- **`mgtd label create <name>`**: 新しいラベルを作成します。
  - `--description` フラグでラベルの説明を追加可能
  - `--json` フラグで作成されたラベル情報を JSON 形式で出力
- **`mgtd label set <issue-id> <label-id>`**: memo または task にラベルを割り当てます。
  - issue-id は memo/task を自動判別
  - 冪等性を保証（重複割り当てでもエラーにならない）
  - `--json` フラグでラベル割り当て情報を JSON 形式で出力
- **`mgtd label delete <name>`**: ラベルを削除します。
  - CASCADE 削除により、関連する全ての issue からラベルが自動的に解除されます
  - `--json` フラグで削除結果を JSON 形式で出力

### Bug Fixes

- **`mgtd label list`**: ラベル ID を表示するように修正しました。
  - 以前は名前のみが表示されており、`mgtd label set` で必要な ID を確認できない問題がありました
  - 現在は `<id>\t<name>` の形式で表示されます（例: `1	bug`）

### Documentation

- README.md に統合ラベルコマンドを追加
- docs/cli_requirement.md のコマンドツリーを更新
- CLAUDE.md に「意味のある単位で小まめにコミットする」「ドキュメント（README.md、docs/）を更新する」の原則を追加

## 0.2.0 - 2025-10-14

### New Features

- **バージョン確認コマンドの追加**: CLIのバージョンを確認する機能を実装しました。
  - `mgtd --version` / `mgtd -v`: バージョン番号を表示
  - `mgtd version`: 詳細なバージョン情報を表示（Node.jsバージョン、プラットフォーム情報）
  - `mgtd version --json`: JSON形式で環境情報を出力

- **バージョン管理戦略のドキュメント化**: Fixed Versioning採用、SemVerルール、リリースプロセスを `docs/versioning.md` に記載しました。
  - README.mdから参照可能

### Tests

- バージョンコマンドの統合テスト（5テスト）を追加
- パフォーマンス検証：すべてのバージョンコマンドが100ms以内で完了

## 0.1.1 - 2025-10-14

### Breaking Changes

- **kebab-case フラグへの統一**: すべての memo コマンドのフラグを GitHub CLI 準拠の kebab-case に変更しました。
  - `--bodyFile` → `--body-file`
  - `--addLabel` → `--add-label`
  - `--removeLabel` → `--remove-label`
  - 旧 camelCase フラグを使用すると、適切なエラーメッセージと新しいフラグ名が表示されます。

- **`memo edit --set-label` の削除**: ラベルの完全置換は `memo label set` コマンドを使用してください。
  - `--setLabel` / `--set-label` を使用すると、移行ガイダンス付きのエラーメッセージが表示されます。

### New Features

- **エディタ起動の明示的制御**: `memo create`, `memo edit`, `memo comment add` に `--editor` / `--no-editor` フラグを追加しました。
  - `--editor`: body が指定されている場合でも強制的にエディタを起動します。
  - `--no-editor`: body が指定されていない場合でもエディタの起動を抑止します（エラーになります）。
  - 両フラグは相互排他的です。

### Tests

- kebab-case フラグの動作確認テスト（7テスト）を追加
- `--editor` / `--no-editor` フラグのテスト（13テスト）を追加
- `memo label set` コマンドの動作確認テスト（6テスト）を追加
- 全30テストが合格

## 0.1.0 - 2025-10-13

- 初期リリース: `mgtd init` / `mgtd memo` CLI を実装し、ローカル SQLite とメモ操作をサポート。
- CLI ヘルプを gh コマンド準拠のセクション構成に刷新し、スペース区切りのサブコマンドでも `--help` が動作するよう改善。
- `mgtd completion` コマンドと bash / zsh / fish 向けスクリプトを同梱し、コマンドから直接導入できるようにした。
- README とドキュメントを更新し、インストール手順・補完導入手順・テスト実行方法・パッケージ作成フローを明記。
- CLI の help / e2e テストを追加し、主要なコマンドと補完スクリプト生成を自動検証。
