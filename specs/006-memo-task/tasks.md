# Implementation Tasks: 統合ラベル管理システム

**Branch**: `006-memo-task` | **Date**: 2025-10-15 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

## Summary

実装タスク総数: 17タスク
- Phase 1 (Setup): 1タスク
- Phase 2 (Foundational): 2タスク
- Phase 3 (US1 - ラベル一覧): 2タスク
- Phase 4 (US2 - ラベル作成): 2タスク
- Phase 5 (US3 - ラベル割り当て): 2タスク
- Phase 6 (US4 - ラベル削除): 2タスク
- Phase 7 (旧コマンド削除): 2タスク
- Phase 8 (Polish): 4タスク

**MVP推奨スコープ**: User Story 1 (ラベル一覧表示) - T001〜T005

---

## Phase 1: Setup

### T001: labelRepository.tsの作成 [P]

**Goal**: ラベル操作用のリポジトリ関数を集約するファイルを作成

**File**: `packages/db/src/labelRepository.ts`

**Implementation**:
```typescript
import Database from 'better-sqlite3';
import { nowIso } from 'meme-gtd-shared';

// Placeholder for label repository functions
// Will be filled in subsequent tasks
```

**Acceptance**: ファイルが存在し、TypeScriptエラーなくビルドできる

---

## Phase 2: Foundational Tasks

### T002: labelRepository基本関数の実装

**Goal**: 全ユーザーストーリーで共通して使用するlabelRepository関数を実装

**File**: `packages/db/src/labelRepository.ts`

**Implementation**:
- `listAllLabels(db: Database): Label[]` - 全ラベル取得（削除済み除外）
- `getLabel(db: Database, id: number): Label` - ID指定取得
- `getLabelByName(db: Database, name: string): Label | null` - 名前指定取得

**Query Examples**:
```typescript
// listAllLabels
SELECT * FROM labels ORDER BY name ASC

// getLabel
SELECT * FROM labels WHERE id = @id

// getLabelByName
SELECT * FROM labels WHERE name = @name
```

**Acceptance**:
- 3関数が実装されている
- `packages/db/src/index.ts`でexportされている
- 既存の`labels`テーブル構造に準拠

**Dependencies**: T001

---

### T003: LabelServiceクラスの作成

**Goal**: labelRepository関数をラップするサービス層を作成

**File**: `packages/core/src/index.ts`

**Implementation**:
```typescript
export interface LabelServiceOptions {
  config: MgtdConfig;
}

export class LabelService {
  private readonly db: Database.Database;

  constructor(private readonly options: LabelServiceOptions) {
    this.db = ensureDatabase(options.config);
  }

  // Methods will be added in subsequent tasks
}
```

**Acceptance**:
- LabelServiceクラスが定義されている
- MemoService/TaskServiceと同じパターンに従っている
- TypeScriptエラーなくビルドできる

**Dependencies**: T002

---

## Phase 3: User Story 1 - ラベル一覧表示 (Priority P1) [Story: US1]

**Story Goal**: ユーザーがシステム内の全ラベルを一覧表示できる

**Independent Test**: `mgtd label list`実行で全ラベルが表示される、`--json`フラグでJSON形式出力される

### T004: LabelService.list()の実装 [Story: US1]

**Goal**: 全ラベル取得メソッドを実装

**File**: `packages/core/src/index.ts` (LabelService class)

**Implementation**:
```typescript
public list(): Label[] {
  return listAllLabels(this.db);
}
```

**Acceptance**: `listAllLabels()`を呼び出し、結果を返す

**Dependencies**: T003

---

### T005: CLI `label list`コマンドの実装 [Story: US1]

**Goal**: `mgtd label list`コマンドを実装

**File**: `packages/cli/src/commands/label/index.ts`

**Implementation**:
- Args: なし
- Flags: `--json`（boolean, optional）
- Logic: LabelService.list()を呼び出し
- Output (default): ラベル名を1行ずつ
- Output (--json): Label[]をJSON形式

**Acceptance**:
- コマンドが実行できる
- ラベルが0件の場合「No labels found」
- ラベルが存在する場合、全件表示
- `--json`フラグでJSON配列出力

