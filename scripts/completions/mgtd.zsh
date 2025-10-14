#compdef mgtd

_mgtd_commands() {
  local -a subcommands
  subcommands=(
    'init:Bootstrap local mgtd storage'
    'memo:Captured memo workspace'
  )
  _describe 'mgtd command' subcommands "$@"
}

_mgtd_init() {
  _arguments \
    '--db[SQLite database file path]:path:_files' \
    '--force[Overwrite existing database]' \
    '--dry-run[Preview actions without writing files]' \
    '--json[Return JSON output]' \
    '(-h --help)'{-h,--help}'[Show help]'
}

_mgtd_memo() {
  local -a memo_sub
  memo_sub=(
    'comment:Inspect memo comments'
    'create:Capture a new memo'
    'delete:Soft-delete a memo'
    'edit:Update memo content or metadata'
    'label:List or modify memo labels'
    'list:List captured memos'
    'promote:Promote a memo to a task'
    'view:Show memo details'
  )

  if (( CURRENT == 2 )); then
    _describe 'memo subcommand' memo_sub
    return
  fi

  case "${words[2]}" in
    comment)
      _mgtd_memo_comment
      ;;
    create)
      _arguments \
        '--body[Inline memo body text]' \
        '--body-file[Load memo body from file or stdin (-)]:path:_files' \
        '*--label[Apply label(s)]:label:' \
        '*--project[Associate project IDs]:project id:' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    delete)
      _arguments \
        '(-y --yes)'{-y,--yes}'[Skip confirmation prompt]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    edit)
      _arguments \
        '--body[Inline replacement memo body]' \
        '--body-file[Load memo body from file or stdin (-)]:path:_files' \
        '*--add-label[Add label(s)]:label:' \
        '*--remove-label[Remove label(s)]:label:' \
        '*--set-label[Replace labels with provided list]:label:' \
        '*--project[Set project IDs]:project id:' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    label)
      _mgtd_memo_label
      ;;
    list)
      _arguments \
        '--label[Filter by label name]:label:' \
        '--search[Full text search query]' \
        '--limit[Limit number of results]:count:' \
        '--order[Sort direction]: :(asc desc)' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    promote)
      _arguments \
        '--title[Task title]' \
        '--body[Override task body inline]' \
        '--body-file[Load task body from file or stdin (-)]:path:_files' \
        '*--label[Apply label(s) to the new task]:label:' \
        '--status[Initial task status]' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    view)
      _arguments \
        '(-c --comments)'{-c,--comments}'[Include memo comments]' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    *)
      _message 'unknown memo subcommand'
      ;;
  esac
}

_mgtd_memo_comment() {
  if (( CURRENT == 3 )); then
    local -a comment_sub
    comment_sub=(
      'add:Add a new memo comment'
      'edit:Edit an existing memo comment'
      'delete:Delete an existing memo comment'
    )
    _describe 'memo comment subcommand' comment_sub
    return
  fi

  case "${words[3]}" in
    add|edit)
      _arguments \
        '--body[Inline comment body]' \
        '--body-file[Load comment body from file or stdin (-)]:path:_files' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    delete)
      _arguments \
        '(-y --yes)'{-y,--yes}'[Skip confirmation prompt]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    *)
      _arguments \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
  esac
}

_mgtd_memo_label() {
  if (( CURRENT == 3 )); then
    local -a label_sub
    label_sub=(
      'add:Add labels to a memo'
      'remove:Remove labels from a memo'
      'set:Replace memo labels'
    )
    _describe 'memo label subcommand' label_sub
    return
  fi

  case "${words[3]}" in
    add|remove|set)
      _arguments \
        '*--label[Label value]:label:' \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
    *)
      _arguments \
        '--json[Return JSON output]' \
        '(-h --help)'{-h,--help}'[Show help]'
      ;;
  esac
}

_mgtd() {
  if (( CURRENT == 1 )); then
    _mgtd_commands
    return
  fi

  case "${words[1]}" in
    init)
      _mgtd_init
      ;;
    memo)
      _mgtd_memo
      ;;
    *)
      _message 'unknown mgtd command'
      ;;
  esac
}

_mgtd "$@"
