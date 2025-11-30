# Research: link設定時の検索機能

**Date**: 2025-11-30
**Feature**: 001-link

## 1. 既存API調査

### TasksService.listTasks()

```typescript
TasksService.listTasks(
  status?: string,
  bookmarked?: string,
  label?: string,
  search?: string,        // ← タイトル検索パラメータ
  scheduledFrom?: string,
  scheduledTo?: string
)
```

**レスポンス**: `id`, `type`, `title`, `status`, `updatedAt`を含むオブジェクト配列

### MemosService.listMemos()

```typescript
MemosService.listMemos(
  bookmarked?: string,
  label?: string,
  search?: string         // ← 本文検索パラメータ
)
```

**レスポンス**: `id`, `type`, `bodyMd`, `updatedAt`を含むオブジェクト配列
**注意**: Memoには`title`がなく`bodyMd`の先頭行をタイトル的に表示

## 2. 既存コンポーネント調査

### AddLinkInline.tsx

- 場所: 既存タスク/メモの詳細ページ
- Step 1: リンクタイプ選択（4つのボタン）
- Step 2: ID入力（`<input type="number">`）
- 状態管理: 親から`creationState`を受け取るパターン

### TaskFormLinks.tsx

- 場所: タスク作成フォーム
- 同様の2ステップフロー
- 状態管理: 自前で`useState`管理
- pending linksをリスト表示

### 共通点

- リンクタイプ定義（`parent`, `child`, `relates`, `derived_from`）
- バリデーション（正の整数、自己参照禁止、重複禁止）
- Tailwind CSSスタイリング

## 3. 設計決定

### Decision 1: コンポーネント構成

**Decision**: 新規`IssuePicker`コンポーネントを作成

**Rationale**:
- AddLinkInlineとTaskFormLinksで同じ検索UIを再利用
- 単一責任の原則に従い、検索/選択ロジックを分離
- テスト容易性の向上

**Alternatives considered**:
- 各コンポーネントに直接実装 → コード重複、保守性低下

### Decision 2: 検索実行タイミング

**Decision**: 300msデバウンス付きインクリメンタル検索

**Rationale**:
- 仕様書のFR-007で300msデバウンス指定
- 過剰なAPIリクエスト防止
- ユーザー体感の最適化

**Alternatives considered**:
- Enterキー押下で検索 → UXが悪い（GitHub UIとの整合性なし）

### Decision 3: 検索対象の統合

**Decision**: TaskとMemoを並行検索し、結果をマージ

**Rationale**:
- 既存APIは別々のエンドポイント
- Promise.allで並行実行し、パフォーマンス維持
- 結果は`updatedAt`降順でソート

**Alternatives considered**:
- 統合検索API作成 → スコープ外（バックエンド変更なし）

### Decision 4: 初期表示データ

**Decision**: 空検索で最新10件を取得

**Rationale**:
- 既存APIで`search`パラメータなしで全件取得可能
- フロントエンドで10件に制限

**Alternatives considered**:
- 別途「最近のアイテム」API → スコープ外

### Decision 5: キーボードナビゲーション実装

**Decision**: 標準的なリストボックスパターン

**Rationale**:
- WAI-ARIA Listbox仕様に準拠
- ↑↓で移動、Enterで選択、Escでキャンセル
- focusedIndexをstateで管理

**Alternatives considered**:
- Tab移動 → リスト選択には不適切

## 4. 型定義

```typescript
// IssuePicker用の型
interface IssuePickerItem {
  id: number;
  type: 'task' | 'memo';
  title: string;          // タスク: title, メモ: bodyMdの先頭行
  status: string | null;  // タスクのみ
  updatedAt: string;
}

interface IssuePickerProps {
  excludeId?: number;                    // 自身を除外
  onSelect: (issue: IssuePickerItem) => void;
  onCancel: () => void;
}
```

## 5. 実装パターン

### デバウンス

```typescript
// useDebounce hook使用またはsetTimeout手動管理
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearchTerm) {
    searchIssues(debouncedSearchTerm);
  } else {
    loadRecentIssues();
  }
}, [debouncedSearchTerm]);
```

### 並行検索

```typescript
const searchIssues = async (term: string) => {
  const [tasks, memos] = await Promise.all([
    TasksService.listTasks(undefined, undefined, undefined, term),
    MemosService.listMemos(undefined, undefined, term)
  ]);
  // マージして返す
};
```
