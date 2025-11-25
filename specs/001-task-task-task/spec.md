# Feature Specification: タスクからタスクを作成する機能

**Feature Branch**: `001-task-task-task`
**Created**: 2025-11-25
**Status**: Draft
**Input**: Task #55: TaskからTaskつくる機能が欲しい

## Clarifications

### Session 2025-11-25

- Q: モーダル起動時の元タスクとのリンク設定のデフォルト動作は？ → A: 元タスクへのリンク設定済み状態でモーダルを開く（ユーザーは削除可能）
- Q: デフォルトで設定されるリンクのタイプは？ → A: `relates`（関連）- 汎用的で階層構造を暗示しない
- Q: Links機能をどのように統合するか？ → A: TaskFormにLinks設定UIを追加する（大規模な変更だが、フォームとして完結）
- Q: task/newページでのLinks UI表示は？ → A: task/newでもLinks UIを表示（空の状態で、ユーザーが任意に追加可能）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - タスク詳細画面から新規タスクを作成 (Priority: P1)

ユーザーがタスク詳細画面（/tasks/:id）を見ているとき、関連する新しいタスクを思いついた場合、その場で新規タスクを作成できる。ブックマークアイコンの右隣にある「新規タスク」ボタンをクリックすると、TaskDetail画面の右半分にオーバーラップする形でタスク作成モーダルが表示される。

**Why this priority**: これが機能の核心であり、ユーザーが「いちいちtasksに行かないといけない」という問題を直接解決する。この機能だけで最小限の価値を提供できる。

**Independent Test**: タスク詳細画面から「新規タスク」ボタンをクリックし、モーダルでタスクを作成できることを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーがタスク詳細画面（/tasks/:id）を表示している, **When** ブックマークアイコン右隣の「新規タスク」ボタンをクリックする, **Then** TaskDetail画面の右半分にオーバーラップする形でタスク作成モーダルが表示される
2. **Given** タスク作成モーダルが表示されている, **When** 必要な情報を入力して作成する, **Then** 新しいタスクが作成され、モーダルが閉じて元のTaskDetail画面に戻る
3. **Given** タスク作成モーダルが表示されている, **When** モーダル外をクリックまたはキャンセルする, **Then** モーダルが閉じて元のTaskDetail画面に戻る（入力内容は破棄）

---

### User Story 2 - 関係性（Links）の設定 (Priority: P1)

タスク作成時に、元タスクとの関係性をLinks機能で設定できる。これにより関連タスク同士を紐付けて管理できる。

**Why this priority**: ユーザーの「だいたいの場合、関連するタスクとして紐付けたい」という要件の核心部分。

**Independent Test**: 新規タスク作成時にLinksを設定し、作成後に関係性が正しく保存されていることを確認する。

**Acceptance Scenarios**:

1. **Given** タスク作成モーダルが表示されている, **When** Links設定セクションを確認する, **Then** 元タスクへのリンクがデフォルトで設定済み状態で表示されている
2. **Given** タスク作成モーダルでデフォルトのリンクを維持した状態, **When** タスクを作成する, **Then** 新しいタスクと元タスクの間にリンク関係が作成される
3. **Given** タスク作成モーダルが表示されている, **When** デフォルトのリンクを削除して作成する, **Then** 関係性なしで独立したタスクが作成される

---

### User Story 3 - 既存のタスク作成フォームとの統一 (Priority: P2)

モーダルで表示されるタスク作成フォームは、task/newで表示されるコンポーネントと同じものをモーダル化して使用する。UIの一貫性を保ち、ユーザーの学習コストを下げる。

**Why this priority**: UIの一貫性。P1で基本機能が動作した後に確認する。

**Independent Test**: モーダルとtask/newページで同じフォームコンポーネントが使用されていることを確認する。

**Acceptance Scenarios**:

