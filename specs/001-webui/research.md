# Research: Calendar View for Web UI

**Date**: 2025-11-25
**Branch**: `001-webui`

## 1. Calendar UI Library Selection

### Decision
**@schedule-x/react** を採用

### Rationale
- React 19完全対応（本プロジェクトはReact 19.2.0）
- 月/週/日表示を標準サポート
- 終日イベント・時間帯イベント両対応
- 高いカスタマイズ性（Reactコンポーネント注入可能）
- 軽量設計
- MIT無料ライセンス

### Alternatives Considered

| Library | React 19 | Features | Size | Decision |
|---------|----------|----------|------|----------|
| @schedule-x/react | ✅ 完全対応 | ⭐⭐⭐⭐⭐ | 軽量 | **採用** |
| FullCalendar | ✅ 互換 | ⭐⭐⭐⭐⭐ | 43KB+ | 重い、有料版あり |
| react-big-calendar | ⚠️ 未確認 | ⭐⭐⭐⭐ | 100KB | React 19リスク |

### Integration Notes
```bash
pnpm --filter meme-gtd-web add @schedule-x/react @schedule-x/calendar @schedule-x/theme-default
```

必要なプラグイン:
- `@schedule-x/event-modal` - イベントモーダル（カスタム実装で置換予定）

## 2. URL State Management

### Decision
**nuqs** を採用

### Rationale
- React Router v7公式サポート（`nuqs/adapters/react-router/v7`）
- 型安全なuseState風API
- 5.5kB gzipped（軽量）
- 複数パラメータ同時管理（useQueryStates）

### Alternatives Considered

| Library | React Router v7 | Type Safety | Size |
|---------|-----------------|-------------|------|
| nuqs | ✅ 公式対応 | ✅ 完全 | 5.5kB | **採用** |
| useSearchParams | ✅ 標準 | ❌ 文字列のみ | 0 | 型安全性不足 |

### Integration Notes
```typescript
// App.tsx でNuqsAdapterをラップ
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'

// 使用例
import { useQueryStates, parseAsStringEnum, parseAsString, parseAsInteger } from 'nuqs'

const [{ view, date, taskId }, setState] = useQueryStates({
  view: parseAsStringEnum(['month', 'week', 'day']).withDefault('month'),
  date: parseAsString.withDefault(today()),
  task: parseAsInteger
})
```

## 3. ItemDetail Modal Adaptation

### Decision
既存のItemDetailコンポーネントをページ/モーダル両対応に改修

### Rationale
- 既存の編集機能（タイトル、ステータス、スケジュール等）を再利用
- コードの重複を避ける
- 一貫したUX

### Implementation Approach
1. ItemDetailに`mode: 'page' | 'modal'` propを追加
2. modalモードの場合:
   - 「← Back」リンクを非表示
   - 幅を固定（右側1/3）
   - 閉じるボタンを追加
3. 既存のページ表示は`mode='page'`（デフォルト）で動作継続

### Code Changes Required
```typescript
// ItemDetail.tsx
interface ItemDetailProps {
  // ... existing props
  mode?: 'page' | 'modal';
  onClose?: () => void;
}
```

## 4. API Date Range Filter

### Decision
既存GET /tasksに`scheduledFrom`/`scheduledTo`パラメータを追加

### Rationale
- 既存エンドポイントの拡張で実装シンプル
- 他のフィルタ（status, label）と組み合わせ可能
- 新規エンドポイント不要

### Implementation
```typescript
// taskSchemas.ts - TaskQuerySchema拡張
export const TaskQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  bookmarked: z.enum(['true', 'false']).optional(),
  label: z.string().optional(),
  search: z.string().optional(),
  // 新規追加
  scheduledFrom: z.string().date().optional()
    .describe('Filter tasks with scheduled_on >= this date (YYYY-MM-DD)'),
  scheduledTo: z.string().date().optional()
    .describe('Filter tasks with scheduled_on <= this date (YYYY-MM-DD)'),
});
```

### SQL Query Extension
```sql
-- 既存クエリに追加
WHERE is_deleted = 0
  AND type = 'task'
  AND (scheduled_on >= ? OR ? IS NULL)
  AND (scheduled_on <= ? OR ? IS NULL)
```

## 5. Task Display Logic

### Time-based Display (Week/Day View)

| Condition | Display Area |
|-----------|--------------|
| `start_time` あり | 該当時間帯 |
| `start_time` なし | 終日エリア |
| `end_date` > `scheduled_on` | 終日エリア（複数日にまたがる） |

### Color Coding

| Status | Color | CSS Class |
|--------|-------|-----------|
| done | 緑濃い色 | `bg-green-600` |
| その他 | 白 | `bg-white border` |
| canceled | 非表示 | - |

## 6. Schedule-X Event Mapping

TaskをSchedule-Xのイベント形式にマッピング:

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO format or YYYY-MM-DD
  end: string;
  _options?: {
    additionalClasses?: string[];
  };
}

function taskToCalendarEvent(task: Task): CalendarEvent {
  const isDone = task.status === 'done';

  return {
    id: String(task.id),
    title: task.title || `Task #${task.id}`,
    start: task.startTime
      ? `${task.scheduledOn} ${task.startTime}`
      : task.scheduledOn,
    end: task.endTime
      ? `${task.endDate || task.scheduledOn} ${task.endTime}`
      : task.endDate || task.scheduledOn,
    _options: {
      additionalClasses: [isDone ? 'task-done' : 'task-pending']
    }
  };
}
```

## Summary of Decisions

| Topic | Decision |
|-------|----------|
| カレンダーUI | @schedule-x/react |
| URL状態管理 | nuqs |
| タスク詳細モーダル | ItemDetail改修（ページ/モーダル両対応） |
| API拡張 | GET /tasksにscheduledFrom/scheduledTo追加 |
| 色分け | Done=緑、その他=白、Cancel=非表示 |
