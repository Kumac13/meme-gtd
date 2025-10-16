# Implementation Tasks: Allow Optional Task Body

**Feature**: タスク作成時にbodyを省略可能にする
**Branch**: `007-https-github-com`
**Date**: 2025-10-16
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Overview

この機能は3つの独立したユーザーストーリーで構成されます:
- **US1 (P1)**: タイトルのみでタスク作成 - 最小限のMVP
- **US2 (P2)**: エディタワークフローの後方互換性確認 - 既存機能の検証
- **US3 (P3)**: 空bodyタスクの表示最適化 - UX向上

TDD (テストファースト) アプローチで実装します。

---

## Phase 1: Setup

### T001 [Setup] 既存テストの実行確認

**Goal**: 変更前のベースラインを確立

**Actions**:
```bash
pnpm --filter meme-gtd-cli test
```

**Success Criteria**:
- すべての既存テストがパス
- テスト実行時間を記録（回帰検出用）

**Files**: N/A

---

### T002 [Setup] DBスキーマの確認

**Goal**: `body_md` カラムが空文字列を許容することを確認

**Actions**:
1. `packages/db/src/schema.sql` を確認
2. `body_md TEXT NOT NULL DEFAULT ''` の定義を確認

**Success Criteria**:
- DBスキーマが既に空文字列を許容している

**Files**:
- `packages/db/src/schema.sql` (読み取りのみ)

**Notes**: 変更不要、確認のみ

---

## Phase 2: Foundational Tasks

この機能には foundational tasks はありません。既存インフラで実装可能。

---

## Phase 3: User Story 1 - Quick Task Capture (P1) ⭐ MVP

**Story Goal**: タイトルのみでタスクを作成できる

**Independent Test**: `mgtd task create --title "test" --body "" --no-editor` が成功する

### T003 [US1][P] テスト作成: 空bodyでタスク作成 (--body "")

**Goal**: 空文字列を明示的に指定した場合のテストを作成

**Actions**:
1. `packages/cli/test/commands/task/create-empty-body.test.js` を新規作成
2. テストケース1: `--body ""` でタスク作成が成功
3. テストケース2: JSON出力で `bodyMd: ""` が含まれる
4. テストを実行 → **RED** (失敗することを確認)

**Success Criteria**:
- テストファイル作成完了
- テスト実行でエラー "Task body cannot be empty" が出力される

**Files**:
- `packages/cli/test/commands/task/create-empty-body.test.js` (新規作成)

**Code Template**:
```javascript
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const cliDist = path.resolve(process.cwd(), 'dist', 'index.js');

const runCli = (argv, options = {}) => {
  const result = spawnSync(process.execPath, [cliDist, ...argv], {
    encoding: 'utf8',
    env: options.env ?? process.env
  });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    status: result.status
  };
};

test('mgtd task create with --body "" succeeds', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-empty-body-'));
  const configPath = path.join(tmp, 'context.json');
  const dbPath = path.join(tmp, 'issues.db');
  const env = {
    ...process.env,
    MGTD_CONFIG_PATH: configPath
  };

  // Init
  const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
  assert.equal(init.status, 0, init.stderr);

  // Create task with empty body
  const create = runCli(['task', 'create', '-t', 'Empty body test', '-b', '', '--no-editor', '-j'], { env });
  assert.equal(create.status, 0, create.stderr);
  const created = JSON.parse(create.stdout);
  assert.equal(created.task.bodyMd, '');
});

// 他のテストケースも追加...
```

**Dependencies**: T001, T002 完了後

---

### T004 [US1][P] テスト作成: 空bodyでタスク作成 (body省略)

**Goal**: bodyオプション省略 + `--no-editor` でのテストを作成

**Actions**:
1. T003のファイルに追加テストケースを作成
2. `--body` オプション省略、`--no-editor` のみ指定
3. テストを実行 → **RED** (現在は `maybePromptEditor` が空文字列を返す動作を確認)

**Success Criteria**:
- テストケース追加完了
- 動作確認完了

**Files**:
- `packages/cli/test/commands/task/create-empty-body.test.js` (追記)

**Dependencies**: T003 完了後

---

### T005 [US1] 実装: bodyバリデーション削除

