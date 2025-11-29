# Tasks: タスクをメモにdemote機能

**Input**: Design documents from `/specs/001-demote/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/api.yaml

**Tests**: テストは明示的に要求されていないため省略。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **モノレポ構造**: `packages/db/`, `packages/core/`, `packages/api/`, `packages/cli/`, `packages/web/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: この機能は既存プロジェクトへの追加のため、セットアップ不要

（スキップ - 既存モノレポ構造を使用）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーが依存するデータベース層とサービス層の実装

**⚠️ CRITICAL**: ユーザーストーリーの実装はこのフェーズ完了後に開始

### Database Layer

- [ ] T001 [US1] `demoteTask`関数をtaskRepository.tsに実装（タスク・コメント取得、本文組み立て、メモ作成、リンク作成、ラベル・プロジェクトコピー） - `packages/db/src/taskRepository.ts`
- [ ] T002 [US1] `demoteTask`をindex.tsからエクスポート - `packages/db/src/index.ts`

### Service Layer

- [ ] T003 [US1] TaskServiceに`demote()`メソッド追加 - `packages/core/src/index.ts`

**Checkpoint**: Foundation ready - demoteのコア機能が使用可能

---

## Phase 3: User Story 1 - タスク完了時にドキュメントとしてメモにコピー (Priority: P1) 🎯 MVP

**Goal**: タスクの内容（タイトル・本文・コメント）をメモとしてコピー作成し、ラベル・プロジェクトを継承する

**Independent Test**: `POST /api/tasks/:id/demote` でメモが作成され、元タスクが変更されていないことを確認

### Implementation for User Story 1

- [ ] T004 [P] [US1] demoteTaskHandlerを実装 - `packages/api/src/handlers/taskHandlers.ts`
- [ ] T005 [P] [US1] DemoteTaskRequestSchemaをZodで定義 - `packages/api/src/handlers/taskHandlers.ts`
- [ ] T006 [US1] `POST /api/tasks/:id/demote`ルートを追加 - `packages/api/src/routes/tasks.ts`

**Checkpoint**: API経由でdemoteが実行可能（US1完了）

---

## Phase 4: User Story 2 - demote前に内容を編集 (Priority: P2)

**Goal**: CLIでdemote実行時にエディタが開き、内容を編集してからメモを作成できる

**Independent Test**: `mgtd task demote <id>` 実行でエディタが開き、編集後の内容でメモが作成される

### Implementation for User Story 2

- [ ] T007 [US2] `task demote`コマンドファイル新規作成（基本構造） - `packages/cli/src/commands/task/demote.ts`
- [ ] T008 [US2] buildDemoteBodyヘルパー関数実装（タイトル・本文・コメント結合） - `packages/cli/src/commands/task/demote.ts`
- [ ] T009 [US2] エディタ起動処理実装（$EDITOR使用） - `packages/cli/src/commands/task/demote.ts`
- [ ] T010 [US2] `--no-editor`フラグ実装 - `packages/cli/src/commands/task/demote.ts`
- [ ] T011 [US2] `--body`, `--body-file`フラグ実装 - `packages/cli/src/commands/task/demote.ts`
- [ ] T012 [US2] `--label`フラグ実装 - `packages/cli/src/commands/task/demote.ts`
- [ ] T013 [US2] `--json`フラグ実装 - `packages/cli/src/commands/task/demote.ts`
- [ ] T014 [US2] MULTIWORD_COMMANDSに`['task', 'demote']`を登録 - `packages/cli/src/index.ts`

**Checkpoint**: CLIでdemoteが実行可能（US2完了）

---

## Phase 5: User Story 3 - 元タスクへのリンクで関連を追跡 (Priority: P2)

**Goal**: 作成されたメモから元タスクへの`derived_from`リンクが表示される

**Independent Test**: demoteで作成されたメモの詳細画面でリンク情報が確認できる

### Implementation for User Story 3

（リンク作成はT001で実装済み。このフェーズではWeb UIでのリンク表示を実装）

- [ ] T015 [US3] タスク詳細画面に「メモにコピー」ボタン追加 - `packages/web/src/pages/TaskDetailPage.tsx`（または該当ファイル）
- [ ] T016 [US3] demote API呼び出し処理実装 - `packages/web/src/pages/TaskDetailPage.tsx`
- [ ] T017 [US3] demote成功後のメモ詳細画面遷移処理 - `packages/web/src/pages/TaskDetailPage.tsx`

**Checkpoint**: Web UIでdemoteが実行可能（US3完了）

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 品質向上とドキュメント更新

- [ ] T018 [P] エラーハンドリング強化（削除済みタスク、存在しないタスク） - 各ファイル
- [ ] T019 [P] エッジケース対応（本文なし、コメントなし） - `packages/db/src/taskRepository.ts`
- [ ] T020 ドキュメント更新 - `docs/cli-commands.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: スキップ
- **Phase 2 (Foundational)**: T001 → T002 → T003 （順次実行）
- **Phase 3 (US1)**: Phase 2完了後、T004/T005は並列可、T006は両方完了後
- **Phase 4 (US2)**: Phase 2完了後に開始可（US1と並列可）、T007から順次実行
- **Phase 5 (US3)**: Phase 2完了後に開始可（US1/US2と並列可）
- **Phase 6 (Polish)**: 全USストーリー完了後

### User Story Dependencies

- **User Story 1 (P1)**: Phase 2完了後に開始可能
- **User Story 2 (P2)**: Phase 2完了後に開始可能（US1と独立）
- **User Story 3 (P2)**: Phase 2完了後に開始可能（US1/US2と独立）

### Parallel Opportunities

- T004, T005: 並列実行可能
- T018, T019, T020: 並列実行可能
- US1, US2, US3: Phase 2完了後に並列実行可能

---

## Parallel Example: Phase 3 (User Story 1)

```bash
# Launch handler and schema in parallel:
Task: "T004 demoteTaskHandlerを実装"
Task: "T005 DemoteTaskRequestSchemaをZodで定義"

# After both complete:
Task: "T006 POST /api/tasks/:id/demote ルートを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational (T001-T003)
2. Complete Phase 3: User Story 1 (T004-T006)
3. **STOP and VALIDATE**: API経由でdemoteをテスト
4. Deploy/demo if ready

### Incremental Delivery

1. Phase 2 → Foundation ready
2. Add US1 (API) → Test → Deploy (MVP!)
3. Add US2 (CLI) → Test → Deploy
4. Add US3 (Web UI) → Test → Deploy
5. Each story adds interface without breaking previous

### Recommended Execution Order (Single Developer)

1. T001 → T002 → T003 (Foundation)
2. T004, T005 (parallel) → T006 (US1 complete)
3. T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 (US2 complete)
4. T015 → T016 → T017 (US3 complete)
5. T018, T019, T020 (parallel, Polish)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- T001が最も重要 - demoteのコアロジックを全て含む
- CLIコマンドファイル(T007-T014)は同一ファイルのため順次実行
- Stop at any checkpoint to validate story independently
