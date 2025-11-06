# CLI Commands Reference

## Claude Code Slash Commands

meme-gtdは、Claude Codeとの統合を強化するスラッシュコマンドを提供しています。これらはCLIコマンドとして実行するのではなく、Claude Codeの対話内で使用します。

### インストール

```bash
# グローバルインストール（すべてのプロジェクトで利用可能）
mgtd claude init --global

# カレントプロジェクトのみにインストール
mgtd claude init
```

### 管理コマンド

```bash
# インストール済みコマンドの一覧表示
mgtd claude list --global

# コマンドの更新
mgtd claude update --global

# コマンドの削除
mgtd claude remove --global
```

### 利用可能なスラッシュコマンド

インストール後、Claude Codeで以下のコマンドが使用可能になります：

| コマンド | 説明 |
|---------|------|
| `/gtd:inbox-review` | ラベルなしメモをレビューしてタスク化を検討 |
| `/gtd:next-actions` | status:nextのタスク一覧を表示 |
| `/gtd:weekly-review` | GTD週次レビューを実施 |
| `/gtd:clarify <memo-id>` | メモを明確化して行動可能にする |
| `/quick:memo <text>` | 素早くメモを作成（テスト環境） |
| `/quick:task <title>` | 素早くタスクを作成（テスト環境） |
| `/promote <memo-id>` | メモをタスクに昇格 |

詳細は [packages/cli/templates/claude-commands/README.md](../packages/cli/templates/claude-commands/README.md) を参照してください。

## Search and Filter Commands

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

Valid status values: `open`, `next`, `waiting`, `scheduled`, `done`, `canceled`

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
mgtd task list [--status <state>] [--label <name>] [--search <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]
```

**Options:**
- `--status <state>` - Filter by task status (open, next, waiting, scheduled, done, canceled)
- `--label <name>` - Filter by label. Supports comma-separated values for OR logic (e.g., bug,enhancement)
- `--search <query>` - Search in task title and body
- `--bookmarked` - Show only bookmarked tasks
- `--order <asc|desc>` - Sort order (default: desc)
- `--limit <n>` - Maximum number of results
- `--json` - Output in JSON format

### Memo List

```bash
mgtd memo list [--label <name>] [--search <query>] [--bookmarked] [--order <asc|desc>] [--limit <n>] [--json]
```

**Options:**
- `--label <name>` - Filter by label. Supports comma-separated values for OR logic (e.g., idea,meeting-notes)
- `--search <query>` - Search in memo body
- `--bookmarked` - Show only bookmarked memos
- `--order <asc|desc>` - Sort order (default: desc)
- `--limit <n>` - Maximum number of results
- `--json` - Output in JSON format

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

### Integration with Other Tools

```bash
# Count open bugs
mgtd task list --label bug --status open --json | jq length

# Extract task titles
mgtd task list --label urgent --json | jq '.[].title'

# Filter and format
mgtd task list --label bug --json | jq '.[] | {id, title, status}'
```

## Notes

- **Case Sensitivity**: Label matching is case-insensitive
- **Whitespace**: Leading and trailing spaces in label names are automatically trimmed
- **Empty Results**: If no items match the filter criteria, an empty list is returned
- **Warning**: Using `--status` flag with `mgtd memo list` will display a warning since memos don't have status
