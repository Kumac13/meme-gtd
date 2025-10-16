# Quickstart: Allow Optional Task Body

**Feature**: タスク作成時にbodyを省略可能にする
**Version**: 0.4.0
**Date**: 2025-10-16

## What's New

v0.4.0 から、タスク作成時にbodyを省略できるようになりました。GTDの「素早く記録する」原則に基づき、タイトルだけでタスクを作成し、詳細は後から追加できます。

---

## Quick Examples

### 基本: タイトルのみでタスク作成

```bash
mgtd task create --title "羅針盤に回答する" --no-editor
```

**出力**:
```
Created task #5
```

### 明示的な空body指定

```bash
mgtd task create --title "買い物リスト作成" --body "" --no-editor
```

両方とも同じ結果（bodyが空のタスク）を作成します。

### 空bodyタスクの確認

```bash
mgtd task view 5
```

**出力**:
```
Task #5: 羅針盤に回答する
Status: open
Updated: 2025-10-16T10:30:00.000Z
Labels: (none)
---
(no body)
```

`(no body)` が表示され、bodyが空であることが明確に分かります。

---

## Step-by-Step Tutorial

### Step 1: タスクを素早く記録

思いついたタスクをすぐに記録:

```bash
mgtd task create --title "プロジェクト計画を立てる" --no-editor
mgtd task create --title "ドキュメントをレビュー" --no-editor
mgtd task create --title "チームミーティング準備" --no-editor
```

**ポイント**: `--no-editor` フラグでエディタ起動をスキップ。

### Step 2: タスク一覧を確認

```bash
mgtd task list
```

**出力**:
```
  #3  プロジェクト計画を立てる  [open]  2025-10-16T10:30:00.000Z
  #4  ドキュメントをレビュー      [open]  2025-10-16T10:31:00.000Z
  #5  チームミーティング準備      [open]  2025-10-16T10:32:00.000Z
```

### Step 3: 後から詳細を追加

```bash
mgtd task edit 3 --body "- 目標設定\n- スケジュール作成\n- リソース確認"
```

### Step 4: 更新されたタスクを確認

```bash
mgtd task view 3
```

**出力**:
```
Task #3: プロジェクト計画を立てる
Status: open
Updated: 2025-10-16T10:35:00.000Z
Labels: (none)
---
- 目標設定
- スケジュール作成
- リソース確認
```

---

## Comparison: Before vs After

### Before (v0.3.0)

```bash
$ mgtd task create --title "タスク" --body "" --no-editor
Error: Task body cannot be empty.
```

必ず本文を入力する必要がありました。

### After (v0.4.0)

```bash
$ mgtd task create --title "タスク" --body "" --no-editor
Created task #1
```

タイトルだけで作成できるようになりました。

---

## Use Cases

### Use Case 1: GTDキャプチャフェーズ

思考を止めずにタスクを記録:

```bash
# 素早く記録
mgtd task create -t "電話する" --no-editor
mgtd task create -t "メール返信" --no-editor
mgtd task create -t "レポート作成" --no-editor

# 後で詳細を整理
mgtd task edit 1 --body "山田さんに進捗確認の電話"
```

### Use Case 2: 会議中のタスク作成

会議中にメモを取りながらタスク作成:

```bash
# 会議中: タイトルだけ記録
mgtd task create -t "API設計レビュー" --status next --no-editor

# 会議後: 詳細を追加
mgtd task edit <id> --body-file meeting-notes.md
```

### Use Case 3: プレースホルダータスク

詳細未定のタスクを先に作成:

```bash
mgtd task create -t "Q4施策検討" --status waiting --no-editor
```

後で情報が揃ってから詳細を追加。

---

## Advanced Usage

### JSON モードで確認

```bash
mgtd task create -t "test" --body "" --no-editor --json
```

**出力**:
```json
{
  "task": {
    "id": 10,
    "type": "task",
    "title": "test",
    "bodyMd": "",
    "status": "open",
    "isBookmarked": false,
    "createdAt": "2025-10-16T10:30:00.000Z",
    "updatedAt": "2025-10-16T10:30:00.000Z"
  }
}
```

`bodyMd: ""` が正しく保存されています。

### ラベルやプロジェクトと組み合わせ

```bash
mgtd task create \
  --title "緊急対応" \
  --body "" \
  --no-editor \
  --label urgent \
  --label bug \
  --status next
```

---

## Migration Guide

### 既存ユーザー向け

**Breaking Changes**: なし

既存のワークフロー（body必須）は引き続き動作します:

```bash
# v0.3.0 でも v0.4.0 でも同じ
mgtd task create --title "タスク" --body "詳細" --no-editor
```

**新機能**: 空body許容

```bash
# v0.4.0 で新たに可能
mgtd task create --title "タスク" --no-editor
```

### エディタモードの変更

v0.3.0:
```bash
$ mgtd task create -t "test" --editor
# エディタで空のまま保存
Error: Task body cannot be empty.
```

v0.4.0:
```bash
$ mgtd task create -t "test" --editor
# エディタで空のまま保存
Created task #1
```

---

## Tips & Best Practices

### Tip 1: エイリアスで更に高速化

```bash
# ~/.bashrc or ~/.zshrc
alias mt='mgtd task create --no-editor --title'
```

使用例:
```bash
mt "買い物に行く"
mt "ドキュメント更新"
```

### Tip 2: 空bodyタスクのフィルタリング

```bash
# JSON モードで空bodyタスクを抽出（jq使用）
mgtd task list --json | jq '.tasks[] | select(.bodyMd == "")'
```

### Tip 3: バッチ作成

```bash
# シェルスクリプトで複数タスクを一括作成
cat tasks.txt | while read line; do
  mgtd task create -t "$line" --no-editor
done
```

---

## FAQ

### Q1: 空bodyのタスクは後から編集できますか？

**A**: はい、`mgtd task edit <id> --body "新しい内容"` で追加できます。

### Q2: エディタモードでも空bodyで作成できますか？

**A**: はい。`--editor` フラグを使った場合も、空のまま保存すれば空bodyで作成されます。

### Q3: memoも同様に空body許容されますか？

**A**: いいえ。v0.4.0ではtaskのみ対応。memoは今後のバージョンで対応予定です。

### Q4: 既存のタスクデータに影響はありますか？

**A**: ありません。DBスキーマ変更なし、既存データはそのまま保持されます。

### Q5: プレースホルダーメッセージをカスタマイズできますか？

**A**: 現時点では "(no body)" 固定です。将来的な設定対応は検討中です。

---

## Troubleshooting

### 問題: エラー "Task body cannot be empty" が出る

**原因**: v0.3.0 以前のバージョンを使用している

**解決**:
```bash
mgtd version
# → 0.3.0 が表示される場合はアップデート

pnpm install
pnpm build
```

### 問題: プレースホルダーが表示されない

**原因**: JSON モードで表示している可能性

**解決**:
```bash
# 人間向け表示（プレースホルダーあり）
mgtd task view 5

# JSON表示（bodyMd: "" のまま）
mgtd task view 5 --json
```

---

## Next Steps

1. **実際に使ってみる**: 今日のタスクをタイトルだけで記録してみましょう
2. **ワークフローの最適化**: エイリアスやスクリプトで更に効率化
3. **フィードバック**: 使用感をissueで共有してください

詳細は [spec.md](./spec.md) および [contracts/cli-commands.md](./contracts/cli-commands.md) を参照してください。
