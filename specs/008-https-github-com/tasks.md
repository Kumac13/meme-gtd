# Tasks: Link Command for Task Relationship Management

**Input**: Design documents from `/specs/008-https-github-com/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: テスト必須原則に従い、Repository/Serviceレイヤーのテストタスクを含む

**Organization**: タスクはユーザーストーリー別に整理され、各ストーリーを独立して実装・テスト可能

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するユーザーストーリー（US1, US2, US3, US4, US5）
- 説明には正確なファイルパスを含む

## Path Conventions
プロジェクトはpnpm workspacesのモノレポ構造：
- **DB層**: `packages/db/src/`, テスト: `packages/db/test/`
- **Core層**: `packages/core/src/`, テスト: `packages/core/test/`
- **CLI層**: `packages/cli/src/commands/`, テスト: `packages/cli/test/`
- **Shared**: `packages/shared/src/`

---

## Phase 1: Setup (共有インフラ)

**Purpose**: linkコマンドの基本構造を作成

- [x] T001 [P] `packages/cli/src/commands/link.ts` を作成（ルートコマンド、ヘルプ表示のみ）
- [x] T002 [P] `packages/cli/src/commands/link/` ディレクトリを作成
- [x] T003 [P] `packages/shared/src/index.ts` にLink型が存在することを確認（既存、変更不要）

**Checkpoint**: 基本構造が準備完了、foundationalタスクに進める

---

## Phase 2: Foundational (全ユーザーストーリーの前提条件)

**Purpose**: 全ユーザーストーリーで共通利用するRepository層とService層の実装

**⚠️ CRITICAL**: このフェーズ完了まで、ユーザーストーリーの実装は開始不可

### Repository Layer (データアクセス)

- [x] T004 [P] `packages/db/src/linkRepository.ts` を作成 - 関数ベースRepository
  - `createLink(db, input: CreateLinkInput): Link`
  - `getLinkById(db, linkId: number): Link`
  - `listLinks(db, issueId: number, filters?: ListLinksFilters): Link[]`
  - `deleteLink(db, linkId: number): void`
  - `findLink(db, criteria): Link | null` (重複チェック用)
  - helper: `linkRowToLink(row: any): Link`

- [x] T005 `packages/db/src/index.ts` を更新 - linkRepository関数をexport

### Repository Tests (TDD: 実装前にテスト作成)

- [x] T006 [P] `packages/db/test/linkRepository.test.ts` を作成
  - createLink: 正常系、重複エラー、ID不在エラー、自己参照エラー
  - listLinks: 空リスト、複数リンク、typeフィルタ、双方向検索
  - deleteLink: 正常削除、ID不在エラー
  - getLinkById: 正常取得、ID不在エラー

### Service Layer (ビジネスロジック)

- [x] T007 `packages/core/src/linkService.ts` を作成 - LinkServiceクラス
  - `constructor(options: { config: Config })`
  - `create(sourceId, targetId, type): Link` (バリデーション含む)
  - `list(issueId, filters?): Link[]`
  - `remove(linkId): void`
  - バリデーション: ID存在確認、重複チェック、自己参照チェック

- [x] T008 `packages/core/src/index.ts` を更新 - LinkServiceをexport

### Service Tests (TDD: 実装前にテスト作成)

- [x] T009 [P] `packages/core/test/linkService.test.ts` を作成
  - create: バリデーション全パターン（正常、自己参照、重複、ID不在）
  - list: Repository呼び出し確認
  - remove: Repository呼び出し確認

**Checkpoint**: Foundation完了 ✅ - ユーザーストーリー実装を並列開始可能

---

## Phase 3: User Story 1 - Create Parent-Child Task Relationships (Priority: P1) 🎯 MVP

**Goal**: `mgtd link add --type parent/child --source <id> --target <id>` でリンクを作成可能にする

**Independent Test**: 2つのタスクを作成し、親子リンクを作成、`link list`で関係が表示されることを確認

### Implementation for User Story 1

- [ ] T010 [P] [US1] `packages/cli/src/commands/link/add.ts` を作成
  - フラグ: `--type` (-t), `--source` (-s), `--target` (-T), `--json` (-j)
  - LinkServiceを使用してリンク作成
  - エラーハンドリング（Service層のエラーをCLI形式で表示）
  - 成功時の出力: `Link created: #<id> (<source> --<type>--> <target>)`
  - JSON出力対応: `{"id":..., "sourceIssueId":..., ...}`

- [ ] T011 [P] [US1] `packages/cli/src/commands/link/list.ts` を作成（P1で必要 - リンク確認用）
  - 引数: `<issue-id>`
  - フラグ: `--type` (-t), `--json` (-j)
  - LinkServiceを使用してリンク一覧取得
  - 人間可読出力: 方向矢印（→/←）付きフォーマット
  - JSON出力: `direction`フィールド追加（outgoing/incoming）

- [ ] T012 [US1] `packages/cli/src/commands/link.ts` のヘルプメッセージ更新
  - サブコマンド（add, list）の説明を追加

