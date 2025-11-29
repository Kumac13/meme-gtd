# Quickstart: タスクをメモにdemote機能

## 概要

タスクの内容（タイトル・本文・コメント）をメモとしてコピー作成する機能。
調査や検討プロセスを含むタスクを完了した際、その成果物をドキュメントとして残せる。

## 使い方

### CLI

```bash
# 基本的な使い方（エディタが開いて編集可能）
mgtd task demote <task-id>

# エディタを開かずに直接demote
mgtd task demote <task-id> --no-editor

# 本文を直接指定
mgtd task demote <task-id> --body "カスタム本文"

# JSON出力
mgtd task demote <task-id> --json
```

### API

```bash
# 自動生成された本文でdemote
curl -X POST http://localhost:3000/api/tasks/123/demote

# カスタム本文を指定
curl -X POST http://localhost:3000/api/tasks/123/demote \
  -H "Content-Type: application/json" \
  -d '{"bodyMd": "# カスタムタイトル\n\nカスタム本文"}'
```

### Web UI

1. タスク詳細画面を開く
2. アクションメニューから「メモにコピー」を選択
3. 編集画面で内容を確認・編集
4. 「作成」ボタンをクリック

## 動作

1. タスクのタイトル・本文・コメントが1つのメモ本文に組み立てられる
2. 新規メモが作成される
3. メモから元タスクへの `derived_from` リンクが作成される
4. タスクのラベル・プロジェクトがメモに継承される
5. **元タスクは変更されない**（削除もステータス変更もされない）

## メモ本文フォーマット

```markdown
# タスクタイトル

タスク本文がここに入る

---
## コメント

### 2025-11-29 10:00:00
最初のコメント

### 2025-11-29 11:00:00
2番目のコメント
```

## 注意事項

- 削除済みタスクはdemoteできない
- コメントがない場合は「コメント」セクションは省略される
- エディタで保存せずに終了するとdemoteはキャンセルされる
