# meme-gtd Claude Code Commands

Custom slash commands for Claude Code to enhance your GTD workflow with meme-gtd.

## Installation

```bash
# Install commands globally (recommended)
mgtd claude init --global

# Install to current project
mgtd claude init

# Update existing commands
mgtd claude update --global
```

## Available Commands

### GTD Workflow Commands

These commands help you follow the GTD (Getting Things Done) methodology:

| Command | Description |
|---------|-------------|
| `/gtd:inbox-review` | Review unlabeled memos and decide what to do |
| `/gtd:next-actions [--limit n]` | List all tasks with status:next |
| `/gtd:weekly-review` | Conduct a comprehensive weekly review |
| `/gtd:clarify <memo-id>` | Clarify a vague memo into actionable steps |

### Quick Capture Commands

Fast capture commands for when you're in flow:

| Command | Description |
|---------|-------------|
| `/quick:memo <text>` | Quickly create a memo in test environment |
| `/quick:task <title>` | Quickly create a task in test environment |

### Utility Commands

| Command | Description |
|---------|-------------|
| `/promote <memo-id>` | Promote a memo to a task with guided workflow |

## Usage Examples

### Inbox Review
```
/gtd:inbox-review
```
Claude will fetch unlabeled memos and help you process each one.

### Weekly Review
```
/gtd:weekly-review
```
Claude will guide you through the GTD weekly review checklist.

### Quick Capture
```
/quick:memo Check email from supplier about delivery schedule
/quick:task Review Q4 budget proposal
```

### Memo Promotion
```
/promote 42
```
Claude will help you convert memo #42 into a properly structured task.

## Safety Features

All commands are configured to:
- ✅ Use `pnpm mgtd:test` (test environment) by default
- ✅ Never touch production database
- ✅ Provide clear confirmation before destructive operations

## Updating Commands

When new commands are released or existing ones are updated:

```bash
# Update to latest version
mgtd claude update --global
```

## Uninstalling

```bash
# Remove installed commands
mgtd claude remove --global
```

## Contributing

Found a bug or have a suggestion? Please open an issue at:
https://github.com/Kumac13/meme-gtd/issues