**Checkpoint**: P1完了 ✅ - 親子リンクの作成・表示が動作、MVP達成

---

## Phase 4: User Story 2 - View Task Relationships (Priority: P2)

**Goal**: `mgtd link list <id>` の機能を完全実装（フィルタ、エラーハンドリング強化）

**Independent Test**: 複数タイプのリンクを持つタスクで`--type`フィルタが正しく動作することを確認

### Implementation for User Story 2

- [ ] T013 [US2] `packages/cli/src/commands/link/list.ts` の拡張
  - `--type`フィルタの完全実装（親、子、relates、derived_fromの全対応）
  - リンクなし時のメッセージ: `No links found for issue #<id>`
  - エラーケース: 無効なtype値の検証とエラーメッセージ

- [ ] T014 [P] [US2] 出力フォーマットの洗練
  - 列幅の調整（link ID、type、矢印、issue IDの整列）
  - TypeScript型定義の整備（LinkWithDirection型）

**Checkpoint**: P2完了 ✅ - リンク表示機能が完全動作

---

## Phase 5: User Story 3 - Create Related Task Connections (Priority: P3)

**Goal**: `relates`タイプのリンクを作成可能にする

**Independent Test**: 2つの無関係タスクを`relates`でリンクし、双方向から確認

### Implementation for User Story 3

- [ ] T015 [US3] `packages/cli/src/commands/link/add.ts` でrelatesタイプの動作確認
  - 既存コード（T010）で実装済みだが、relatesタイプの明示的テスト
  - contractsのrelatesシナリオに沿った動作確認

**Checkpoint**: P3完了 ✅ - relatesリンクが動作

---

## Phase 6: User Story 4 - Track Memo-to-Task Derivation (Priority: P3)

**Goal**: `derived_from`タイプのリンクを作成可能にする

**Independent Test**: メモを作成、タスクを作成、`derived_from`でリンク、トレーサビリティ確認

### Implementation for User Story 4

- [ ] T016 [US4] `packages/cli/src/commands/link/add.ts` でderived_fromタイプの動作確認
  - 既存コード（T010）で実装済みだが、derived_fromタイプの明示的テスト
  - memo→task間のリンク作成シナリオを確認

**Checkpoint**: P4完了 ✅ - derived_fromリンクが動作

---

## Phase 7: User Story 5 - Remove Obsolete Links (Priority: P3)

**Goal**: `mgtd link remove <link-id>` でリンクを削除可能にする

**Independent Test**: リンクを作成、IDを記録、削除、`link list`で消えたことを確認

### Implementation for User Story 5

- [ ] T017 [US5] 確認プロンプト実装の調査
  - 既存コマンド（task delete等）で確認プロンプトの実装があるか調査
  - `readline`または`@inquirer/prompts`の選択を決定

- [ ] T018 [US5] `packages/cli/src/commands/link/remove.ts` を作成
  - 引数: `<link-id>`
  - フラグ: `--yes` (-y), `--json` (-j)
  - 確認プロンプト: `Delete link #<id> (<source> --<type>--> <target>)? (y/N):`
  - `--yes`フラグ時はプロンプトスキップ
  - LinkServiceを使用して削除
  - 成功時出力: `Link #<id> deleted`
  - キャンセル時: `Cancelled`
  - JSON出力: `{"deleted": true/false, "linkId": ..., "reason": ...}`

- [ ] T019 [US5] `packages/cli/src/commands/link.ts` のヘルプメッセージ更新
  - removeサブコマンドの説明を追加

**Checkpoint**: P5完了 ✅ - リンク削除機能が動作、全ユーザーストーリー完了

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 全ユーザーストーリーに影響する改善・ドキュメント整備

### Documentation

- [ ] T020 [P] `docs/cli-commands.md` を更新
  - linkコマンドの仕様を追記（`mgtd link add/list/remove`）
  - 各サブコマンドのオプション一覧
  - 使用例

- [ ] T021 [P] `README.md` を更新（必要に応じて）
  - linkコマンドの説明を追加
  - GTDワークフローでの活用例

### Build & Integration

- [ ] T022 プロジェクト全体のビルド確認
  - `pnpm build` が全パッケージで成功することを確認
  - 型エラー、リントエラーがないことを確認

- [ ] T023 手動テスト実行（quickstart.mdのシナリオ）
  - Scenario 1-7を実行してE2E動作確認
  - テストDB使用の徹底確認

### Optional Enhancements (次バージョンで検討)

- [ ] T024 [FUTURE] 循環参照チェックの実装（多段階A→B→C→A）
  - MVPでは直接循環のみチェック、将来的にグラフ探索を実装

- [ ] T025 [FUTURE] パフォーマンス最適化（DBインデックス追加）
  - data-model.mdで推奨されたインデックスを実装
  - 大量リンク時のベンチマーク

**Checkpoint**: Polish完了 ✅ - 本番リリース可能

---

## Dependencies & Execution Order