**Dependencies**: T004

**Checkpoint**: ✓ User Story 1完了 - ラベル一覧表示が動作

---

## Phase 4: User Story 2 - ラベル作成 (Priority P1) [Story: US2]

**Story Goal**: ユーザーがmemo/taskから独立して新しいラベルを作成できる

**Independent Test**: `mgtd label add <name>`実行でラベルが作成され、`mgtd label list`で確認できる

### T006: labelRepository.createLabel()の実装 [Story: US2]

**Goal**: ラベル作成関数を実装

**File**: `packages/db/src/labelRepository.ts`

**Implementation**:
```typescript
export const createLabel = (
  db: Database.Database,
  name: string,
  description?: string
): Label => {
  // Check uniqueness
  const existing = getLabelByName(db, name);
  if (existing) {
    throw new Error(`Label '${name}' already exists`);
  }

  const now = nowIso();
  const stmt = db.prepare(
    `INSERT INTO labels (name, description, created_at)
     VALUES (@name, @description, @createdAt)`
  );
  const result = stmt.run({ name, description: description ?? null, createdAt: now });
  return getLabel(db, Number(result.lastInsertRowid));
};
```

**Acceptance**:
- 重複チェックが動作
- ラベルが作成される
- `packages/db/src/index.ts`でexportされている

**Dependencies**: T002

---

### T007: CLI `label add`コマンドの実装 [Story: US2]

**Goal**: `mgtd label add <name>`コマンドを実装

**File**: `packages/cli/src/commands/label/add.ts`

**Implementation**:
- Args: `name`（string, required）
- Flags: `--description`（string, optional）, `--json`（boolean, optional）
- Logic: LabelService.create()を呼び出し
- Output (default): `Label '<name>' created`
- Output (--json): Labelオブジェクト
- Error handling: 重複時にエラーメッセージ表示

**LabelService Method** (add to `packages/core/src/index.ts`):
```typescript
public create(name: string, description?: string): Label {
  return createLabel(this.db, name, description);
}
```

**Acceptance**:
- コマンドが実行できる
- ラベルが作成される
- 重複時にエラーメッセージ「Label 'xxx' already exists」
- `--json`フラグでJSON出力

**Dependencies**: T006

**Checkpoint**: ✓ User Story 2完了 - ラベル作成が動作

---

## Phase 5: User Story 3 - ラベル割り当て (Priority P1) [Story: US3]

**Story Goal**: ユーザーがtype（memo/task）を意識せずにissueにラベルを割り当てられる

**Independent Test**: `mgtd label set <issue-id> <label-id>`実行でラベルが付与され、`mgtd memo view`/`mgtd task view`で確認できる

### T008: labelRepository.attachLabelToIssue()の実装 [Story: US3]

**Goal**: issueにラベルを割り当てる関数を実装

**File**: `packages/db/src/labelRepository.ts`

**Implementation**:
```typescript
export const attachLabelToIssue = (
  db: Database.Database,
  issueId: number,
  labelId: number
): void => {
  // Check issue exists and not deleted
  const issue = db
    .prepare('SELECT id, type, is_deleted FROM issues WHERE id = @id')
    .get({ id: issueId }) as any;

  if (!issue || issue.is_deleted === 1) {
    throw new Error(`Issue #${issueId} not found or deleted`);
  }

  // Check label exists
  const label = getLabel(db, labelId);
  if (!label) {
    throw new Error(`Label #${labelId} not found`);
  }

  // Insert (idempotent - ignore if already exists)
  db.prepare(
    `INSERT OR IGNORE INTO issue_labels (issue_id, label_id, assigned_at)
     VALUES (@issueId, @labelId, @assignedAt)`
  ).run({ issueId, labelId, assignedAt: nowIso() });
};
```

**Acceptance**:
- issue存在チェックが動作
- label存在チェックが動作
- 削除済みissueにエラー
- 冪等性が保証される（重複挿入時にエラーにならない）
- `packages/db/src/index.ts`でexportされている

**Dependencies**: T002

---

### T009: CLI `label set`コマンドの実装 [Story: US3]

**Goal**: `mgtd label set <issue-id> <label-id>`コマンドを実装

**File**: `packages/cli/src/commands/label/set.ts`

**Implementation**:
- Args: `issueId`（integer, required）, `labelId`（integer, required）
- Flags: `--json`（boolean, optional）
- Logic: LabelService.assignToIssue()を呼び出し
- Output (default): `Label assigned to issue #<id>`
- Output (--json): `{issue_id, label_id, assigned_at}`
- Error handling: issue/label不存在時にエラーメッセージ

