---
name: ios-deploy
description: Use when the user asks to build, deploy, or install the iOS app. Also use automatically after making iOS code changes when the user is testing. Builds and deploys MemeGTD to both iOS Simulator and physical device in parallel.
---

# iOS Deploy

Build and deploy MemeGTD iOS app to both Simulator and physical device.

## Configuration

| Key | Value |
|-----|-------|
| Project dir | `ios/MemeGTD/` |
| Scheme | `MemeGTD` |
| Simulator | `iPhone 17` |
| Device ID | `711DF058-2471-5314-A487-F8682231A5F6` |
| Bundle ID | `name.kumac.MemeGTD` |
| DerivedData | `~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx` |

## Codex execution rule

In this Codex sandbox, commands that use `xcodebuild`, `xcrun simctl`, or `xcrun devicectl` must be run with escalated execution. Do not try them in the sandbox first.

## Failure boundary

The first job of this skill is to run the known local deploy recipe. Do not start by rediscovering bundle IDs, device IDs, app paths, signing state, DDI state, or generic Xcode behavior when the configured recipe already contains working local values.

Diagnostics are allowed only after the configured build/install commands fail.

## Known bad Codex behavior to avoid

- Do not convert this deploy task into a DDI/CoreDevice investigation before running the fixed recipe.
- Do not interpret `kAMDMobileImageMounterDeviceLocked` as proof of user/device fault without independent evidence.
- Do not store deploy corrections in memory instead of this skill.
- Do not web-search broad Apple/DDI topics when the task is local CLI deployment.
- Do not change target scope from Simulator+device to device-only unless the user explicitly asks.

## Steps

Run both builds in **parallel** using two tool calls in a single message:

### Build 1: Simulator
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

### Build 2: Device
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS,id=711DF058-2471-5314-A487-F8682231A5F6' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

**IMPORTANT**: The working directory MUST be `ios/MemeGTD/` (absolute path: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/ios/MemeGTD`). If not, run commands with that working directory.

After both builds succeed, run install commands in **parallel**:

### Install on Simulator
```bash
xcrun simctl install "iPhone 17" ~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx/Build/Products/Debug-iphonesimulator/MemeGTD.app
xcrun simctl terminate "iPhone 17" name.kumac.MemeGTD 2>/dev/null || true
xcrun simctl launch "iPhone 17" name.kumac.MemeGTD
```

### Install on Device
```bash
xcrun devicectl device install app --device 711DF058-2471-5314-A487-F8682231A5F6 ~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx/Build/Products/Debug-iphoneos/MemeGTD.app 2>&1
```

## Error handling

- If a build fails, show the error output.
- If device is not connected, skip device install and report it.
- Treat `App installed:` from `devicectl` as device install success.
- Always report results for both targets.