**Goal**: create.ts の空bodyエラーを削除

**Actions**:
1. `packages/cli/src/commands/task/create.ts:117-119` を削除
   ```typescript
   // 削除する箇所:
   if (!body.trim()) {
     this.error('Task body cannot be empty.');
   }
   ```
2. ビルド: `pnpm --filter meme-gtd-cli build`
3. テスト実行: `pnpm --filter meme-gtd-cli test`

**Success Criteria**:
- ビルド成功
- T003, T004 のテストがパス → **GREEN**
- 既存テストもすべてパス (T001 のベースラインと比較)

**Files**:
- `packages/cli/src/commands/task/create.ts` (修正)

**Dependencies**: T003, T004 完了後

---

### T006 [US1] マニュアルテスト: 実際にタスク作成

**Goal**: 実際のCLIで動作確認

**Actions**:
```bash
# テスト環境のDB準備
export MGTD_CONFIG_PATH=/tmp/test-context.json
mgtd init -d /tmp/test.db -f

# 空bodyでタスク作成
mgtd task create --title "手動テスト" --body "" --no-editor
# → "Created task #1" が表示されることを確認

# JSON確認
mgtd task create --title "JSON確認" --body "" --no-editor --json
# → bodyMd: "" が含まれることを確認
```

**Success Criteria**:
- タスク作成成功
- エラーが出ない
- JSON出力が正しい

**Files**: N/A

**Dependencies**: T005 完了後

---

**✅ Checkpoint: US1 (P1) Complete**

この時点で MVP が完成。以下を満たす:
- タイトルのみでタスク作成可能
- 既存テスト100%パス
- E2Eテストで動作保証

---

## Phase 4: User Story 2 - Backward Compatibility (P2)

**Story Goal**: 既存のエディタワークフローが継続動作する

**Independent Test**: `--editor` フラグでエディタが起動し、空のまま保存してもタスクが作成される

### T007 [US2][P] テスト作成: エディタモード

**Goal**: `--editor` フラグの動作検証テストを作成

**Actions**:
1. T003のファイルに追加テストケースを作成
2. エディタモードのモック（環境変数 `EDITOR` を `true` などに設定してスキップ）
3. 既存のエディタ動作テストが引き続きパスすることを確認

**Success Criteria**:
- エディタモードの既存テストがパス
- 空body保存時もエラーが出ない

**Files**:
- `packages/cli/test/commands/task/create-empty-body.test.js` (追記、またはスキップマーク)

**Notes**: エディタモックが複雑な場合はマニュアルテスト (T008) のみで対応可

**Dependencies**: T005 完了後 (並行可能)

---

### T008 [US2] マニュアルテスト: エディタワークフロー

**Goal**: エディタモードで空bodyを保存してタスク作成

**Actions**:
```bash
# エディタ起動モード
mgtd task create --title "エディタテスト" --editor
# → エディタが起動
# → 何も入力せずに保存・終了
# → "Created task #X" が表示されることを確認

# 従来のbody入力ワークフロー
mgtd task create --title "従来ワークフロー" --editor
# → エディタが起動
# → "本文を入力" と入力して保存
# → "Created task #Y" が表示されることを確認

mgtd task view Y
# → "本文を入力" が表示されることを確認
```

**Success Criteria**:
- 両方のワークフローが動作
- エラーが出ない

**Files**: N/A

**Dependencies**: T005 完了後

---

**✅ Checkpoint: US2 (P2) Complete**

既存ユーザーのワークフローに影響なし。

---

## Phase 5: User Story 3 - Display Optimization (P3)

**Story Goal**: 空bodyタスクの表示時に "(no body)" プレースホルダーを表示

**Independent Test**: `mgtd task view <empty-body-task-id>` で "(no body)" が表示される

### T009 [US3][P] テスト作成: 空bodyタスクの表示

**Goal**: view コマンドのプレースホルダー表示テストを作成

**Actions**:
1. T003のファイルに追加テストケースを作成
2. 空bodyタスクを作成し、`task view` で "(no body)" が表示されることを検証
3. JSON モードでは `bodyMd: ""` がそのまま出力されることを検証
4. テストを実行 → **RED** (現在は空行のみ)

