# Quickstart: Link Command

**Date**: 2025-10-18
**Feature**: Link Command for Task Relationship Management

## Overview

linkコマンドの動作確認とテストシナリオ。手動テスト用の手順とスクリプト例を提供。

**IMPORTANT**: 必ずテストDBを使用すること（`CLAUDE.md`のテストDB使用ルールに従う）

## Prerequisites

1. プロジェクトのビルドが完了していること
   ```bash
   pnpm build
   ```

2. テスト用DBの準備
   ```bash
   # テスト環境のセットアップ
   TEST_DIR=$(mktemp -d)
   TEST_CONFIG="$TEST_DIR/context.json"
   TEST_DB="$TEST_DIR/issues.db"

   # エイリアス設定（セッション中有効）
   alias mgtd-test='MGTD_CONFIG_PATH="$TEST_CONFIG" node dist/index.js'

   # DB初期化
   MGTD_CONFIG_PATH="$TEST_CONFIG" pnpm --filter meme-gtd-cli exec node dist/index.js init -d "$TEST_DB" -f -j
   ```

## Quick Test Scenarios

### Scenario 1: 親子タスクの作成と表示

```bash
# 1. テストタスクを作成
mgtd-test task create -t "親タスク: Webサイトリニューアル" -b "" --no-editor -j
# → タスクID 1

mgtd-test task create -t "子タスク: デザインモックアップ作成" -b "" --no-editor -j
# → タスクID 2

mgtd-test task create -t "子タスク: コンテンツライティング" -b "" --no-editor -j
# → タスクID 3

# 2. 親子リンクを作成（子→親の視点）
mgtd-test link add --type parent --source 2 --target 1
# Expected: Link created: #1 (2 --parent--> 1)

mgtd-test link add --type parent --source 3 --target 1
# Expected: Link created: #2 (3 --parent--> 1)

# 3. 親タスクのリンクを表示
mgtd-test link list 1
# Expected:
# Links for issue #1:
#   #1   parent        ←  Issue #2
#   #2   parent        ←  Issue #3

# 4. 子タスクのリンクを表示
mgtd-test link list 2
# Expected:
# Links for issue #2:
#   #1   parent        →  Issue #1
```

---

### Scenario 2: 関連タスクの作成

```bash
# 1. 関連タスクを作成
mgtd-test task create -t "競合調査" -b "" --no-editor -j
# → ID 4

mgtd-test task create -t "価格戦略策定" -b "" --no-editor -j
# → ID 5

# 2. 関連リンクを作成
mgtd-test link add --type relates --source 4 --target 5
# Expected: Link created: #3 (4 --relates--> 5)

# 3. 双方向確認
mgtd-test link list 4
# Expected: #3   relates       →  Issue #5

mgtd-test link list 5
# Expected: #3   relates       ←  Issue #4
```

---

### Scenario 3: メモからタスクへの派生

```bash
# 1. メモを作成
echo "# アイデア\nWebサイトのパフォーマンス改善が必要" | mgtd-test memo create -j
# → ID 6 (memo)

# 2. メモから派生したタスクを作成
mgtd-test task create -t "Webパフォーマンス最適化" -b "画像圧縮とCDN導入" --no-editor -j
# → ID 7 (task)

# 3. 派生リンクを作成
mgtd-test link add --type derived_from --source 7 --target 6
# Expected: Link created: #4 (7 --derived_from--> 6)

# 4. タスクのリンク確認
mgtd-test link list 7
# Expected: #4   derived_from  →  Issue #6
```

---

### Scenario 4: リンクの削除

```bash
# 1. リンクを作成
mgtd-test link add --type relates --source 2 --target 3
# Expected: Link created: #5 (2 --relates--> 3)

# 2. リンク削除（確認あり）
mgtd-test link remove 5
# Prompt: Delete link #5 (2 --relates--> 3)? (y/N): y
# Expected: Link #5 deleted

# 3. 削除確認
mgtd-test link list 2
# Expected: Link #5が表示されない

# 4. リンク削除（--yes）
mgtd-test link add --type relates --source 2 --target 3
# → #6
mgtd-test link remove 6 --yes
# Expected: Link #6 deleted (プロンプトなし)
```

---

### Scenario 5: バリデーションエラーの確認

```bash
# 1. 自己参照エラー
mgtd-test link add --type parent --source 1 --target 1
# Expected: Error: Cannot link issue to itself (ID: 1)

# 2. 重複エラー
mgtd-test link add --type parent --source 2 --target 1
# Expected: Link created: #...

mgtd-test link add --type parent --source 2 --target 1
# Expected: Error: Link already exists (source: 2, target: 1, type: parent)

# 3. 存在しないID
mgtd-test link add --type parent --source 999 --target 1
# Expected: Error: Issue #999 not found

mgtd-test link add --type parent --source 1 --target 999
# Expected: Error: Issue #999 not found

# 4. 無効なタイプ
mgtd-test link add --type invalid --source 1 --target 2
# Expected: Error: Invalid link type: invalid
```

---

### Scenario 6: typeフィルタの動作確認

```bash
# 1. 複数タイプのリンクを作成
mgtd-test link add --type parent --source 2 --target 1
mgtd-test link add --type relates --source 2 --target 4
mgtd-test link add --type child --source 2 --target 3

# 2. フィルタなし
mgtd-test link list 2
# Expected: 3つのリンク全て表示

# 3. parentフィルタ
mgtd-test link list 2 --type parent
# Expected: parentタイプのみ表示

# 4. relatesフィルタ
mgtd-test link list 2 --type relates
# Expected: relatesタイプのみ表示
```

---

### Scenario 7: JSON出力の確認