1. **Given** TaskDetailからタスク作成モーダルを開いた, **When** フォームを確認する, **Then** task/newページと同じ入力項目・レイアウトである（Links UIを含む）
2. **Given** task/newページを開いた, **When** フォームを確認する, **Then** モーダル内のフォームと同じUIである（Links UIは空の状態）
3. **Given** task/newページを開いた, **When** Links UIを確認する, **Then** 空の状態で表示され、ユーザーは任意のタスクへのリンクを追加できる

---

### User Story 4 - ProjectおよびCalendarからのTaskDetailモーダルでは非表示 (Priority: P2)

ProjectやCalendar画面からTaskDetailをモーダルで開いた場合、「新規タスク」ボタンは表示されない。これは二重モーダルのオーバーラップを防ぐため。

**Why this priority**: UXの品質維持。二重モーダルは操作性を著しく損なう。

**Independent Test**: Project/CalendarからTaskDetailモーダルを開き、新規タスクボタンが表示されないことを確認する。

**Acceptance Scenarios**:

1. **Given** Project画面からTaskDetailモーダルを開いている, **When** ヘッダー部分を確認する, **Then** 「新規タスク」ボタンは表示されない
2. **Given** Calendar画面からTaskDetailモーダルを開いている, **When** ヘッダー部分を確認する, **Then** 「新規タスク」ボタンは表示されない
3. **Given** /tasks/:idページでTaskDetailを直接表示している, **When** ヘッダー部分を確認する, **Then** 「新規タスク」ボタンが表示される

---

### Edge Cases

- タスク作成中に元タスクが削除された場合：作成は成功するが、リンク関係は設定されない（孤立タスクとして作成）
- モーダル表示中にブラウザバック：モーダルが閉じて元の画面に戻る
- 入力中にモーダル外クリック：確認なしでモーダルを閉じる（入力内容は破棄）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは、タスク詳細ページ（/tasks/:id）のブックマークアイコン右隣に「新規タスク」ボタンを表示しなければならない
- **FR-002**: システムは、「新規タスク」ボタンクリック時にTaskDetail画面の右半分にオーバーラップする形でタスク作成モーダルを表示しなければならない
- **FR-003**: モーダルは、task/newで使用されているTaskFormコンポーネントを再利用しなければならない
- **FR-004**: TaskFormコンポーネントにLinks設定UIを追加しなければならない
- **FR-005**: システムは、モーダル起動時に元タスクへの`relates`タイプのリンクをデフォルトで設定済み状態にしなければならない（ユーザーは削除可能）
- **FR-006**: システムは、リンクを設定した状態でタスクを作成した場合、新しいタスクと元タスクの間にリンク関係を作成しなければならない
- **FR-007**: システムは、Project画面からのTaskDetailモーダルでは「新規タスク」ボタンを非表示にしなければならない
- **FR-008**: システムは、Calendar画面からのTaskDetailモーダルでは「新規タスク」ボタンを非表示にしなければならない
- **FR-009**: システムは、タスク作成後にモーダルを閉じて元のTaskDetail画面を表示しなければならない

### Key Entities

- **Task（タスク）**: 作成対象および元タスクの両方を表すエンティティ。
- **Task Link（タスクリンク）**: タスク間の関連を表すエンティティ。双方向の関係性を持つ。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ユーザーはタスク詳細画面から2クリック以内で新規タスク作成モーダルを開ける
- **SC-002**: 作成された関連タスクの80%以上が、元タスクとのリンク関係を持つ
- **SC-003**: タスク作成にかかる時間が、タスク一覧画面に移動して作成する場合と比較して50%以上短縮される
- **SC-004**: ユーザーの90%が初回使用時に追加説明なしで機能を利用できる

## Assumptions

- task/newで使用されているTaskFormコンポーネントはモーダル化可能な形で実装されている
- タスク間のLinks機能（API・データモデル）は既に存在する（LinksService, LinkSection等）
- Project/CalendarのTaskDetailモーダルは`mode`プロパティでコンテキストを判別可能
- ItemDetailの`mode`プロパティ（'page' | 'panel'）で直接ページかモーダルかを判別
- Web UIでの実装を想定（CLIは対象外）
- TaskFormへのLinks UI追加は、既存のAddLinkInlineコンポーネントを参考に実装
