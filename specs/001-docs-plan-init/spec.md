# Feature Specification: Memo Command CLI Requirements Alignment

**Feature Branch**: `001-docs-plan-init`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "@docs/plan_init_memo.mdに基づいて、mgtdのmemoコマンドに修正を入れる。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub CLI準拠のオプション命名規則への統一 (Priority: P1)

開発者がmgtdのmemoコマンドを使用する際、GitHub CLIと同じ命名規則（kebab-case）でオプションを指定できることで、学習コストを削減し、一貫性のある体験を提供する。

**Why this priority**: CLIツールの基本的なインターフェース設計に関わる変更であり、後方互換性に影響を与える可能性があるため、最優先で対応する必要がある。また、GitHub CLIの規約に準拠することで、ユーザーにとって予測可能で学習しやすいインターフェースを提供できる。

**Independent Test**: 既存のcamelCaseオプション（`--bodyFile`, `--addLabel`等）をkebab-case（`--body-file`, `--add-label`等）に変更し、すべてのmemoサブコマンドで正しく動作することを確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーが`mgtd memo create --body-file memo.txt`を実行する, **When** コマンドが実行される, **Then** ファイルからメモが正常に作成される
2. **Given** ユーザーが`mgtd memo edit 12 --add-label bug`を実行する, **When** コマンドが実行される, **Then** メモにラベルが正常に追加される
3. **Given** ユーザーが`mgtd memo edit 12 --remove-label bug`を実行する, **When** コマンドが実行される, **Then** メモからラベルが正常に削除される
4. **Given** ユーザーが旧来のcamelCase形式（`--bodyFile`）でコマンドを実行する, **When** コマンドが実行される, **Then** エラーメッセージが表示され、正しいkebab-case形式が提示される

---

### User Story 2 - エディタ起動の明示的制御 (Priority: P2)

開発者が`memo create`、`memo edit`、`memo comment add`コマンドでエディタの起動/抑止を明示的に制御できることで、スクリプトでの自動化とインタラクティブな編集の両方のユースケースに対応する。

**Why this priority**: エディタ起動の制御は、CLIツールの自動化可能性と使い勝手に大きく影響する。GitHub CLIと同様の`--editor` / `--no-editor`フラグを提供することで、柔軟なワークフローをサポートできる。

**Independent Test**: `--editor`と`--no-editor`フラグを各コマンドに追加し、以下のシナリオが正しく動作することを確認できる：(1) フラグなしのデフォルト動作、(2) `--editor`での強制起動、(3) `--no-editor`での抑止。

**Acceptance Scenarios**:

1. **Given** ユーザーが`mgtd memo create`を実行する（本文なし）, **When** コマンドが実行される, **Then** デフォルトでエディタが起動し、本文を入力できる
2. **Given** ユーザーが`mgtd memo create --body "draft" --editor`を実行する, **When** コマンドが実行される, **Then** `--body`の内容がエディタにプリセットされ、編集後に保存される
3. **Given** ユーザーが`mgtd memo create --body "final" --no-editor`を実行する, **When** コマンドが実行される, **Then** エディタを起動せずに本文が設定される
4. **Given** ユーザーが`mgtd memo edit 12`を実行する, **When** コマンドが実行される, **Then** 既存の本文がエディタに読み込まれ、編集できる
5. **Given** ユーザーが`mgtd memo edit 12 --body "update" --no-editor`を実行する, **When** コマンドが実行される, **Then** エディタを起動せずに本文が更新される
6. **Given** ユーザーが`mgtd memo comment add 12 --editor`を実行する, **When** コマンドが実行される, **Then** エディタでコメントを作成できる

---

### User Story 3 - 機能重複の解消（`--set-label`の削除） (Priority: P3)

開発者がラベルの完全置換を行う際、`memo label set`コマンドに一元化された明確なインターフェースを使用することで、混乱を避け、GitHub CLI準拠の設計を維持する。