**Success Criteria**:
- テストケース追加完了
- テスト失敗（空行のみ表示される）

**Files**:
- `packages/cli/test/commands/task/create-empty-body.test.js` (追記)

**Code Template**:
```javascript
test('mgtd task view displays (no body) for empty body', () => {
  // ... 前のテストでタスク作成済み

  // View task
  const view = runCli(['task', 'view', '1'], { env });
  assert.equal(view.status, 0, view.stderr);
  assert.match(view.stdout, /\(no body\)/);
});

test('mgtd task view --json preserves empty bodyMd', () => {
  const viewJson = runCli(['task', 'view', '1', '--json'], { env });
  assert.equal(viewJson.status, 0, viewJson.stderr);
  const payload = JSON.parse(viewJson.stdout);
  assert.equal(payload.task.bodyMd, '');
});
```

**Dependencies**: T005 完了後 (並行可能)

---

### T010 [US3] 実装: プレースホルダー表示

**Goal**: view.ts に空body時のプレースホルダーを追加

**Actions**:
1. `packages/cli/src/commands/task/view.ts:58` を修正
   ```typescript
   // Before:
   this.log(task.bodyMd);

   // After:
   this.log(task.bodyMd || '(no body)');
   ```
2. ビルド: `pnpm --filter meme-gtd-cli build`
3. テスト実行: `pnpm --filter meme-gtd-cli test`

**Success Criteria**:
- ビルド成功
- T009 のテストがパス → **GREEN**
- JSON出力は変更なし（既存テストがパス）

**Files**:
- `packages/cli/src/commands/task/view.ts` (修正)

**Dependencies**: T009 完了後

---

### T011 [US3] マニュアルテスト: 表示確認

**Goal**: 実際のCLIで表示確認

**Actions**:
```bash
# 空bodyタスクを表示
mgtd task view 1
# → "(no body)" が表示されることを確認

# JSON モード
mgtd task view 1 --json
# → "bodyMd": "" が含まれることを確認

# 通常のbodyタスクも確認（回帰テスト）
mgtd task create --title "通常タスク" --body "内容あり" --no-editor
mgtd task view <id>
# → "内容あり" が表示されることを確認（プレースホルダーなし）
```

**Success Criteria**:
- 空bodyタスクに "(no body)" 表示
- 通常タスクは従来通り表示
- JSON出力は正しい

**Files**: N/A

**Dependencies**: T010 完了後

---

**✅ Checkpoint: US3 (P3) Complete**

全ユーザーストーリー完了。

---

## Phase 6: Documentation & Versioning

### T012 [Polish] ドキュメント更新

**Goal**: CLIリファレンスに空body許容を追記

**Actions**:
1. `docs/cli_requirement.md` を更新
   - `task create` セクションに空body許容を追記
   - 例を追加: `mgtd task create --title "タスク" --no-editor`
2. `task view` セクションに "(no body)" 表示を追記

**Success Criteria**:
- ドキュメント更新完了
- レビュー可能な状態

**Files**:
- `docs/cli_requirement.md` (更新)

**Dependencies**: T010 完了後

---

### T013 [Polish] 最終テスト実行

**Goal**: すべてのテストが引き続きパス

**Actions**:
```bash
# 全パッケージのテスト
pnpm test

# ビルド
pnpm build
```

**Success Criteria**:
- すべてのテストがパス
- ビルド成功
- T001 のベースラインと比較して新規テストのみ追加

**Files**: N/A

**Dependencies**: T012 完了後

---

### T014 [Polish] バージョンバンプ

**Goal**: バージョンを 0.3.0 → 0.4.0 に更新

**Actions**:
```bash
# ルートでバージョン更新（タグは作らない）
npm version minor --no-git-tag-version

# 全パッケージのバージョンを同期
pnpm -r exec npm version $(node -p "require('./package.json').version") --no-git-tag-version

# 変更をステージング
git add .

# バージョンバンプのコミット（実装コミットとは別）
git commit -m "chore: bump version to v0.4.0"

# gitタグを作成
git tag v0.4.0
```

**Success Criteria**:
- バージョン更新完了
- package.json (ルート + 全パッケージ) が 0.4.0
- gitタグ作成完了

**Files**:
- `package.json` (ルート)
- `packages/*/package.json` (全パッケージ)

