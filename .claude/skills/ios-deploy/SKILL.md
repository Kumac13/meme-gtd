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
| Device ID | `00008140-00121D0C0238801C` |
| Bundle ID | `name.kumac.MemeGTD` |
| DerivedData | `~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx` |

## Steps

Run both builds in **parallel** using two Bash tool calls in a single message:

### Build 1: Simulator
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

### Build 2: Device
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS,id=00008140-00121D0C0238801C' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

**IMPORTANT**: The working directory MUST be `ios/MemeGTD/` (absolute path: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/ios/MemeGTD`). If not, `cd` there first.

After both builds succeed, run install commands in **parallel**:

### Install on Simulator
```bash
xcrun simctl install "iPhone 17" ~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx/Build/Products/Debug-iphonesimulator/MemeGTD.app && xcrun simctl terminate "iPhone 17" name.kumac.MemeGTD 2>/dev/null; xcrun simctl launch "iPhone 17" name.kumac.MemeGTD
```

### Install on Device
```bash
xcrun devicectl device install app --device 00008140-00121D0C0238801C ~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx/Build/Products/Debug-iphoneos/MemeGTD.app 2>&1
```

## Error handling

- If a build fails, show the error output.
- If device is not connected, skip device install and report it.
- Always report results for both targets.