**LabelService Method** (add to `packages/core/src/index.ts`):
```typescript
public assignToIssue(issueId: number, labelId: number): void {
  return attachLabelToIssue(this.db, issueId, labelId);
}
```

**Acceptance**:
- コマンドが実行できる
- memoにラベル割り当て可能
- taskにラベル割り当て可能
- 存在しないissue-idでエラー「Issue #999 not found」
- 削除済みissueでエラー「Issue not found or deleted」
- `--json`フラグでJSON出力

**Dependencies**: T008

**Checkpoint**: ✓ User Story 3完了 - ラベル割り当てが動作

---

## Phase 6: User Story 4 - ラベル削除 (Priority P3) [Story: US4]

**Story Goal**: ユーザーが不要なラベルを削除できる（関連issueから自動解除）

**Independent Test**: `mgtd label delete <name>`実行でラベルが削除され、`mgtd label list`で表示されなくなる

### T010: labelRepository.deleteLabel()の実装 [Story: US4]

**Goal**: ラベル削除関数を実装（CASCADE削除）

**File**: `packages/db/src/labelRepository.ts`

**Implementation**:
```typescript
export const deleteLabel = (
  db: Database.Database,
  name: string
): void => {
  const label = getLabelByName(db, name);
  if (!label) {
    throw new Error(`Label '${name}' not found`);
  }

  // Delete label (CASCADE removes issue_labels automatically)
  db.prepare('DELETE FROM labels WHERE name = @name').run({ name });
};
```

**Acceptance**:
- ラベルが削除される
- issue_labelsが自動削除される（CASCADE）
- 存在しないラベルでエラー
- `packages/db/src/index.ts`でexportされている

**Dependencies**: T002

---

### T011: CLI `label delete`コマンドの実装 [Story: US4]

**Goal**: `mgtd label delete <name>`コマンドを実装

**File**: `packages/cli/src/commands/label/delete.ts`

**Implementation**:
- Args: `name`（string, required）
- Flags: `--json`（boolean, optional）
- Logic: LabelService.delete()を呼び出し
- Output (default): `Label '<name>' deleted`
- Output (--json): `{name, deleted: true}`
- Error handling: 存在しない場合にエラーメッセージ

**LabelService Method** (add to `packages/core/src/index.ts`):
```typescript
public delete(name: string): void {
  return deleteLabel(this.db, name);
}
```

**Acceptance**:
- コマンドが実行できる
- ラベルが削除される
- 関連issue_labelsが削除される
- 存在しないラベルでエラー「Label 'xxx' not found」
- `--json`フラグでJSON出力

**Dependencies**: T010

**Checkpoint**: ✓ User Story 4完了 - ラベル削除が動作

---

## Phase 7: 旧コマンド削除

### T012: memo labelコマンドの削除

**Goal**: `memo label`関連コマンドを全て削除

**Files to DELETE**:
- `packages/cli/src/commands/memo/label/index.ts`
- `packages/cli/src/commands/memo/label/add.ts`
- `packages/cli/src/commands/memo/label/set.ts`
- `packages/cli/src/commands/memo/label/remove.ts`

**Directory to DELETE**: `packages/cli/src/commands/memo/label/`

**Acceptance**:
- ディレクトリが存在しない
- `mgtd memo label`実行時にcommand not found

**Dependencies**: T005, T007, T009, T011 (全新コマンド実装完了後)

---

### T013: task labelコマンドの削除

**Goal**: `task label`関連コマンドを全て削除

**Files to DELETE**:
- `packages/cli/src/commands/task/label/index.ts`
- `packages/cli/src/commands/task/label/add.ts`
- `packages/cli/src/commands/task/label/set.ts`
- `packages/cli/src/commands/task/label/remove.ts`

