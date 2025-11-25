# Research: タスクからタスクを作成する機能

**Date**: 2025-11-25
**Feature**: 001-task-task-task

## 1. TaskForm Component Analysis

**File**: `packages/web/src/components/TaskForm.tsx`

### Current Props Interface
```typescript
interface TaskFormProps {
  initialTitle?: string;
  initialBodyMd?: string;
  initialStatus?: TaskStatus;
  taskId?: number;
  fromMemoId?: number;  // 既存: メモからの変換用
  mode: 'create' | 'edit';
}
```

### 現在のセクション構成
1. **Title Input** - 必須テキストフィールド
2. **Description (Markdown)** - オプションのテキストエリア
3. **Status Selector** - edit mode または fromMemoId 時のみ表示
4. **Schedule Section** - create mode かつ fromMemoId なしの場合のみ表示
5. **Projects Section** - マルチセレクト、検索機能付き
6. **Labels Section** - マルチセレクト、新規作成機能付き

### 拡張ポイント
- `fromMemoId` と同様に `initialLinks?: PendingLink[]` props を追加
- Schedule/Projects/Labels と同様のアコーディオンパターンでLinks UIを追加
- フォーム送信後に `LinksService.createLink()` を呼び出す

**Decision**: TaskFormに新しいprops `initialLinks` を追加し、Linksセクションをアコーディオン形式で追加する。

---

## 2. AddLinkInline Component Analysis

**File**: `packages/web/src/components/AddLinkInline.tsx`

### Props Interface
```typescript
interface AddLinkInlineProps {
  sourceIssueId: number;
  onAdd: (targetId: number, linkType: LinkType) => Promise<void>;
  onCancel: () => void;
  creationState: LinkCreationState;
  setCreationState: (state: LinkCreationState | ((prev: LinkCreationState) => LinkCreationState)) => void;
}
```

### UIパターン
- **2段階プロセス**: タイプ選択 → ターゲットID入力
- **4つのリンクタイプ**: Parent, Child, Related, Derived from
- **バリデーション**: 空チェック、数値チェック、自己参照チェック

### TaskForm統合への考慮
- AddLinkInlineは既存タスクのID入力が前提
- TaskFormでは「作成前」のためターゲットIDは分かっている（元タスク）
- 新しいコンポーネント `TaskFormLinks` を作成し、AddLinkInlineの一部を参考に実装

**Decision**: TaskForm用に簡略化したLinks UIコンポーネントを新規作成。タイプ選択と削除機能のみ。

---

## 3. ItemDetail Component Analysis

**File**: `packages/web/src/components/ItemDetail.tsx`

### Props Interface（関連部分）
```typescript
interface ItemDetailProps {
  // ...
  customActions?: React.ReactNode;  // カスタムボタン用
  mode?: 'page' | 'panel';  // レイアウト制御
}
```

### ボタン配置位置
- **コンテナ**: `flex items-center gap-2`
- **順序**: Status selector → customActions → bookmark button
- **mode='panel'時**: `w-full justify-end` で右寄せ

### 拡張方法
- `customActions` propsに「新規タスク」ボタンを渡す
- `mode === 'page'` の場合のみボタンを表示（パネル/モーダル時は非表示）

**Decision**: ItemDetailの `customActions` を使用して「新規タスク」ボタンを追加。mode='page'時のみ表示。

---

## 4. Modal Patterns

### TaskDetailPanel パターン
**File**: `packages/web/src/components/calendar/TaskDetailPanel.tsx`

```tsx
return (
  <>
    {/* バックドロップ（クリックで閉じる） */}
    <div className="fixed inset-0 z-40" onClick={onClose} />

    {/* 右半分パネル */}
    <div className="fixed top-0 right-0 bottom-0 w-1/2 bg-white shadow-xl border-l z-50">
      {/* ヘッダー: タイトル + 閉じるボタン */}
      {/* コンテンツ: スクロール可能 */}
    </div>
  </>
);
```

### 技術詳細
- **Z-index**: バックドロップ (z-40) < パネル (z-50)
- **位置**: `fixed top-0 right-0 bottom-0 w-1/2`
- **閉じる動作**: バックドロップクリック or Xボタン

**Decision**: TaskDetailPanelと同じパターンで `CreateTaskModal` を実装。

---

## 5. LinksService API

**File**: `packages/web/src/api/services/LinksService.ts`

### createLink() メソッド
```typescript
public static createLink(requestBody: {
  sourceIssueId: number;
  targetIssueId: number;
  linkType: 'parent' | 'child' | 'relates' | 'derived_from';
}): CancelablePromise<{
  id: number;
  sourceIssueId: number;
  targetIssueId: number;
  linkType: string;
  createdAt: string;
}>
```

### 使用タイミング
- タスク作成成功後に呼び出し
- `sourceIssueId`: 新しく作成したタスクのID
- `targetIssueId`: 元タスクのID
- `linkType`: 'relates'（デフォルト）

**Decision**: API変更は不要。既存のLinksServiceをそのまま使用。

---

## 6. Link Types Definition

**File**: `packages/web/src/types/links.ts`

```typescript
export type LinkType = 'parent' | 'child' | 'relates' | 'derived_from';

export interface LinkCreationState {
  isAdding: boolean;
  selectedType: LinkType | null;
  targetId: string;
  error: string | null;
  isSubmitting: boolean;
}
```

---

## Implementation Decisions Summary

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| TaskFormに `initialLinks` props追加 | 既存の `fromMemoId` パターンと一貫性 | 別コンポーネントでラップ |
| 新規 `TaskFormLinks` コンポーネント | AddLinkInlineは既存タスク向け、シンプルなUI必要 | AddLinkInlineを拡張 |
| `customActions` で新規タスクボタン追加 | ItemDetailの既存拡張ポイントを活用 | ItemDetail直接修正 |
| TaskDetailPanelパターンでモーダル実装 | 既存のCalendar/Project連携と一貫性 | 別のモーダルライブラリ |
| API変更なし | 既存のLinksService.createLink()で十分 | 専用エンドポイント追加 |

---

## New Components Required

1. **TaskFormLinks.tsx** - TaskForm内でのLinks設定UI
   - リンク一覧表示（削除可能）
   - リンク追加UI（タイプ選択 + タスク検索/ID入力）

2. **CreateTaskModal.tsx** - タスク作成モーダル
   - 右半分オーバーレイ
   - TaskFormをラップ
   - 初期リンク設定をpropsで受け取り

---

## Files to Modify

| File | Change |
|------|--------|
| `TaskForm.tsx` | `initialLinks` props追加、TaskFormLinksセクション追加 |
| `TaskDetail.tsx` | モーダル状態管理、CreateTaskModal表示 |
| `ItemDetail.tsx` | mode='page'時のみ customActions を表示するガード追加（オプション） |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| TaskForm変更が既存機能に影響 | initialLinksはオプショナル、既存動作は変更なし |
| リンク作成失敗時のロールバック | タスク作成成功→リンク作成失敗時はエラー表示のみ（タスクは残る） |
| UIの複雑化 | Linksセクションはアコーディオンでデフォルト閉じ |
