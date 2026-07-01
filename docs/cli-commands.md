# CLI Commands Reference

## Search and Filter Commands

### Full-Text Search

Search tasks and memos using free-text queries powered by SQLite FTS5 (Full-Text Search).

#### Task Search Options

Tasks support three search options for flexible querying:

```bash
# Search both title AND body (default)
mgtd task list --search "authentication"
mgtd task list --search "login screen"

# Search title only
mgtd task list --search-title "Implement OAuth"
mgtd task list --search-title "Fix bug"

# Search body only
mgtd task list --search-body "OAuth integration details"
mgtd task list --search-body "error handling"
```

#### Memo Search Options

Memos support searching in body content:

```bash
# Search memo body
mgtd memo list --search "meeting notes"
mgtd memo list --search "project requirements"

# Explicit body search (equivalent to --search for memos)
mgtd memo list --search-body "action items"
```

#### Search Features

**Multi-word Search (AND Logic):**
Multiple words in a search query are combined with implicit AND logic.

```bash
# Find tasks containing BOTH "login" AND "OAuth"
mgtd task list --search "login OAuth"

# Find memos containing BOTH "meeting" AND "requirements"
mgtd memo list --search "meeting requirements"
```

**Search with Filters:**
Combine search with label and status filters.

```bash
# Search for "authentication" in bugs
mgtd task list --search "authentication" --label bug

# Search for "OAuth" in open tasks
mgtd task list --search "OAuth" --status open

# Search memos with specific label
mgtd memo list --search "action items" --label meeting-notes
```

**Preview Snippets:**
Search results include highlighted preview snippets (when using `--json`).

```bash
mgtd task list --search "login" --json
# Returns: "preview": "Implement <mark>login</mark> feature"
```

**Project and Link IDs:**
Task list responses include arrays of associated project IDs and link IDs (when using `--json`).

```bash
mgtd task list --json
# Returns: "projectIds": [1, 2], "linkIds": [5, 8]
```

This enables AI agents to reference related projects and links for context.

**Prefix Wildcard Search:**
Use `*` suffix for prefix matching. This is especially useful for Japanese text search.

```bash
# English: exact word match
mgtd task list --search "auth"        # Matches "auth" as standalone word
mgtd task list --search "auth*"       # Matches "auth", "authentication", "authorize", etc.

# Japanese: prefix wildcard recommended
mgtd task list --search-title "MS*"   # Matches "MSのタスク", "MSお困りごと", etc.
mgtd memo list --search "会議*"       # Matches "会議メモ", "会議議事録", etc.
```

