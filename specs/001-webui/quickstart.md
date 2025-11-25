# Quickstart: Calendar View for Web UI

**Branch**: `001-webui`
**Date**: 2025-11-25

## Prerequisites

- Node.js 22+
- pnpm 9.0.0+
- 既存のmeme-gtdプロジェクトがセットアップ済み

## Setup

### 1. Install New Dependencies

```bash
# カレンダーライブラリ
pnpm --filter meme-gtd-web add @schedule-x/react @schedule-x/calendar @schedule-x/theme-default

# URL状態管理
pnpm --filter meme-gtd-web add nuqs
```

### 2. Start Development Server

```bash
# APIサーバー起動（テスト環境、ポート3001）
pnpm server:dev

# 別ターミナルでWebサーバー起動
pnpm dev:web
```

### 3. Access

- Web UI: http://localhost:5173
- API: http://localhost:3001/api

## Key Files to Modify

### API (packages/api)

| File | Change |
|------|--------|
| `src/schemas/taskSchemas.ts` | scheduledFrom/scheduledTo追加 |
| `src/routes/tasks.ts` | 日付範囲フィルタ実装 |

### Web (packages/web)

| File | Change |
|------|--------|
| `src/App.tsx` | /calendarルート追加、NuqsAdapter追加 |
| `src/components/Layout.tsx` | Calendarタブ追加 |
| `src/components/ItemDetail.tsx` | mode prop追加（モーダル対応） |
| `src/pages/Calendar.tsx` | 新規作成 |
| `src/components/calendar/*` | 新規作成 |
| `src/hooks/useCalendarState.ts` | 新規作成 |

## Implementation Order

### Phase 1: API Extension
1. TaskQuerySchemaにscheduledFrom/scheduledTo追加
2. tasks.tsにフィルタロジック追加
3. APIテスト

### Phase 2: Basic Calendar
1. NuqsAdapter設定
2. Layout.tsxにCalendarタブ追加
3. App.tsxに/calendarルート追加
4. Calendar.tsx（月表示のみ）作成
5. useCalendarState.ts作成

### Phase 3: Full Calendar
1. 週表示・日表示追加
2. ナビゲーション（今日、前へ、次へ）
3. 色分け（Done=緑、その他=白）

### Phase 4: Task Detail Modal
1. ItemDetail.tsxをモーダル対応に改修
2. TaskDetailModal.tsx作成
3. 編集機能連携

### Phase 5: Polish
1. URLパラメータ完全対応
2. パフォーマンス最適化
3. E2Eテスト

## Testing

### Manual Testing

```bash
# テスト環境でCLI操作（タスク作成）
pnpm mgtd:test task create -t "Test Task" --scheduled 2025-11-25 --no-editor

# ブラウザでカレンダー確認
open http://localhost:5173/calendar
```

### E2E Testing

```bash
pnpm --filter meme-gtd-web test:e2e
```

## Common Issues

### Issue: nuqs not working
**Solution**: App.tsxでNuqsAdapterがBrowserRouterをラップしているか確認

```typescript
// ✅ Correct
<BrowserRouter>
  <NuqsAdapter>
    <Routes>...</Routes>
  </NuqsAdapter>
</BrowserRouter>
```

### Issue: Calendar events not showing
**Checklist**:
1. タスクにscheduled_onが設定されているか
2. status=canceledでないか
3. API応答に正しいデータが含まれているか

### Issue: Modal not closing
**Solution**: モーダル外クリックのイベントハンドラを確認
