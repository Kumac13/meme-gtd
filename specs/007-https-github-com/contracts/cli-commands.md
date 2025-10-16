# CLI Command Contracts: Allow Optional Task Body

**Feature**: タスク作成時にbodyを省略可能にする
**Date**: 2025-10-16

## Modified Commands

### mgtd task create

**Summary**: タスク作成コマンド（空body許容に変更）

#### Before (v0.3.0)

**Input**:
```bash
mgtd task create --title "タイトル" --body "" --no-editor
```

**Output**:
```
Error: Task body cannot be empty.
```

**Exit Code**: 2 (oclif error code)

---

#### After (v0.4.0)

**Input**:
```bash
mgtd task create --title "タイトル" --body "" --no-editor
```

**Output** (human-readable):
```
Created task #5
```

**Exit Code**: 0

**Output** (JSON mode):
```bash
mgtd task create --title "タイトル" --body "" --no-editor --json
```

```json
{
  "task": {
    "id": 5,
    "type": "task",
    "title": "タイトル",
    "bodyMd": "",
    "status": "open",
    "scheduledOn": null,
    "isBookmarked": false,
    "createdAt": "2025-10-16T10:30:00.000Z",
    "updatedAt": "2025-10-16T10:30:00.000Z",
    "derivedFrom": null
  }
}
```

**Exit Code**: 0

#### Variations

**空bodyの指定方法**:

1. `--body ""` (明示的な空文字列)
2. `--no-editor` のみ（bodyオプション省略）
   ```bash
   mgtd task create --title "タイトル" --no-editor
   ```

両方とも同じ結果（bodyMd: ""）を返す。

**エディタモード** (変更なし):
```bash
mgtd task create --title "タイトル" --editor
```
- エディタが起動
- 空のまま保存・終了 → bodyMd: "" で作成成功（v0.4.0以降）

---

### mgtd task view

**Summary**: タスク詳細表示コマンド（空body時のプレースホルダー追加）

#### Before (v0.3.0)

**Input**:
```bash
mgtd task view 5
```

**Output** (bodyが空の場合):
```
Task #5: タイトル
Status: open
Updated: 2025-10-16T10:30:00.000Z
Labels: (none)
---

```

*空行のみが表示され、bodyがないことが不明瞭*

---

#### After (v0.4.0)

**Input**:
```bash
mgtd task view 5
```

**Output** (bodyが空の場合):
```
Task #5: タイトル
Status: open
Updated: 2025-10-16T10:30:00.000Z
Labels: (none)
---
(no body)
```

**Exit Code**: 0

**JSON mode** (変更なし):
```bash
mgtd task view 5 --json
```

```json
{
  "task": {
    "id": 5,
    "type": "task",
    "title": "タイトル",
    "bodyMd": "",
    "status": "open",
    "scheduledOn": null,
    "isBookmarked": false,
    "createdAt": "2025-10-16T10:30:00.000Z",
    "updatedAt": "2025-10-16T10:30:00.000Z",
    "derivedFrom": null
  },
  "labels": [],
  "comments": []
}
```

*JSON出力では bodyMd: "" がそのまま表示される（正しい動作）*

**Exit Code**: 0

---

## Unchanged Commands

以下のコマンドは変更なし（既に空bodyを正しく扱っている）:

### mgtd task list

```bash
mgtd task list --json
```

空bodyタスクも正常に一覧表示される。bodyMd: "" が含まれる。

### mgtd task edit

```bash
mgtd task edit 5 --body "新しい内容"
```

空bodyタスクの編集も既存と同様に動作（変更なし）。

---

## Error Cases (変更なし)

以下のエラーケースは引き続き同じ動作:

### タイトルなし
```bash
mgtd task create --body "本文" --no-editor
```
**Error**: `Error: Missing required flag title`

### 不正なステータス
```bash
mgtd task create --title "test" --body "" --no-editor --status invalid
```
**Error**: `Error: Expected --status to be one of: open, next, waiting, scheduled, done, canceled`

---

## Backward Compatibility

### 破壊的変更なし

v0.3.0 で動作していたコマンドは v0.4.0 でも同様に動作:

```bash
# v0.3.0 でも v0.4.0 でも成功
mgtd task create --title "タイトル" --body "本文" --no-editor

# v0.3.0 でエラー → v0.4.0 で成功（新機能）
mgtd task create --title "タイトル" --body "" --no-editor
```

### マイグレーション不要

既存のタスクデータに影響なし。DBスキーマ変更なし。

---

## Testing Contract

### 必須テストケース

#### Test 1: 空bodyでタスク作成 (--body "")
```bash
$ mgtd task create --title "Empty body test" --body "" --no-editor --json
{
  "task": {
    "id": 1,
    "bodyMd": "",
    ...
  }
}
$ echo $?
0
```

#### Test 2: 空bodyでタスク作成 (body省略 + --no-editor)
```bash
$ mgtd task create --title "No body option test" --no-editor --json
{
  "task": {
    "id": 2,
    "bodyMd": "",
    ...
  }
}
$ echo $?
0
```

#### Test 3: 空bodyタスクの表示
```bash
$ mgtd task view 1
Task #1: Empty body test
...
---
(no body)
```

#### Test 4: 空bodyタスクのJSON表示
```bash
$ mgtd task view 1 --json
{
  "task": {
    "bodyMd": "",
    ...
  }
}
```

#### Test 5: 既存テストの継続パス
```bash
$ mgtd task create --title "Normal task" --body "Some content" --no-editor
Created task #3

$ mgtd task view 3
...
---
Some content
```

---

## Exit Codes Summary

| Scenario | Before (v0.3.0) | After (v0.4.0) |
|----------|----------------|----------------|
| `--body ""` | 2 (error) | 0 (success) |
| `--no-editor` (body省略) | 0 (success) | 0 (success) |
| `--body "content"` | 0 (success) | 0 (success) |
| タイトル省略 | 2 (error) | 2 (error) |
