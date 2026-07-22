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
* Preventive rules go where the mistake happens: the auto-loaded context of the directory being edited (nested `CLAUDE.md`) or the always-loaded root rules. A rule that is only read at a late stage (e.g. release time) does not prevent anything.

## Release and commit discipline

* Never stack implementation commits after the version bump commit; the bump commit is always the branch tip. If more commits are needed after the bump, update the CHANGELOG, re-stack the bump at the tip, and re-point the unpushed tag (procedure: release skill).
* Use the commit type that matches the change (`refactor:`, `test:`, `ci:`, `docs:`) — do not label a refactor as `fix:`.

