# Tasks: コードブロック折りたたみ機能

**Input**: Design documents from `/specs/001-task-147-status/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: テストタスクは明示的にリクエストされていないため、含めていません。

**Organization**: タスクはユーザーストーリーごとにグループ化されています。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するユーザーストーリー（US1, US2, US3）
- 各タスクに正確なファイルパスを記載

## Path Conventions

- **Web app**: `packages/web/src/` (monorepo構造)

---

## Phase 1: Setup (依存パッケージインストール)

**Purpose**: rehype-raw, rehype-sanitizeパッケージのインストール

- [x] T001 [Setup] `packages/web/package.json`にrehype-raw, rehype-sanitizeを追加: `pnpm --filter meme-gtd-web add rehype-raw rehype-sanitize`

**Checkpoint**: 依存パッケージがインストールされ、importが可能になる

---

## Phase 2: Foundational (Markdownレンダラー更新)

**Purpose**: ReactMarkdownにrehypeプラグインを追加し、HTMLタグのパースとサニタイズを有効化

**⚠️ CRITICAL**: このフェーズが完了するまで、全てのユーザーストーリーの動作確認はできない

- [x] T002 [Foundation] `packages/web/src/utils/markdown.tsx`のimport文にrehype-raw, rehype-sanitizeを追加
- [x] T003 [Foundation] `MarkdownRenderer`コンポーネントの`ReactMarkdown`に`rehypePlugins={[rehypeRaw, rehypeSanitize]}`を追加

**Checkpoint**: Foundation ready - `<details>/<summary>`タグがパース・サニタイズされる状態

---

## Phase 3: User Story 1 - 折りたたみコードブロックの記述と表示 (Priority: P1) 🎯 MVP

**Goal**: `<details>/<summary>`タグを使用して、コードブロックを折りたたみ/展開可能にする

**Independent Test**: タスク/メモに`<details><summary>見出し</summary>コードブロック</details>`を入力し、Web UIで折りたたみ/展開が機能することを確認

### Implementation for User Story 1

- [ ] T004 [US1] 動作確認: テスト環境で`<details>/<summary>`タグを含むMarkdownを入力し、折りたたみ表示を確認
- [ ] T005 [US1] 動作確認: summary部分のクリックで展開/折りたたみが切り替わることを確認
- [ ] T006 [US1] 動作確認: `open`属性付き`<details open>`で初期展開状態を確認

**Checkpoint**: User Story 1が完全に機能し、独立してテスト可能

---

## Phase 4: User Story 2 - 折りたたみ状態でのコードコピー (Priority: P1)

**Goal**: 折りたたまれた状態でも、コピーボタンでコードブロック全文をコピー可能にする

**Independent Test**: 折りたたんだ状態のコードブロックでコピーボタンを押し、クリップボードにコード全文がコピーされることを確認

### Implementation for User Story 2

- [ ] T007 [US2] 動作確認: 折りたたみ状態でコピーボタンが表示されることを確認
- [ ] T008 [US2] 動作確認: 折りたたみ状態でコピーボタンをクリックし、コード全文がクリップボードにコピーされることを確認
- [ ] T009 [US2] 動作確認: コピーされた内容に`<details>/<summary>`タグが含まれていないことを確認

**Checkpoint**: User Stories 1 AND 2が両方とも独立して動作

---

## Phase 5: User Story 3 - セキュリティ対策（XSS防止） (Priority: P1)

**Goal**: `<script>`タグやイベントハンドラ属性などの危険なHTMLがサニタイズされることを確認

**Independent Test**: 悪意のあるスクリプトタグを含むMarkdownを入力し、スクリプトが実行されないことを確認

### Implementation for User Story 3

- [ ] T010 [US3] 動作確認: `<script>alert('XSS')</script>`を入力し、スクリプトが実行されないことを確認
- [ ] T011 [US3] 動作確認: `<img src="x" onerror="alert('XSS')">`を入力し、イベントハンドラが除去されることを確認
- [ ] T012 [US3] 動作確認: `<details><summary>Click</summary><script>alert('XSS')</script></details>`を入力し、detailsは機能するがscriptはサニタイズされることを確認

**Checkpoint**: 全てのユーザーストーリーが独立して機能

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 回帰テストと既存機能の確認

- [ ] T013 [Polish] 既存Markdownレンダリング確認: 見出し、リスト、表、インラインコードが従来通り動作することを確認
- [ ] T014 [Polish] Edge Case確認: ネストされた`<details>`タグが正しく動作することを確認
- [ ] T015 [Polish] Edge Case確認: `<summary>`なしの`<details>`がブラウザデフォルト動作になることを確認
- [ ] T016 [Polish] quickstart.mdの動作確認手順を実行して全体検証

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即座に開始可能
- **Foundational (Phase 2)**: Setup完了後 - 全ユーザーストーリーをブロック
- **User Stories (Phase 3-5)**: Foundational完了後 - 順次または並列で実行可能
- **Polish (Phase 6)**: 全ユーザーストーリー完了後

### User Story Dependencies

- **User Story 1 (P1)**: Foundational完了後に開始可能 - 他ストーリーへの依存なし
- **User Story 2 (P1)**: Foundational完了後に開始可能 - US1の実装に依存（同じ機能の異なる側面）
- **User Story 3 (P1)**: Foundational完了後に開始可能 - 他ストーリーへの依存なし

### Within Each Phase

- T002 → T003 は順次実行（同一ファイル）
- 各User Storyの動作確認タスクは順次実行

### Parallel Opportunities

- Phase 3, 4, 5は全てFoundational完了後に開始可能だが、実際には同一機能の異なる側面を検証するため順次実行を推奨
- Phase 6の確認タスクは互いに独立して実行可能

---

## Parallel Example

```bash
# Phase 2完了後、以下の動作確認を順次実行:
# US1: 折りたたみ表示確認
# US2: コピー機能確認
# US3: XSSサニタイズ確認

# または、異なる検証者が並列で確認:
# 検証者A: User Story 1 (T004-T006)
# 検証者B: User Story 3 (T010-T012)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup完了
2. Phase 2: Foundational完了
3. Phase 3: User Story 1完了
4. **STOP and VALIDATE**: 折りたたみ/展開が動作することを確認
5. デモ/リリース可能

### Incremental Delivery

1. Setup + Foundational完了 → 基盤準備完了
2. User Story 1完了 → 折りたたみ機能が動作 (MVP!)
3. User Story 2完了 → コピー機能が動作
4. User Story 3完了 → セキュリティ確認済み
5. Polish完了 → 回帰なし確認済み

### 実装コード概要

```tsx
// packages/web/src/utils/markdown.tsx

import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

// MarkdownRendererコンポーネント内
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkBreaks]}
  rehypePlugins={[rehypeRaw, rehypeSanitize]}
  components={{ ...defaultComponents, ...components }}
>
  {content}
</ReactMarkdown>
```

---

## Notes

- 全てのUser Storyが同一優先度(P1)のため、順次実装を推奨
- コード変更は2タスク(T002, T003)のみ、残りは動作確認タスク
- 既存の`CodeBlockWithCopy`コンポーネントは変更不要
- `rehype-sanitize`のデフォルトスキーマで`details/summary`は許可済み
- 本番DBには一切触れないこと（テスト環境: http://localhost:3001）
