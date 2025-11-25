# Tasks: タスクからタスクを作成する機能

**Input**: Design documents from `/specs/001-task-task-task/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: テスト要件は明示されていないため、テストタスクは含まない。

**Organization**: タスクはUser Story単位でグループ化され、各ストーリーを独立して実装・テスト可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存なし）
- **[Story]**: 所属するUser Story（例: US1, US2, US3, US4）
- 正確なファイルパスを記述

## Path Conventions

- **Web app (monorepo)**: `packages/web/src/`
- このプロジェクトはpnpm workspaces monorepo構造

---

## Phase 1: Setup

**Purpose**: 型定義の追加

- [x] T001 [P] [Setup] `packages/web/src/types/links.ts` に `PendingLink` 型を定義

```typescript
export interface PendingLink {
  targetIssueId: number;
  linkType: LinkType;
  targetIssue?: {
    id: number;
    type: 'task' | 'memo';
    title: string;
  };
}
```

**Checkpoint**: 型定義が完了し、他のコンポーネントで使用可能

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 共通コンポーネントの作成（全User Storyで使用）

**⚠️ CRITICAL**: User Story 1, 2 はこのフェーズ完了後に開始可能

- [x] T002 [Foundation] `packages/web/src/components/TaskFormLinks.tsx` を新規作成

  - Props: `links: PendingLink[]`, `onAdd`, `onRemove`
  - リンク一覧表示（削除ボタン付き）
  - リンク追加UI（タイプ選択 + タスクID入力）
  - AddLinkInline コンポーネントのパターンを参考に実装
  - アコーディオン形式（Schedule/Projects/Labelsと同じパターン）

- [ ] T003 [Foundation] `packages/web/src/components/TaskForm.tsx` を修正

  - `initialLinks?: PendingLink[]` props を追加
  - `pendingLinks` state を追加
  - TaskFormLinks セクションをアコーディオンとして追加（Labels セクションの下）
  - フォーム送信時に pendingLinks を使用してリンク作成（LinksService.createLink）

**Checkpoint**: TaskFormがLinks設定機能を持つようになった。task/newページでLinks UIが表示される（空の状態）

---

## Phase 3: User Story 1 - タスク詳細画面から新規タスクを作成 (Priority: P1) 🎯 MVP

**Goal**: タスク詳細画面（/tasks/:id）から直接新規タスクを作成できる

**Independent Test**: タスク詳細画面から「新規タスク」ボタンをクリックし、モーダルでタスクを作成できることを確認

### Implementation for User Story 1

- [ ] T004 [P] [US1] `packages/web/src/components/CreateTaskModal.tsx` を新規作成

  - Props: `isOpen`, `onClose`, `sourceTask: {id, title}`, `onTaskCreated?`
  - TaskDetailPanel と同じモーダルパターン（右半分オーバーレイ）
  - バックドロップ（z-40）+ パネル（z-50）
  - ヘッダー: 「新規タスク作成」タイトル + 閉じるボタン
  - コンテンツ: TaskForm（mode='create'）をラップ
  - TaskForm に `initialLinks` として元タスクへの `relates` リンクを渡す

- [ ] T005 [US1] `packages/web/src/pages/TaskDetail.tsx` を修正

  - `isCreateModalOpen` state を追加
  - `handleOpenCreateModal`, `handleCloseCreateModal` ハンドラを追加
  - ItemDetail の `customActions` に「新規タスク」ボタンを渡す
  - CreateTaskModal コンポーネントを条件付きでレンダリング
  - タスク作成成功時の処理（モーダルを閉じる）

**Checkpoint**: /tasks/:id ページで「新規タスク」ボタンが表示され、クリックでモーダルが開き、タスク作成が可能

---

## Phase 4: User Story 2 - 関係性（Links）の設定 (Priority: P1)

**Goal**: タスク作成時に元タスクとの関係性をLinks機能で設定できる

**Independent Test**: 新規タスク作成時にLinksが設定され、作成後に関係性が正しく保存されていることを確認

### Implementation for User Story 2

- [ ] T006 [US2] `packages/web/src/components/CreateTaskModal.tsx` を修正

  - デフォルトリンク（relates）が設定済み状態で表示されることを確認
  - ユーザーがリンクを削除できることを確認
  - ユーザーが追加のリンクを設定できることを確認

- [ ] T007 [US2] `packages/web/src/components/TaskForm.tsx` を修正

  - フォーム送信後のリンク作成ロジックを実装
  - タスク作成成功後、pendingLinks の各リンクに対して LinksService.createLink() を呼び出し
  - エラーハンドリング（リンク作成失敗時はエラー表示、タスクは残す）

**Checkpoint**: モーダルからタスク作成時、デフォルトでrelatesリンクが設定され、保存される

---

## Phase 5: User Story 3 - 既存のタスク作成フォームとの統一 (Priority: P2)

**Goal**: モーダルとtask/newページで同じTaskFormコンポーネントを使用し、UIの一貫性を保つ

**Independent Test**: task/newページでLinks UIが空の状態で表示されることを確認

### Implementation for User Story 3

- [ ] T008 [US3] `packages/web/src/pages/TaskNew.tsx` を確認・修正（必要に応じて）

  - TaskForm にLinks UIが表示されることを確認
  - initialLinks が渡されない場合、空の状態で表示されることを確認
  - ユーザーが任意のリンクを追加できることを確認

**Checkpoint**: task/newページとモーダルで同じUIが表示される

---

## Phase 6: User Story 4 - Project/CalendarからのTaskDetailモーダルでは非表示 (Priority: P2)

**Goal**: Project/Calendar画面からTaskDetailをモーダルで開いた場合、「新規タスク」ボタンは非表示

**Independent Test**: Project/CalendarからTaskDetailモーダルを開き、新規タスクボタンが表示されないことを確認

### Implementation for User Story 4

- [ ] T009 [US4] `packages/web/src/pages/TaskDetail.tsx` を修正

  - ItemDetail の `mode` prop に基づいて「新規タスク」ボタンの表示を制御
  - `mode === 'page'` の場合のみ customActions を渡す

- [ ] T010 [US4] 動作確認

  - /tasks/:id ページ: 「新規タスク」ボタンが表示される
  - Project画面からのモーダル: ボタン非表示
  - Calendar画面からのモーダル: ボタン非表示

**Checkpoint**: 二重モーダル問題が回避され、UXが改善

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 仕上げと品質向上

- [ ] T011 [P] エラーハンドリングの改善
  - リンク作成失敗時のユーザーフィードバック
  - 元タスク削除時の graceful degradation

- [ ] T012 [P] スタイル調整
  - モーダルのレスポンシブ対応
  - TaskFormLinks のスタイル統一

- [ ] T013 動作確認チェックリスト
  - [ ] /tasks/:id で「新規タスク」ボタンが表示される
  - [ ] ボタンクリックでモーダルが右半分に表示される
  - [ ] モーダルにデフォルトリンク（relates）が設定済み
  - [ ] リンクを削除できる
  - [ ] 追加のリンクを設定できる
  - [ ] タスク作成成功でリンクも作成される
  - [ ] モーダル外クリックで閉じる
  - [ ] task/newページでLinks UIが空の状態で表示される
  - [ ] Project/Calendarからのモーダルでは「新規タスク」ボタン非表示

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即座に開始可能
- **Foundational (Phase 2)**: Setup完了後 - 全User Storyをブロック
- **User Story 1 (Phase 3)**: Foundational完了後
- **User Story 2 (Phase 4)**: User Story 1完了後（TaskForm修正が必要）
- **User Story 3 (Phase 5)**: Foundational完了後（US1/US2と並列可能）
- **User Story 4 (Phase 6)**: User Story 1完了後
- **Polish (Phase 7)**: 全User Story完了後

### User Story Dependencies

```
Phase 1: Setup (T001)
    ↓
