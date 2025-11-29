# Tasks: Project List View Status Filter

**Feature**: 001-task-112-project
**Date**: 2025-11-29
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

| Phase | Description | Tasks |
|-------|-------------|-------|
| Phase 1 | Setup (不要 - 既存コンポーネント使用) | 0 |
| Phase 2 | Foundational (共通定義) | 1 |
| Phase 3 | US1+US2: Filter & Sort (P1) | 3 |
| Phase 4 | US3: Status Badge (P2) | 1 |
| Phase 5 | US4+US5: Bookmark & URL (P3) | 1 |
| Phase 6 | Polish & Edge Cases | 1 |
| **Total** | | **7** |

---

## Phase 2: Foundational (共通定義)

> 全ユーザーストーリーで使用する定数・型定義

### [X] T001: Define status options and labels constants [US1,US2,US3]

**File**: `packages/web/src/pages/ListView.tsx`

**Description**: ListView.tsx にステータスオプションとラベルの定数を追加する。Kanban と同じカラム構成に対応。

**Implementation**:
```typescript
// コンポーネント外部に定義
const statusOptions = [
  'all', 'documents', 'inbox', 'open', 'next', 'waiting',
  'scheduled', 'someday', 'done', 'canceled'
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

const statusOrder: Record<string, number> = {
  next: 0, waiting: 1, scheduled: 2, inbox: 3, open: 4, someday: 5,
  done: 6, canceled: 7
};
```

**Acceptance**: 定数がファイル内に定義されている

---

## Phase 3: US1+US2 - Filter Items by Status & Sort (P1)

> **Goal**: ユーザーがステータスでアイテムをフィルタリングでき、All選択時はDone/Canceledが末尾に表示される
>
> **Independent Test**: FilterBarが表示され、各ステータスボタンで該当アイテムのみ表示、All選択時はソート順を確認

### [X] T002: Add useSearchParams and FilterBar import [US1,US5]

**File**: `packages/web/src/pages/ListView.tsx`

**Description**: 必要なインポートを追加する

**Implementation**:
```typescript
import { useSearchParams } from 'react-router-dom';
import FilterBar from '../components/FilterBar';
```

**Acceptance**: インポートエラーなし

---

### [X] T003: Add filter state management with URL params [US1,US5]

**File**: `packages/web/src/pages/ListView.tsx`

**Description**: useSearchParams を使用してフィルタ状態を管理する

**Implementation**:
```typescript
// ListView コンポーネント内
const [searchParams, setSearchParams] = useSearchParams();
const statusFilter = searchParams.get('status') || 'all';
const bookmarkFilter = searchParams.get('bookmarked') === 'true';

const handleStatusFilterChange = (newStatus: string) => {
  const params = new URLSearchParams(searchParams);
  if (newStatus === 'all') {
    params.delete('status');
  } else {
    params.set('status', newStatus);
  }
  setSearchParams(params);
};

const handleBookmarkFilterChange = (newBookmarked: boolean) => {
  const params = new URLSearchParams(searchParams);
  if (newBookmarked) {
    params.set('bookmarked', 'true');
  } else {
    params.delete('bookmarked');
  }
  setSearchParams(params);
};
```

**Acceptance**: フィルタ変更時にURLパラメータが更新される

---

### [X] T004: Implement filter and sort logic with useMemo [US1,US2]

**File**: `packages/web/src/pages/ListView.tsx`

**Description**: useMemo でフィルタリング・ソートロジックを実装する

**Implementation**:
```typescript
import { useMemo } from 'react';

// コンポーネント内
const filteredAndSortedItems = useMemo(() => {
  let items: (Task | Memo)[] = [];

  // ステータスフィルタ
  if (statusFilter === 'all') {
    items = [...tasks, ...memos];
  } else if (statusFilter === 'documents') {
    items = [...memos];
  } else {
    items = tasks.filter(task => task.status === statusFilter);
  }

  // ブックマークフィルタ
  if (bookmarkFilter) {
    items = items.filter(item => item.isBookmarked);
  }

  // ソート: Done/Canceled を末尾に、メモはさらに末尾
  return items.sort((a, b) => {
    const aIsMemo = !('status' in a) || a.status === null;
    const bIsMemo = !('status' in b) || b.status === null;
    if (aIsMemo && !bIsMemo) return 1;
    if (!aIsMemo && bIsMemo) return -1;
    if (aIsMemo && bIsMemo) return 0;

    const aOrder = statusOrder[(a as Task).status ?? ''] ?? 5;
    const bOrder = statusOrder[(b as Task).status ?? ''] ?? 5;
    return aOrder - bOrder;
  });
}, [tasks, memos, statusFilter, bookmarkFilter]);

// 既存の allItems を置き換え
// const allItems = [...tasks, ...memos]; → filteredAndSortedItems を使用
```

**Acceptance**:
- All: Next → ... → Done → Canceled → Documents の順
- 個別ステータス: 該当アイテムのみ表示
- Documents: メモのみ表示

---

