---
name: ios-deploy
description: Use when the user asks to build, deploy, or install the iOS app. Also use automatically after making iOS code changes when the user is testing. Builds and deploys MemeGTD to both iOS Simulator and physical device in parallel.
---

# iOS Deploy

Build and deploy MemeGTD iOS app to both Simulator and physical device.
This skill is the single source of truth for the deploy procedure and configuration values (the `.codex` copy points here).

## Configuration

| Key | Value |
|-----|-------|
| Project dir | `ios/MemeGTD/` |
| Scheme | `MemeGTD` |
| Simulator | `iPhone 17` |
| Device ID | `711DF058-2471-5314-A487-F8682231A5F6` |
| Bundle ID | `name.kumac.MemeGTD` |
| DerivedData | `~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx` |

これらは環境固有の値。ビルド/インストールが「パスが存在しない」系で失敗した場合のみ、以下で再取得して本表を更新する:

```bash
# DerivedData のビルド出力パス（ios/MemeGTD/ で実行）
xcodebuild -scheme MemeGTD -showBuildSettings 2>/dev/null | grep -E '\bBUILD_DIR ='

# 接続中デバイスのID一覧
xcrun devicectl list devices

# 利用可能なシミュレータ一覧
xcrun simctl list devices available | grep iPhone
```

## Steps

Run both builds in **parallel** using two Bash tool calls in a single message.
The working directory must be `ios/MemeGTD/` (absolute path: `/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/ios/MemeGTD`).

### Build 1: Simulator
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

### Build 2: Device
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS,id=711DF058-2471-5314-A487-F8682231A5F6' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

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
