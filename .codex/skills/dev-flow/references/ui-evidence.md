# UI の確認とスクショ

UI の実装確認・レビューと、見た目の選択肢をユーザーが選ぶ質問で、実画面のスクショを撮ってユーザーに出すための固定手順。変更前（現行）の画面は、ユーザーが求めたときだけ撮る。確認用の道具を毎回作り直さず、ここにある手順を使う。

## 撮る前に決めること

1. 依頼文と確認基準から、見せるべき画面と状態を書き出す。入口（どこから呼ぶか）、変更した画面、その前後の画面を含める。
2. データを実際の利用に近づける。コメントやリンクは複数件入れ、変更で導入した状態（未同期など）と通常の状態が同じ画面に並ぶようにする（1件だけの画面や、片方の状態だけの画面では確認にならないため）。
3. 実装した実画面を使う。静的なモックや、表示部品だけを取り出した画面は使わない。

データは必ずテスト用サーバーに入れる。本番（ポート3000）のデータは画面確認に使わない。

## テスト用サーバー

テスト環境の作り方は `test-env` スキルに従う。ここには、作業中の worktree の変更を表示するときの差分だけを書く。

- その worktree で `pnpm build` を実行してから、テスト DB を初期化してサーバーを起動する。
- ポート3001を別の作業ツリーのサーバーが使っている場合は、ポートを指定して起動する。以降の例は3002を使う。

```bash
pnpm server:dev --port 3002
```

- 新しく作った worktree では、`pnpm mgtd:test init` が better-sqlite3 の bindings file を見つけられずに失敗する（pnpm がインストール時にこのパッケージのビルドを実行しないため。`pnpm rebuild better-sqlite3` でもビルドされない。2026-11-24 検証）。パッケージのインストールスクリプトを直接実行する。

```bash
(cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run install)
```

データは API で入れる。画像の保存先は最初に1つ決める。

```bash
OUT_DIR=$(mktemp -d)
BASE=http://localhost:3002
jq -n --arg t "$TITLE" --arg b "$BODY" '{title:$t,bodyMd:$b}' \
  | curl -fsS -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' -d @-
jq -n --arg b "$COMMENT" '{bodyMd:$b}' \
  | curl -fsS -X POST "$BASE/api/tasks/$TASK_ID/comments" -H 'Content-Type: application/json' -d @-
```

## Web

```bash
agent-browser open "http://localhost:3002/tasks/$TASK_ID"
agent-browser screenshot "$OUT_DIR/web-task.png"
agent-browser close
```

操作が必要な場合は `.claude/skills/agent-browser/SKILL.md` のコマンドを使う。

## iOS（シミュレーター）

`xcodebuild`・`xcrun simctl`・`xcrun devicectl`・`axe` は、`.codex/rules/dev-flow.rules` の許可ルールで、承認なしにサンドボックスの外で実行される。ルールに一致させるため、次を守る。

- 変数（`$UDID` など）・リダイレクト（`2>&1`、`> file`）・コマンド置換（`$(...)`）・パイプ（`| grep`）を使わず、値を直接書いた単純なコマンドにする。`xcodebuild` の出力は `-quiet` で絞る。
- escalated（`sandbox_permissions`）を付けない。ルールに一致しない形で呼ぶと承認待ちになり、ユーザーが張り付く必要が出る。
- それ以外のコマンド（`set`・`git`・`cat`・`rg` など）は、サンドボックス内でそのまま実行する。

以下の例の `<UDID>` や `<OUT_DIR>` は、最初に決めた値を直接書く。

同じ名前の「iPhone 17」が iOS のバージョンごとに複数あり、同時に起動していることがある。名前で指定すると、コマンドごとに別の端末へ届くことがあるため、最初に UDID を1つ決めて、ビルド・インストール・起動・操作・撮影のすべてで同じ UDID を使う。

一覧から、Task が指定する iOS バージョンの iPhone 17 の UDID を選ぶ。指定が無ければ、一覧にある最新の iOS バージョンのものを選ぶ。

```bash
xcrun simctl list devices available
xcrun simctl bootstatus <UDID> -b
```

ビルドとインストールは、確認する worktree の `ios/MemeGTD/` で行う。scheme と Bundle ID は `ios-deploy` スキルの Configuration と同じ。ビルド出力先は `-derivedDataPath` で worktree 内の `ios/MemeGTD/build`（git の管理外）に固定し、出力先を調べ直さない。`<WORKTREE>` は worktree の絶対パスを直接書く。

```bash
xcodebuild -quiet -scheme MemeGTD -destination "platform=iOS Simulator,id=<UDID>" -derivedDataPath <WORKTREE>/ios/MemeGTD/build build
xcrun simctl install <UDID> <WORKTREE>/ios/MemeGTD/build/Build/Products/Debug-iphonesimulator/MemeGTD.app
```

起動時の引数で接続先をテスト用サーバーに向ける。引数はその起動にだけ効き、アプリの保存済み設定は変わらない。

```bash
xcrun simctl launch --terminate-running-process <UDID> name.kumac.MemeGTD -appMode server -apiUrl http://127.0.0.1:3002
```

画面の操作は `axe`、撮影は `simctl` で行う。

```bash
axe describe-ui --udid <UDID>
axe tap --label "<画面上の文言>" --wait-timeout 8 --udid <UDID>
xcrun simctl io <UDID> screenshot <OUT_DIR>/ios-thread.png
```

`axe describe-ui` がホーム画面の要素を返す場合は、UDID が起動先と食い違っている。

オフラインの状態は、テスト用サーバーを止めて作る。

確認用に新しく起動したシミュレーターとテスト用サーバーは、確認が終わったら終了する。

## 提出前点検

撮った画像は `view_image` で自分で開き、次を1つずつ確かめる。満たさない画像は出さずに、直すか撮り直す。

1. 依頼文の要求と確認基準を1つずつ画像と照合し、すべて写っている。依頼された状態そのものが写っている（似た別の状態ではない）。
2. 見切れ、重なり、途切れた線、文字の省略、不揃いな位置や高さが無い。
3. 色と部品が既存のデザインシステムの範囲にある。iOS は `ios/README.md` のデザインシステム節、Web は変更するディレクトリの `CLAUDE.md` と既存コンポーネントに従う。
4. 変更していない周辺の表示が、変更前と変わっていない。

点検で見つけた崩れは、報告に書くだけにせず直す。

## 提出

- 画像は `![何の画面のどの状態か](絶対パス)` でインライン表示する。リンクだけにしない。
- 画像ごとに、どの要求を確認できるかを1行で添える。
- 変更後の確認では、撮った画像を対象ごとにすべて出す（Web と iOS、Memo・Task・Article のように対象が複数ある場合は、対象ごと）。変更前（現行）の画面は、ユーザーが求めていなければ出さない。