**Note:** Current FTS5 tokenizer (`unicode61`) splits on spaces and punctuation, which works well for English but not for Japanese. For Japanese text, use the `*` wildcard for reliable partial matching. See [Issue #76](https://github.com/Kumac13/meme-gtd/issues/76) for Japanese tokenization support.

#### Search Technology

- **Engine**: SQLite FTS5 with unicode61 tokenizer
- **Matching**: Partial word matching supported
- **Case**: Case-insensitive by default
- **Performance**: Instant results for datasets up to 10,000 items

### Task List with Filters

Filter tasks by label and status using the `--label` and `--status` flags.

#### Filter by Single Label

```bash
mgtd task list --label bug
mgtd task list --label enhancement
```

#### Filter by Multiple Labels (OR Logic)

Use comma-separated values to filter by multiple labels. Tasks matching ANY of the specified labels will be returned.

```bash
mgtd task list --label bug,enhancement
mgtd task list --label urgent,high-priority
```

#### Filter by Status

```bash
mgtd task list --status open
mgtd task list --status next
mgtd task list --status done
```

Valid status values: `inbox`, `open`, `next`, `waiting`, `scheduled`, `someday`, `done`, `canceled`

#### Combined Filters (AND Logic)

Combine label and status filters. Tasks must match ALL specified criteria.

```bash
mgtd task list --label bug --status open
mgtd task list --label bug,enhancement --status next
```

#### Additional Options

```bash
# Combine with other flags
mgtd task list --label urgent --order asc --limit 10
mgtd task list --label bug --status open --json
mgtd task list --label critical --bookmarked
```

### Memo List with Filters

Filter memos by label using the `--label` flag. Note: Memos do not have status.

#### Filter by Single Label

```bash
mgtd memo list --label idea
mgtd memo list --label meeting-notes
```

#### Filter by Multiple Labels (OR Logic)

```bash
mgtd memo list --label idea,meeting-notes
mgtd memo list --label inbox,todo
```

#### Combined with Other Options

```bash
mgtd memo list --label important --order desc
mgtd memo list --label idea --limit 5 --json
```

## Full Command Syntax

### Task List

```bash
mgtd task list [--status <state>] [--label <name>] [--search <query>] [--search-title <query>] [--search-body <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]
```

**Options:**
- `--status <state>` - Filter by task status (inbox, open, next, waiting, scheduled, someday, done, canceled)
- `--label <name>` - Filter by label. Supports comma-separated values for OR logic (e.g., bug,enhancement)
- `--search <query>` - Search in both task title and body using FTS5 (multi-word AND logic)
- `--search-title <query>` - Search in task title only using FTS5
- `--search-body <query>` - Search in task body only using FTS5
- `--bookmarked` - Show only bookmarked tasks
- `--order <asc|desc>` - Sort order (default: desc)
- `--limit <n>` - Maximum number of results
- `--json` - Output in JSON format (includes preview snippets when searching, projectIds, and linkIds)

### Memo List

```bash
mgtd memo list [--label <name>] [--search <query>] [--search-body <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]
```

**Options:**
- `--label <name>` - Filter by label. Supports comma-separated values for OR logic (e.g., idea,meeting-notes)
- `--search <query>` - Search in memo body using FTS5 (multi-word AND logic)
- `--search-body <query>` - Search in memo body using FTS5 (same as --search for memos)
- `--bookmarked` - Show only bookmarked memos
- `--order <asc|desc>` - Sort order (default: desc)
- `--limit <n>` - Maximum number of results
- `--json` - Output in JSON format (includes preview snippets when searching)

## Examples

### Common Use Cases

```bash
# All open bugs
mgtd task list --label bug --status open

# High priority items (multiple labels)
mgtd task list --label urgent,high-priority --status next

# All ideas and meeting notes from memos
mgtd memo list --label idea,meeting-notes

# Bookmarked urgent tasks
mgtd task list --label urgent --bookmarked

# Get JSON output for scripting
mgtd task list --label bug --status open --json

# Limit results
mgtd task list --label enhancement --limit 10
```

### Search Examples

```bash
# Search tasks for "authentication"
mgtd task list --search "authentication"

# Search task titles only
mgtd task list --search-title "Implement OAuth"

# Search task bodies only
mgtd task list --search-body "integration details"

# Multi-word search (AND logic)
mgtd task list --search "login OAuth"

# Search with label filter
mgtd task list --search "authentication" --label bug

# Search with status filter
mgtd task list --search "OAuth" --status open

# Search memos
mgtd memo list --search "meeting notes"

# Search memos with label
mgtd memo list --search "action items" --label meeting-notes

# Search with JSON output (includes preview)
mgtd task list --search "login" --json
```

### Integration with Other Tools

```bash
# Count open bugs
mgtd task list --label bug --status open --json | jq length

# Extract task titles
mgtd task list --label urgent --json | jq '.[].title'

# Filter and format
mgtd task list --label bug --json | jq '.[] | {id, title, status}'
```

## Task Scheduling Commands

### Scheduling a Task

Schedule tasks using ISO 8601 datetime format (YYYY-MM-DDTHH:MM:SS).

#### Create a Scheduled Task

```bash
# Create a task with scheduled start and end times
mgtd task create --title "Team meeting" --scheduled-start 2025-12-10T14:00:00 --scheduled-end 2025-12-10T15:00:00 --no-editor

# Create an all-day event
mgtd task create --title "Conference" --scheduled-start 2025-12-11T00:00:00 --scheduled-end 2025-12-13T23:59:59 --all-day --no-editor

# Create with body content
mgtd task create --title "Project review" --body "Review Q4 progress" --scheduled-start 2025-12-15T10:00:00 --scheduled-end 2025-12-15T11:00:00 --no-editor
```

**Options:**
- `--scheduled-start <datetime>` - Scheduled start datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS)
- `--scheduled-end <datetime>` - Scheduled end datetime (ISO 8601: YYYY-MM-DDTHH:MM:SS)
- `--all-day` - Mark as an all-day event (only date portion is used)

#### Edit Task Schedule

```bash
# Update scheduled times
mgtd task edit 12 --scheduled-start 2025-12-10T15:00:00 --scheduled-end 2025-12-10T16:00:00 --no-editor

# Convert to all-day event
mgtd task edit 12 --all-day --no-editor

# Convert from all-day to timed event
mgtd task edit 12 --no-all-day --no-editor

# Clear schedule (empty string)
mgtd task edit 12 --scheduled-start "" --scheduled-end "" --no-editor
```

