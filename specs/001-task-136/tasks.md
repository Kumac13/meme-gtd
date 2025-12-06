# Tasks: 画像添付機能

**Input**: Design documents from `/specs/001-task-136/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/attachments.yaml

**Tests**: テストは明示的に要求されていないため、本タスクリストには含まない。

**Organization**: タスクはユーザーストーリーごとにグループ化され、各ストーリーを独立して実装・テスト可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するユーザーストーリー（例: US1, US2）
- 説明には正確なファイルパスを含む

## Path Conventions

- **Monorepo構造**: `packages/api/src/`, `packages/web/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依存パッケージの追加と基本設定

- [x] T001 `@fastify/multipart` を packages/api に追加: `pnpm --filter meme-gtd-api add @fastify/multipart`
- [x] T002 TypeScript型定義を追加: Node.js 22+の`crypto.randomUUID()`を使用するため外部パッケージ不要

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全ユーザーストーリーに必要な共通インフラ

**⚠️ CRITICAL**: このフェーズが完了するまで、ユーザーストーリーの作業は開始できない

- [x] T003 画像保存先ディレクトリのユーティリティ関数を作成: `packages/api/src/utils/attachments.ts`
  - `getAttachmentsDir()`: `~/.mgtd/attachments` を返す
  - `getIssueAttachmentsDir(issueId)`: `~/.mgtd/attachments/{issueId}` を返す
  - `ensureAttachmentsDir(issueId)`: ディレクトリを作成（再帰的）
- [x] T004 Zodスキーマを作成: `packages/api/src/schemas/attachmentSchemas.ts`
  - `AttachmentResponseSchema`: id, filename, absolutePath, markdownRef, mimeType, size
  - `AttachmentErrorSchema`: error, code, message
  - 許可されるMIMEタイプ: image/png, image/jpeg, image/gif, image/webp
- [x] T005 @fastify/multipart をサーバーに登録: `packages/api/src/server.ts`
  - ファイルサイズ制限: 10MB
  - ファイル数制限: 1

**Checkpoint**: 基盤準備完了 - ユーザーストーリー実装を開始可能

---

## Phase 3: User Story 1 - Web UIから画像をアップロード (Priority: P1) 🎯 MVP

**Goal**: Web UIでメモ/タスク編集中に画像をドラッグ＆ドロップまたはファイル選択でアップロードし、本文にMarkdown画像参照を挿入

**Independent Test**: Web UIでメモを開き、画像をドラッグ＆ドロップして本文に挿入。保存後、画像が表示されることを確認。

### Backend Implementation (US1)

- [x] T006 [P] [US1] 画像アップロードハンドラを作成: `packages/api/src/handlers/attachmentHandlers.ts`
  - `uploadAttachment`: POST /api/attachments/:issueId
    - ファイル形式検証（MIMEタイプ + 拡張子）
    - ファイルサイズ検証（10MB以下）
    - UUID生成してファイル保存
    - 絶対パス形式でレスポンス返却
  - `getAttachment`: GET /api/attachments/:issueId/:filename
    - ファイル存在確認
    - 適切なContent-Typeでファイル配信
- [x] T007 [US1] 画像ルートを作成: `packages/api/src/routes/attachments.ts`
  - POST /api/attachments/:issueId - 画像アップロード
  - GET /api/attachments/:issueId/:filename - 画像取得
- [x] T008 [US1] ルートをサーバーに登録: `packages/api/src/server.ts` 更新
  - `attachmentRoutes` をインポートして登録
  - Swagger tagsに 'Attachments' を追加

### Frontend Implementation (US1)

- [x] T009 [P] [US1] 画像アップロードフックを作成: `packages/web/src/hooks/useImageUpload.ts`
  - `uploadImage(issueId, file)`: APIを呼び出して画像をアップロード
  - ローディング状態管理
  - エラーハンドリング（ファイル形式、サイズ）
  - アップロード成功時にmarkdownRefを返す
- [x] T010 [P] [US1] 画像アップローダーコンポーネントを作成: `packages/web/src/components/ImageUploader.tsx`
  - ドラッグ＆ドロップ対応（onDragOver, onDrop）
  - ファイル選択ボタン（hidden input[type="file"]）
  - アップロード中のローディング表示
  - props: issueId, onUploadComplete(markdownRef)
- [x] T011 [US1] MemoFormに画像アップロードを統合: `packages/web/src/components/MemoForm.tsx` 更新
  - textareaにImageUploaderを統合
  - アップロード完了時にカーソル位置にmarkdownRefを挿入