Phase 2: Foundational (T002 → T003)
    ↓
    ├── Phase 3: US1 (T004 [P], T005)
    │       ↓
    │   Phase 4: US2 (T006 → T007)
    │
    ├── Phase 5: US3 (T008) - US1/US2と並列可能
    │
    └── Phase 6: US4 (T009 → T010) - US1完了後
            ↓
        Phase 7: Polish (T011 [P], T012 [P], T013)
```

### Within Each Phase

- [P] マークのタスクは並列実行可能
- 同一ファイルへの変更は順次実行
- コミットは各タスクまたは論理的グループ単位で

### Parallel Opportunities

- T001, T004 は並列実行可能（異なるファイル）
- T011, T012 は並列実行可能（独立した改善）

---

## Parallel Example: Phase 2 + Phase 3

```bash
# Phase 2 完了後、以下を並列で開始可能:

# 開発者A: User Story 1
Task: "packages/web/src/components/CreateTaskModal.tsx を新規作成"
Task: "packages/web/src/pages/TaskDetail.tsx を修正"

# 開発者B: User Story 3 (Foundational完了後すぐに開始可能)
Task: "packages/web/src/pages/TaskNew.tsx を確認・修正"
```

---

## Implementation Strategy

### MVP First (User Story 1 + 2)

1. Phase 1: Setup (T001)
2. Phase 2: Foundational (T002, T003)
3. Phase 3: User Story 1 (T004, T005)
4. Phase 4: User Story 2 (T006, T007)
5. **STOP and VALIDATE**: タスク詳細画面からタスク作成、リンク設定が動作
6. Deploy/demo if ready

### Full Implementation

1. MVP完了
2. Phase 5: User Story 3 (T008)
3. Phase 6: User Story 4 (T009, T010)
4. Phase 7: Polish (T011-T013)

---

## Notes

- [P] タスク = 異なるファイル、依存なし
- [Story] ラベルでタスクをUser Storyに紐付け
- 各User Storyは独立してテスト可能
- 各チェックポイントで検証を推奨
- API変更は不要（既存のLinksServiceを使用）
