# Quickstart: Project List View Status Filter

**Date**: 2025-11-29
**Feature**: 001-task-112-project

## 開発環境セットアップ

```bash
# 依存関係インストール
pnpm install

# 開発サーバー起動（テスト環境）
pnpm server:dev

# ブラウザで http://localhost:3001 にアクセス
```

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `packages/web/src/pages/ListView.tsx` | FilterBar追加、フィルタ・ソートロジック |
| `packages/web/src/components/ItemList.tsx` | ステータスバッジ表示追加 |

## 実装手順

### 1. ListView.tsx の変更

```typescript
// 1. インポート追加
import FilterBar from '../components/FilterBar';
import { useSearchParams } from 'react-router-dom';

// 2. フィルタオプション定義
const statusOptions = ['all', 'documents', 'inbox', 'open', 'next', 'waiting', 'scheduled', 'someday', 'done', 'canceled'];
const statusLabels = { /* ... */ };

// 3. フィルタ状態管理
const [searchParams, setSearchParams] = useSearchParams();
const statusFilter = searchParams.get('status') || 'all';
const bookmarkFilter = searchParams.get('bookmarked') === 'true';

// 4. フィルタ・ソートロジック (useMemo)

// 5. FilterBar コンポーネント追加
```

### 2. ItemList.tsx の変更

```typescript
// タスクアイテムにステータスバッジを追加
{isTask(item) && item.status && (
  <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusBadgeClass(item.status)}`}>
    {statusLabels[item.status]}
  </span>
)}
```

## 検証方法

1. テスト環境でプロジェクト詳細ページを開く
2. 「List」タブを選択
3. 各フィルタボタンをクリックして動作確認
4. URL パラメータが更新されることを確認
5. ブラウザの戻る/進むボタンでフィルタ状態が復元されることを確認

## 関連ドキュメント

- [spec.md](./spec.md) - 機能仕様
- [data-model.md](./data-model.md) - データモデル
- [contracts/](./contracts/) - コンポーネント契約

## 参照実装

- `packages/web/src/pages/TasksList.tsx` - 同様のフィルタ実装例
- `packages/web/src/components/KanbanBoard.tsx` - カラム構成の参照
