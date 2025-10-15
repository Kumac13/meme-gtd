# Feature Specification: 統合ラベル管理システム

**Feature Branch**: `006-memo-task`
**Created**: 2025-10-15
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/9 について進めたい。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - ラベル一覧の統合表示 (Priority: P1)

ユーザーは、システム内に登録されている全てのラベルを一覧表示できる。現在、`memo label <id>`や`task label <id>`では特定のmemo/taskに付与されたラベルしか見られず、データベース全体のラベル一覧を確認する方法がない。

**Why this priority**: ラベル管理の基本機能。ユーザーが既存ラベルを確認できなければ、重複ラベルの作成や誤ったラベルの使用につながる。

**Independent Test**: `mgtd label list`コマンドを実行し、データベース内の全ラベルが表示されることで単独テスト可能。

**Acceptance Scenarios**:

1. **Given** データベースにラベルが3件（"bug", "feature", "urgent"）存在する、**When** `mgtd label list`を実行する、**Then** 3件全てのラベル名が表示される
2. **Given** データベースにラベルが0件存在する、**When** `mgtd label list`を実行する、**Then** 「No labels found」というメッセージが表示される
3. **Given** データベースにラベルが存在する、**When** `mgtd label list --json`を実行する、**Then** JSON形式でラベルの配列（name, description, created_atを含む）が返される

---

### User Story 2 - 新規ラベルの作成 (Priority: P1)

ユーザーは、memo/taskから独立して新しいラベルをシステムに登録できる。現在、ラベルは`memo label add`や`task label add`を通じて暗黙的に作成されるが、事前にラベルを定義して整理したい。

**Why this priority**: ラベル体系を事前に設計し、統一的なラベル運用を可能にする基本機能。

**Independent Test**: `mgtd label add <name>`を実行し、データベースにラベルが作成され、その後`mgtd label list`で確認できることで単独テスト可能。

**Acceptance Scenarios**:

1. **Given** ラベル"documentation"が存在しない、**When** `mgtd label add documentation`を実行する、**Then** ラベルが作成され、成功メッセージが表示される
2. **Given** ラベル"bug"がすでに存在する、**When** `mgtd label add bug`を実行する、**Then** エラーメッセージ「Label 'bug' already exists」が表示される
3. **Given** 新規ラベル作成が成功した、**When** `mgtd label add feature --json`を実行する、**Then** 作成されたラベル情報（name, id, created_at）がJSON形式で返される

---

### User Story 3 - 統合ラベル割り当て（memo/task共通） (Priority: P1)

ユーザーは、`mgtd label set <issue-id> <label-id>`コマンドを使用して、memoまたはtaskにラベルを割り当てることができる。`memo label`/`task label`コマンドは廃止され、統合された`mgtd label`に置き換えられる。

**Why this priority**: DBは統合されているのにCLIが分離されているのは設計ミス。`memo label`/`task label`を廃止し、データモデルとCLIを一致させる。DBには影響しない。

**Independent Test**: `mgtd label set <issue-id> <label-id>`を実行し、対象のissue（memoまたはtask）にラベルが付与されることを`mgtd memo view <id>`または`mgtd task view <id>`で確認できる。

**Acceptance Scenarios**:

1. **Given** memo #5とlabel "urgent"（id=2）が存在する、**When** `mgtd label set 5 2`を実行する、**Then** memo #5に"urgent"ラベルが付与される
2. **Given** task #10とlabel "bug"（id=1）が存在する、**When** `mgtd label set 10 1`を実行する、**Then** task #10に"bug"ラベルが付与される
3. **Given** 存在しないissue-id=999を指定する、**When** `mgtd label set 999 1`を実行する、**Then** エラーメッセージ「Issue #999 not found」が表示される
4. **Given** 削除済みissueを指定する、**When** `mgtd label set <deleted-id> 1`を実行する、**Then** エラーメッセージ「Issue not found or deleted」が表示される

---

### User Story 4 - ラベルの削除 (Priority: P3)

ユーザーは、不要になったラベルをシステムから削除できる。削除時には、そのラベルが付与されているmemo/taskから自動的に解除される。

**Why this priority**: ラベル管理の完全性を保つために必要だが、日常的な使用頻度は低い。

**Independent Test**: `mgtd label delete <name>`を実行し、ラベルが削除され、`mgtd label list`で表示されなくなることで単独テスト可能。

**Acceptance Scenarios**:

1. **Given** ラベル"obsolete"が存在し、どのissueにも付与されていない、**When** `mgtd label delete obsolete`を実行する、**Then** ラベルが削除され、成功メッセージが表示される
2. **Given** ラベル"feature"が複数のissueに付与されている、**When** `mgtd label delete feature`を実行する、**Then** ラベルが削除され、全ての関連issueからラベルが解除される（CASCADE削除）
3. **Given** 存在しないラベル"nonexistent"を指定する、**When** `mgtd label delete nonexistent`を実行する、**Then** エラーメッセージ「Label 'nonexistent' not found」が表示される

