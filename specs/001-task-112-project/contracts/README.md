# Contracts: Project List View Status Filter

**Date**: 2025-11-29
**Feature**: 001-task-112-project

## API Contracts

この機能はクライアントサイドのみの変更であり、新規APIエンドポイントは不要です。

### 使用する既存エンドポイント

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects/{id}` | GET | プロジェクト詳細取得 |
| `/api/tasks` | GET | タスク一覧取得 |
| `/api/memos` | GET | メモ一覧取得 |

## Component Contracts

### FilterBar Props (既存)

```typescript
interface FilterBarProps {
  showStatusFilter?: boolean;
  statusFilter?: string;
  bookmarkFilter?: boolean;
  onStatusFilterChange?: (status: string) => void;
  onBookmarkFilterChange?: (bookmarked: boolean) => void;
  statusOptions?: string[];
  statusLabels?: Record<string, string>;
  showBookmarkFilter?: boolean;
}
```

### ListView 用カスタムオプション

```typescript
const statusOptions = [
  'all',
  'documents',
  'inbox',
  'open',
  'next',
  'waiting',
  'scheduled',
  'someday',
  'done',
  'canceled'
];

const statusLabels: Record<string, string> = {
  all: 'All',
  documents: 'Documents',
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};
```

### Status Badge Props (新規)

```typescript
interface StatusBadgeProps {
  status: string;
}

// 色分け定義
const statusBadgeClasses: Record<string, string> = {
  inbox: 'bg-gray-100 text-gray-700',
  open: 'bg-blue-100 text-blue-700',
  next: 'bg-green-100 text-green-700',
  waiting: 'bg-yellow-100 text-yellow-700',
  scheduled: 'bg-purple-100 text-purple-700',
  someday: 'bg-orange-100 text-orange-700',
  done: 'bg-gray-200 text-gray-500',
  canceled: 'bg-red-100 text-red-500',
};
```

## URL Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| status | string | フィルタするステータス | `?status=next` |
| bookmarked | boolean | ブックマークフィルタ | `?bookmarked=true` |
