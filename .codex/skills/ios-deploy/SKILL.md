---
name: ios-deploy
description: Use when the user asks to build, deploy, or install the iOS app. Also use automatically after making iOS code changes when the user is testing. Prioritize the physical device by default; if the user explicitly asks for `実機`, `device`, `physical device`, or only one target, deploy only to that target. Launch the app only when the user explicitly asks to run/launch/open it.
---

# iOS Deploy

Build and install MemeGTD iOS app, prioritizing the physical device.

## Critical local rule

In this repo and environment, do not begin by running `xcrun devicectl`, `xcrun simctl`, or `xcodebuild`
inside the sandbox when deploying to iOS. CoreDevice, Simulator services, signing assets, and SwiftPM
caches are known to fail from the sandbox here.

For iOS deploy commands that use `devicectl`, `simctl`, or `xcodebuild`, request escalated execution first
with a concise justification. Do not do a sandbox-first attempt just to observe the predictable failure.

## Configuration

| Key | Value |
|-----|-------|
| Project dir | `ios/MemeGTD/` |
| Scheme | `MemeGTD` |
| DerivedData | `./.codex-derived-data` |

## Steps

The working directory MUST be `ios/MemeGTD/` (absolute path: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/ios/MemeGTD`).

Do not hardcode simulator names, device IDs, bundle IDs, or DerivedData paths. Discover them first.

## Priority and scope

- Physical device deployment is the priority. Do device discovery, device build, and device install before spending time on Simulator work unless the user explicitly asks for Simulator only.
- If the user asks for `実機`, `device`, or `physical device`, do not discover, build, install, or launch the Simulator.
- If the user asks generally to deploy/install after iOS code changes and does not specify a target, deploy to the physical device first. After device install succeeds, deploy to Simulator only if the user asked for both targets or if there is a clear testing reason.
- `deploy` and `install` mean build and install. Do not launch the app after install unless the user explicitly asks to `launch`, `run`, `open`, or otherwise says they want the app started.
- Never treat failure as a reason to stop with a vague report. Diagnose the immediate error, gather local evidence, research the error on the web, form a concrete hypothesis, and try the next justified fix within available permissions. If user action is required on the physical device, state the exact device-side action and why it is required.

### Resolve runtime values
```bash
BUNDLE_ID="$(rg -m 1 'PRODUCT_BUNDLE_IDENTIFIER = ' MemeGTD.xcodeproj/project.pbxproj | sed -E 's/.*PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/\1/')"
SIMULATOR_ID="$(xcrun simctl list devices available | rg -m 1 'iPhone .*\([0-9A-F-]{36}\) \((Booted|Shutdown)\)$' | sed -E 's/.*\(([0-9A-F-]{36})\) \((Booted|Shutdown)\)$/\1/')"
DEVICE_ID="$(xcrun devicectl list devices | awk 'NR > 2 && $1 !~ /^-/ && $3 ~ /[0-9A-F-]{36}/ { print $3; exit }')"
```

- If device deployment is in scope, resolve `BUNDLE_ID` and `DEVICE_ID` first.
- If Simulator deployment is in scope, resolve `SIMULATOR_ID`.
- If `DEVICE_ID` is empty, investigate before giving up: rerun `xcrun devicectl list devices` with escalated permissions if needed, check the raw output for pairing/availability state, and report the exact reason the device cannot be used.
- If `SIMULATOR_ID` is empty and Simulator deployment is in scope, report that no available simulator was found.
- If the user explicitly asked for only one target, skip discovery and deployment for the other target.

Use `-derivedDataPath ./.codex-derived-data` on every build so install paths are deterministic without depending on a user-specific Xcode cache path.

When both targets are requested, start the physical device build first. Simulator work must not block physical device deployment.

### Build 1: Device
```bash
xcodebuild -scheme MemeGTD -derivedDataPath ./.codex-derived-data -destination "platform=iOS,id=$DEVICE_ID" -allowProvisioningUpdates build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

### Build 2: Simulator
```bash
xcodebuild -scheme MemeGTD -derivedDataPath ./.codex-derived-data -destination "platform=iOS Simulator,id=$SIMULATOR_ID" build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

In this environment, `xcodebuild`, `simctl`, and `devicectl` must be treated as outside-sandbox commands for deploy work because they access SwiftPM caches, Simulator services, signing assets, and physical device services. Request escalated execution before running them. If one is accidentally run in the sandbox and fails with cache, simulator, CoreDevice, or provisioning access errors, rerun the same command with escalated permissions and avoid repeating the sandbox-first path.

After the builds finish, install whatever succeeded. Do not block device deployment on Simulator issues, and do not block Simulator deployment on a device signing failure. Do not launch after install unless the user explicitly requested launch/run/open.

### Install on Simulator
```bash
xcrun simctl install "$SIMULATOR_ID" ./.codex-derived-data/Build/Products/Debug-iphonesimulator/MemeGTD.app
```

### Launch on Simulator (only when explicitly requested)
```bash
xcrun simctl terminate "$SIMULATOR_ID" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID"
```

### Install on Device
```bash
xcrun devicectl device install app --device "$DEVICE_ID" ./.codex-derived-data/Build/Products/Debug-iphoneos/MemeGTD.app 2>&1
```

### Launch on Device (only when explicitly requested)
```bash
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1
```

## Error handling

- Do not intentionally start a deploy build in the sandbox. If a sandboxed build happens by mistake and fails with `Operation not permitted`, SwiftPM cache errors, CoreDevice errors, or Simulator service errors, rerun with escalated permissions.
- If a build fails, show the error output.
- If the device build fails, capture the exact failing phase and error domain. Check signing settings, provisioning profile availability, bundle ID, entitlements, target deployment version, connected device OS version, and package resolution before changing anything.
- If the device build fails with missing provisioning profiles, retry with `-allowProvisioningUpdates`.
- If install fails, capture the full `devicectl` output, verify that `MemeGTD.app` exists under `./.codex-derived-data/Build/Products/Debug-iphoneos/`, verify code signing with `codesign --verify --deep --strict --verbose=4`, inspect app entitlements with `codesign -d --entitlements :-`, and decode `embedded.mobileprovision` with `security cms -D -i` when permissions allow.
- If launch was explicitly requested and launch fails with `Security`, `RequestDenied`, invalid code signature, inadequate entitlements, or profile not explicitly trusted, do not guess. Verify local signing/provisioning evidence, then web-search the exact error text using Apple Developer Documentation, Apple Developer Forums, and other credible sources. Form a hypothesis such as "developer profile is installed but not trusted on the device" only after comparing local evidence with the researched error. If trust is required, tell the user the exact iPhone path, for example Settings > General > VPN & Device Management > Developer App > Trust.
- For every failure, perform web research after local evidence collection and before deciding the fix unless the error is a known sandbox permission issue already covered above.
- Do not make random project changes to signing, entitlements, deployment target, bundle ID, or team settings. Each change must follow from a stated hypothesis and evidence.
- Keep going through justified diagnosis and remediation steps. Do not say the deployment "cannot be done" unless the remaining blocker is outside available permissions or requires a physical action from the user on the device.
- If the user asked for `実機` or `device`, do not spend time on Simulator at all.
- If device is not connected, do not silently skip. Report the raw discovery result and the concrete next action needed, such as connecting/unlocking the iPhone, trusting the Mac, enabling Developer Mode, or pairing the device.
- Treat `simctl terminate ... found nothing to terminate` as non-fatal.
- `devicectl` may print an initial provider warning before continuing; if it later reports `App installed:`, treat install as successful.
- Report results only for targets that were in scope, and clearly separate build, install, and launch if launch was explicitly requested.
