# Data Model: タスクからタスクを作成する機能

**Date**: 2025-11-25
**Feature**: 001-task-task-task

## Overview

この機能はUI変更が中心で、データモデルの変更は不要。既存の`links`テーブルとLinksService APIをそのまま使用する。

## Existing Data Models (No Changes)

### Task (issues table)
```sql
-- 既存テーブル、変更なし
CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('memo', 'task')),
  title TEXT NOT NULL,
  body_md TEXT,
  status TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- ... その他のカラム
);
```

### Link (links table)
```sql
-- 既存テーブル、変更なし
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_issue_id INTEGER NOT NULL,
  target_issue_id INTEGER NOT NULL,
  link_type TEXT NOT NULL CHECK(link_type IN ('parent', 'child', 'relates', 'derived_from')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (source_issue_id) REFERENCES issues(id) ON DELETE CASCADE,
  FOREIGN KEY (target_issue_id) REFERENCES issues(id) ON DELETE CASCADE
);
```

## Frontend Data Types

### New Types for TaskForm

```typescript
// packages/web/src/types/task-form.ts (新規または既存ファイルに追加)

/**
 * TaskFormで使用するリンク情報（作成前の一時的な状態）
 */
export interface PendingLink {
  /** リンク先のタスクID */
  targetIssueId: number;
  /** リンクタイプ */
  linkType: LinkType;
  /** 表示用のタスク情報（オプション） */
  targetIssue?: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}

/**
 * TaskFormの拡張props
 */
export interface TaskFormLinksProps {
  /** 初期リンク設定（モーダルから渡される） */
  initialLinks?: PendingLink[];
  /** リンク変更時のコールバック */
  onLinksChange?: (links: PendingLink[]) => void;
}
```

### CreateTaskModal Props

```typescript
// packages/web/src/components/CreateTaskModal.tsx

export interface CreateTaskModalProps {
  /** モーダル表示フラグ */
  isOpen: boolean;
  /** 閉じるハンドラ */
  onClose: () => void;
  /** 元タスク情報（リンク設定のデフォルト値に使用） */
  sourceTask: {
    id: number;
    title: string;
  };
  /** タスク作成成功時のコールバック */
  onTaskCreated?: (taskId: number) => void;
}
```

## State Management

### TaskDetail Page State

```typescript
// packages/web/src/pages/TaskDetail.tsx に追加

const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

// モーダルを開く
const handleOpenCreateModal = () => setIsCreateModalOpen(true);

// モーダルを閉じる
const handleCloseCreateModal = () => setIsCreateModalOpen(false);

// タスク作成成功時
const handleTaskCreated = (newTaskId: number) => {
  setIsCreateModalOpen(false);
  // オプション: 新しいタスクへナビゲート or 成功メッセージ表示
};
```

### TaskForm Links State

```typescript
// packages/web/src/components/TaskForm.tsx に追加

const [pendingLinks, setPendingLinks] = useState<PendingLink[]>(
  initialLinks ?? []
);

// リンク追加
const handleAddLink = (link: PendingLink) => {
  setPendingLinks(prev => [...prev, link]);
};

// リンク削除
const handleRemoveLink = (targetIssueId: number) => {
  setPendingLinks(prev =>
    prev.filter(l => l.targetIssueId !== targetIssueId)
  );
};
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ TaskDetail Page (/tasks/:id)                                     │
│                                                                  │
│  ┌──────────────────┐    ┌───────────────────────────────────┐  │
│  │ ItemDetail       │    │ CreateTaskModal (right half)      │  │
│  │                  │    │                                   │  │
│  │ [Bookmark][New]──┼────┤►┌─────────────────────────────┐   │  │
│  │                  │    │ │ TaskForm                    │   │  │
│  │ Task content...  │    │ │                             │   │  │
│  │                  │    │ │ Title: [____________]       │   │  │
│  │                  │    │ │ Body:  [____________]       │   │  │
│  │                  │    │ │                             │   │  │
│  │                  │    │ │ ▼ Links                     │   │  │
│  │                  │    │ │   [relates] Task #42 [x]    │   │  │
│  │                  │    │ │   [+ Add link]              │   │  │
│  │                  │    │ │                             │   │  │
│  │                  │    │ │ ▼ Schedule                  │   │  │
│  │                  │    │ │ ▼ Projects                  │   │  │
│  │                  │    │ │ ▼ Labels                    │   │  │
│  │                  │    │ │                             │   │  │
│  │                  │    │ │     [Cancel] [Create Task]  │   │  │
│  │                  │    │ └─────────────────────────────┘   │  │
│  └──────────────────┘    └───────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
1. User clicks [New Task] button
2. CreateTaskModal opens with sourceTask={id, title}
3. TaskForm initializes with initialLinks=[{targetIssueId: sourceTask.id, linkType: 'relates'}]
4. User fills form, optionally modifies links
5. On submit:
   a. TasksService.createTask() → newTaskId
   b. For each pendingLink: LinksService.createLink({sourceIssueId: newTaskId, ...link})
6. Modal closes, TaskDetail refreshes
```

## API Calls Sequence

```
1. POST /api/tasks
   Body: { title, body_md, status, ... }
   Response: { id: 123, ... }

2. POST /api/links (for each pending link)
   Body: {
     sourceIssueId: 123,      // 新しいタスクのID
     targetIssueId: 42,       // 元タスクのID
     linkType: 'relates'
   }
   Response: { id: 456, ... }
```

## Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| pendingLinks[].targetIssueId | 正の整数 | Invalid task ID |
| pendingLinks[].targetIssueId | 存在するタスク | Task not found |
| pendingLinks[].linkType | 'parent' \| 'child' \| 'relates' \| 'derived_from' | Invalid link type |
| pendingLinks | 重複なし | Duplicate link |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| タスク作成成功、リンク作成失敗 | タスクは残る、エラーメッセージ表示 |
| 元タスクが作成中に削除された | リンク作成スキップ、警告表示 |
| ネットワークエラー | リトライ可能なエラーメッセージ |