- [x] T012 [US1] TaskFormに画像アップロードを統合: `packages/web/src/components/TaskForm.tsx` 更新
  - textareaにImageUploaderを統合
  - アップロード完了時にカーソル位置にmarkdownRefを挿入
- [x] T013 [US1] Markdownレンダラーで画像パスを変換: `packages/web/src/utils/markdown.tsx` 更新
  - imgコンポーネントをカスタマイズ
  - `~/.mgtd/attachments/{issueId}/{filename}` → `/api/attachments/{issueId}/{filename}` に変換
  - 変換対象: 絶対パス形式の画像参照のみ

**Checkpoint**: User Story 1 完了 - Web UIで画像アップロード・表示が独立して機能

---

## Phase 4: User Story 2 - CLI出力をClaude Codeにコピペ (Priority: P2)

**Goal**: CLIでメモ/タスクを表示した際、画像パスがClaude Codeで認識可能な絶対パス形式で出力される

**Independent Test**: 画像参照を含むメモをCLIで表示し、出力をClaude Codeにコピペして画像パスが認識されることを確認。

### Verification (US2)

- [x] T014 [US2] CLI出力の動作確認: 既存の `memo show` / `task show` が bodyMd をそのまま出力することを確認
  - 確認方法: コードレビューで `memo/view.ts` と `task/view.ts` を確認
  - 結果: `this.log(memo.bodyMd)` と `this.log(task.bodyMd || '(no body)')` で直接出力
  - 変更不要 - 既存実装がそのまま絶対パスを出力する

**Note**: research.md によると、既存のCLI実装は bodyMd をそのまま出力するため、変更は不要と予想される。

**Checkpoint**: User Story 2 完了 - CLI出力が絶対パス形式で動作

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 複数ユーザーストーリーにまたがる改善

- [x] T015 [P] エラーメッセージの日本語化確認
  - ファイルサイズ超過: 「ファイルサイズが10MBを超えています」 ✓
  - 非対応フォーマット: 「PNG, JPEG, GIF, WebP形式のみ対応しています」 ✓
  - API/フロントエンド両方で確認済み
- [x] T016 [P] quickstart.md の検証実行
  - curlコマンド形式が正しいことを確認
  - エンドポイントURLとレスポンス形式が実装と一致
- [ ] T017 手動E2Eテスト (ユーザー検証待ち)
  - メモ作成 → 画像アップロード → 保存 → 画像表示確認
  - タスク作成 → 画像アップロード → 保存 → 画像表示確認
  - CLI出力確認

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - 即座に開始可能
- **Foundational (Phase 2)**: Setup完了に依存 - 全ユーザーストーリーをブロック
- **User Story 1 (Phase 3)**: Foundational完了に依存
- **User Story 2 (Phase 4)**: Foundational完了に依存（US1と並列可能だが、テストデータ作成のため順次推奨）
- **Polish (Phase 5)**: 全ユーザーストーリー完了に依存

### Within Each User Story

- バックエンド → フロントエンドの順
- ハンドラ → ルート → サーバー登録の順
- フック → コンポーネント → 既存フォーム統合の順

### Parallel Opportunities

**Phase 2内**:
```
T003 (utils/attachments.ts) と T004 (schemas) は並列実行可能
```

**Phase 3 (US1) 内**:
```
# バックエンドとフロントエンドで並列開始可能（ただしフロントエンドはAPIモック必要）
# 以下は完全に並列可能:
T006 (attachmentHandlers.ts)
T009 (useImageUpload.ts)
T010 (ImageUploader.tsx)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup 完了
2. Phase 2: Foundational 完了 (CRITICAL)
3. Phase 3: User Story 1 完了
4. **STOP and VALIDATE**: Web UIで画像アップロード・表示を独立テスト
5. デプロイ/デモ可能

### Incremental Delivery

1. Setup + Foundational → 基盤準備完了
2. User Story 1 追加 → 独立テスト → デプロイ/デモ (MVP!)
3. User Story 2 追加 → 独立テスト → 完全版リリース
4. 各ストーリーは前のストーリーを破壊せず価値を追加

---

## Notes

- [P] タスク = 異なるファイル、依存関係なし
- [Story] ラベルでタスクを特定のユーザーストーリーにマッピング
- 各ユーザーストーリーは独立して完了・テスト可能
- 論理的なグループ後にコミット
- チェックポイントで停止してストーリーを独立検証可能
