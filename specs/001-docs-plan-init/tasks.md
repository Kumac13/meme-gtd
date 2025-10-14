# Tasks: Memo Command CLI Requirements Alignment

**Input**: Design documents from `/specs/001-docs-plan-init/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/flag-changes.md, quickstart.md

**Tests**: テストは既存のテストフレームワーク（node:test）を使用し、すべての変更に対するテストケースを追加します（FR-019）。

**Organization**: タスクはUser Story（優先度順）ごとにグループ化し、各ストーリーを独立して実装・テスト可能にします。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するUser Story（US1, US2, US3）
- ファイルパスを含む具体的な説明

## Path Conventions
- **Monorepo structure**: `packages/cli/`, `packages/core/`, `packages/db/`, `packages/config/`, `packages/logger/`, `packages/shared/`
- **Tests**: `packages/cli/test/`

---

## Phase 1: Setup (共有インフラ)

**目的**: エディタヘルパー関数の拡張（全User Storyで共通使用）

- [x] T001 [P] [Setup] `packages/cli/src/lib/editor.ts`に`EditorOptions`インターフェースを定義
- [x] T002 [Setup] `packages/cli/src/lib/editor.ts`に`maybePromptEditor()`関数を実装（相互排他チェック、優先順位ロジック）
- [x] T003 [P] [Setup] `packages/cli/test/lib/editor.test.ts`を作成し、`maybePromptEditor()`のユニットテストを追加

**Checkpoint**: ✅ エディタヘルパー関数が完成し、全コマンドで使用可能

---

## Phase 2: Foundational (ブロッキング前提条件)

**目的**: 旧オプション検出とエラーメッセージのユーティリティ（全User Storyで必要）

**⚠️ CRITICAL**: このフェーズが完了するまで、User Storyの作業は開始できません

- [x] T004 [P] [Foundation] `packages/cli/src/lib/legacy-flags.ts`（新規作成）に旧フラグ検出関数`detectLegacyFlags()`を実装
- [x] T005 [P] [Foundation] `packages/cli/test/lib/legacy-flags.test.ts`を作成し、旧フラグ検出のユニットテストを追加

**Checkpoint**: ✅ 旧フラグ検出ユーティリティが完成し、全コマンドで使用可能

---

## Phase 3: User Story 1 - GitHub CLI準拠のオプション命名規則への統一 (Priority: P1) 🎯 MVP

**Goal**: すべてのmemoコマンドでkebab-caseオプションを使用でき、旧camelCaseオプションは適切なエラーメッセージを表示する

**Independent Test**: `mgtd memo create --body-file test.md`が動作し、`mgtd memo create --bodyFile test.md`がエラーを返すことを確認

### Implementation for User Story 1

#### 1. `memo create`コマンドの更新

- [x] T006 [US1] `packages/cli/src/commands/memo/create.ts`のフラグ定義を更新（`bodyFile` → `body-file`）
- [x] T007 [US1] `packages/cli/src/commands/memo/create.ts`の`run()`メソッドに旧フラグ検出ロジックを追加
- [x] T008 [US1] `packages/cli/src/commands/memo/create.ts`のusageとexamplesを更新（kebab-case）

#### 2. `memo edit`コマンドの更新

- [x] T009 [US1] `packages/cli/src/commands/memo/edit.ts`のフラグ定義を更新（`bodyFile` → `body-file`, `addLabel` → `add-label`, `removeLabel` → `remove-label`）
- [x] T010 [US1] `packages/cli/src/commands/memo/edit.ts`の`run()`メソッドに旧フラグ検出ロジックを追加
- [x] T011 [US1] `packages/cli/src/commands/memo/edit.ts`のusageとexamplesを更新（kebab-case）

#### 3. `memo promote`コマンドの更新

- [x] T012 [P] [US1] `packages/cli/src/commands/memo/promote.ts`のフラグ定義を更新（`bodyFile` → `body-file`, `addLabel` → `add-label`, `removeLabel` → `remove-label`）
- [x] T013 [US1] `packages/cli/src/commands/memo/promote.ts`の`run()`メソッドに旧フラグ検出ロジックを追加
- [x] T014 [US1] `packages/cli/src/commands/memo/promote.ts`のusageとexamplesを更新（kebab-case）

#### 4. `memo comment add`コマンドの更新

- [x] T015 [P] [US1] `packages/cli/src/commands/memo/comment/add.ts`のフラグ定義を更新（`bodyFile` → `body-file`）
- [x] T016 [US1] `packages/cli/src/commands/memo/comment/add.ts`の`run()`メソッドに旧フラグ検出ロジックを追加
- [x] T017 [US1] `packages/cli/src/commands/memo/comment/add.ts`のusageとexamplesを更新（kebab-case）

#### 5. `memo comment edit`コマンドの更新

- [x] T018 [P] [US1] `packages/cli/src/commands/memo/comment/edit.ts`のフラグ定義を更新（`bodyFile` → `body-file`）
- [x] T019 [US1] `packages/cli/src/commands/memo/comment/edit.ts`の`run()`メソッドに旧フラグ検出ロジックを追加
- [x] T020 [US1] `packages/cli/src/commands/memo/comment/edit.ts`のusageとexamplesを更新（kebab-case）

#### 6. テストの更新（User Story 1）

- [x] T021 [P] [US1] `packages/cli/test/commands/memo/create.test.ts`を更新（kebab-caseフラグに変更）
- [x] T022 [P] [US1] `packages/cli/test/commands/memo/create.test.ts`に旧フラグエラーメッセージのテストを追加
- [x] T023 [P] [US1] `packages/cli/test/commands/memo/edit.test.ts`を更新（kebab-caseフラグに変更）
- [x] T024 [P] [US1] `packages/cli/test/commands/memo/edit.test.ts`に旧フラグエラーメッセージのテストを追加
- [x] T025 [P] [US1] 統合テスト`packages/cli/test/integration/cli.test.ts`を更新（kebab-caseオプションの動作確認）

**Checkpoint**: User Story 1完了 - すべてのmemoコマンドでkebab-caseオプションが動作し、旧オプションは適切なエラーを返す

---

## Phase 4: User Story 2 - エディタ起動の明示的制御 (Priority: P2)

**Goal**: `memo create`、`memo edit`、`memo comment add`コマンドで`--editor` / `--no-editor`フラグが動作し、エディタの起動/抑止を制御できる

**Independent Test**: `mgtd memo create --body "test" --editor`でエディタが起動し、`mgtd memo create --body "test" --no-editor`でエディタが起動しないことを確認

### Implementation for User Story 2

#### 1. `memo create`コマンドへの`--editor` / `--no-editor`追加

- [x] T026 [US2] `packages/cli/src/commands/memo/create.ts`に`--editor`と`--no-editor`フラグを追加（`exclusive`オプション設定）
- [x] T027 [US2] `packages/cli/src/commands/memo/create.ts`の`run()`メソッドで`maybePromptEditor()`を使用するようエディタ起動ロジックを更新
- [x] T028 [US2] `packages/cli/src/commands/memo/create.ts`のexamplesに`--editor` / `--no-editor`の使用例を追加

#### 2. `memo edit`コマンドへの`--editor` / `--no-editor`追加

- [x] T029 [US2] `packages/cli/src/commands/memo/edit.ts`に`--editor`と`--no-editor`フラグを追加（`exclusive`オプション設定）
- [x] T030 [US2] `packages/cli/src/commands/memo/edit.ts`の`run()`メソッドで`maybePromptEditor()`を使用するようエディタ起動ロジックを更新
- [x] T031 [US2] `packages/cli/src/commands/memo/edit.ts`のexamplesに`--editor` / `--no-editor`の使用例を追加

#### 3. `memo comment add`コマンドへの`--editor` / `--no-editor`追加

- [x] T032 [P] [US2] `packages/cli/src/commands/memo/comment/add.ts`に`--editor`と`--no-editor`フラグを追加（`exclusive`オプション設定）
- [x] T033 [US2] `packages/cli/src/commands/memo/comment/add.ts`の`run()`メソッドで`maybePromptEditor()`を使用するようエディタ起動ロジックを更新
- [x] T034 [US2] `packages/cli/src/commands/memo/comment/add.ts`のexamplesに`--editor` / `--no-editor`の使用例を追加

#### 4. テストの追加（User Story 2）

- [x] T035 [P] [US2] `packages/cli/test/commands/memo/create.test.ts`に`--editor`フラグのテストを追加
- [x] T036 [P] [US2] `packages/cli/test/commands/memo/create.test.ts`に`--no-editor`フラグのテストを追加
- [x] T037 [P] [US2] `packages/cli/test/commands/memo/create.test.ts`に`--editor`と`--no-editor`の相互排他テストを追加
- [x] T038 [P] [US2] `packages/cli/test/commands/memo/edit.test.ts`に`--editor` / `--no-editor`フラグのテストを追加
- [x] T039 [P] [US2] `packages/cli/test/commands/memo/comment/add.test.ts`に`--editor` / `--no-editor`フラグのテストを追加

**Checkpoint**: User Story 2完了 - エディタフラグがすべての対象コマンドで動作し、優先順位ロジックが正しく機能する

---

## Phase 5: User Story 3 - 機能重複の解消（`--set-label`の削除） (Priority: P3)

**Goal**: `memo edit --set-label`が削除され、`memo label set`コマンドのみでラベルの完全置換が可能になる

**Independent Test**: `mgtd memo edit 12 --set-label bug`がエラーを返し、`mgtd memo label set 12 --label bug`が動作することを確認

### Implementation for User Story 3

#### 1. `memo edit`から`--set-label`フラグを削除

- [x] T040 [US3] `packages/cli/src/commands/memo/edit.ts`から`setLabel`フラグ定義を削除（User Story 1で完了）
- [x] T041 [US3] `packages/cli/src/commands/memo/edit.ts`の`run()`メソッドから`setLabel`処理ロジックを削除（User Story 1で完了）
- [x] T042 [US3] `packages/cli/src/commands/memo/edit.ts`の旧フラグ検出ロジックに`--setLabel` / `--set-label`を追加（User Story 1で完了）
- [x] T043 [US3] `packages/cli/src/commands/memo/edit.ts`のusageとexamplesから`--set-label`を削除（User Story 1で完了）

#### 2. `memo label set`コマンドの確認

- [x] T044 [P] [US3] `packages/cli/src/commands/memo/label/set.ts`が正しく動作していることを確認（変更不要）
- [x] T045 [P] [US3] `packages/db/src/repositories/memoRepository.ts`の`setMemoLabels()`関数が保持されていることを確認

#### 3. テストの更新（User Story 3）

- [x] T046 [P] [US3] `packages/cli/test/commands/memo/edit.test.ts`から`--set-label`使用のテストケースを削除（元々存在しない）
- [x] T047 [P] [US3] `packages/cli/test/commands/memo/edit.test.ts`に`--set-label`エラーメッセージのテストを追加（User Story 1で完了）
- [x] T048 [P] [US3] 統合テスト`packages/cli/test/integration/cli.test.ts`に`memo label set`の動作確認テストを追加

**Checkpoint**: User Story 3完了 - `memo edit --set-label`が削除され、`memo label set`への移行が完了

---

## Phase 6: Polish & Cross-Cutting Concerns

**目的**: ドキュメント更新とテスト実行

- [ ] T049 [P] [Polish] `README.md`を更新（すべてのコマンド例をkebab-caseに変更）
- [ ] T050 [P] [Polish] `CHANGELOG.md`を作成/更新（v0.1.1の破壊的変更セクションを追加）
- [ ] T051 [Polish] `pnpm test`を実行し、すべてのテストがパスすることを確認
- [ ] T052 [P] [Polish] `pnpm build`を実行し、ビルドが成功することを確認
- [ ] T053 [Polish] 手動テスト: `pnpm run mgtd:install`でCLIをインストールし、実際のコマンドで動作確認

**Checkpoint**: すべてのドキュメントが更新され、テストが100%パス

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - すぐに開始可能
- **Foundational (Phase 2)**: Setupの完了に依存 - すべてのUser Storyをブロック
- **User Stories (Phase 3-5)**: Foundationalの完了に依存
  - User Story間は独立して並列実行可能
  - または優先度順に順次実行（P1 → P2 → P3）
- **Polish (Phase 6)**: すべてのUser Storyの完了に依存

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完了後に開始可能 - 他のストーリーへの依存なし
- **User Story 2 (P2)**: Foundational完了後に開始可能 - US1に依存（kebab-caseフラグ定義が前提）
- **User Story 3 (P3)**: Foundational完了後に開始可能 - US1に依存（kebab-caseフラグ定義が前提）

### Within Each User Story

- コマンド更新タスクは同じコマンドファイルを操作するため順次実行
- 異なるコマンドファイルの更新は並列実行可能（[P]マーク）
- テストタスクは実装完了後に実行
- コマンド更新完了 → テストケース追加 → テスト実行

### Parallel Opportunities

- Phase 1: T001とT003は並列実行可能
- Phase 2: T004とT005は並列実行可能
- Phase 3（US1）: T012-T013-T014（promote）とT015-T016-T017（comment add）とT018-T019-T020（comment edit）は並列実行可能
- Phase 3（US1）: テストT021-T025は並列実行可能
- Phase 4（US2）: T032-T033-T034（comment add）は並列実行可能
- Phase 4（US2）: テストT035-T039は並列実行可能
- Phase 5（US3）: T044とT045は並列実行可能
- Phase 5（US3）: テストT046-T048は並列実行可能
- Phase 6: T049-T050とT052は並列実行可能

---

## Parallel Example: User Story 1

```bash
# Phase 3（US1）の並列実行可能タスク:
# グループ1（異なるコマンドファイル）
Task T012-T014: memo promote コマンドの更新
Task T015-T017: memo comment add コマンドの更新
Task T018-T020: memo comment edit コマンドの更新

