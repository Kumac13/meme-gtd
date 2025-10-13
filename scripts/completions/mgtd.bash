# bash completion for mgtd
# 保存先例: ~/.local/share/mgtd/completions/mgtd.bash
# 有効化例: source /path/to/mgtd.bash

_mgtd_complete_full() {
  local cur prev words cword
  _init_completion -n '=' || return

  local root_subcommands="init memo"

  if [[ ${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${root_subcommands}" -- "${cur}") )
    return
  fi

  local first="${words[1]}"
  local second="${words[2]}"

  case "${first}" in
    init)
      local init_flags="--db --force --dry-run --json --help -h"
      COMPREPLY=( $(compgen -W "${init_flags}" -- "${cur}") )
      ;;
    memo)
      if [[ ${cword} -eq 2 ]]; then
        local memo_sub="comment create delete edit label list promote view"
        COMPREPLY=( $(compgen -W "${memo_sub}" -- "${cur}") )
        return
      fi

      case "${second}" in
        comment)
          if [[ ${cword} -eq 3 ]]; then
            local comment_sub="add edit delete"
            COMPREPLY=( $(compgen -W "${comment_sub}" -- "${cur}") )
            return
          fi
          case "${words[3]}" in
            add|edit)
              local comment_body_flags="--body --body-file --json --help -h"
              COMPREPLY=( $(compgen -W "${comment_body_flags}" -- "${cur}") )
              ;;
            delete)
              local comment_delete_flags="--yes -y --help -h"
              COMPREPLY=( $(compgen -W "${comment_delete_flags}" -- "${cur}") )
              ;;
            *)
              local comment_flags="--json --help -h"
              COMPREPLY=( $(compgen -W "${comment_flags}" -- "${cur}") )
              ;;
          esac
          ;;
        create)
          local create_flags="--body --body-file --label --project --json --help -h"
          COMPREPLY=( $(compgen -W "${create_flags}" -- "${cur}") )
          ;;
        delete)
          local delete_flags="--yes -y --help -h"
          COMPREPLY=( $(compgen -W "${delete_flags}" -- "${cur}") )
          ;;
        edit)
          local edit_flags="--body --body-file --add-label --remove-label --set-label --project --json --help -h"
          COMPREPLY=( $(compgen -W "${edit_flags}" -- "${cur}") )
          ;;
        label)
          if [[ ${cword} -eq 3 ]]; then
            local label_sub="add remove set"
            COMPREPLY=( $(compgen -W "${label_sub}" -- "${cur}") )
            return
          fi
          case "${words[3]}" in
            add|remove|set)
              local label_flags="--label --json --help -h"
              COMPREPLY=( $(compgen -W "${label_flags}" -- "${cur}") )
              ;;
            *)
              local label_view_flags="--json --help -h"
              COMPREPLY=( $(compgen -W "${label_view_flags}" -- "${cur}") )
              ;;
          esac
          ;;
        list)
          local list_flags="--label --search --limit --order --json --help -h"
          COMPREPLY=( $(compgen -W "${list_flags}" -- "${cur}") )
          ;;
        promote)
          local promote_flags="--title --body --body-file --label --status --json --help -h"
          COMPREPLY=( $(compgen -W "${promote_flags}" -- "${cur}") )
          ;;
        view)
          local view_flags="--comments -c --json --help -h"
          COMPREPLY=( $(compgen -W "${view_flags}" -- "${cur}") )
          ;;
      esac
      ;;
  esac
}

_mgtd_complete_basic() {
  local cur
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  if [[ ${COMP_CWORD} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "init memo" -- "${cur}") )
    return
  fi
  if [[ "${COMP_WORDS[1]}" == "memo" && ${COMP_CWORD} -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "comment create delete edit label list promote view" -- "${cur}") )
    return
  fi
}

if declare -F _init_completion >/dev/null; then
  complete -F _mgtd_complete_full mgtd
else
  complete -F _mgtd_complete_basic mgtd
fi