**Directory to DELETE**: `packages/cli/src/commands/task/label/`

**Acceptance**:
- ディレクトリが存在しない
- `mgtd task label`実行時にcommand not found

**Dependencies**: T005, T007, T009, T011 (全新コマンド実装完了後)

**Checkpoint**: ✓ 旧コマンド削除完了

---

## Phase 8: Polish & Integration

### T014: CLI index.tsのMULTIWORD_COMMANDS更新 [P]

**Goal**: 新しいlabelコマンドを登録し、旧コマンドを削除

**File**: `packages/cli/src/index.ts`

**Implementation**:
- ADD: `['label', 'add']`, `['label', 'set']`, `['label', 'delete']`, `['label']`
- REMOVE: `['memo', 'label', ...]`, `['task', 'label', ...]` (全ての旧label関連エントリ)

**Acceptance**:
- 新labelコマンドが登録されている
- 旧memo/task labelコマンドエントリが削除されている

**Dependencies**: T012, T013

---

### T015: エラーメッセージの統一 [P]

**Goal**: 全labelコマンドのエラーメッセージを仕様に合わせて統一

**Files**:
- `packages/db/src/labelRepository.ts`
- `packages/cli/src/commands/label/*.ts`

**Verification**:
- 重複ラベル: `Label 'xxx' already exists`
- ラベル不存在: `Label 'xxx' not found`
- Issue不存在: `Issue #999 not found`
- Issue削除済み: `Issue not found or deleted`

**Acceptance**: 仕様書のエラーメッセージと完全一致

**Dependencies**: T007, T009, T011

---

### T016: JSON出力形式の検証 [P]

**Goal**: 全`--json`フラグの出力が仕様通りか検証

**Files**: `packages/cli/src/commands/label/*.ts`

**Verification**:
- `label list --json`: `[{id, name, description, created_at}, ...]`
- `label add --json`: `{id, name, description, created_at}`
- `label set --json`: `{issue_id, label_id, assigned_at}`
- `label delete --json`: `{name, deleted: true}`

**Acceptance**: 全コマンドの`--json`出力が仕様と一致

**Dependencies**: T005, T007, T009, T011

---

### T017: 統合動作確認

**Goal**: 全ユーザーストーリーの受入条件を手動で確認

**Verification Steps**:
1. US1: `mgtd label list` / `mgtd label list --json`
2. US2: `mgtd label add test` / 重複エラー確認
3. US3: `mgtd label set 1 1` / memo/task両方で確認
4. US4: `mgtd label delete test` / CASCADE削除確認
5. 旧コマンド: `mgtd memo label` / `mgtd task label` → command not found

**Acceptance**: 全受入条件が満たされている

**Dependencies**: T014, T015, T016

**Final Checkpoint**: ✓ 統合ラベル管理システム完成

---

## Dependencies

```
Setup & Foundational (Must Complete First):
T001 → T002 → T003

User Stories (Can be implemented in parallel after foundational):
├─ US1 (P1): T004 → T005
├─ US2 (P1): T006 → T007
├─ US3 (P1): T008 → T009
└─ US4 (P3): T010 → T011

Cleanup (After all US complete):
T012, T013

Polish (Parallel after cleanup):
T014, T015 [P], T016 [P] → T017
```

## Parallel Execution Opportunities

**Within Foundational Phase**:
- T001 can start immediately
- T002 depends on T001
- T003 depends on T002

**Within User Stories** (after T003):
- T004 (US1), T006 (US2), T008 (US3), T010 (US4) can run in parallel
- T005, T007, T009, T011 follow their respective repository tasks

**Within Polish Phase**:
- T015, T016 can run in parallel after T014

## Implementation Strategy

**MVP (Minimum Viable Product)**:
- T001 → T002 → T003 → T004 → T005
- Delivers: ラベル一覧表示機能のみ

**Incremental Delivery**:
1. MVP: User Story 1 (T001-T005)
2. Iteration 2: User Story 2 (T006-T007)
3. Iteration 3: User Story 3 (T008-T009)
4. Iteration 4: User Story 4 (T010-T011)
5. Final: Cleanup & Polish (T012-T017)

Each iteration delivers independently testable functionality.
