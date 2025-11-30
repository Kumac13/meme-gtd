# Tasks: link設定時の検索機能

**Input**: Design documents from `/specs/001-link/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md

**Tests**: テストは明示的にリクエストされていないため、省略。

**Organization**: タスクはユーザーストーリーごとにグループ化。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: ユーザーストーリー（US1, US2, US3）
- パスは `packages/web/src/` を基準

---

## Phase 1: Setup (共通基盤)

**Purpose**: 型定義と共通インフラの準備

- [x] T001 [Setup] `packages/web/src/types/links.ts` に `IssuePickerItem` 型を追加

---

## Phase 2: Foundational (基盤コンポーネント)

**Purpose**: 全ユーザーストーリーが依存する `IssuePicker` コンポーネントの基本構造

**⚠️ CRITICAL**: US1/US2/US3 はこのフェーズ完了後に開始可能

- [x] T002 [Foundation] `packages/web/src/components/IssuePicker.tsx` を新規作成
  - Props: `excludeId`, `onSelect`, `onCancel`
  - 基本UI構造（検索入力、結果リスト、空のハンドラー）
  - ローディング/エラー/空結果の表示

**Checkpoint**: IssuePicker の骨格完成 - 各ストーリーの実装開始可能

---

## Phase 3: User Story 1 - タイトル検索によるリンク先選択 (Priority: P1) 🎯 MVP

**Goal**: 検索テキスト入力でタスク/メモを検索し、候補から選択してリンク作成

**Independent Test**: 検索フィールドに入力 → マッチする候補表示 → クリックで選択

### Implementation for User Story 1

- [x] T003 [US1] `IssuePicker.tsx` に検索ロジックを実装
  - `TasksService.listTasks({ search })` と `MemosService.listMemos({ search })` を並行呼び出し
  - 結果を `IssuePickerItem[]` に変換してマージ
  - 300ms デバウンス実装
  - 10件制限

- [x] T004 [US1] `IssuePicker.tsx` に候補リスト表示を実装
  - ID, タイプ (Task/Memo), タイトル, ステータスを表示
  - クリックで `onSelect` コールバック呼び出し
  - 自分自身（`excludeId`）を除外

- [x] T005 [US1] `AddLinkInline.tsx` を修正して `IssuePicker` を統合
  - Step 2 の ID 入力を `IssuePicker` に置き換え
  - `onSelect` で選択されたアイテムの ID を使用

- [x] T006 [US1] `TaskFormLinks.tsx` を修正して `IssuePicker` を統合
  - Step 2 の ID 入力を `IssuePicker` に置き換え
  - pending links に追加するフローを維持

**Checkpoint**: 検索→選択→リンク追加が動作。MVP 完成

---

## Phase 4: User Story 2 - 初期表示での最近のアイテム表示 (Priority: P2)

**Goal**: 検索入力前に最近のタスク/メモを10件表示

**Independent Test**: IssuePicker を開いた時点で最近のアイテムが表示される

### Implementation for User Story 2

- [x] T007 [US2] `IssuePicker.tsx` に初期表示ロジックを追加
  - 検索文字列が空の時は `search` パラメータなしで API 呼び出し
  - `updatedAt` 降順でソート
  - 10件制限

- [x] T008 [US2] `IssuePicker.tsx` のUI更新
  - 検索文字列空時に "Recent:" ラベル表示
  - 検索入力があれば候補リストをリアルタイム更新

**Checkpoint**: 初期表示 + 検索切り替えが動作

---

## Phase 5: User Story 3 - キーボードナビゲーション (Priority: P3)

**Goal**: ↑↓キーで候補移動、Enter で選択、Esc でキャンセル

**Independent Test**: キーボードのみで候補選択が完了できる

### Implementation for User Story 3

- [x] T009 [US3] `IssuePicker.tsx` にキーボードナビゲーション状態を追加
  - `focusedIndex` state を追加
  - 候補リストで現在フォーカス中のアイテムをハイライト

- [x] T010 [US3] `IssuePicker.tsx` にキーイベントハンドラーを追加
  - `onKeyDown` で ↓/↑/Enter/Esc を処理
  - ↓: `focusedIndex` を +1（リスト末尾でループまたは停止）
  - ↑: `focusedIndex` を -1（リスト先頭でループまたは停止）
  - Enter: フォーカス中のアイテムを選択
  - Esc: `onCancel` 呼び出し

- [x] T011 [US3] アクセシビリティ属性を追加
  - `role="listbox"`, `role="option"`
  - `aria-activedescendant` でフォーカス位置を示す

**Checkpoint**: 全ユーザーストーリー完成

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: エッジケース対応とコード品質

- [x] T012 [P] [Polish] エッジケース対応
  - 検索結果 0 件時のメッセージ表示（「該当するアイテムがありません」）
  - ローディング中のスピナー表示

- [x] T013 [P] [Polish] 重複リンク防止
  - 既存リンク済みアイテムを候補に表示するが、選択時にエラー表示
  - または候補から除外する props を追加

- [x] T014 [Polish] ビルド確認
  - `pnpm --filter meme-gtd-web build` でエラーなし確認
  - TypeScript 型エラーなし確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即時開始可能
- **Foundational (Phase 2)**: Setup 完了後 - 全ストーリーをブロック
- **User Stories (Phase 3-5)**: Foundational 完了後
  - US1 完了後に US2/US3 を開始可能（または並行）
- **Polish (Phase 6)**: 全ストーリー完了後

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完了後 - 他ストーリーへの依存なし
- **User Story 2 (P2)**: US1 の検索ロジック上に構築（US1 完了後推奨）
- **User Story 3 (P3)**: US1/US2 の UI 上に構築（US1 完了後推奨）

### Within Each User Story

- 検索ロジック → UI 更新 → 統合

### Parallel Opportunities

- T012 と T013 は並列実行可能（異なる機能領域）
- US2/US3 は US1 完了後に並列開始可能（ただし同じファイルのため順次推奨）

---

## Parallel Example: Phase 6

```bash
# T012 と T013 を並列実行
Task: "エッジケース対応（空結果、ローディング）"
Task: "重複リンク防止ロジック"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup 完了
2. Phase 2: Foundational 完了（IssuePicker 骨格）
3. Phase 3: User Story 1 完了（検索→選択→リンク追加）
4. **STOP and VALIDATE**: 検索機能をテスト
5. デプロイ可能な状態

### Incremental Delivery

1. Setup + Foundational → 基盤完成
2. User Story 1 → MVP（検索選択） → デプロイ可
3. User Story 2 → 初期表示追加 → デプロイ可
4. User Story 3 → キーボード対応 → デプロイ可
5. Polish → エッジケース対応 → 完成

---

## Notes

- [P] = 異なるファイル、依存関係なし
- [Story] = ユーザーストーリーへのマッピング
- コミットはタスクまたは論理グループごと
- チェックポイントで各ストーリーを独立検証
