# Quickstart: タスクからタスクを作成する機能

**Date**: 2025-11-25
**Feature**: 001-task-task-task

## Prerequisites

- Node.js 22+
- pnpm 10.23.0+
- テスト環境セットアップ済み (`test-data/test.db`)

## Development Setup

```bash
# 1. ブランチ確認
git checkout 001-task-task-task

# 2. 依存関係インストール
pnpm install

# 3. テストDBの初期化（必要な場合）
pnpm mgtd:test init -d $PWD/test-data/test.db -f

# 4. 開発サーバー起動
pnpm server:dev  # APIサーバー (port 3001)
pnpm --filter meme-gtd-web dev  # Webサーバー (port 5173)
```

## File Structure

```
packages/web/src/
├── components/
│   ├── TaskForm.tsx              # 変更
│   ├── TaskFormLinks.tsx         # 新規
│   ├── ItemDetail.tsx            # 変更（オプション）
│   └── CreateTaskModal.tsx       # 新規
├── pages/
│   └── TaskDetail.tsx            # 変更
└── types/
    └── task-form.ts              # 新規（または links.ts に追加）
```

## Implementation Order

### Step 1: Types定義
```typescript
// packages/web/src/types/task-form.ts
export interface PendingLink {
  targetIssueId: number;
  linkType: LinkType;
  targetIssue?: { id: number; type: 'task' | 'memo'; title: string; };
}
```

### Step 2: TaskFormLinks コンポーネント
```typescript
// packages/web/src/components/TaskFormLinks.tsx
interface TaskFormLinksProps {
  links: PendingLink[];
  onAdd: (link: PendingLink) => void;
  onRemove: (targetIssueId: number) => void;
}
```

### Step 3: TaskForm 拡張
```typescript
// TaskFormProps に追加
initialLinks?: PendingLink[];
```

### Step 4: CreateTaskModal コンポーネント
```typescript
// packages/web/src/components/CreateTaskModal.tsx
interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceTask: { id: number; title: string; };
  onTaskCreated?: (taskId: number) => void;
}
```

### Step 5: TaskDetail ページ統合
```typescript
// 状態追加
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

// customActions として新規タスクボタンを渡す
<ItemDetail
  customActions={
    <button onClick={() => setIsCreateModalOpen(true)}>
      新規タスク
    </button>
  }
/>
```

## Testing

```bash
# ユニットテスト
pnpm --filter meme-gtd-web test

# 特定テストファイル
pnpm --filter meme-gtd-web test TaskFormLinks
pnpm --filter meme-gtd-web test CreateTaskModal

# E2Eテスト
pnpm --filter meme-gtd-web test:e2e
```

## Manual Testing Checklist

1. [ ] `/tasks/:id` で「新規タスク」ボタンが表示される
2. [ ] ボタンクリックでモーダルが右半分に表示される
3. [ ] モーダルにデフォルトリンク（`relates`タイプ）が設定済み
4. [ ] リンクを削除できる
5. [ ] 追加のリンクを設定できる
6. [ ] タスク作成成功でリンクも作成される
7. [ ] モーダル外クリックで閉じる
8. [ ] Project/Calendarからのモーダルでは「新規タスク」ボタン非表示

## Key Files Reference

| File | Purpose |
|------|---------|
| `components/AddLinkInline.tsx` | リンク追加UIの参考実装 |
| `components/LinkSection.tsx` | リンク一覧表示の参考実装 |
| `components/calendar/TaskDetailPanel.tsx` | モーダルパターンの参考実装 |
| `api/services/LinksService.ts` | リンク作成API |
| `api/services/TasksService.ts` | タスク作成API |

## Common Issues

### モーダルが背後に表示される
- z-indexを確認: backdrop (z-40) < panel (z-50)

### リンク作成が失敗する
- タスク作成後のIDを正しく使用しているか確認
- LinksService.createLink() のパラメータ確認

### TaskFormの既存機能が壊れる
- initialLinksはオプショナルにする
- 既存のpropsに影響しないよう注意
