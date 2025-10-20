# Implementation Plan: Link Command for Task Relationship Management

**Branch**: `008-https-github-com` | **Date**: 2025-10-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-https-github-com/spec.md`

## Summary

linkコマンドの実装により、タスクとメモ間の関係性を管理する機能を提供します。既存のデータベーステーブル（`links`）に対応するCLIコマンド（`mgtd link add`、`mgtd link list`、`mgtd link remove`）を実装し、GTDワークフローにおけるタスクの階層化・関連付けを可能にします。

技術的アプローチ：
- 既存のoclifフレームワークとコマンド構造を踏襲
- `packages/db`に`linkRepository.ts`を追加
- `packages/cli/src/commands/link/`配下にサブコマンドを実装
- 既存のtask/memoコマンドと同様のパターンで実装

## Technical Context

**Language/Version**: TypeScript (Node.js 22.0.0以上)
**Primary Dependencies**: @oclif/core (CLI framework), better-sqlite3 (database), meme-gtd-shared (shared types)
**Storage**: SQLite (既存の`links`テーブルを使用 - schema/001_init.sqlで定義済み)
**Testing**: Vitest (packages/*/test/*.test.ts)
**Target Platform**: macOS/Linux CLI
**Project Type**: モノレポ（pnpm workspaces） - 複数パッケージ構成
**Performance Goals**: CLI応答時間 < 1秒、リンク操作はシンプルなCRUD操作のため高速
**Constraints**: 既存のコマンド構造・命名規則に従う、JSON出力対応必須
**Scale/Scope**: 小規模機能追加（3つのサブコマンド、1つのリポジトリファイル）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: プロジェクトのconstitution.mdはテンプレート状態のため、既存の実装パターンから推測される原則を適用：

### ✅ パッケージ分離原則
- **Status**: 準拠
- **Rationale**: 既存パターン（db/repository、cli/commands、core/services）に従い、linkRepository（db層）とlinkコマンド（cli層）を分離

### ✅ CLI一貫性原則
- **Status**: 準拠
- **Rationale**: 既存コマンド（task、memo、label）と同じoclif構造、JSON出力対応、エラーハンドリングパターンを踏襲

### ✅ テスト必須原則
- **Status**: 準拠予定
- **Rationale**: 既存の`packages/db/test/`、`packages/core/test/`パターンに従い、linkRepository.test.tsを実装

### ✅ シンプルさ優先
- **Status**: 準拠
- **Rationale**: 新規抽象化なし、既存のRepository/Serviceパターンを再利用、linksテーブルへの単純なCRUD操作のみ

## Project Structure

### Documentation (this feature)

```
specs/008-https-github-com/
├── spec.md              # 機能仕様（完成）
├── plan.md              # このファイル
├── research.md          # Phase 0で生成
├── data-model.md        # Phase 1で生成
├── quickstart.md        # Phase 1で生成
├── contracts/           # Phase 1で生成（CLI I/O contract）
│   ├── link-add.md
│   ├── link-list.md
│   └── link-remove.md
├── checklists/          # 品質チェックリスト
│   └── requirements.md  # 仕様品質チェック（完成）
└── tasks.md             # Phase 2で生成（/speckit.tasksコマンド）
```

### Source Code (repository root)

```
packages/
├── db/                          # データアクセス層
│   ├── src/
│   │   ├── index.ts            # エクスポート（linkRepositoryを追加）
│   │   ├── linkRepository.ts   # 【新規】リンクCRUD操作
│   │   ├── memoRepository.ts
│   │   ├── taskRepository.ts
│   │   ├── labelRepository.ts
│   │   └── migrate.ts
│   └── test/
│       ├── linkRepository.test.ts  # 【新規】リポジトリテスト
│       ├── memoRepository.test.ts
│       └── taskRepository.test.ts
│
├── core/                        # ビジネスロジック層（今回は不要の可能性）
│   ├── src/
│   │   └── index.ts
│   └── test/
│
├── cli/                         # CLIコマンド層
│   ├── src/
│   │   └── commands/
│   │       ├── link.ts         # 【新規】ルートコマンド
│   │       ├── link/           # 【新規】サブコマンド
│   │       │   ├── add.ts      # mgtd link add実装
│   │       │   ├── list.ts     # mgtd link list実装
│   │       │   └── remove.ts   # mgtd link remove実装
│   │       ├── task/
│   │       ├── memo/
│   │       └── label/
│   └── test/
│       └── (必要に応じて統合テスト)
│
├── shared/                      # 共通型定義
│   └── src/
│       └── types.ts            # Link型の追加（必要に応じて）
│
└── config/                      # 設定管理
└── logger/                      # ロギング

