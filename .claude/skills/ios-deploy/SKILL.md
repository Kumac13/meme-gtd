---
name: ios-deploy
description: Use when the user asks to build, deploy, or install the iOS app. Also use automatically after making iOS code changes when the user is testing. Builds and deploys MemeGTD to both iOS Simulator and physical device in parallel.
---

# iOS Deploy

Build and deploy MemeGTD iOS app to both Simulator and physical device.
This skill is the single source of truth for the deploy procedure and configuration values (the `.codex` copy points here).

## <critical>絶対ルール: 実機をスキップしない</critical>

- 実機へのビルド・インストールは、自分の判断でスキップしない。
- 実機が失敗したら、「実機失敗時の Todo」を上から順に全て実行する。
- ユーザーに確認・依頼するのは「実機失敗時の Todo」の最終段階に達したときのみ。その前に聞かない。
- 報告できる実機の結果は「成功」か、「Todo を全て実行した上での失敗（試した項目と結果を列挙）」のみ。

## Configuration

| Key | Value |
|-----|-------|
| Project dir | `ios/MemeGTD/` |
| Scheme | `MemeGTD` |
| Simulator | `iPhone 17`（UDID `8AE8F37B-DB36-4607-A4B5-D1E9BEFEA726`） |
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

### <critical>全コマンドをサンドボックス無効で実行する</critical>

本スキルの `xcodebuild` / `xcrun simctl` / `xcrun devicectl` / `osascript` は**最初の 1 回目から必ず** Bash ツールの `dangerouslyDisableSandbox: true` で実行する。
サンドボックス内で実行すると、以下の**偽エラー**が出てビルドが 1 行も進まない（2026-09-24 に発生。サンドボックス外では同じコマンドがそのまま通った）:

- `CoreSimulator is out of date. Current version (...) is older than build version (...)`
- `No locator class for device extension 'Xcode.Device.CoreDevice'` / `Symbol not found: _$s10CoreDevice...`
- `Unable to find a device matching the provided destination specifier` （実機・シミュレータが両方見えない）
- エラー B の `No Accounts` もサンドボックスが原因（メモリ `ios_signing_no_accounts_trap` 参照）

これらは Xcode の再インストール・コンポーネント更新・再起動で直すものではない。まずサンドボックスを外して再実行する。

### Build 1: Simulator
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS Simulator,name=iPhone 17' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

### Build 2: Device

**Step 2-0（必須・毎回）: プロファイルの有効期限を先に確認する。**
無料 Apple ID のプロファイルは**作成から 7 日で失効**する。失効後に xcodebuild を実行すると `No profiles for 'name.kumac.MemeGTD' were found` で落ちる（2026-08-12 / 08-21 / 09-08 / 09-24 に再発）。これはエラーではなく週 1 回の定常事象なので、**xcodebuild の前に**確認して先に再生成する。

```bash
cd ~/Library/Developer/Xcode/UserData/Provisioning\ Profiles/ && for f in *.mobileprovision; do security cms -D -i "$f" 2>/dev/null | plutil -extract Name raw -; security cms -D -i "$f" 2>/dev/null | plutil -extract ExpirationDate raw -; done; date -u +%Y-%m-%dT%H:%M:%SZ
```

`name.kumac.MemeGTD` と `name.kumac.MemeGTD.ShareExtension` の 2 件が**両方**あり、かつ ExpirationDate が現在時刻より **24 時間以上先**でなければ、Step 2-1 を実行する。条件を満たしていれば Step 2-1 は飛ばして Step 2-2 へ。

