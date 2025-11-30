# Data Model: link設定時の検索機能

**Date**: 2025-11-30
**Feature**: 001-link

## 概要

この機能はフロントエンドのみの変更であり、データモデルの変更はありません。
既存のエンティティ（Issue, Link）をそのまま使用します。

## 既存エンティティ（参照のみ）

### Issue（タスク/メモ）

```typescript
interface Task {
  id: number;
  type: 'task';
  title: string;
  bodyMd: string;
  status: 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done' | 'canceled';
  scheduledOn: string | null;
  startTime: string | null;
  endDate: string | null;
  endTime: string | null;
  duration: number | null;
  meta: Record<string, any>;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}

interface Memo {
  id: number;
  type: 'memo';
  title: null;            // メモにはタイトルがない
  bodyMd: string;
  status: null;
  scheduledOn: null;
  meta: Record<string, any>;
  isBookmarked: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  labels: string[];
}
```

### Link

```typescript
interface Link {
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
}
```

## 新規フロントエンド型定義

### IssuePickerItem

IssuePicker コンポーネントで使用する統一型。TaskとMemoの両方を扱う。

```typescript
interface IssuePickerItem {
  id: number;
  type: 'task' | 'memo';
  title: string;          // タスク: title, メモ: bodyMdの先頭行（トリミング）
  status: string | null;  // タスク: status値, メモ: null
  updatedAt: string;      // ソート用
}
```

### 変換ロジック

```typescript
// Task → IssuePickerItem
function taskToPickerItem(task: Task): IssuePickerItem {
  return {
    id: task.id,
    type: 'task',
    title: task.title,
    status: task.status,
    updatedAt: task.updatedAt,
  };
}

// Memo → IssuePickerItem
function memoToPickerItem(memo: Memo): IssuePickerItem {
  // bodyMdの最初の行をタイトルとして使用
  const firstLine = memo.bodyMd.split('\n')[0]?.trim() || '(無題)';
  // 長すぎる場合はトリミング
  const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;

  return {
    id: memo.id,
    type: 'memo',
    title,
    status: null,
    updatedAt: memo.updatedAt,
  };
}
```

## データフロー

```
[検索入力]
    ↓
[デバウンス 300ms]
    ↓
[並行APIコール]
    ├── TasksService.listTasks({ search })
    └── MemosService.listMemos({ search })
    ↓
[レスポンス変換]
    ├── tasks.map(taskToPickerItem)
    └── memos.map(memoToPickerItem)
    ↓
[マージ & ソート (updatedAt DESC)]
    ↓
[上位10件に制限]
    ↓
[IssuePickerItem[] として表示]
```

## バリデーションルール

| ルール | 場所 | 説明 |
|--------|------|------|
| 自己参照禁止 | フロントエンド | `excludeId`で現在編集中のIDを除外 |
| 重複禁止 | フロントエンド | 既存リンク済みIDをフィルタリング |
| 存在確認 | バックエンド | リンク作成API側で検証（既存実装） |
