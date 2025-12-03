# Feature Specification: コードブロック折りたたみ機能

**Feature Branch**: `001-task-147-status`
**Created**: 2025-12-04
**Status**: Draft
**Input**: Task #147 - 長いコードブロック（クエリなど）を畳めるようにして、パッと見の視認性を上げたい

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 折りたたみコードブロックの記述と表示 (Priority: P1)

ユーザーがMarkdownでコードブロックを記述する際、GitHubと同じ`<details>/<summary>`タグを使用して、コードブロックを折りたたんだ状態で表示できるようにする。長いSQLクエリや設定ファイルなど、内容は保持したいが普段は隠しておきたいコンテンツに対して使用する。

**Why this priority**: 本機能の核心的な価値。折りたたみ機能がないと、長いコードブロックが画面を占有し、他の内容の視認性を著しく下げる。

**Independent Test**: `<details>/<summary>`タグを含むMarkdownを作成・保存し、Web UIで折りたたみ/展開が機能することを確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーがタスク/メモの本文に`<details><summary>見出し</summary>コードブロック</details>`形式でMarkdownを記述している, **When** Web UIで該当のタスク/メモを表示する, **Then** コードブロックは折りたたまれた状態で表示され、summaryテキスト（見出し）のみが見える

2. **Given** 折りたたまれた状態のコードブロックがある, **When** ユーザーがsummary部分をクリックする, **Then** コードブロックが展開され、全文が表示される

3. **Given** 展開された状態のコードブロックがある, **When** ユーザーがsummary部分を再度クリックする, **Then** コードブロックが折りたたまれる

---

### User Story 2 - 折りたたみ状態でのコードコピー (Priority: P1)

折りたたまれた状態でも、コードブロックのコピー機能が正常に動作し、全文がコピーできる。

**Why this priority**: コピー機能はコードブロックの基本的なユースケースであり、折りたたみ機能との両立は必須。

**Independent Test**: 折りたたんだ状態のコードブロックでコピーボタンを押し、クリップボードの内容を確認できる。

**Acceptance Scenarios**:

1. **Given** 折りたたまれた状態のコードブロック（コピーボタン付き）がある, **When** ユーザーがコピーボタンをクリックする, **Then** コードブロックの全文がクリップボードにコピーされる（`<details>/<summary>`タグは含まれない）

2. **Given** 展開された状態のコードブロックがある, **When** ユーザーがコピーボタンをクリックする, **Then** 従来通りコードブロックの全文がクリップボードにコピーされる

---

### User Story 3 - セキュリティ対策（XSS防止） (Priority: P1)

HTMLタグを有効化することで発生しうるXSS攻撃を防止する。許可されたタグ以外はサニタイズされる。

**Why this priority**: セキュリティはP1として扱う。HTMLタグの有効化によるリスクを最小化する必要がある。

**Independent Test**: 悪意のあるスクリプトタグを含むMarkdownを入力し、スクリプトが実行されないことを確認できる。

**Acceptance Scenarios**:

1. **Given** ユーザーが`<script>alert('XSS')</script>`を含むMarkdownを入力した, **When** Web UIで該当のコンテンツを表示する, **Then** scriptタグはサニタイズされ、スクリプトは実行されない

2. **Given** ユーザーが`<details><summary>クリック</summary><script>alert('XSS')</script></details>`を入力した, **When** Web UIで該当のコンテンツを表示する, **Then** detailsタグは正常に機能するが、scriptタグはサニタイズされる

3. **Given** ユーザーが`<img src="x" onerror="alert('XSS')">`を入力した, **When** Web UIで該当のコンテンツを表示する, **Then** onerrorイベントハンドラはサニタイズされ、スクリプトは実行されない

---

### Edge Cases

- `<details>`タグがネストされている場合はどうなるか？ → ブラウザのネイティブ動作に従い、各レベルで独立して動作する
- `<summary>`タグがない`<details>`タグがある場合 → ブラウザのデフォルト動作（"詳細"などのデフォルトテキスト）に従う
- 折りたたみの中に画像やリンクがある場合 → 通常通りレンダリングされる
- 空の`<details>`タグがある場合 → 展開しても何も表示されない（ブラウザのネイティブ動作）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは`<details>`および`<summary>`HTMLタグをMarkdown内で認識し、レンダリングできなければならない
- **FR-002**: システムは折りたたみ状態のコードブロックのコピーボタンを表示し、全文をコピーできなければならない
- **FR-003**: システムはコピー時に`<details>/<summary>`タグを除外し、純粋なコード内容のみをクリップボードにコピーしなければならない
- **FR-004**: システムは許可されていないHTMLタグ（`<script>`, `<iframe>`, イベントハンドラ属性など）をサニタイズしなければならない
- **FR-005**: システムは折りたたみの開閉状態をユーザーのクリック操作で切り替えられなければならない
- **FR-006**: システムは既存のMarkdownレンダリング機能（見出し、リスト、表、インラインコードなど）を維持しなければならない

### Key Entities

- **CollapsibleBlock**: 折りたたみ可能なコンテンツ領域。`<details>`タグで囲まれた部分を表す。
  - **summary**: 折りたたみ時に表示されるラベル/見出し
  - **content**: 折りたたみの中に含まれるコンテンツ（コードブロック、テキストなど）
  - **open**: 展開状態かどうか（boolean）

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ユーザーは折りたたみ可能なコードブロックを1クリックで展開/折りたたみできる
- **SC-002**: 折りたたんだ状態でもコピー機能が100%正常に動作する（全文がコピーされる）
- **SC-003**: 許可されていないHTMLタグ（script, iframe, イベントハンドラなど）は100%サニタイズされる
- **SC-004**: 既存のMarkdownレンダリング機能が100%維持される（回帰なし）
- **SC-005**: 長いコードブロックを含むページの初期表示時に、折りたたみにより画面占有面積が削減される

## Assumptions

- ユーザーはGitHub Flavored Markdownの`<details>/<summary>`記法に馴染みがある
- 折りたたみの初期状態は閉じた状態（`open`属性なし）がデフォルト
- サニタイズには`rehype-sanitize`プラグインを使用し、`<details>`, `<summary>`を許可リストに追加する
- 既存の`CodeBlockWithCopy`コンポーネントは変更せず、`<details>`内のコードブロックでも動作する
