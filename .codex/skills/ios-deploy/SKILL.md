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

## Previous Codex Deploy Failure Record

- Responsibility: the previous failure was Codex's fault, not the user's, not the iPhone's, and not the project's.
- Working recipe: Codex ignored the known Claude-style fixed recipe; next time run this skill's fixed commands first.
- Config values: Codex rediscovered bundle ID, simulator, device ID, and DerivedData despite known working values; next time use the configured values unless output proves they are stale.
- Target scope: Codex deployed only to the physical device instead of Simulator and device in parallel; next time build both in parallel and install both in parallel.
- Command shape: Codex added alternate flags and fallback commands before needed; next time keep the command shape shown in this skill.
- DeviceLocked output: Codex treated `kAMDMobileImageMounterDeviceLocked` as user/device fault; next time do not blame device state without independent proof after the fixed recipe fails.
- DDI diagnosis: Codex chased CoreDevice/DDI details before completing the fixed recipe; next time DDI work is fallback only.
- Generic build fallback: Codex switched to generic iOS build as a detour; next time use it only after the fixed device build truly fails and diagnosis is requested.
- Signing checks: Codex ran `codesign` and related checks too early; next time inspect signing only after the fixed install command fails.
- App path resolution: Codex dynamically resolved paths despite known DerivedData paths; next time use the configured DerivedData path first.
- Memory misuse: Codex tried to fix behavior in memory instead of the invoked skill; next time keep deploy rules in this skill.
- Research scope: Codex researched broad Apple/DDI issues instead of the local CLI deploy method; next time research only after the fixed recipe fails.
- User communication: Codex reported speculative causes and device actions too early; next time report exact command results and avoid speculation.

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
