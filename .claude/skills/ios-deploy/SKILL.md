---
name: ios-deploy
description: Use when the user asks to build, deploy, or install the iOS app. Also use automatically after making iOS code changes when the user is testing. Builds and deploys MemeGTD to both iOS Simulator and physical device in parallel.
---

# iOS Deploy

Build and deploy MemeGTD iOS app to both Simulator and physical device.
This skill is the single source of truth for the deploy procedure and configuration values (the `.codex` copy points here).

## <critical>絶対ルール: 実機を何があってもスキップしない</critical>

**IMPORTANT: 実機へのビルド・インストールは、いかなる理由があっても絶対にスキップしない。成功するまでやる。**

「デバイスが unavailable」「タイムアウト」「No profiles」「No Accounts」は全て**過去に何度も発生し、全て復旧手順が確立済みの既知事象**である。これらを理由に実機をスキップして「Simulator は完了、実機はスキップ」と報告するのは、この Mac で何度も繰り返してきた**既知の誤り**であり、ユーザーから厳しく叱責されている。

- 実機ビルド/インストールが失敗したら、**報告する前に**「実機の既知エラーと復旧手順」に従って自力で復旧し、成功させる。
- ユーザーに「ケーブルを確認してください」「Xcode にサインインしてください」と依頼して作業を止めることは**禁止**。まず復旧手順を全部試す。
- 実機の結果が「スキップ」「未完了」のまま報告を終えることは**禁止**。報告できる実機の結果は「成功」か、**全復旧手順を試し切った上での**失敗詳細のみ。
- 実機の失敗を「デバイス未接続」「ログイン切れ」と診断してはならない。過去の同一診断は全て誤診だった。

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

## 実機の既知エラーと復旧手順（必ず順に全部試す。スキップ禁止）

以下は全て過去に発生し、復旧が実証済みのエラー。該当したら**ユーザーに聞かずに**該当手順を実行し、その後「Build 2: Device」から再実行する。

### エラー A: `Timed out waiting for all destinations` / `devicectl list devices` で `unavailable`

一時的なもの。デバイスは繋がっている。**「未接続」と診断してはならない。**

1. 数十秒待ってから `xcrun devicectl list devices` を再実行する（`available (paired)` に戻る。2026-09-08 に実証）。
2. `available (paired)` になったら「Build 2: Device」を再実行する。
3. まだ `unavailable` なら、1〜2 を最低 3 回（間隔 30 秒）繰り返す。
4. それでも `unavailable` なら、エラー B の Xcode AppleScript ビルド（Xcode がデバイス接続を自ら再確立する）を実行し、再度 1 から試す。

### エラー B: `No profiles for 'name.kumac.MemeGTD' were found` / `No Accounts: Add a new account in Accounts settings`

**偽シグナル。Xcode の Apple ID ログインは生きている。**（2026-08-12、08-21、09-08 に発生。毎回同じ手順で復旧済み）
CLI の xcodebuild からアカウントが見えないだけで、`-allowProvisioningUpdates` を付けても直らない。
**ユーザーに「サインインしてください」と求めることは絶対禁止。**（過去に二度この誤診をして強い不信を招いた）

1. 起動中の Xcode に AppleScript でビルドさせ、プロファイルを再生成させる:
   ```bash
   osascript -e 'with timeout of 540 seconds
   tell application "Xcode"
     open "/Users/kumac13/ghq/github.com/Kumac13/meme-gtd/ios/MemeGTD/MemeGTD.xcodeproj"
     delay 5
     set wd to first workspace document
     set ar to build wd
     repeat until completed of ar
       delay 3
     end repeat
     return (status of ar as string)
   end tell
   end timeout'
   ```
2. `ls ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/` で `.mobileprovision` が 2 件（MemeGTD / ShareExtension）生成されたことを確認する。
3. 「Build 2: Device」を標準コマンドで再実行する（そのまま通る）。

### エラー C: `devicectl device install app` が失敗

1. `xcrun devicectl list devices` で状態を確認し、`unavailable` ならエラー A の手順へ。
2. `Failed to load provisioning paramter list ... No provider was found.` は無害なノイズ。失敗ではない。`App installed:` が出ていれば成功。

## Error handling

- If a build fails, show the error output **after** exhausting the recovery steps above.
- **Never skip the device.** A device failure is not a stopping point; it is the start of the recovery procedure above.
- Treat `App installed:` from `devicectl` as device install success.
- Always report results for both targets. The device row must be "成功", or a failure detail that lists every recovery step tried.
