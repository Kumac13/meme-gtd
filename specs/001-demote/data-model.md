# Data Model: タスクをメモにdemote機能

**Feature**: 001-demote
**Date**: 2025-11-29

## エンティティ

### Task (demote対象)

既存テーブル `issues` (type='task')

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | INTEGER | Primary Key |
| type | TEXT | 'task' |
| title | TEXT | タスクタイトル |
| body_md | TEXT | 本文（Markdown） |
| status | TEXT | タスクステータス |
| is_deleted | INTEGER | 論理削除フラグ |

### Memo (demote結果)

既存テーブル `issues` (type='memo')

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | INTEGER | Primary Key |
| type | TEXT | 'memo' |
| title | TEXT | NULL（メモにはタイトルなし） |
| body_md | TEXT | 組み立てられた本文 |
| status | TEXT | NULL（メモにはステータスなし） |
| is_deleted | INTEGER | 論理削除フラグ |

### Comment

既存テーブル `comments`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | INTEGER | Primary Key |
| issue_id | INTEGER | 親Issue ID |
| body_md | TEXT | コメント本文 |
| created_at | TEXT | 作成日時 |

### Link

既存テーブル `links`

| フィールド | 型 | 説明 |
|-----------|-----|------|
| id | INTEGER | Primary Key |
| source | INTEGER | リンク元Issue ID（新規memo） |
| target | INTEGER | リンク先Issue ID（元task） |
| link_type | TEXT | 'derived_from' |

### Label / Project

既存の `issue_labels`, `issue_projects` テーブルを使用。
demote時にタスクのラベル・プロジェクトをメモにコピー。

## 状態遷移

```
[Task] --demote--> [Memo] + [Link]
   |                  |
   | (変更なし)        | (新規作成)
   v                  v
[Task]             [Memo]
                     |
                     +-- derived_from --> [Task]
```

## バリデーションルール

1. **demote対象タスク**
   - `is_deleted = 0` であること（削除済みタスクは不可）
   - `type = 'task'` であること

2. **生成されるメモ**
   - `body_md` は必須（空文字列不可）
   - タイトルがある場合は本文先頭に `# {title}` を追加

3. **リンク**
   - `source` = 新規メモID
   - `target` = 元タスクID
   - `link_type` = 'derived_from'

## データフロー

```
demoteTask(taskId, options)
    |
    +-- 1. getTask(taskId) // タスク取得
    |
    +-- 2. getComments(taskId) // コメント取得
    |
    +-- 3. buildDemoteBody(task, comments) // 本文組み立て
    |
    +-- 4. createMemo(body_md) // メモ作成
    |
    +-- 5. createLink(memoId, taskId, 'derived_from') // リンク作成
    |
    +-- 6. copyLabels(taskId, memoId) // ラベルコピー
    |
    +-- 7. copyProjects(taskId, memoId) // プロジェクトコピー
    |
    +-- return { task, memoId }
```