### [X] T005: Add FilterBar component to ListView JSX [US1,US4]

**File**: `packages/web/src/pages/ListView.tsx`

**Description**: FilterBar コンポーネントを JSX に追加する

**Implementation**:
```tsx
// return 文内、ItemList の前に追加
<>
  <div className="mb-4">
    <FilterBar
      showStatusFilter
      statusFilter={statusFilter}
      bookmarkFilter={bookmarkFilter}
      onStatusFilterChange={handleStatusFilterChange}
      onBookmarkFilterChange={handleBookmarkFilterChange}
      statusOptions={statusOptions}
      statusLabels={statusLabels}
    />
  </div>
  <ItemList items={filteredAndSortedItems} itemType="task" basePath="" onItemClick={handleItemClick} />
  {/* ... */}
</>
```

**Acceptance**: FilterBar が表示され、クリックでフィルタが動作する

---

**[Checkpoint US1+US2]**: フィルタボタンでアイテムが絞り込まれ、All選択時はソート順が正しい

---

## Phase 4: US3 - Display Status Badge on Task Items (P2)

> **Goal**: 各タスクにステータスバッジが表示される
>
> **Independent Test**: リスト内のタスクにステータスバッジが色分けで表示される

### [X] T006: Add status badge to ItemList component [US3]

**File**: `packages/web/src/components/ItemList.tsx`

**Description**: タスクアイテムにステータスバッジを追加する

**Implementation**:
```tsx
// ファイル上部に定数追加
const statusLabels: Record<string, string> = {
  inbox: 'Inbox',
  open: 'Open',
  next: 'Next',
  waiting: 'Waiting',
  scheduled: 'Scheduled',
  someday: 'Someday',
  done: 'Done',
  canceled: 'Canceled',
};

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

// isTask(item) の表示部分内（タイトルの近くに追加）
// 例: <h2> の後、ラベルの前に追加
{isTask(item) && item.status && (
  <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusBadgeClasses[item.status] || 'bg-gray-100 text-gray-700'}`}>
    {statusLabels[item.status] || item.status}
  </span>
)}
```

**Acceptance**:
- 各タスクにステータスバッジが表示される
- ステータスごとに色分けされている
- メモにはバッジが表示されない

---

**[Checkpoint US3]**: タスクにステータスバッジが色分けで表示される

---

## Phase 5: US4+US5 - Bookmark Filter & URL Persistence (P3)

> **Goal**: ブックマークフィルタが動作し、フィルタ状態がURLに保存される
>
> **Independent Test**: ブックマークフィルタでアイテムが絞り込まれ、URLパラメータが更新される

（T003, T005 で既に実装済み - 追加作業なし）

**[Checkpoint US4+US5]**: ブックマークフィルタ動作、URL更新・復元が動作する

---

## Phase 6: Polish & Edge Cases

> エッジケース対応と最終調整

### [X] T007: Update empty state message for filtered results [Edge]

**File**: `packages/web/src/pages/ListView.tsx`

**Description**: フィルタ結果が空の場合のメッセージを改善する

**Implementation**:
```tsx
// 既存の EmptyState を条件付きで更新
{filteredAndSortedItems.length === 0 ? (
  <EmptyState
    message={
      statusFilter === 'all' && !bookmarkFilter
        ? "No items in this project. Add tasks or memos to get started."
        : `No ${statusFilter === 'documents' ? 'documents' : statusLabels[statusFilter] || statusFilter} items${bookmarkFilter ? ' (bookmarked)' : ''}.`
    }
  />
) : (
  <ItemList items={filteredAndSortedItems} itemType="task" basePath="" onItemClick={handleItemClick} />
)}
```

**Acceptance**: フィルタ結果が空の場合、適切なメッセージが表示される

---

**[Final Checkpoint]**: 全機能が動作し、エッジケースも対処されている

---

## Dependencies

```
T001 (constants)
  ↓
T002 (imports) ─┬─→ T003 (state management)
                │      ↓
                └─→ T004 (filter/sort logic) ←─┐
                       ↓                       │
                    T005 (FilterBar JSX) ──────┘
                       ↓
                    T007 (empty state)

T006 (status badge) ← 独立して並行実行可能
```

## Parallel Execution Examples

### Option 1: Sequential (1 developer)
```
T001 → T002 → T003 → T004 → T005 → T006 → T007
```

### Option 2: Parallel (2 developers)
```
Developer 1: T001 → T002 → T003 → T004 → T005 → T007
Developer 2: T006 [P]
```

## Implementation Strategy

### MVP Scope (Phase 3 only)
- User Story 1 + 2 のみ実装
- フィルタ機能とソート機能が動作すれば最小限のMVP

### Full Implementation
- 全7タスクを順番に実装
- 推定: 1-2時間で完了可能なシンプルな変更

### Files Modified
| File | Tasks |
|------|-------|
| `packages/web/src/pages/ListView.tsx` | T001, T002, T003, T004, T005, T007 |
| `packages/web/src/components/ItemList.tsx` | T006 |
