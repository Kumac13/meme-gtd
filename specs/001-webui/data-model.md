# Data Model: Calendar View for Web UI

**Date**: 2025-11-25
**Branch**: `001-webui`

## Existing Entities (No Changes Required)

### Task (issues table)

カレンダー表示に使用する既存フィールド:

| Field | Type | Description | Calendar Usage |
|-------|------|-------------|----------------|
| id | INTEGER | Primary key | イベントID |
| title | TEXT | タスクタイトル | タイル表示テキスト |
| status | TEXT | ステータス | 色分け（done=緑、other=白、canceled=除外） |
| scheduled_on | TEXT (DATE) | スケジュール日 | カレンダー表示位置 |
| start_time | TEXT (HH:MM) | 開始時刻 | 週/日表示の時間帯 |
| end_time | TEXT (HH:MM) | 終了時刻 | 週/日表示の時間帯 |
| end_date | TEXT (DATE) | 終了日 | 複数日イベント表示 |
| type | TEXT | 'memo' or 'task' | フィルタ（taskのみ表示） |

### Validation Rules (Existing)

```typescript
// From taskSchemas.ts
status: ['inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled']
scheduled_on: YYYY-MM-DD format
start_time: HH:MM format (regex: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
end_time: HH:MM format
end_date: YYYY-MM-DD format
```

## New Entities (Frontend Only)

### CalendarViewState

URL状態として管理（データベースには保存しない）:

```typescript
interface CalendarViewState {
  view: 'month' | 'week' | 'day';
  date: string; // YYYY-MM-DD, 基準日付
  taskId: number | null; // 選択中のタスク（モーダル表示用）
}
```

### CalendarEvent (Frontend Mapping)

TaskをSchedule-Xライブラリ用にマッピング:

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime or YYYY-MM-DD
  end: string;   // ISO datetime or YYYY-MM-DD
  _options?: {
    additionalClasses?: string[];
  };
}
```

### Mapping Logic

```
Task → CalendarEvent mapping:

1. id: String(task.id)
2. title: task.title || `Task #${task.id}`
3. start:
   - if start_time: `${scheduled_on}T${start_time}`
   - else: scheduled_on
4. end:
   - if end_time && end_date: `${end_date}T${end_time}`
   - if end_time only: `${scheduled_on}T${end_time}`
   - if end_date only: end_date
   - else: scheduled_on
5. _options.additionalClasses:
   - if status === 'done': ['task-done']
   - else: ['task-pending']
```

## State Transitions

### CalendarViewState Transitions

```
User Actions → State Changes:

[Tab Click]
  /memos, /tasks, /projects → /calendar
    → { view: 'month', date: today(), taskId: null }

[View Toggle]
  月 → 週 → 日
    → { view: newView, date: same, taskId: same }

[Navigation]
  「前へ」「次へ」「今日」
    → { view: same, date: newDate, taskId: null }

[Task Tile Click]
  タイルクリック
    → { view: same, date: same, taskId: clickedTaskId }

[Modal Close]
  モーダル外クリック / 閉じるボタン
    → { view: same, date: same, taskId: null }

[Task Edit (in Modal)]
  ステータス変更、日付変更
    → APIコール → イベント再取得 → カレンダー更新
```

### Task Status Color Mapping

```
status → display:

'done'     → 緑濃い色 (bg-green-600)
'inbox'    → 白 (bg-white)
'open'     → 白 (bg-white)
'next'     → 白 (bg-white)
'waiting'  → 白 (bg-white)
'scheduled'→ 白 (bg-white)
'someday'  → 白 (bg-white)
'canceled' → 非表示
```

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                     Calendar Page                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  URL Params (nuqs)                                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │ /calendar?view=week&date=2025-11-25&task=102    │    │
│  └─────────────────────────────────────────────────┘    │
│           │                                              │
│           ▼                                              │
│  useCalendarState()                                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ { view: 'week', date: '2025-11-25', taskId: 102 }│    │
│  └─────────────────────────────────────────────────┘    │
│           │                                              │
│           ▼                                              │
│  GET /api/tasks?scheduledFrom=...&scheduledTo=...       │
│           │                                              │
│           ▼                                              │
│  Task[] → CalendarEvent[] mapping                       │
│           │                                              │
│           ▼                                              │
│  Schedule-X Calendar Component                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │ [Month/Week/Day View]   [Task Detail Modal]     │    │
│  │                          (taskId=102)           │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## API Query Parameters (New)

### GET /api/tasks - Extended Query

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status |
| bookmarked | boolean | No | Filter by bookmark |
| label | string | No | Filter by label |
| search | string | No | Search by title |
| **scheduledFrom** | string (date) | No | `scheduled_on >= scheduledFrom` |
| **scheduledTo** | string (date) | No | `scheduled_on <= scheduledTo` |

### Example Queries

```
# 2025年11月のタスク（月表示）
GET /api/tasks?scheduledFrom=2025-11-01&scheduledTo=2025-11-30

# 2025年11月24日〜30日のタスク（週表示）
GET /api/tasks?scheduledFrom=2025-11-24&scheduledTo=2025-11-30

# 2025年11月25日のタスク（日表示）
GET /api/tasks?scheduledFrom=2025-11-25&scheduledTo=2025-11-25
```
