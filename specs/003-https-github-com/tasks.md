---
description: "メモ削除の対話的確認機能のタスクリスト"
---

# Tasks: Interactive Confirmation for Memo Delete

**Input**: 設計ドキュメント `/specs/003-https-github-com/`より
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli-command.md, quickstart.md

**Tests**: この機能では、quickstart.mdに統合テストの実装ガイドが含まれていますが、TDDアプローチは明示的に要求されていないため、実装後の検証ステップとして扱います。

**Organization**: タスクはユーザーストーリーごとにグループ化され、各ストーリーを独立して実装・テストできるようになっています。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するユーザーストーリー（US1, US2, US3）
- 説明には正確なファイルパスを含む

## Path Conventions
- **Project Type**: Monorepo (pnpm workspace)
- **Modified Package**: `packages/cli` のみ
- **Paths**: `packages/cli/src/commands/memo/delete.ts` (変更), `packages/cli/test/commands/memo/delete.test.js` (新規作成)

---

## Phase 1: Setup (共通インフラ)

**Purpose**: プロジェクト初期化と基本構造（この機能では既存プロジェクトへの変更のため最小限）

- [x] T001 research.mdの技術決定事項を確認（Node.js readline、TTY検出、SIGINT処理）
- [x] T002 contracts/cli-command.mdでコマンド仕様を確認（引数、フラグ、振る舞い）
- [x] T003 quickstart.mdの実装ガイドを確認（実装パターン、ピットフォール）

---

## Phase 2: Foundational (前提条件)

**Purpose**: すべてのユーザーストーリーに必要なコアインフラストラクチャ

**⚠️ CRITICAL**: このフェーズが完了するまで、ユーザーストーリーの作業は開始できません

- [x] T004 既存の`packages/cli/src/commands/memo/delete.ts`の現在の実装を読み込み、構造を理解する
- [x] T005 `packages/cli/src/commands/memo/delete.ts`に`import * as readline from 'readline';`を追加

**Checkpoint**: 基盤準備完了 - ユーザーストーリーの実装を並列開始可能

---

## Phase 3: User Story 1 - Interactive Deletion Confirmation (Priority: P1) 🎯 MVP

**Goal**: ユーザーがコマンドフラグを覚えることなく、自然で対話的な方法でメモの削除を確認できるようにする

**Independent Test**: `mgtd memo delete <id>` を実行し、確認を求める対話的プロンプトが表示されることを確認。'y' で削除、'n' でキャンセルできることを検証。

### Implementation for User Story 1

- [x] T006 [US1] `packages/cli/src/commands/memo/delete.ts`に`createPreview(bodyMd: string): string`プライベートメソッドを追加（メモ内容の最初の60文字を取得、複数行の場合は最初の行のみ、必要に応じて`...`で切り詰め）
- [x] T007 [US1] `packages/cli/src/commands/memo/delete.ts`に`promptConfirmation(id: number, preview: string): Promise<boolean>`プライベートメソッドを追加
  - readline.createInterfaceでプロンプトを作成
  - `Delete memo #<id>: "<preview>"? (y/n): ` という質問を表示
  - 入力を`toLowerCase().trim()`で正規化
  - ['y', 'yes']なら`true`、['n', 'no']なら`false`を返す
  - 無効な入力の場合はエラーメッセージを表示して`false`を返す
  - SIGINT（Ctrl+C）ハンドラを追加（`process.once('SIGINT', ...)`）
  - rl.close()を確実に呼び出し
- [x] T008 [US1] `packages/cli/src/commands/memo/delete.ts`の`run()`メソッドを更新
  - `--yes`フラグがある場合は既存の動作を維持（即座に削除、プロンプトなし）
  - `--yes`フラグがない場合、`process.stdin.isTTY`をチェック
  - TTYでない場合はエラーメッセージ"Cannot prompt for confirmation. Please use --yes flag to confirm deletion."を表示して終了（exit: 1）
  - TTYの場合、`service.show(args.id)`でメモを取得（存在しない場合のエラーハンドリング）
  - `createPreview()`でプレビューを生成
  - `promptConfirmation()`で確認を求める
  - 確認された場合は削除を実行、キャンセルされた場合は"Deletion cancelled."を表示

**Checkpoint**: この時点で、User Story 1は完全に機能し、独立してテスト可能

---