#### Record Actual Execution Times

For tracking when tasks were actually performed (different from scheduled times):

```bash
# Record actual start time
mgtd task edit 12 --actual-start 2025-12-10T14:30:00 --no-editor

# Record actual start and end times
mgtd task edit 12 --actual-start 2025-12-10T14:30:00 --actual-end 2025-12-10T16:00:00 --no-editor

# Clear actual times
mgtd task edit 12 --actual-start "" --actual-end "" --no-editor
```

**Edit Options:**
- `--scheduled-start <datetime>` - Update scheduled start datetime (empty string to clear)
- `--scheduled-end <datetime>` - Update scheduled end datetime (empty string to clear)
- `--all-day` / `--no-all-day` - Toggle all-day event flag
- `--actual-start <datetime>` - Set actual start datetime (empty string to clear)
- `--actual-end <datetime>` - Set actual end datetime (empty string to clear)

### Legacy Scheduling Options (Deprecated)

The following options are deprecated but still work for backward compatibility:

```bash
# Deprecated: --scheduled-on, --start, --end-date, --end
mgtd task create --title "Meeting" --scheduled-on 2025-12-10 --start 14:00 --end 15:00

# Preferred: Use --scheduled-start and --scheduled-end
mgtd task create --title "Meeting" --scheduled-start 2025-12-10T14:00:00 --scheduled-end 2025-12-10T15:00:00
```

## Project Commands

### Project Create

Create a new project with optional status and schedule.

```bash
mgtd project create "Sprint 1" --status active --start-date 2025-01-01 --end-date 2025-03-31
mgtd project create "Q4 Goals" --description "Year-end objectives" --status planned
mgtd project create "Bug Tracker" --view table --json
```

**Options:**
- `--description, -d` - Project description
- `--view, -v` - View type: `board` (default) or `table`
- `--status` - Project status: `planned` (default), `active`, `paused`, `done`, `canceled`
- `--start-date` - Start date in YYYY-MM-DD format
- `--end-date` - End date in YYYY-MM-DD format
- `--json, -j` - Output in JSON format

### Project List

List all projects with optional status filter.

```bash
mgtd project list
mgtd project list --status active
mgtd project list --json
```

**Options:**
- `--status` - Filter by project status
- `--json, -j` - Output in JSON format

### Project View

View project details including status, schedule, and associated items.

```bash
mgtd project view 5
mgtd project view 5 --json
```

### Project Update

Update project properties including status and schedule.

```bash
mgtd project update 5 --status done
mgtd project update 5 --start-date 2025-01-01 --end-date 2025-12-31
mgtd project update 5 --name "Updated Name" --description "New description"
mgtd project update 5 --status active --json
```

**Options:**
- `--name` - Update project name
- `--description` - Update project description
- `--status` - Update project status
- `--start-date` - Update start date (YYYY-MM-DD)
- `--end-date` - Update end date (YYYY-MM-DD)
- `--json, -j` - Output in JSON format

**Status Values:**
- `planned` - Project is in planning phase
- `active` - Project is actively being worked on
- `paused` - Project is temporarily paused
- `done` - Project is completed
- `canceled` - Project is canceled

### Project Add/Remove/Move

Manage items within projects.

```bash
# Add task/memo to project
mgtd project add 5 12 --column "In Progress"

# Remove item from project
mgtd project remove 5 12

# Move item to different position/column
mgtd project move 5 12 --column "Done" --after 15
```

### Project Delete

Delete a project (requires confirmation).

```bash
mgtd project delete 5
mgtd project delete 5 --yes --json
```

## Task Demote

Copy a task's content (title, body, comments) to create a new memo. The original task remains unchanged.

### Basic Usage

```bash
mgtd task demote 21
mgtd task demote 8 --no-editor --json
```

### With Custom Body

```bash
# Provide body inline
mgtd task demote 5 --body "Custom memo content"

# Load body from file
mgtd task demote 5 --body-file notes.md

# Load from stdin
echo "Content" | mgtd task demote 5 --body-file -
```

### With Labels

```bash
# Override labels (instead of inheriting from task)
mgtd task demote 5 --label documentation --label archive
```

### Options

```bash
mgtd task demote <id> [--body <text>] [--body-file <path>] [--label <name>...] [--no-editor] [--json]
```

**Options:**
- `--body, -b` - Override memo body inline
- `--body-file, -f` - Load body from file or stdin (use `-` for stdin)
- `--label, -l` - Labels to apply to memo (inherits from task if not specified)
- `--no-editor` - Skip editor, use auto-generated or provided body directly
- `--json, -j` - Output in JSON format