**Why this priority**: 機能重複は混乱を招き、メンテナンスコストを増加させる。GitHub CLIには`--set-label`が存在せず、`--add-label` / `--remove-label`のみを提供している。この変更により、設計の一貫性を保ち、ユーザーが直感的にコマンドを選択できるようになる。

**Independent Test**: `memo edit`から`--set-label`フラグを削除し、`memo label set`コマンドのみでラベルの完全置換が可能であることを確認できる。既存のテストケースを更新し、`memo edit --set-label`がエラーを返すことを確認する。

**Acceptance Scenarios**:

1. **Given** ユーザーが`mgtd memo label set 12 --label feature,bug`を実行する, **When** コマンドが実行される, **Then** メモのラベルが指定されたラベルのみに置換される
2. **Given** ユーザーが`mgtd memo edit 12 --set-label feature,bug`を実行する, **When** コマンドが実行される, **Then** エラーメッセージが表示され、`memo label set`コマンドの使用が推奨される
3. **Given** ユーザーが`mgtd memo edit 12 --add-label feature`を実行する, **When** コマンドが実行される, **Then** 既存のラベルに追加される形でラベルが設定される
4. **Given** ユーザーが`mgtd memo edit 12 --remove-label bug`を実行する, **When** コマンドが実行される, **Then** 指定されたラベルのみが削除される

---

### Edge Cases

- `--editor`と`--no-editor`が同時に指定された場合、どちらが優先されるか？（仕様: `--no-editor`が優先される、またはエラーを返す）
- `--body-file`で指定されたファイルが存在しない場合、どのようなエラーメッセージが表示されるか？
- kebab-caseへの移行時、旧来のcamelCaseオプションを使用した場合、どのようなエラーメッセージが表示されるか？（仕様: 推奨される正しい形式を提示する）
- `memo edit --set-label`を実行した場合、どのようなエラーメッセージが表示されるか？（仕様: `memo label set`コマンドの使用を推奨する）
- エディタ起動中にユーザーが編集をキャンセルした場合、コマンドはどのように振る舞うか？（仕様: 変更を保存せずにコマンドを終了する）

## Requirements *(mandatory)*

### Functional Requirements

**オプション命名規則の統一**:

- **FR-001**: すべての`memo`サブコマンドのオプションはkebab-caseで定義されなければならない（例: `--body-file`, `--add-label`, `--remove-label`）
- **FR-002**: システムは、旧来のcamelCase形式のオプション（例: `--bodyFile`, `--addLabel`）が使用された場合、適切なエラーメッセージと正しいkebab-case形式を提示しなければならない
- **FR-003**: 影響範囲: `memo create`, `memo edit`, `memo promote`, `memo comment add`, `memo comment edit`のすべてのフラグ定義

**エディタ起動の明示的制御**:

- **FR-004**: `memo create`コマンドは`--editor`フラグをサポートし、`--body`オプション指定時でもエディタで編集可能にしなければならない
- **FR-005**: `memo create`コマンドは`--no-editor`フラグをサポートし、エディタの自動起動を抑止しなければならない
- **FR-006**: `memo edit`コマンドはデフォルトで既存本文をエディタで開かなければならない
- **FR-007**: `memo edit`コマンドは`--editor`フラグをサポートし、エディタ起動を明示的に指定できなければならない
- **FR-008**: `memo edit`コマンドは`--no-editor`フラグをサポートし、エディタの起動を抑止しなければならない
- **FR-009**: `memo comment add`コマンドは`--editor`フラグをサポートし、エディタでコメントを作成できなければならない
- **FR-010**: `memo comment add`コマンドは`--no-editor`フラグをサポートし、エディタの起動を抑止しなければならない
- **FR-011**: エディタ起動ロジックは、フラグ優先度（`--no-editor` > `--editor` > デフォルト動作）に従って動作しなければならない
- **FR-012**: `--editor`と`--no-editor`が同時に指定された場合、システムはエラーを返すか、`--no-editor`を優先しなければならない

**機能重複の解消**:

- **FR-013**: `memo edit`コマンドから`--set-label`フラグを削除しなければならない
- **FR-014**: ラベルの完全置換は`memo label set`コマンドでのみ提供されなければならない
- **FR-015**: `memo edit`コマンドで`--set-label`が使用された場合、システムは適切なエラーメッセージを表示し、`memo label set`コマンドの使用を推奨しなければならない
- **FR-016**: `packages/db/src/memoRepository.ts`の`setMemoLabels`関数は保持され、`memo label set`コマンドで使用されなければならない

**テストとドキュメント**:

- **FR-017**: すべてのテストコードは新しいkebab-case命名規則に更新されなければならない
- **FR-018**: すべてのドキュメント（README、CLIヘルプ、コマンド説明）は新しいオプション命名規則に更新されなければならない
- **FR-019**: 各変更に対応するテストケースを追加し、既存テストが正常にパスすることを確認しなければならない

### Key Entities

- **Memo**: メモの本体。本文（body）、ラベル（labels）、作成日時、更新日時などの属性を持つ。
- **Label**: メモに付与されるタグ。メモのカテゴリ分けやフィルタリングに使用される。
- **Comment**: メモに関連付けられるコメント。本文と作成日時を持つ。
- **Editor Session**: ユーザーがエディタで編集する際の一時的なセッション。編集内容の保存またはキャンセルを制御する。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: すべての`memo`サブコマンドでkebab-caseオプションが使用でき、旧来のcamelCaseオプションは適切なエラーメッセージを表示する
- **SC-002**: `memo create`、`memo edit`、`memo comment add`コマンドで`--editor` / `--no-editor`フラグが正しく動作し、エディタの起動/抑止を制御できる
- **SC-003**: `memo edit --set-label`が削除され、`memo label set`コマンドのみでラベルの完全置換が可能になる
- **SC-004**: すべての既存テストが新しい仕様に適合し、100%のテストケースがパスする
- **SC-005**: ドキュメント（README、CLIヘルプ）が更新され、新しいオプション命名規則とエディタ制御フラグが正確に記載される
- **SC-006**: ユーザーがGitHub CLIの経験を活かして、mgtdのmemoコマンドを追加の学習なしに使用できる（学習コストの削減）
- **SC-007**: エディタ起動の制御により、スクリプトでの自動化（`--no-editor`）とインタラクティブな編集（`--editor`）の両方のユースケースに対応できる

## Assumptions

- 既存のユーザーベースは小規模であり、破壊的変更（オプション命名規則の変更）による影響は限定的である
- GitHub CLIの設計原則（kebab-case、`--editor` / `--no-editor`フラグ）がmgtdのターゲットユーザーにとって最適なUXである
- エディタ起動時、システムはユーザーの`$EDITOR`環境変数を使用し、設定されていない場合はデフォルトエディタ（例: `vi`、`nano`）を使用する
- `--editor`と`--no-editor`の両方が指定された場合、`--no-editor`を優先する（または明示的なエラーを返す）
- ラベルの完全置換が必要なケースは限定的であり、`memo label set`コマンドへの一元化がユーザビリティを向上させる
- 現在のv0.1.0から次のリリース（v0.1.1）として、これらの変更を段階的にデプロイする予定である

## Dependencies

- `docs/cli_requirement.md`: CLIコマンド仕様の参照元
- `docs/requirements.md`: 全体的な要件定義
- GitHub CLI: オプション命名規則とUX設計の参照元
- `packages/db/src/memoRepository.ts`: データベース操作のリポジトリ層（`setMemoLabels`関数の保持が必要）
- テストフレームワーク（`node:test`）: すべての変更に対応するテストケースの追加

## Out of Scope

- オートコンプリートの動的生成（将来のリリースで対応予定）
- リリースパッケージ化の完全自動化
- 新しいmemoサブコマンドの追加（この仕様は既存コマンドの修正のみに焦点を当てる）
- エディタのカスタマイズオプション（現時点では`$EDITOR`環境変数に依存）
- 後方互換性のためのcamelCaseオプションのエイリアス提供（完全に削除し、エラーメッセージで案内する方針）