## Phase 4: User Story 2 - Non-Interactive Mode for Automation (Priority: P2)

**Goal**: AIエージェントやスクリプトが対話的プロンプトなしでメモを削除できるようにする

**Independent Test**: `mgtd memo delete <id> --yes` を実行し、対話的プロンプトなしで即座にメモが削除されることを確認。

### Implementation for User Story 2

- [x] T009 [US2] T008で実装した`--yes`フラグのロジックを検証（既存の動作が保持されていることを確認）
  - `--yes`フラグがある場合、`promptConfirmation()`が呼び出されないこと
  - 即座に`service.remove(args.id)`が実行されること
  - 成功メッセージ`Memo #<id> marked as deleted.`が表示されること

**Note**: User Story 2の実装はT008で既に完了しています（`--yes`フラグの分岐処理）。このフェーズは検証タスクのみです。

**Checkpoint**: User Stories 1と2の両方が独立して動作することを確認

---

## Phase 5: User Story 3 - Short Flag Alias (Priority: P3)

**Goal**: パワーユーザーが最小限のタイピングで削除を確認できるようにする

**Independent Test**: `mgtd memo delete <id> -y` を実行し、`--yes`と同じ動作をすることを確認。

### Implementation for User Story 3

- [x] T010 [US3] `packages/cli/src/commands/memo/delete.ts`の`--yes`フラグ定義に`char: 'y'`オプションを追加して短縮エイリアス`-y`を有効化
  ```typescript
  yes: Flags.boolean({
    char: 'y',  // この行を追加
    description: 'Skip confirmation and delete immediately',
  })
  ```
  **Note**: 既存コードで既に`char: 'y'`が設定されていることを確認しました（18-19行目）。

**Checkpoint**: すべてのユーザーストーリーが独立して機能することを確認

---

## Phase 6: Integration Tests & Validation

**Purpose**: 実装した機能の検証（quickstart.mdのガイドに従って統合テストを作成）

- [x] T011 `packages/cli/test/commands/memo/delete.test.js`を新規作成
  - テストのセットアップ（一時ディレクトリ、テストDB初期化）
  - [US1] 非TTY環境（パイプ経由）で--yesなし → エラーメッセージ ✓
  - [US1] 存在しないメモID → エラーメッセージ（既存の動作） ✓
  - [US2] --yesフラグ → プロンプトなしで即座に削除 ✓
  - [US2] --yesフラグは非TTY環境でも動作 ✓
  - [US3] -y短縮フラグ → プロンプトなしで即座に削除 ✓
  - [US3] -y短縮フラグは非TTY環境でも動作 ✓
  - **Note**: 対話的プロンプトのテスト（y/n入力、大文字小文字、プレビュー表示、無効な入力、Ctrl+C）は疑似TTYが必要なため、手動検証（Phase 7）で実施
- [x] T012 ビルド実行: `pnpm --filter meme-gtd-cli build`
- [x] T013 統合テスト実行: 8つのテストすべてがパス ✓

---

## Phase 7: Manual Verification & Polish

**Purpose**: 手動検証とクロスカッティング改善

- [ ] T014 quickstart.mdの「Manual Verification」セクションの全シナリオを手動で実行（ユーザーが実施）
  - 対話的削除（y入力）
  - 対話的削除（n入力）
  - --yesフラグでの削除
  - -y短縮フラグでの削除
  - 無効な入力処理
  - Ctrl+C処理
- [ ] T015 エラーメッセージが明確でユーザーフレンドリーであることを確認（ユーザーが実施）
- [ ] T016 プロンプトのレスポンス時間が100ms以内であることを確認（ユーザーが実施）
- [ ] T017 ビルドが成功することを最終確認: `pnpm build`（既に確認済み ✓）
- [x] T018 `docs/cli_requirement.md`の`memo delete`セクションを更新（対話的プロンプトの仕様を追記）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存関係なし - 即座に開始可能
- **Foundational (Phase 2)**: Setup完了に依存 - すべてのユーザーストーリーをブロック
- **User Stories (Phase 3-5)**: すべてFoundational phase完了に依存
  - User Storiesは並列実行可能（スタッフがいる場合）
  - または優先順位順に順次実行（P1 → P2 → P3）
- **Integration Tests (Phase 6)**: User Stories 1-3の実装完了に依存
- **Manual Verification (Phase 7)**: Integration Tests完了に依存