**Dependencies**: T013 完了後

---

## Summary

### Task Count

- **Phase 1 (Setup)**: 2 tasks
- **Phase 2 (Foundational)**: 0 tasks
- **Phase 3 (US1 - MVP)**: 4 tasks
- **Phase 4 (US2)**: 2 tasks
- **Phase 5 (US3)**: 3 tasks
- **Phase 6 (Polish)**: 3 tasks

**Total**: 14 tasks

### Per User Story

- **US1 (P1)**: T003, T004, T005, T006 = 4 tasks ⭐ MVP
- **US2 (P2)**: T007, T008 = 2 tasks
- **US3 (P3)**: T009, T010, T011 = 3 tasks

### Parallel Opportunities

**Within US1**:
- T003 と T004 は並行実行可能 [P] (異なるテストケース)

**Across Stories**:
- US2 (T007, T008) は US1 完了後すぐ開始可能
- US3 (T009) は US1 完了後すぐ開始可能（T007-T008と並行可）

### Independent Test Criteria

各ユーザーストーリーは独立してテスト可能:

**US1**:
```bash
mgtd task create --title "test" --body "" --no-editor
# → Success
```

**US2**:
```bash
mgtd task create --title "test" --editor
# (エディタで空のまま保存)
# → Success
```

**US3**:
```bash
mgtd task view <empty-body-task-id>
# → "(no body)" が表示される
```

---

## Dependency Graph

```
Phase 1: Setup
  T001 (既存テスト確認) ──┐
  T002 (DBスキーマ確認)──┘
                          ↓
Phase 3: US1 (MVP) ⭐
  T003 (テスト: --body "") ──┐
  T004 (テスト: body省略)   ──┤ [P] 並行可能
                              ↓
  T005 (実装: バリデーション削除)
                              ↓
  T006 (マニュアルテスト)
                              ↓
                    ┌─────────┴──────────┐
                    ↓                    ↓
Phase 4: US2        |        Phase 5: US3 [P] 並行可能
  T007 (テスト: エディタ)     T009 (テスト: 表示)
                    ↓                    ↓
  T008 (マニュアル: エディタ) T010 (実装: プレースホルダー)
                    ↓                    ↓
                    └──────────┬─────────┘
                               ↓
                        T011 (マニュアル: 表示)
                               ↓
Phase 6: Polish
  T012 (ドキュメント)
                               ↓
  T013 (最終テスト)
                               ↓
  T014 (バージョンバンプ)
```

---

## Parallel Execution Examples

### Example 1: US1 のみ実装 (MVP)

```bash
# Phase 1
T001, T002 → 順次実行

# Phase 3 (US1)
T003, T004 → 並行実行 [P]
T005 → 単独実行
T006 → 単独実行
```

**MVP完成**: 最小限の機能でリリース可能

### Example 2: Full Implementation

```bash
# Phase 1
T001, T002

# Phase 3 (US1)
T003, T004 [P] → T005 → T006

# Phase 4 & 5 (並行)
US2: T007, T008 [P]
US3: T009 → T010 → T011 [P]

# Phase 6
T012 → T013 → T014
```

---

## Implementation Strategy

### Recommended Approach: MVP First

1. **Week 1**: US1 (P1) - MVP
   - T001-T006
   - リリース v0.4.0-alpha

2. **Week 2**: US2 + US3 (並行)
   - T007-T011
   - リリース v0.4.0-beta

3. **Week 3**: Polish & Release
   - T012-T014
   - リリース v0.4.0

### Alternative: All at Once

- すべてのタスクを順次実行
- 一度に v0.4.0 リリース

---

## Exit Criteria

すべてのタスク完了時に以下を満たす:

✅ すべてのテストがパス (既存 + 新規)
✅ ビルドが成功
✅ 3つのユーザーストーリーがすべて動作
✅ ドキュメント更新完了
✅ バージョン 0.4.0 にバンプ

---

## Notes

- **TDD順守**: すべての実装タスクはテストが先 (Red → Green → Refactor)
- **段階的コミット**: 各フェーズまたはユーザーストーリー完了時にコミット推奨
- **後方互換性**: 既存テストが100%パスすることを各ステップで確認