```bash
# 1. link add --json
mgtd-test link add --type parent --source 2 --target 1 --json
# Expected: {"id":...,"sourceIssueId":2,"targetIssueId":1,"linkType":"parent","createdAt":"..."}

# 2. link list --json
mgtd-test link list 2 --json
# Expected: [{"id":...,"direction":"outgoing",...}, ...]

# 3. link remove --json --yes
mgtd-test link remove <id> --yes --json
# Expected: {"deleted":true,"linkId":<id>}
```

---

## End-to-End Workflow Test

完全なGTDワークフローのシミュレーション：

```bash
# === 1. Capture（キャプチャ）===
echo "# プロジェクトアイデア\nモバイルアプリを開発したい" | mgtd-test memo create -j
# → Memo ID 100

# === 2. Clarify（明確化）===
# メモから実行可能タスクを作成
mgtd-test task create -t "モバイルアプリ開発プロジェクト" -b "iOSとAndroid対応" --no-editor -j
# → Task ID 101

# 派生リンクを作成
mgtd-test link add --type derived_from --source 101 --target 100

# === 3. Organize（整理）===
# プロジェクトを子タスクに分割
mgtd-test task create -t "UI/UXデザイン" -b "" --no-editor -j  # → ID 102
mgtd-test task create -t "バックエンドAPI開発" -b "" --no-editor -j  # → ID 103
mgtd-test task create -t "フロントエンド実装" -b "" --no-editor -j  # → ID 104

# 親子関係を構築
mgtd-test link add --type parent --source 102 --target 101
mgtd-test link add --type parent --source 103 --target 101
mgtd-test link add --type parent --source 104 --target 101

# === 4. Review（レビュー）===
# プロジェクト全体のリンク構造を確認
mgtd-test link list 101
# Expected:
#   #...  derived_from  →  Issue #100
#   #...  parent        ←  Issue #102
#   #...  parent        ←  Issue #103
#   #...  parent        ←  Issue #104

# === 5. Engage（実行）===
# 関連タスクを追加
mgtd-test task create -t "テストケース作成" -b "" --no-editor -j  # → ID 105
mgtd-test link add --type relates --source 104 --target 105

# 親タスクのクローズ（子タスクも確認）
mgtd-test task close 101
mgtd-test link list 101
# Expected: リンクは維持されている（タスククローズしてもリンクは削除されない）
```

---

## Cleanup

テスト後はテスト環境をクリーンアップ：

```bash
# テストディレクトリを削除
rm -rf "$TEST_DIR"

# エイリアスを削除
unalias mgtd-test
```

---

## Automated Test Script

上記シナリオを自動実行するスクリプト例：

```bash
#!/bin/bash
# test-link-commands.sh

set -e  # エラーで停止

# Setup
TEST_DIR=$(mktemp -d)
TEST_CONFIG="$TEST_DIR/context.json"
TEST_DB="$TEST_DIR/issues.db"
MGTD="MGTD_CONFIG_PATH=$TEST_CONFIG pnpm --filter meme-gtd-cli exec node dist/index.js"

echo "==> Initializing test DB..."
eval "$MGTD init -d $TEST_DB -f -j" > /dev/null

echo "==> Creating test tasks..."
TASK1=$(eval "$MGTD task create -t 'Parent Task' -b '' --no-editor -j" | jq -r '.id')
TASK2=$(eval "$MGTD task create -t 'Child Task 1' -b '' --no-editor -j" | jq -r '.id')
TASK3=$(eval "$MGTD task create -t 'Child Task 2' -b '' --no-editor -j" | jq -r '.id')

echo "==> Creating links..."
eval "$MGTD link add --type parent --source $TASK2 --target $TASK1"
eval "$MGTD link add --type parent --source $TASK3 --target $TASK1"

echo "==> Listing links..."
eval "$MGTD link list $TASK1"

echo "==> Testing validations..."
eval "$MGTD link add --type parent --source $TASK1 --target $TASK1" && exit 1 || echo "  ✓ Self-reference blocked"
eval "$MGTD link add --type parent --source $TASK2 --target $TASK1" && exit 1 || echo "  ✓ Duplicate blocked"

echo "==> Cleanup..."
rm -rf "$TEST_DIR"

echo "==> All tests passed!"
```

---

## Troubleshooting

### 問題: "Issue not found"エラーが発生

**原因**: テストDBではなく本番DBを参照している

**解決**: 必ず`MGTD_CONFIG_PATH`環境変数を設定
```bash
MGTD_CONFIG_PATH="$TEST_CONFIG" node dist/index.js ...
```

### 問題: リンクが作成されない

**原因**: DB初期化が不完全

**解決**: テストDBを再初期化
```bash
rm -rf "$TEST_DIR"
# セットアップ手順を再実行
```

### 問題: JSON出力が壊れている

**原因**: 標準エラー出力がJSON混入

**解決**: stderr をリダイレクト
```bash
mgtd-test link add ... --json 2>/dev/null | jq
```

---

## Performance Benchmark (Optional)

大量リンク作成時のパフォーマンス測定：

```bash
# 1000個のタスクを作成
for i in {1..1000}; do
  mgtd-test task create -t "Task $i" -b "" --no-editor -j > /dev/null
done

# 500個のリンクを作成
time for i in {2..501}; do
  mgtd-test link add --type parent --source $i --target 1 --json > /dev/null
done

# リンク一覧取得のパフォーマンス
time mgtd-test link list 1 --json > /dev/null
```

**Expected**: < 1秒で500リンク作成、< 0.1秒でリスト取得（SQLiteの標準パフォーマンス）

---

## Next Steps

- [ ] 自動テストスイート作成（`packages/cli/test/commands/link/*.test.ts`）
- [ ] CI/CDパイプラインへの統合
- [ ] パフォーマンス最適化（indexの追加検討）