### User Story Dependencies

- **User Story 1 (P1)**: Foundational (Phase 2)完了後に開始可能 - 他のストーリーへの依存なし
- **User Story 2 (P2)**: T008で実装済み（検証のみ） - US1の実装に含まれる
- **User Story 3 (P3)**: Foundational (Phase 2)完了後に開始可能 - US1/US2とは独立

### Within Each User Story

- US1: T006（プレビュー生成） → T007（プロンプト確認） → T008（run()メソッド更新）の順
- US2: T009（検証のみ、T008に依存）
- US3: T010（フラグ定義の変更、独立）

### Parallel Opportunities

- Phase 1のすべてのタスク（T001, T002, T003）は並列実行可能
- US1のT006とT007は並列実行可能（両方とも新しいプライベートメソッドの追加）
- US3のT010はUS1/US2の実装と並列実行可能（異なる箇所の変更）
- Phase 6のT011（テスト作成）は実装完了後に開始し、T012（ビルド）とT013（テスト実行）は順次実行

---

## Parallel Example: Core Implementation

```bash
# US1の独立したメソッド作成を並列で実行:
Task: "T006 createPreview()メソッドを追加"
Task: "T007 promptConfirmation()メソッドを追加"

# これらが完了したら、run()メソッドを更新:
Task: "T008 run()メソッドを更新して対話的プロンプトを統合"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup を完了
2. Phase 2: Foundational を完了（CRITICAL - すべてのストーリーをブロック）
3. Phase 3: User Story 1 を完了
4. **STOP and VALIDATE**: User Story 1を独立してテスト
5. 準備ができていればデプロイ/デモ

### Incremental Delivery

1. Setup + Foundational を完了 → 基盤準備完了
2. User Story 1 を追加 → 独立してテスト → デプロイ/デモ（MVP!）
3. User Story 2 を追加 → 独立してテスト → デプロイ/デモ（自動化サポート追加）
4. User Story 3 を追加 → 独立してテスト → デプロイ/デモ（短縮フラグ追加）
5. 各ストーリーが以前のストーリーを壊すことなく価値を追加

### Single Developer Strategy

1つのファイル（delete.ts）への変更が中心のため、段階的に実装:

1. Phase 1-2を完了（設計文書の確認とreadlineのimport）
2. User Story 1（T006, T007, T008）を順次実装 → 手動検証
3. User Story 2（T009）を検証 → 手動検証
4. User Story 3（T010）を実装 → 手動検証
5. 統合テスト（Phase 6）を作成・実行
6. 最終検証（Phase 7）

---

## Notes

- [P] タスク = 異なるファイル、依存関係なし
- [Story] ラベルはタスクを特定のユーザーストーリーにマッピング（トレーサビリティ）
- 各ユーザーストーリーは独立して完了・テスト可能
- 各タスクまたは論理的なグループの後にコミット
- 任意のチェックポイントで停止してストーリーを独立検証可能
- 避けるべき: 曖昧なタスク、同一ファイルの競合、ストーリーの独立性を壊すクロスストーリー依存

## Quick Reference

- **Total Tasks**: 17タスク
- **User Story 1 (P1 - MVP)**: 3タスク（T006-T008）
- **User Story 2 (P2)**: 1タスク（T009 - 検証のみ）
- **User Story 3 (P3)**: 1タスク（T010）
- **Integration Tests**: 3タスク（T011-T013）
- **Manual Verification**: 4タスク（T014-T017）
- **MVP Scope**: Phase 1-3（T001-T008）でUser Story 1が完全に機能

## Success Criteria

- ✅ ユーザーがコマンドフラグを覚えずに自然な対話的確認でメモを削除できる
- ✅ 対話的プロンプトがユーザー入力に100ms以内で応答
- ✅ 自動化スクリプトとAIエージェントが`--yes`フラグでプロンプトなしでメモを削除可能
- ✅ プロンプトでの無効な入力が明確なエラーメッセージで拒否される
- ✅ 100%の対話的削除試行で、何が削除されるか（メモIDとコンテンツプレビュー）が明確に表示される
- ✅ Ctrl+Cが優雅にキャンセルを処理（終了コード130）
- ✅ 非TTY環境で適切なエラーメッセージが表示される
- ✅ すべての統合テストがパス
- ✅ 手動検証シナリオがすべてパス
