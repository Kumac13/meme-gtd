# Research: Project List View Status Filter

**Date**: 2025-11-29
**Feature**: 001-task-112-project

## Research Summary

この機能は既存実装パターンの再利用であり、新規の技術調査は不要。

## Decisions

### 1. FilterBar コンポーネントの再利用

**Decision**: 既存の `FilterBar` コンポーネントをカスタムオプションで再利用する

**Rationale**:
- TasksList で既に動作実績がある
- `statusOptions` と `statusLabels` のカスタマイズに対応している
- 一貫したUI/UXを維持できる

**Alternatives considered**:
- 新規FilterBarの作成 → 却下（重複実装になる）
- ドロップダウンセレクタ → 却下（既存パターンと不一致）

### 2. URL パラメータ管理

**Decision**: `useSearchParams` を使用してフィルタ状態をURLに保存

**Rationale**:
- TasksList と同じパターン
- ブラウザの履歴機能と統合
- ページリロードでも状態維持

**Alternatives considered**:
- React state のみ → 却下（URLからの状態復元不可）
- localStorage → 却下（URL共有不可）

### 3. ソートロジック

**Decision**: クライアントサイドで `useMemo` を使用してソート

**Rationale**:
- データ量が少ない（プロジェクト内のアイテムのみ）
- APIへの追加リクエスト不要
- 即時反映が可能

**Alternatives considered**:
- サーバーサイドソート → 却下（オーバーエンジニアリング）

### 4. ステータスバッジの色分け

**Decision**: Tailwind CSS のユーティリティクラスで色分け

**Rationale**:
- 既存のスタイリングパターンと一致
- シンプルな実装
- ダークモード対応が容易

**Alternatives considered**:
- CSS-in-JS → 却下（既存パターンと不一致）
- 外部UIライブラリ → 却下（依存追加不要）

## Key Findings from Existing Code

### FilterBar Props (packages/web/src/components/FilterBar.tsx)

```typescript
interface FilterBarProps {
  showStatusFilter?: boolean;
  statusFilter?: string;
  bookmarkFilter?: boolean;
  onStatusFilterChange?: (status: string) => void;
  onBookmarkFilterChange?: (bookmarked: boolean) => void;
  statusOptions?: string[];  // カスタムオプション対応
  statusLabels?: Record<string, string>;  // カスタムラベル対応
  showBookmarkFilter?: boolean;
}
```

### KanbanBoard カラム構成 (packages/web/src/components/KanbanBoard.tsx)

```typescript
const allColumns = ['Documents', 'Inbox', 'Open', 'Next', 'Waiting', 'Scheduled', 'Someday', 'Done', 'Canceled'];
```

→ ListView のフィルタオプションもこれに対応させる

## No Unresolved Clarifications

すべての技術的決定は既存パターンに基づいて解決済み。
