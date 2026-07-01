# AGENTS.md

## Instruction handling

* Do not change the user’s task into a broader diagnostic task.
* When the user invokes a skill explicitly, treat that skill as the source of truth for the task procedure.
* Do not replace a known working local recipe with dynamic rediscovery unless the recipe fails.
* Interpret editing instructions such as “1行ずつ” as instructions about the resulting file structure first, not as instructions to make one-line tool patches.
* If an instruction is ambiguous, preserve the requested end state and avoid tool-operation literalism.

## Failure handling

* Do not blame the user, the device, or the local environment from a nested error string alone.
* Run the normal recipe first. Use diagnostics only after the recipe actually fails.
* Report the command phase that failed: discovery, build, install, launch, or edit.
* Do not start broad web/DDI/signing research when the requested task is to run a known local command recipe.

## Source of truth

* Repo behavior belongs in repo AGENTS.md or the relevant skill.
* Repeatable workflows belong in skills.
* Memory must not override an explicitly invoked skill.
* Routing for repo knowledge starts at the root `CLAUDE.md` document-routing table; the document catalog and update rules live in `docs/CLAUDE.md`.