---

### Edge Cases

- 複数のmemoとtaskに同じラベルが付与されている場合、`mgtd label delete`で全ての関連が正しくクリーンアップされるか？（CASCADE削除の動作確認）
- issue-idとlabel-idが数値的に重複している場合（例: memo #3とlabel id=3）、`mgtd label set`での引数の解釈が正しいか？
- 大量のラベル（1000件以上）が存在する場合、`mgtd label list`のパフォーマンスは許容範囲か？
- `--json`フラグが全てのlabelコマンドで一貫して動作するか？
- `memo label`/`task label`コマンドを削除した後、CLIのコマンド一覧やヘルプから完全に削除されているか？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは`mgtd label list`コマンドで、データベース内の全ラベルを一覧表示しなければならない
- **FR-002**: システムは`mgtd label add <name>`コマンドで、新しいラベルを作成しなければならない
- **FR-003**: システムは重複するラベル名の作成を拒否し、明確なエラーメッセージを返さなければならない
- **FR-004**: システムは`mgtd label set <issue-id> <label-id>`コマンドで、指定されたissue（memoまたはtask）にラベルを割り当てなければならない
- **FR-005**: `mgtd label set`は、issueのtype（memo/task）を自動判別し、既存の`attachLabels()`関数を使用しなければならない
- **FR-006**: システムは`mgtd label delete <name>`コマンドで、ラベルを削除し、関連するissue_labelsレコードをCASCADE削除しなければならない
- **FR-007**: 全てのlabelコマンドは`--json`フラグをサポートし、機械可読な出力を提供しなければならない
- **FR-008**: `mgtd label set`コマンドは、削除済み（is_deleted=1）のissueに対してエラーを返さなければならない
- **FR-009**: `mgtd label set`コマンドは、既に同じラベルが付与されているissueに対して冪等性を保証しなければならない（重複エラーを返さない）
- **FR-010**: ラベル作成時には、name（必須）とdescription（オプション）を受け付けなければならない
- **FR-011**: 既存の`memo label`および`task label`コマンド（add/set/remove/indexを含む全サブコマンド）を削除しなければならない

### Key Entities

- **Label**: システム全体で共有されるタグ。属性: id（自動採番）, name（一意、必須）, description（任意）, created_at
- **Issue**: memoまたはtaskの抽象表現。属性: id（連番）, type（'memo'または'task'）, is_deleted（論理削除フラグ）
- **IssueLabel**: IssueとLabelの多対多関連。属性: issue_id, label_id, assigned_at（外部キー制約あり、CASCADE削除）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ユーザーは、3コマンド以内（`mgtd label list`, `mgtd label add`, `mgtd label set`）で新規ラベルの作成から割り当てまでを完了できる
- **SC-002**: `mgtd label list`コマンドは、1000件のラベルが存在する場合でも1秒以内に結果を表示する
- **SC-003**: ラベル削除時、関連するissue_labelsレコードが100%自動削除され、孤立レコードが残らない
- **SC-004**: 全てのlabelコマンドは、`--json`フラグ使用時に有効なJSON形式の出力を返す（JSONパーサーでエラーが発生しない）
- **SC-005**: `memo label`/`task label`コマンドが完全に削除され、CLIから実行不可能になる
- **SC-006**: 不正な入力（存在しないID、削除済みissue、重複ラベル名）に対して、明確で実行可能なエラーメッセージが100%のケースで返される

## Assumptions

- ラベル名は大文字小文字を区別する（"Bug"と"bug"は別のラベル）
- ラベルのdescriptionフィールドは、将来の機能拡張のために予約されているが、初期実装では必須ではない
- `mgtd label set`コマンドは、既存のラベル割り当てを上書きせず、追加のみを行う（冪等性を持つ）
- パフォーマンス要件（SC-002）は、通常のデスクトップ環境（SSD、4GB RAM以上）を前提とする
- GitHub CLIの`gh label`コマンドをUXの参考とするが、完全な互換性は求めない
- ラベルの色付けは現行スコープ外とし、将来の機能として検討する

## Dependencies

- 既存のDBスキーマ（`labels`, `issue_labels`, `issues`テーブル）は変更不要
- CLIフレームワーク（oclif）の既存コマンド構造に新しい`label`トップレベルコマンドを追加
- `packages/db`の既存リポジトリ関数（`attachLabels`, `detachLabels`等）を再利用
- `packages/core`にLabelServiceを新規作成し、リポジトリ層を抽象化

## Out of Scope

- ラベルの色設定機能
- ラベルの階層化・カテゴリ分け
- ラベルの名前変更機能（削除→再作成で代替可能）
- ラベルの使用頻度統計・分析機能
- ラベルのエクスポート/インポート機能
- `memo label`/`task label`コマンドからの自動移行（DBスキーマは変更なし、コマンド削除のみ）