schema/
└── 001_init.sql                # linksテーブル定義（既存）
```

**Structure Decision**:
既存のモノレポ構造を維持し、linkコマンドは以下の配置：
- **データ層**: `packages/db/src/linkRepository.ts`（新規作成）
- **CLI層**: `packages/cli/src/commands/link/`配下（新規ディレクトリ）
- **テスト**: 各パッケージの`test/`ディレクトリに配置

core層（ビジネスロジック）は、リンク操作がシンプルなCRUDのため不要と判断。必要に応じてPhase 1で再評価。

## Complexity Tracking

*今回の実装では違反なし - 既存パターンに完全準拠*

該当なし。linkコマンドは既存のコマンド構造（task、memo、label）と同じアーキテクチャパターンで実装可能。

---

## Constitution Check Re-evaluation (Post Phase 1 Design)

*再評価日: 2025-10-18*

### ✅ パッケージ分離原則
- **Status**: ✅ 準拠確認
- **Evidence**:
  - `packages/db/src/linkRepository.ts` - データアクセス層
  - `packages/core/src/linkService.ts` - ビジネスロジック層（research.mdで決定）
  - `packages/cli/src/commands/link/` - CLI層
  - 各レイヤーの責務が明確に分離されている

### ✅ CLI一貫性原則
- **Status**: ✅ 準拠確認
- **Evidence**:
  - contracts/で定義したI/Oフォーマットは既存コマンド（label、task）と統一
  - JSON出力対応（`--json` flag）
  - エラーハンドリングパターン（`this.error(message, {exit: 1})`）
  - フラグ命名規則（`--yes`, `--json`）の一貫性

### ✅ テスト必須原則
- **Status**: ✅ 計画済み
- **Evidence**:
  - quickstart.mdで手動テストシナリオ定義
  - 自動テスト計画: `linkRepository.test.ts`、`linkService.test.ts`
  - contractsで各コマンドのテストケース明記

### ✅ シンプルさ優先
- **Status**: ✅ 準拠確認
- **Evidence**:
  - 新規抽象化レイヤーなし（Repository + Service + CLI の3層のみ）
  - 既存の`Link`型定義を再利用（meme-gtd-shared）
  - SQLクエリはシンプル（prepared statements、JOIN不要）
  - Phase 1で実装する機能を最小限に絞った（MVP focused）

### 追加確認事項

#### データ整合性の保証
- **Status**: ✅ DB制約で保証
- **Evidence**:
  - FK制約による参照整合性（`FOREIGN KEY ... ON DELETE CASCADE`）
  - CHECK制約によるlinkType検証
  - アプリケーション層でのバリデーション（重複、自己参照）

#### 外部依存の追加
- **Status**: ✅ 新規依存なし
- **Evidence**:
  - 既存パッケージのみ使用（@oclif/core、better-sqlite3、meme-gtd-shared）
  - 確認プロンプトは標準ライブラリ（readline）またはinquirerで対応（既存プロジェクトで確認必要）

#### パフォーマンス考慮
- **Status**: ✅ 問題なし
- **Rationale**:
  - シンプルなCRUD操作（複雑なグラフ探索なし、MVP段階）
  - SQLiteの標準パフォーマンスで十分（< 1秒応答時間）
  - Index追加はPhase 2で検討（データ量増加時のみ）

---

## Phase Summary

### Phase 0: Research ✅
- **Deliverable**: research.md
- **Key Decisions**: Repository pattern、Service layer、CLI structure
- **Status**: Complete

### Phase 1: Design & Contracts ✅
- **Deliverables**:
  - data-model.md ✅
  - contracts/link-add.md ✅
  - contracts/link-list.md ✅
  - contracts/link-remove.md ✅
  - quickstart.md ✅
- **Status**: Complete

### Phase 2: Task Generation (Next Step)
- **Command**: `/speckit.tasks`
- **Output**: tasks.md（実装タスクのリスト）
- **Prerequisites**: Phase 0 & 1完了 ✅

---

## Ready for Implementation ✅

全ての設計フェーズが完了しました。次のステップ：

```bash
/speckit.tasks
```

これにより、spec.mdのユーザーストーリーに基づいた実装タスクリスト（tasks.md）が生成されます。
