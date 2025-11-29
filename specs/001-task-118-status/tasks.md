# Tasks: モバイル表示改善

**Input**: Design documents from `/specs/001-task-118-status/`
**Prerequisites**: plan.md, spec.md, research.md, quickstart.md

**Tests**: テストタスクは仕様書で明示的に要求されていないため、手動検証のみ

**Organization**: タスクはユーザーストーリー別に整理（独立した実装とテストを可能に）

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: 所属するユーザーストーリー（US1, US2, US3）
- ファイルパスは正確に記載

## Path Conventions

- **Web app**: `packages/web/src/` （monorepo構造）
- 変更対象: `packages/web/src/components/Layout.tsx`

---

## Phase 1: Setup

**Purpose**: 開発環境の準備

- [x] T001 開発サーバー起動（`pnpm server:dev`）し、http://localhost:3001 でアクセス確認

**Checkpoint**: 開発環境準備完了

---

## Phase 2: Foundational

**Purpose**: この機能には基盤となる変更が不要（既存のTailwind CSSとLayout.tsxを使用）

該当タスクなし - Phase 3に直接進む

**Checkpoint**: 基盤準備完了 - ユーザーストーリー実装開始可能

---

## Phase 3: User Story 1 - モバイルでナビゲーションを快適に使う (Priority: P1)

**Goal**: 640px未満のビューポートで、4つのナビゲーションリンクが横スクロールなしで画面内に収まる

**Independent Test**: DevToolsで375px幅に設定し、横スクロールバーが表示されず、全リンクがタップ可能

### Implementation for User Story 1

- [x] T002 [US1] `packages/web/src/components/Layout.tsx` のナビリンクコンテナを変更
  - 変更前: `className="ml-6 flex space-x-8"`
  - 変更後: `className="flex space-x-4 sm:ml-6 sm:space-x-8"`
  - FR-003, FR-005, FR-007 を満たす

### Verification for User Story 1

- [ ] T003 [US1] 手動検証: DevToolsで375px幅に設定し、横スクロールが発生しないことを確認
- [ ] T004 [US1] 手動検証: 4つのナビリンク（Memos, Tasks, Projects, Calendar）がすべて画面内に収まることを確認
- [ ] T005 [US1] 手動検証: 各リンクをクリックして正しいページに遷移することを確認

**Checkpoint**: User Story 1 完了 - モバイルで横スクロールなしでナビゲーション可能

---

## Phase 4: User Story 2 - モバイルで画面スペースを有効活用する (Priority: P2)

**Goal**: 640px未満のビューポートでロゴ「Mëmo」を非表示にし、ナビゲーション領域を拡大

**Independent Test**: DevToolsで375px幅に設定し、ロゴが非表示であることを確認

### Implementation for User Story 2

- [x] T006 [US2] `packages/web/src/components/Layout.tsx` のロゴ部分を変更
  - 変更前: `className="text-xl font-bold text-gray-900"`
  - 変更後: `className="hidden sm:block text-xl font-bold text-gray-900"`
  - FR-001 を満たす

### Verification for User Story 2

- [ ] T007 [US2] 手動検証: DevToolsで375px幅に設定し、ロゴ「Mëmo」が非表示であることを確認
- [ ] T008 [US2] 手動検証: ビューポートを640px以上に設定し、ロゴが表示されることを確認（FR-002）

**Checkpoint**: User Story 2 完了 - モバイルでロゴ非表示、デスクトップで表示

---

## Phase 5: User Story 3 - デスクトップ表示を維持する (Priority: P3)

**Goal**: 640px以上のビューポートで既存のレイアウト（ロゴ表示、32px間隔、24pxマージン）が維持される

**Independent Test**: DevToolsで1024px幅に設定し、既存レイアウトと視覚的に同一

### Implementation for User Story 3

該当タスクなし - Phase 3, 4の変更で自動的に達成される（`sm:`プレフィックスにより既存スタイルが640px以上で適用）

### Verification for User Story 3

- [ ] T009 [US3] 手動検証: DevToolsで1024px幅に設定し、ロゴ「Mëmo」が表示されることを確認
- [ ] T010 [US3] 手動検証: ナビリンク間隔が32px（space-x-8相当）であることを確認（FR-004）
- [ ] T011 [US3] 手動検証: ロゴとナビゲーション間のマージンが24px（ml-6相当）であることを確認（FR-006）

**Checkpoint**: User Story 3 完了 - デスクトップ表示に回帰なし

---

## Phase 6: Edge Cases & Final Verification

**Purpose**: 境界条件とエッジケースの検証

- [ ] T012 [P] 手動検証: ビューポート320px幅で全リンクがタップ可能であることを確認（SC-004）
- [ ] T013 [P] 手動検証: ビューポート639px/640px/641pxでの表示切り替えがスムーズであることを確認
- [ ] T014 [P] 手動検証: モバイル横向き（landscape）表示で意図通り動作することを確認
- [x] T015 ビルド成功確認: `pnpm --filter meme-gtd-web build` が成功することを確認

**Checkpoint**: 全検証完了 - 本番リリース準備完了

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - すぐに開始可能
- **Foundational (Phase 2)**: 該当なし
- **User Story 1 (Phase 3)**: Setup完了後に開始
- **User Story 2 (Phase 4)**: Setup完了後に開始（US1と同じファイルを変更するため順次実行推奨）
- **User Story 3 (Phase 5)**: US1, US2の検証タスクのみ
- **Edge Cases (Phase 6)**: 全USの実装完了後

### User Story Dependencies

- **User Story 1 (P1)**: 独立して実装・テスト可能
- **User Story 2 (P2)**: US1と同一ファイル（Layout.tsx）を変更するため順次実行
- **User Story 3 (P3)**: 実装タスクなし、US1とUS2の`sm:`クラスにより自動達成

### Task Dependencies within Layout.tsx

T002とT006は同一ファイル（Layout.tsx）を変更するため、**順次実行が必要**（並列不可）

### Parallel Opportunities

- T012, T013, T014: 異なる検証シナリオのため並列実行可能
- 実装タスク（T002, T006）は同一ファイルのため順次実行

---

## Parallel Example

```bash
# 検証タスクは並列実行可能:
Task: "手動検証: ビューポート320px幅で全リンクがタップ可能"
Task: "手動検証: ビューポート639px/640px/641pxでの表示切り替え"
Task: "手動検証: モバイル横向き（landscape）表示"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: 開発環境起動
2. Phase 3: T002を実装し、T003-T005で検証
3. **STOP and VALIDATE**: 横スクロール問題が解決したことを確認
4. 必要に応じてUS2, US3に進む

### Full Implementation

1. T001: 開発環境起動
2. T002: ナビリンク間隔変更
3. T003-T005: US1検証
4. T006: ロゴ非表示設定
5. T007-T008: US2検証
6. T009-T011: US3検証（デスクトップ回帰確認）
7. T012-T015: エッジケース検証とビルド確認

### Estimated Effort

- 実装タスク: 2件（T002, T006）
- 検証タスク: 13件
- 総所要時間: 30分〜1時間程度

---

## Notes

- 全変更は単一ファイル（Layout.tsx）内で完結
- Tailwindのモバイルファーストアプローチを使用
- テストは手動検証で実施（E2Eテストはオプション）
- 各チェックポイントで独立して動作確認可能
- コミットは実装タスク（T002, T006）完了後に作成推奨
