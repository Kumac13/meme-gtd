# fish completion for mgtd
# 保存先例: ~/.config/fish/completions/mgtd.fish

set -l mgtd_root_commands init memo

complete -c mgtd -f

# Root commands
complete -c mgtd -n '__fish_use_subcommand' -a 'init' -d 'Bootstrap local mgtd storage'
complete -c mgtd -n '__fish_use_subcommand' -a 'memo' -d 'Captured memo workspace'

# init flags
complete -c mgtd -n '__fish_seen_subcommand_from init' -l db -d 'SQLite database file path'
complete -c mgtd -n '__fish_seen_subcommand_from init' -l force -d 'Overwrite existing database'
complete -c mgtd -n '__fish_seen_subcommand_from init' -l dry-run -d 'Preview actions only'
complete -c mgtd -n '__fish_seen_subcommand_from init' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from init' -s h -l help -d 'Show help'

# memo subcommands
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'comment' -d 'Inspect memo comments'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'create' -d 'Capture a new memo'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'delete' -d 'Soft-delete a memo'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'edit' -d 'Update memo content or metadata'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'label' -d 'List or modify memo labels'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'list' -d 'List captured memos'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'promote' -d 'Promote a memo to a task'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -a 'view' -d 'Show memo details'

# memo list flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from list' -l label -d 'Filter by label name'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from list' -l search -d 'Full text search query'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from list' -l limit -d 'Limit number of results'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from list' -l order -d 'Sort direction (asc|desc)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from list' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from list' -s h -l help -d 'Show help'

# memo create flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from create' -l body -d 'Inline memo body text'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from create' -l body-file -d 'Load memo body from file or stdin (-)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from create' -l label -d 'Apply label(s)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from create' -l project -d 'Associate project IDs'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from create' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from create' -s h -l help -d 'Show help'

# memo delete flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation prompt'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from delete' -s h -l help -d 'Show help'

# memo edit flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l body -d 'Inline replacement memo body'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l body-file -d 'Load memo body from file or stdin (-)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l add-label -d 'Add label(s)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l remove-label -d 'Remove label(s)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l set-label -d 'Replace labels with provided list'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l project -d 'Set project IDs'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from edit' -s h -l help -d 'Show help'

# memo promote flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -l title -d 'Task title'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -l body -d 'Override task body inline'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -l body-file -d 'Load task body from file or stdin (-)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -l label -d 'Apply label(s) to the new task'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -l status -d 'Initial task status'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from promote' -s h -l help -d 'Show help'

# memo view flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from view' -s c -l comments -d 'Include memo comments'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from view' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from view' -s h -l help -d 'Show help'

# memo comment subcommands
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and not __fish_use_subcommand' -a 'add' -d 'Add a new memo comment'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and not __fish_use_subcommand' -a 'edit' -d 'Edit an existing memo comment'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and not __fish_use_subcommand' -a 'delete' -d 'Delete an existing memo comment'

# memo comment flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from add' -l body -d 'Inline comment body'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from add' -l body-file -d 'Load comment body from file or stdin (-)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from add' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from add' -s h -l help -d 'Show help'

complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from edit' -l body -d 'Inline replacement comment body'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from edit' -l body-file -d 'Load comment body from file or stdin (-)'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from edit' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from edit' -s h -l help -d 'Show help'

complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation prompt'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from comment; and __fish_seen_subcommand_from delete' -s h -l help -d 'Show help'

# memo label flags
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from add' -l label -d 'Label value'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from add' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from add' -s h -l help -d 'Show help'

complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from remove' -l label -d 'Label value'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from remove' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from remove' -s h -l help -d 'Show help'

complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from set' -l label -d 'Label value'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from set' -l json -d 'Return JSON output'
complete -c mgtd -n '__fish_seen_subcommand_from memo; and __fish_seen_subcommand_from label; and __fish_seen_subcommand_from set' -s h -l help -d 'Show help'

# default memo view/list completions
complete -c mgtd -n '__fish_seen_subcommand_from memo; and not __fish_use_subcommand' -s h -l help -d 'Show help'
