# Feature Specification: Project List View Status Filter

**Feature Branch**: `001-task-112-project`
**Created**: 2025-11-29
**Status**: Draft
**Input**: Task #112: Project List View にステータスフィルタを追加 - Project の List ビュー（/projects/:id/list）に Kanban と同様のステータスフィルタ機能を追加し、Done/Canceled のタスクをリスト末尾に表示する

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter Items by Status (Priority: P1)

プロジェクトのListビューで、ユーザーはステータスでアイテムをフィルタリングできる。Kanbanビューと同様に、タスクはステータス（Inbox, Open, Next, Waiting, Scheduled, Someday, Done, Canceled）でフィルタリングでき、メモは「Documents」として扱われる。

**Why this priority**: フィルタ機能はこの機能の中核であり、モバイルでListビューを使用するユーザーがアクティブなタスクを素早く見つけるために必須。

**Independent Test**: FilterBarが表示され、各ステータスボタンをクリックすると該当するアイテムのみが表示されることで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** プロジェクトのListビューを開いている, **When** 「Next」フィルタをクリック, **Then** Nextステータスのタスクのみが表示される
2. **Given** プロジェクトのListビューを開いている, **When** 「Documents」フィルタをクリック, **Then** メモのみが表示される
3. **Given** プロジェクトのListビューを開いている, **When** 「All」フィルタをクリック, **Then** すべてのタスクとメモが表示される

---

### User Story 2 - Sort Items with Done/Canceled at End (Priority: P1)

「All」フィルタ選択時、アイテムはステータス順にソートされ、Done/Canceledのタスクはリストの末尾に表示される。メモ（Documents）はさらにその後に表示される。

**Why this priority**: ユーザーがアクティブなタスクに集中できるよう、完了・キャンセル済みタスクを視覚的に分離することはフィルタ機能と同等に重要。

**Independent Test**: 「All」を選択した状態で、リストの順序を確認することで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** 複数のステータスを持つタスクとメモがあるプロジェクト, **When** 「All」フィルタを選択, **Then** Next → Waiting → Scheduled → Inbox → Open → Someday → Done → Canceled → Documents の順で表示される
2. **Given** DoneとNextのタスクが混在するプロジェクト, **When** 「All」フィルタを選択, **Then** Nextタスクが先に、Doneタスクが後に表示される

---

### User Story 3 - Display Status Badge on Task Items (Priority: P2)

リスト内の各タスクにステータスバッジが表示され、ユーザーはスクロールしながら各タスクのステータスを一目で確認できる。

**Why this priority**: ステータスの視覚的表示はフィルタ機能の補完であり、ユーザビリティを向上させるが、フィルタとソート機能なしでも機能する。

**Independent Test**: リストを表示し、各タスクアイテムにステータスバッジが表示されることで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** Nextステータスのタスクがリストにある, **When** リストを表示, **Then** そのタスクに「Next」バッジが表示される
2. **Given** Doneステータスのタスクがリストにある, **When** リストを表示, **Then** そのタスクに「Done」バッジがグレー色で表示される
3. **Given** メモがリストにある, **When** リストを表示, **Then** メモにはステータスバッジが表示されない

---

### User Story 4 - Bookmark Filter (Priority: P3)

ユーザーはブックマーク済みアイテムのみを表示するフィルタを使用できる。

**Why this priority**: ブックマークフィルタは既存のTasksListと同様の機能であり、一貫性のために追加するが、コア機能ではない。

**Independent Test**: ブックマークボタンをクリックし、ブックマーク済みアイテムのみが表示されることで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** ブックマーク済みとそうでないタスクがある, **When** ブックマークフィルタを有効化, **Then** ブックマーク済みのアイテムのみ表示される
2. **Given** ブックマークフィルタが有効, **When** ブックマークフィルタを無効化, **Then** すべてのアイテムが再び表示される

---

### User Story 5 - Persist Filter State in URL (Priority: P3)

フィルタ状態はURLパラメータに保存され、ブラウザの戻る/進むボタンでフィルタ状態が維持される。

**Why this priority**: URL永続化は良いUXだが、フィルタ機能自体が動作した後の改善。

**Independent Test**: フィルタを選択後、URLを確認し、ブラウザの戻る/進むボタンでフィルタ状態が復元されることで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** 「Next」フィルタを選択, **When** URLを確認, **Then** URLに`?status=next`が含まれる
2. **Given** フィルタを変更した履歴がある, **When** ブラウザの戻るボタンをクリック, **Then** 前のフィルタ状態が復元される

---

### Edge Cases

- フィルタ選択時にアイテムがない場合、適切な空状態メッセージが表示される
- 複数フィルタ（ステータス + ブックマーク）を組み合わせた場合、両方の条件を満たすアイテムのみ表示される
- プロジェクトにタスクのみでメモがない場合、「Documents」フィルタは空リストを表示する
- プロジェクトにメモのみでタスクがない場合、タスクステータスフィルタは空リストを表示する

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムはListビューにFilterBarを表示し、以下のフィルタオプションを提供しなければならない: All, Documents, Inbox, Open, Next, Waiting, Scheduled, Someday, Done, Canceled
- **FR-002**: システムはKanbanビューと同じカラム構成に対応するフィルタを提供しなければならない（メモは「Documents」として扱う）
- **FR-003**: システムは「All」選択時にアイテムをステータス順でソートし、Done/Canceledを末尾、メモ（Documents）をさらに末尾に表示しなければならない
- **FR-004**: システムは各タスクにステータスバッジを表示しなければならない
- **FR-005**: システムはブックマークフィルタを提供しなければならない
- **FR-006**: システムはフィルタ状態をURLパラメータで永続化しなければならない
- **FR-007**: システムはフィルタ結果が空の場合、適切な空状態メッセージを表示しなければならない

### Key Entities

- **Task**: ステータス（inbox, open, next, waiting, scheduled, someday, done, canceled）、ブックマーク状態、ラベル、スケジュール日を持つアイテム
- **Memo**: ステータスを持たないドキュメントタイプのアイテム。Kanbanでは「Documents」カラムに配置される
- **Filter State**: 現在のステータスフィルタとブックマークフィルタの状態。URLパラメータとして永続化される

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ユーザーはListビューで1クリックでステータスフィルタを切り替えられる
- **SC-002**: 「All」フィルタ選択時、Done/Canceledタスクはアクティブタスクより後に表示される
- **SC-003**: フィルタ状態はブラウザの戻る/進むボタンで正しく復元される
- **SC-004**: すべてのステータスバッジは各ステータスを識別できる視覚的な区別（色分け）を持つ
- **SC-005**: モバイルユーザーはListビューでアクティブなタスクを3タップ以内で見つけられる

## Assumptions

- 既存のFilterBarコンポーネントを再利用し、`statusOptions`と`statusLabels`をカスタマイズする
- ソート順序は Next → Waiting → Scheduled → Inbox → Open → Someday → Done → Canceled → Documents
- ステータスバッジの色分けは既存のUIパターンに従う（例: Next=緑系、Done=グレー系、Canceled=赤系）
- フィルタのURLパラメータは`status`（ステータス）と`bookmarked`（ブックマーク）を使用する
