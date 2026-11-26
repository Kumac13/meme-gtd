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

## Development flow (Codex)

* When the user shares a meme-gtd Task (pasted Task JSON or a Task ID), follow the `dev-flow` skill (`.codex/skills/dev-flow/SKILL.md`). It is the source of truth for consideration, planning, implementation, PR, and review.
* The main thread does three things only: talk to the user, read and write the Task through `.codex/skills/dev-flow/scripts/task.mjs` (never `curl`), and start and wait for role agents (`spawn_agent` with `fork_turns="none"`; the verifier with `agent_type="verifier"`). Research, reading code, browser or simulator operation, screenshots, image inspection, edits, builds, tests, push, and PR creation all go to role agents. `.codex/hooks/orchestrator-guard.mjs` denies the rest once the user has trusted the hooks (Settings > Hooks, or `/hooks`); follow the same limits when the hooks are not trusted.
* Wait for a role agent with `wait_agent` at `timeout_ms=3600000`. Do not re-wait on short timeouts and do not poll for progress.
* Answer a question before doing anything else. Read 「は？」 and other short objections as an objection to your previous output: re-read that output and the original request, fix what missed, and continue the original request. Do not turn an objection into a cancellation or a new work order.
* Do what was asked, within what was asked, and report as soon as it is done. Produce only the requested deliverable: a request to report is answered in the chat, not by creating Tasks. Create a Task only when the user says to create one.
* Do not ask about what the Task body or the user's messages already state, or about what investigation can settle.
* End a turn only when the requested work is complete or at the two agreement points the skill defines: the consideration result (before planning) and the plan (before implementation). At an agreement point, write what the user needs to judge in the chat (compared approaches, chosen approach and why, changed files, processing order, what is verified and by whom) and state what you are asking agreement for. A Task comment is a work log, not a report. Agreement on consideration or plan is separate from confirming the implemented result and from PR review.
* A shared Task is not an implementation request by itself. Change files only when the request asks for implementation (実装, 直して, and the like) or the user agrees to the plan. After that, proceed through verification, PR, Task link, and review without stopping.
* Record user-reported issues verbatim in the Task's status table (`task.mjs status add`) for Tasks run through this flow, and report in that table's shape.

## Release and commit discipline

* Never stack implementation commits after the version bump commit; the bump commit is always the branch tip. If more commits are needed after the bump, update the CHANGELOG, re-stack the bump at the tip, and re-point the unpushed tag (procedure: release skill).
* Use the commit type that matches the change (`refactor:`, `test:`, `ci:`, `docs:`) — do not label a refactor as `fix:`.

