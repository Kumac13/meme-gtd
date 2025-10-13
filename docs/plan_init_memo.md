# init / memo 実装ロードマップ（更新用）

最終更新: 2025-10-09（担当: assistant）

---

## 0. 現状の把握

- リポジトリにはまだアプリケーションコードが存在しない（`docs/` のみ）。  
- これから CLI 実装を始めるため、プロジェクト構成・依存ライブラリ・テスト方針をゼロから定義する必要がある。  
- 必須成果物: `mgtd` CLI バイナリ、SQLite スキーマ・マイグレーション、各種テスト、README/補完スクリプト。

---

## 進捗サマリ（2025-10-09）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を確定し、パッケージ雛形を整備。  
- ✅ `schema/001_init.sql` を作成し、issues/labels/comments/links/projects など全テーブルと FTS トリガを定義。  
- ✅ `meme-gtd-config`・`meme-gtd-logger`・`meme-gtd-shared`・`meme-gtd-db`・`meme-gtd-core` を実装し、CLI から利用できる基盤を整備。  
- ✅ `mgtd init` および `mgtd memo` 系サブコマンド（create/list/view/edit/delete/promote/comment/label）を実装。  
- 🔄 未完了: 設定仕様ドキュメント追記（S5）、CLI UX シーケンス図（S6）、テスト整備（B3, I5, 4.3）、README/補完スクリプトなど文書仕上げ（フェーズ5）。

---

## 1. 調査・設計フェーズ

| ID | タスク | 詳細 | 担当 | 期限 | 状態 |
|----|--------|------|------|------|------|
| S1 | 実装言語・CLIフレームワーク決定 | **決定**: TypeScript (Node.js 22) + `@oclif/core`。理由: TypeScript エコシステムとの親和性、CLI 開発の柔軟性。 | assistant | 2025-10-09 | ☑ |
| S2 | ディレクトリ構成の策定 | **決定**: `packages/cli` (oclif), `packages/core`, `packages/db`, `packages/config`, `packages/shared`. pnpm ワークスペースで管理。 | assistant | 2025-10-09 | ☑ |
| S3 | SQLite アクセスライブラリ調査 | **決定**: `better-sqlite3` を直接利用し、マイグレーションは自前適用（`migrate.ts`）で運用。FTS5 対応は手動検証済み。 | assistant | 2025-10-09 | ☑ |
| S4 | スキーマドラフト作成 | schema/001_init.sql (SQLite) 作成済み。列型/インデックス/FTS トリガを実装。 | assistant | 2025-10-09 | ☑ |
| S5 | 設定ファイル仕様決定 | `context.json` に `dbPath`, `mode`, `schemaVersion`, `updatedAt` を保持。優先度: CLIフラグ > ENV > config > default。仕様を docs に追記。 | assistant | 2025-10-11 | ☐ |
| S6 | CLI UX 詳細設計 | サブコマンドごとのシーケンス図を作成し、エラー時の戻り値とメッセージパターンを定義。 | assistant | 2025-10-11 | ☐ |

アウトプット: 言語/ライブラリ決定メモ、schema/001_init.sql (SQLite) 草案、設定仕様メモ、CLI フロー図。

---

## 2. 開発基盤構築フェーズ

| ID | タスク | 詳細 | 担当 | 状態 |
|----|--------|------|------|------|
| B1 | プロジェクト初期化 | `pnpm init`, `pnpm dlx oclif multi mgtd`, TypeScript 設定。 | assistant | ☐ |
| B2 | 共通ユーティリティ実装 | `packages/config` に設定ローダ (`dotenv`, JSON 読み込み)、`packages/logger` に `pino` ベースのロガーを用意。 | assistant | ☐ |
| B3 | テスト基盤整備 | `vitest` + `zx` で CLI テスト。`test/fixtures/` に SQLite 初期データを配置。 | assistant | ☐ |
| B4 | ビルド＆ラン手順 | `package.json` / `pnpm` スクリプトに `build`, `test`, `lint`, `dev`, `mgtd` を定義。必要なら `Makefile` / `justfile` を補助的に利用。 | assistant | ☐ |

---

## 3. `mgtd init` 実装フェーズ

| ステップ | タスク内容 | 詳細 |
|----------|------------|------|
| I1 | スキーマ実装 | schema/001_init.sql (SQLite) を確定し、適用用コマンド／マイグレーションランナーを作成。 |
| I2 | 初期化ロジック | `mgtd init` で SQLite ファイルを作成、スキーマ適用、`context.json` 生成。 |
| I3 | オプション実装 | `--db`, `--force`, `--dry-run`, `--json` の実装と出力整形。 |
| I4 | 安全対策 | 既存ファイル検知、権限不足エラー、パスの自動ディレクトリ作成、ロールバック戦略。 |
| I5 | テスト | 単体テスト: ファイル生成可否、dry-run 結果。統合テスト: コマンドを実行し DB が作成されているか検証。 |

成果物: `packages/cli/src/commands/init.ts`, `packages/db/src/migrate.ts`, テストケース、ドキュメント更新。

---

## 4. `mgtd memo` 実装フェーズ

### 4.1 DAO / データ層

- `packages/db/src/issues.ts`: memo レコード CRUD（insert/select/update/delete）。
- `packages/db/src/comments.ts`, `packages/db/src/labels.ts`, `packages/db/src/links.ts`。
- FTS テーブル生成 (`issues_fts` など) と同期トリガ。

### 4.2 CLI サブコマンド実装

| サブコマンド | 必要処理 | 備考 |
|--------------|----------|------|
| `memo create` | 本文入力、ラベル付与、プロジェクト追加、JSON/表出力 | `$EDITOR` 起動、`--body-file` 対応 |
| `memo list` | フィルタ（ラベル、検索、ソート）、ページング、JSON | FTS クエリ、論理削除除外 |
| `memo view` | 本文＋コメント＋リンクの表示、JSON | `--comments` 対応 |
| `memo edit` | 本文更新、ラベル追加/削除、プロジェクト変更、履歴記録 | トランザクション必要 |
| `memo delete` | 論理削除 (`is_deleted=true`)、`--yes` サポート | |
| `memo promote` | Task レコード生成、`derived_from` リンク追加、タスク表示 | Task 側 API 呼び出し |
| `memo comment ...` | コメント CRUD + 履歴保存 | |
| `memo label ...` | ラベル付け替え、一覧表示 | |

### 4.3 テスト

- DAO 単体テスト（各テーブルの CRUD と制約確認）
- CLI 統合テスト（fixture DB + snapshot/golden ファイル）
- エラーパス検証（存在しない ID、型不一致、バリデーション失敗）

---

## 5. 文書・補完・リリース整備

- README に `mgtd init` / `mgtd memo` の使用例とセットアップ手順を追加。
- `docs/cli_requirement.md` を最新実装に合わせて更新。
- zsh / fish 向け補完スクリプト生成。
- CHANGELOG エントリとリリースノート草案作成。
- 手動 E2E 確認（`init` → `memo create` → `memo promote` → `task list` の一連フロー）。

---

## リスク・検討事項

- SQLite ファイル配置パスと権限（`mgtd init` で失敗しやすい点の洗い出し）
- スキーマバージョンアップ時のマイグレーション戦略
- 大量データ時のパフォーマンス（FTS インデックス、リストのページング）
- 将来予定の MCP 連携に向けた API 抽象化（CLI コマンドから分離されたサービス層が必要）

---

進捗に応じて各タスクの assignee・期限・状態を更新し、この計画を運用する。