### Dependency Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← 全ユーザーストーリーの前提
    ├─→ Phase 3 (US1 - P1) 🎯 MVP ←─┐
    │       ↓ (list depends on add)    │
    ├─→ Phase 4 (US2 - P2)              │ 並列実行可能
    ├─→ Phase 5 (US3 - P3)              │
    ├─→ Phase 6 (US4 - P3)              │
    └─→ Phase 7 (US5 - P3) ─────────────┘
            ↓ (all stories done)
    Phase 8 (Polish)
```

### Critical Path

1. **T001-T003**: Setup（並列可）
2. **T004-T009**: Foundational（Repository→Service→Tests、一部並列可）
3. **T010**: US1 `link add`実装（MVP必須）
4. **T011**: US1 `link list`実装（addの確認に必要）
5. **T012**: US1 ヘルプ更新
6. **T013-T023**: 残りのユーザーストーリー（US2-US5は並列実行可能）
7. **T020-T023**: Polish（並列可）

### Parallel Execution Opportunities

**Phase 2 (Foundational)**:
- T004 (linkRepository) || T006 (linkRepository test) || T007 (linkService)
- T009 (linkService test) after T007

**Phase 3-7 (User Stories)**:
- US2, US3, US4, US5は**US1完了後に並列実行可能**
  - US2: T013-T014
  - US3: T015
  - US4: T016
  - US5: T017-T019

**Phase 8 (Polish)**:
- T020 (docs) || T021 (README) || T022 (build)

---

## Independent Test Criteria per User Story

### US1 (P1) - MVP
- ✅ 2つのタスクを作成できる
- ✅ `mgtd link add --type parent --source <child> --target <parent>` が成功
- ✅ `mgtd link list <parent>` で子タスクが表示される
- ✅ `mgtd link list <child>` で親タスクが表示される
- ✅ JSON出力が正しいLink objectを返す

### US2 (P2)
- ✅ 複数タイプのリンクを持つタスクで全リンクが表示される
- ✅ `--type parent` で親リンクのみフィルタされる
- ✅ リンクなしタスクで適切なメッセージが表示される
- ✅ 方向矢印（→/←）が正しく表示される

### US3 (P3)
- ✅ `--type relates` でリンクが作成される
- ✅ 双方向（source/target両方）からリンクが見える

### US4 (P3)
- ✅ メモとタスク間で`derived_from`リンクが作成される
- ✅ タスクからメモへのトレーサビリティが確認できる

### US5 (P3)
- ✅ `mgtd link remove <id> --yes` でリンクが削除される
- ✅ 確認プロンプト（`--yes`なし）でキャンセル可能
- ✅ 削除後、`link list`でリンクが表示されない

---

## Implementation Strategy

### MVP Scope (推奨)
**Phase 1 + Phase 2 + Phase 3 (US1)** = linkコマンドの基本機能

- linkRepository (CRUD operations)
- LinkService (validation)
- `link add` command (parent/child types)
- `link list` command (basic display)
- Tests (Repository + Service)

**Estimated Effort**: 8-12タスク（T001-T012）
**Delivery Value**: GTDワークフローの階層的タスク管理が可能

### Incremental Delivery

1. **MVP Release** (Phase 1-3)
2. **Enhanced Viewing** (Phase 4 - US2)
3. **Full Link Types** (Phase 5-6 - US3, US4)
4. **Complete CRUD** (Phase 7 - US5)
5. **Production Ready** (Phase 8 - Polish)

### Testing Approach

- **TDD**: Repository/Serviceテストは実装前に作成（T006, T009）
- **Manual**: quickstart.mdのシナリオで各フェーズ後に手動確認
- **Integration**: 既存のtask/memoコマンドとの統合テスト（Optional）

---

## Task Summary

| Phase | User Story | Task Count | Parallelizable | Critical |
|-------|------------|------------|----------------|----------|
| Phase 1 | Setup | 3 | 3 | ✅ |
| Phase 2 | Foundational | 6 | 3 | ✅ |
| Phase 3 | US1 (P1) 🎯 | 3 | 2 | ✅ MVP |
| Phase 4 | US2 (P2) | 2 | 1 | - |
| Phase 5 | US3 (P3) | 1 | 1 | - |
| Phase 6 | US4 (P3) | 1 | 1 | - |
| Phase 7 | US5 (P3) | 3 | 0 | - |
| Phase 8 | Polish | 6 | 4 | - |
| **Total** | **5 Stories** | **25** | **15** | **12** |

**MVP (Phase 1-3)**: 12タスク
**Full Feature**: 25タスク
**Parallel Opportunities**: 15タスク（60%）

---

## Next Steps

1. ✅ `/speckit.tasks` 完了 - このファイルが生成されました
2. ⏭️ タスク実行: 上から順番に、または並列実行可能タスクを同時実行
3. 📝 各タスク完了後にチェックボックスにチェック
4. 🧪 Phase 3完了時点でMVP動作確認
5. 🚀 Phase 8完了後に本番リリース準備