**Step 2-1（条件付き）: Xcode に AppleScript でビルドさせ、プロファイルを再生成する。**
CLI の xcodebuild からはアカウントが見えず、`-allowProvisioningUpdates` でも生成できない。Xcode 本体にビルドさせるのが唯一の方法。
Xcode が未起動、またはサンドボックス内から起動された Xcode はアカウントを読めず GUI ビルドでも `No Accounts` になる（2026-09-15 に特定）。そのため**必ず一度 Xcode を終了し、サンドボックス無効の Bash から起動し直してから**ビルドする。1 回目が `failed` ならセッション復元前なので、そのままもう 1 回 `build` する（2 回目で `succeeded`）。
```bash
osascript -e 'tell application "Xcode" to quit'; sleep 5
open -a Xcode /Users/kumac13/ghq/github.com/Kumac13/meme-gtd/ios/MemeGTD/MemeGTD.xcodeproj; sleep 20
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
`succeeded` が返ったら Step 2-0 のコマンドで 2 件が新しい ExpirationDate で存在することを確認する。

**Step 2-2: 実機ビルド。**
```bash
xcodebuild -scheme MemeGTD -destination 'platform=iOS,id=711DF058-2471-5314-A487-F8682231A5F6' build 2>&1 | grep -E '(error:|BUILD|FAILED)'
```

After both builds succeed, run install commands in **parallel**:

### Install on Simulator
`iPhone 17` という名前のシミュレータは 2 台あるため UDID で指定する。未起動だと `Unable to lookup in current state: Shutdown` で失敗するので、先に boot する。
```bash
SIM=8AE8F37B-DB36-4607-A4B5-D1E9BEFEA726
xcrun simctl boot $SIM 2>/dev/null || true
xcrun simctl bootstatus $SIM -b
xcrun simctl install $SIM ~/Library/Developer/Xcode/DerivedData/MemeGTD-anbnqzkhbpvbrqcsmlrystorxlsx/Build/Products/Debug-iphonesimulator/MemeGTD.app
xcrun simctl terminate $SIM name.kumac.MemeGTD 2>/dev/null || true
xcrun simctl launch $SIM name.kumac.MemeGTD
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
4. それでも `unavailable` なら、Step 2-1 の Xcode AppleScript ビルド（Xcode がデバイス接続を自ら再確立する）を実行し、再度 1 から試す。

### エラー B: `No profiles for 'name.kumac.MemeGTD' were found` / `No Accounts: Add a new account in Accounts settings`

**Step 2-0 を実行していれば発生しない。** 発生したなら Step 2-0 を飛ばしたということなので、Step 2-0 → 2-1 → 2-2 をやり直す。
`No Accounts` は偽シグナルで、Xcode の Apple ID ログインは生きている。**ユーザーに「サインインしてください」と求めることは絶対禁止。**（過去に二度この誤診をして強い不信を招いた）

### エラー D: `Timed out waiting for all destinations` + `needs to be unlocked to enable development services`

エラー A と同じタイムアウト文言だが、原因は**実機の画面ロック**。`devicectl list devices` は `available (paired)` のまま。
（2026-09-24 に発生。アンロック後に「Build 2: Device」がそのまま通った）

1. ロック状態を確認する（`passcodeRequired: true` ならロック中）:
   ```bash
   xcrun devicectl device info lockState --device 00008140-00121D0C0238801C
   ```
2. 20 秒間隔で最長 2 分ポーリングし、`passcodeRequired: false` になったら「Build 2: Device」を再実行する。
3. 2 分経ってもロック中なら、ユーザーに「iPhone のロックを解除してください」とだけ依頼し、解除後に再実行する（これは物理操作でありユーザーにしかできない。これ以外の依頼はしない）。

### エラー C: `devicectl device install app` が失敗

1. `xcrun devicectl list devices` で状態を確認し、`unavailable` ならエラー A の手順へ。
2. `Failed to load provisioning paramter list ... No provider was found.` は無害なノイズ。失敗ではない。`App installed:` が出ていれば成功。

## Error handling

- If a build fails, show the error output **after** exhausting the recovery steps above.
- **Never skip the device.** A device failure is not a stopping point; it is the start of the recovery procedure above.
- Treat `App installed:` from `devicectl` as device install success.
- Always report results for both targets. The device row must be "成功", or a failure detail that lists every recovery step tried.
