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
* The flow has one fixed stop: the user's approval of the plan. Whatever the request says (検討, 実装, or just a shared Task), go through investigation, plan, and an independent plan check without stopping, then present the plan itself in the chat (chosen approach and rejected alternatives, files and processing to change, how it will be verified, where it takes effect, who checked what) and wait. Do not change files before the approval is recorded with `task.mjs approve`; do not end the turn before the plan is presented.
* What the Task body states is already decided. Do not ask about it, and do not add targets or conditions the body does not contain.
* A Task comment is a record, not a report. Everything the user needs in order to judge goes in the chat; never answer with only "recorded on the Task".
* A one-off request in the chat (install on the device, restart the server) means exactly that: do it, report the result at once, and do not start checks nobody asked for.
* Server-side changes (`packages/api`, `core`, `db`, `shared`, `web`) are visible on the web UI and on the device only after the port 3000 server is rebuilt and restarted from code that contains them (`.codex/skills/dev-flow/references/prod-server.md`). Reinstalling the iOS app does not show them.
* The main thread is the only one that talks to the user. Planning, implementation, verification, and review each run in a subagent spawned with `fork_turns="none"`, so earlier assumptions are not carried over. The verifier is spawned with `agent_type="verifier"` (`.codex/agents/verifier.toml`).
* The main thread may run only read-only commands and the dev-flow scripts; `.codex/hooks/orchestrator-guard.mjs` denies everything else. Delegate the work instead of retrying.
* Record every user-reported issue verbatim in the Task's status table (`task.mjs status add`) before acting on it, and report in that table's shape.
* Read and write meme-gtd Tasks only through `.codex/skills/dev-flow/scripts/task.mjs`, never with `curl`.
* The user decides what the product should be (behavior, appearance, names, scope). Ask only about points that the Task and the user's words leave open, that change what the user sees, and that investigation cannot settle; with no such point, ask nothing. How to implement it is for the planner to compare and decide, not a question for the user. Everything else in the flow proceeds without asking.

## Release and commit discipline

* Never stack implementation commits after the version bump commit; the bump commit is always the branch tip. If more commits are needed after the bump, update the CHANGELOG, re-stack the bump at the tip, and re-point the unpushed tag (procedure: release skill).
* Use the commit type that matches the change (`refactor:`, `test:`, `ci:`, `docs:`) — do not label a refactor as `fix:`.