# グループ2（テスト）
Task T021: memo create テスト更新
Task T022: memo create 旧フラグテスト追加
Task T023: memo edit テスト更新
Task T024: memo edit 旧フラグテスト追加
Task T025: 統合テスト更新
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup完了
2. Phase 2: Foundational完了（CRITICAL - すべてのストーリーをブロック）
3. Phase 3: User Story 1完了
4. **STOP and VALIDATE**: User Story 1を独立してテスト
5. 準備ができればデプロイ/デモ

### Incremental Delivery

1. Setup + Foundational完了 → 基盤準備完了
2. User Story 1追加 → 独立してテスト → デプロイ/デモ（MVP!）
3. User Story 2追加 → 独立してテスト → デプロイ/デモ
4. User Story 3追加 → 独立してテスト → デプロイ/デモ
5. 各ストーリーが前のストーリーを壊すことなく価値を追加

### Sequential Strategy (推奨)

この機能では、User Story 2とUser Story 3がUser Story 1に依存しているため、順次実行を推奨：

1. Phase 1 + Phase 2完了
2. Phase 3（US1）完了 → テスト → コミット
3. Phase 4（US2）完了 → テスト → コミット
4. Phase 5（US3）完了 → テスト → コミット
5. Phase 6（Polish）完了 → 最終テスト → プルリクエスト作成

---

## Notes

- [P]タスク = 異なるファイル、依存関係なし
- [Story]ラベル = タスクを特定のUser Storyにマッピング（トレーサビリティ）
- 各User Storyは独立して完成・テスト可能
- 実装前にテストが失敗することを確認
- 各タスクまたは論理的なグループごとにコミット
- 各チェックポイントで停止し、ストーリーを独立して検証
- 避けるべきこと: 曖昧なタスク、同じファイルの競合、ストーリーの独立性を壊す依存関係

---

## Task Summary

- **総タスク数**: 53
- **User Story 1**: 20タスク（T006-T025）
- **User Story 2**: 14タスク（T026-T039）
- **User Story 3**: 9タスク（T040-T048）
- **並列実行機会**: 約15タスクが並列実行可能
- **推奨MVPスコープ**: User Story 1のみ（kebab-caseオプション統一）

**Independent Test Criteria**:
- **US1**: kebab-caseオプションが動作し、旧オプションがエラーを返す
- **US2**: `--editor` / `--no-editor`フラグが期待通りに動作する
- **US3**: `memo edit --set-label`がエラーを返し、`memo label set`が動作する

**実装準備完了**: ✅