### Inheritance

The new memo automatically inherits from the original task:
- **Labels** - All labels assigned to the task (unless `--label` is specified)
- **Projects** - All project memberships
- **Links** - All existing links (parent, child, relates, derived_from)
- A `derived_from` link to the original task is automatically created

### Editor Behavior

By default, an editor opens with auto-generated content:
- Task title as `# Title` heading
- Task body
- Comments in chronological order with timestamps

Use `--no-editor` to skip the editor and use the auto-generated content directly.

### Output

Returns the original task (unchanged) and the new memo ID:

```json
{
  "task": { "id": 21, "title": "Research OAuth", ... },
  "memoId": 45
}
```

## Database Commands

### Database Backup

Create a consistent, timestamped snapshot of the SQLite database using the online backup API. Safe to run while the API server or CLI is using the database (WAL mode): uncheckpointed writes are included in the snapshot.

```bash
# Create a backup in <db dir>/backups (default keeps 7 generations)
mgtd db backup

# Keep more generations
mgtd db backup --keep 14

# Store backups in a custom directory
mgtd db backup --output ~/backups/mgtd

# List existing backups (newest first)
mgtd db backup --list

# Specify database path
mgtd db backup --db ~/.local/share/mgtd/issues.db

# JSON output for scripting
mgtd db backup --json
```

**Options:**
- `--db, -d <path>` - SQLite database file path (defaults to configured path)
- `--output, -o <dir>` - Backup destination directory (default: `backups` directory next to the database file)
- `--keep <n>` - Number of backup generations to keep; older ones are pruned (default: 7, `0` disables pruning)
- `--list, -l` - List existing backups instead of creating one
- `--json, -j` - Output in JSON format

**Features:**
- **WAL-safe**: Uses SQLite's online backup API, so the snapshot includes uncheckpointed WAL content (a plain `cp` does not)
- **No accidental DB creation**: The source database is opened read-only with `fileMustExist`, so a wrong path never creates an empty database
- **Generation management**: Backups are named `<name>-YYYYMMDD-HHmmssSSS.db`; pruning only ever deletes files matching this pattern

**Restore procedure:**

```bash
# Stop the API server first, then:
cp ~/.local/share/mgtd/backups/issues-20260612-103000123.db ~/.local/share/mgtd/issues.db
rm -f ~/.local/share/mgtd/issues.db-wal ~/.local/share/mgtd/issues.db-shm
```

**Example Output:**

```json
{
  "success": true,
  "dbPath": "/Users/name/.local/share/mgtd/issues.db",
  "backupPath": "/Users/name/.local/share/mgtd/backups/issues-20260612-103000123.db",
  "sizeBytes": 176128,
  "prunedFiles": []
}
```

### Database Migrate

Apply pending database migrations safely without deleting existing data.

```bash
# Preview migrations (dry run)
mgtd db migrate --dry-run

# Apply migrations with automatic backup
mgtd db migrate

# Apply migrations without backup
mgtd db migrate --no-backup

# Specify database path
mgtd db migrate --db ~/.local/share/mgtd/issues.db

# JSON output for scripting
mgtd db migrate --json
```

**Options:**
- `--db, -d <path>` - SQLite database file path (defaults to configured path)
- `--backup / --no-backup` - Create timestamped backup before migration (default: true)
- `--dry-run, -n` - Preview migrations without applying
- `--json, -j` - Output in JSON format

**Features:**
- **Automatic Backup**: Creates a WAL-safe snapshot in `<db dir>/backups` (e.g., `issues-20260612-103000123.db`) before applying migrations, using the same mechanism as `mgtd db backup`
- **Safe Operation**: Unlike `mgtd init --force`, this command never deletes your database
- **Idempotent**: Already applied migrations are skipped
- **Error Recovery**: Shows backup restore command on failure

**Example Output:**

```json
{
  "success": true,
  "dbPath": "/Users/name/.local/share/mgtd/issues.db",
  "dbSizeKB": 172,
  "backupPath": "/Users/name/.local/share/mgtd/backups/issues-20260612-103000123.db",
  "appliedMigrations": ["007_add_calendar_datetime_fields"],
  "skippedMigrations": ["001_init", "002_add_project_view_meta", ...]
}
```

## Search Commands

### Keyword Search

Search across memos, tasks, and articles by keyword. Searches title, body, and comments using partial text matching (LIKE).

```bash
# Basic keyword search
mgtd search keyword "郡司ペギオ"

# Filter by issue types
mgtd search keyword "TODO" --types memo,task

# Limit results and output JSON
mgtd search keyword "meeting" --limit 5 --json
```

