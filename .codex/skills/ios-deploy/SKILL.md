---
name: ios-deploy
description: Use when the user asks to build, deploy, or install the iOS app. Also use automatically after making iOS code changes when the user is testing. Builds and deploys MemeGTD to both iOS Simulator and physical device in parallel.
---

# iOS Deploy (Codex)

The deploy procedure and all configuration values (scheme, simulator, device ID, bundle ID, DerivedData path) are maintained in **`.claude/skills/ios-deploy/SKILL.md`** — read and follow that file. This file only adds Codex-specific rules.

## Codex execution rule

`xcodebuild`, `xcrun simctl`, `xcrun devicectl`, and `axe` cannot run inside the Codex sandbox. `.codex/rules/dev-flow.rules` allows them to run outside the sandbox without an approval prompt, but only when the command matches the rule:

- Write each command as one plain command with literal values. Do not add `2>&1`, `2>/dev/null`, `|| true`, pipes, variables, or `$(...)`; any of these makes the rule miss and turns the command into an approval prompt the user has to answer. Use `xcodebuild -quiet` instead of piping to `grep`.
- Do not request escalated execution (`sandbox_permissions`) for these commands.
- Run every other command (`set`, `git`, `cat`, `rg`, and so on) inside the sandbox as usual. Never escalate them.

## Failure boundary

The first job of this skill is to run the known local deploy recipe. Do not start by rediscovering bundle IDs, device IDs, app paths, signing state, DDI state, or generic Xcode behavior when the configured recipe already contains working local values.

Diagnostics are allowed only after the configured build/install commands fail.

## Known bad Codex behavior to avoid

- Do not convert this deploy task into a DDI/CoreDevice investigation before running the fixed recipe.
- Do not interpret `kAMDMobileImageMounterDeviceLocked` as proof of user/device fault without independent evidence.
- Do not store deploy corrections in memory instead of the canonical skill file (`.claude/skills/ios-deploy/SKILL.md`).
- Do not web-search broad Apple/DDI topics when the task is local CLI deployment.
- Do not change target scope from Simulator+device to device-only unless the user explicitly asks.
