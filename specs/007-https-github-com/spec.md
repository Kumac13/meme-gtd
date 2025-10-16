# Feature Specification: Allow Optional Task Body

**Feature Branch**: `007-https-github-com`
**Created**: 2025-10-16
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/22"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Task Capture with Title Only (Priority: P1)

ユーザーがタスクのタイトルだけを思いついた時に、詳細な説明（body）を後で追加する前提で、素早くタスクを作成できる。

**Why this priority**: GTDの「素早く記録する」原則に基づく最も重要な機能。思考の流れを止めずにタスクを記録できることがGTDワークフローの核心である。

**Independent Test**: `mgtd task create --title "羅針盤に回答する" --body "" --no-editor` を実行してタスクが作成され、bodyが空文字列で保存されることを確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーがタイトルのみでタスクを作成しようとする、**When** `mgtd task create --title "タスク名" --body "" --no-editor` を実行、**Then** タスクが正常に作成されbodyは空文字列として保存される
2. **Given** ユーザーがタイトルのみでタスクを作成しようとする、**When** `mgtd task create --title "タスク名" --no-editor` を実行（bodyオプション省略）、**Then** タスクが正常に作成されbodyは空文字列として保存される
3. **Given** ユーザーがJSONモードでタスクを作成する、**When** `mgtd task create --title "タスク名" --body "" --no-editor --json` を実行、**Then** JSON出力に `"bodyMd": ""` が含まれる

---

### User Story 2 - Backward Compatibility with Existing Body-Required Workflow (Priority: P2)

既存のユーザーが、エディタを使ってbodyを入力する従来のワークフローを継続できる。

**Why this priority**: 既存ユーザーの使用体験を壊さないことは重要だが、新機能（P1）の実装によって自動的に達成される。

**Independent Test**: `--editor` フラグも `--no-editor` フラグも指定せず、かつ `--body` も指定しない場合に、エディタが起動してbody入力を促すことを確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーがエディタを使ってタスクを作成したい、**When** `mgtd task create --title "タスク名" --editor` を実行、**Then** エディタが起動しbody入力を促す
2. **Given** ユーザーが空のbodyでエディタを閉じる、**When** エディタで何も入力せず保存して終了、**Then** タスクが作成されbodyは空文字列として保存される

---

### User Story 3 - Display Empty Body Tasks Appropriately (Priority: P3)

空のbodyを持つタスクを一覧表示・詳細表示する際に、ユーザーにとって分かりやすい表示を行う。

**Why this priority**: 基本機能（P1）の後に対応すべき表示最適化。ユーザー体験向上のため重要だが、タスク作成自体には影響しない。

**Independent Test**: 空bodyのタスクを作成後、`mgtd task list` および `mgtd task view <id>` で表示した際に、適切なプレースホルダーまたは空行が表示されることを確認できる。

**Acceptance Scenarios**:

1. **Given** 空bodyのタスクが存在する、**When** `mgtd task view <id>` を実行、**Then** bodyセクションに "(no body)" または適切なメッセージが表示される
2. **Given** 空bodyのタスクが存在する、**When** `mgtd task list --json` を実行、**Then** `"bodyMd": ""` が正しく出力される
3. **Given** 空bodyのタスクが存在する、**When** `mgtd task view <id> --json` を実行、**Then** JSON出力に `"bodyMd": ""` が含まれる

---

### Edge Cases

- `--body ""` と `--no-editor` を同時に指定した場合、エディタは起動せず空のbodyでタスクが作成される
- `--body ""` のみ指定（`--no-editor` なし）した場合、現在の実装では `maybePromptEditor` がエディタを起動する可能性があるが、ユーザーがエディタで空のまま保存すれば空のbodyでタスクが作成される
- 空白文字のみのbody（例: `--body "   "`）は、現在の実装では `body.trim()` でチェックされるため空とみなされるが、この仕様変更後は許容される
- タスク詳細表示（`task view`）で空bodyの場合、line 58で空文字列が出力される（現状では空行のみ）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow task creation with an empty body when `--body ""` is provided
- **FR-002**: System MUST allow task creation with an empty body when `--body` option is omitted and `--no-editor` is specified
- **FR-003**: System MUST remove the validation error "Task body cannot be empty" (line 118 in create.ts)
- **FR-004**: System MUST preserve existing editor behavior when neither `--body` nor `--no-editor` is specified
- **FR-005**: System MUST save empty body as an empty string (`""`) in the database, not NULL
- **FR-006**: System MUST maintain consistency with memo create behavior, which also validates `!body.trim()` at line 102 in memo/create.ts
- **FR-007**: System MUST display a placeholder message when showing task details with empty body (e.g., "(no body)" or similar)
- **FR-008**: System MUST preserve empty string in JSON output without transformation

### Key Entities

- **Task**: タスクを表すエンティティ。`bodyMd` 属性が空文字列を許容する必要がある
  - 現在の実装: `TaskService.create()` が `bodyMd` パラメータを受け取る
  - 変更後: `bodyMd` が空文字列でも正常に処理される

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create tasks with title only in under 5 seconds using `--no-editor` flag
- **SC-002**: 100% of existing test cases continue to pass after the change
- **SC-003**: Users can successfully create tasks with empty body via both `--body ""` and omitting `--body` with `--no-editor`
- **SC-004**: No regression in existing editor-based task creation workflow
- **SC-005**: Users can immediately distinguish empty-body tasks from tasks with content when viewing task details

## Assumptions

1. **Database Schema**: `issues` テーブルの `body_md` カラムは既に `TEXT NOT NULL DEFAULT ''` として定義されており、空文字列を受け入れる
2. **Editor Behavior**: `maybePromptEditor()` の実装は変更不要。空の入力を返すことが既に可能
3. **Memo Consistency**: memo create も同様に空のbody許容に変更する必要がある（FR-006参照）
4. **Display Format**: "(no body)" というプレースホルダーメッセージは英語でもユーザーフレンドリーと判断（日本語化は将来の国際化対応時に検討）

## Out of Scope

- タスク編集時の空body許容（別機能として検討）
- memo create コマンドの同様の変更（別issueで対応推奨）
- `task edit` での空body許容
- プレースホルダーメッセージの多言語対応