**Options:**
- `--types, -t` - Comma-separated issue types to search: memo, task, article
- `--limit, -n` - Maximum number of results (default: 20)
- `--json, -j` - Output in JSON format

**Result structure:**

Each result is grouped by issue. If multiple comments match, they are listed under the same issue.

```json
{
  "results": [
    {
      "id": 1405,
      "type": "memo",
      "title": null,
      "bodyMd": "full body text...",
      "status": null,
      "isBookmarked": false,
      "labels": ["reading"],
      "commentCount": 17,
      "createdAt": "2026-02-19T09:18:16.650Z",
      "updatedAt": "2026-02-19T09:18:16.650Z",
      "matches": [
        { "field": "comment", "commentId": 864, "text": "matched comment text..." },
        { "field": "comment", "commentId": 867, "text": "another matched comment..." }
      ]
    }
  ],
  "total": 1
}
```

### Semantic Search

Search across memos, tasks, and articles using vector similarity via OpenAI-compatible embeddings. Requires embeddings to be synced first (`mgtd embedding sync`).

```bash
# Basic semantic search
mgtd search semantic "郡司ペギオ"

# Filter by types and limit
mgtd search semantic "GTD workflow" --types task --limit 10

# Specify model and output JSON
mgtd search semantic "読書メモ" --model qwen3-embedding:4b --json
```

**Options:**
- `--types, -t` - Comma-separated issue types to search: memo, task, article
- `--limit, -n` - Maximum number of results (default: 20)
- `--model, -m` - Embedding model name (overrides `MGTD_EMBEDDING_MODEL`)
- `--json, -j` - Output in JSON format

**Configuration (via `~/.config/mgtd/.env` or environment variables):**
- `MGTD_EMBEDDING_URL` - OpenAI-compatible embeddings endpoint (default: `http://localhost:11434/v1`)
- `MGTD_EMBEDDING_MODEL` - Model name (default: `qwen3-embedding:4b`)
- `MGTD_EMBEDDING_API_KEY` - API key (default: `ollama`)

**Prerequisites:**
- Embedding server must be running (e.g., Ollama, OpenAI API)
- Model must be available on the server
- Embeddings must be synced (`mgtd embedding sync`)

**Result structure:**

Results include full body text, all comments (embedding target includes comments), and similarity score.

```json
{
  "results": [
    {
      "id": 654,
      "type": "memo",
      "title": null,
      "bodyMd": "full body text...",
      "status": null,
      "isBookmarked": false,
      "labels": [],
      "comments": [
        { "id": 45, "bodyMd": "comment text...", "createdAt": "...", "updatedAt": "..." }
      ],
      "commentCount": 1,
      "createdAt": "2025-04-23T13:03:23.570Z",
      "updatedAt": "2025-04-23T13:03:23.570Z",
      "score": 0.47
    }
  ],
  "total": 1
}
```

## Embedding Commands

### Embedding Sync

Generate or update vector embeddings for all issues. Detects new issues, model changes, and content changes (via SHA-256 hash).

```bash
# Sync embeddings with default settings
mgtd embedding sync

# Specify model (overrides MGTD_EMBEDDING_MODEL)
mgtd embedding sync --model qwen3-embedding:0.6b

# JSON output
mgtd embedding sync --json
```

**Options:**
- `--model, -m` - Embedding model name (overrides `MGTD_EMBEDDING_MODEL`)
- `--json, -j` - Output in JSON format

**Configuration (via `~/.config/mgtd/.env` or environment variables):**
- `MGTD_EMBEDDING_URL` - OpenAI-compatible embeddings endpoint (default: `http://localhost:11434/v1`)
- `MGTD_EMBEDDING_MODEL` - Model name (default: `qwen3-embedding:4b`)
- `MGTD_EMBEDDING_API_KEY` - API key (default: `ollama`)

**Prerequisites:**
- Embedding server must be running (e.g., Ollama, OpenAI API)
- Model must be available on the server

**Output:**
```json
{
  "created": 10,
  "updated": 2,
  "skipped": 0,
  "total": 12
}
```

## Notes

- **Case Sensitivity**: Label matching is case-insensitive
- **Whitespace**: Leading and trailing spaces in label names are automatically trimmed
- **Empty Results**: If no items match the filter criteria, an empty list is returned
- **Warning**: Using `--status` flag with `mgtd memo list` will display a warning since memos don't have status
- **Date Validation**: Project start date must be before or equal to end date
- **Project Status**: Default status for new projects is `planned`
