# init / memo 実装ロードマップ（更新用）

> **注意（アーカイブ文書）**: 本書は初期実装時のロードマップであり、既に完了済み。現状の把握には `docs/architecture.md` を参照すること。

最終更新: 2025-10-14（担当: assistant）

---

## 進捗サマリ（2025-10-14）

### ✅ 完了済み（v0.1.0）

- ✅ TypeScript + oclif / pnpm ワークスペース構成を整備し、`mgtd init` / `mgtd memo` コマンドを実装。
- ✅ `schema/001_init.sql` に全テーブルと FTS トリガを定義し、`applyMigrations` から適用可能にした。
- ✅ `context.json` の仕様を `docs/requirement.md` に追記し、`docs/cli_requirement.md` に CLI シーケンス図を追加。
- ✅ `pnpm run mgtd:install` でグローバルに CLI を導入できるようスクリプトを整備し、`~/.local/bin/mgtd` へシンボリックリンクを作成する方式に統一。
- ✅ DB/CORE 向けの node:test テストを追加し、`pnpm test` が成功することを確認。
- ✅ README を更新し、インストール・動作確認・テスト手順を明記。
- ✅ CLI ヘルプ体系を刷新し、スペース区切りのサブコマンドでも `--help` が整形出力されるようにした（`src/index.ts` の正規化と各コマンド metadata を追加）。
- ✅ `mgtd completion` コマンドを追加し、bash / zsh / fish 向けスクリプトを内蔵・配布できるようにした。
- ✅ `scripts/completions/` および README に補完導入手順を反映。
- ✅ `CHANGELOG.md` を作成し、0.1.0 の変更履歴を整理。
- ✅ CLI 統合テスト（help コマンド検証 / e2e 動作確認）を追加し、`pnpm test` で自動実行されるよう整備。
- ✅ `scripts/package-cli.mjs` で `pnpm mgtd:pack` によるパッケージ生成フローを整備。

### ✅ 完了済み（v0.1.1 - 2025-10-14）

**背景**: `docs/cli_requirement.md` との照合により、要件不一致が判明し修正完了。

#### 1. ✅ オプション命名規則の統一（kebab-case 化）

**修正内容**:
- ✅ 全 memo コマンドのフラグ定義を kebab-case に変更
  - `--bodyFile` → `--body-file`
  - `--addLabel` → `--add-label`
  - `--removeLabel` → `--remove-label`
- ✅ 旧 camelCase フラグの検出とエラーメッセージ表示機能を追加
- ✅ テストコード追加（7テスト）

**影響範囲**: `memo create`, `memo edit`, `memo promote`, `memo comment add/edit`

#### 2. ✅ `--editor` / `--no-editor` フラグの追加

**実装内容**:
- ✅ `memo create` に `--editor` / `--no-editor` フラグを追加
- ✅ `memo edit` に `--editor` / `--no-editor` フラグを追加
- ✅ `memo comment add` に `--editor` / `--no-editor` フラグを追加
- ✅ エディタ起動ロジックをフラグ優先度に従って整理
- ✅ `maybePromptEditor()` ヘルパー関数を実装
- ✅ TDDアプローチでテスト先行開発（13テスト）

**実現された動作**:
```bash
# 既存本文をエディタで編集（デフォルト）
mgtd memo edit 12

# エディタを強制起動（--body 指定時も上書き編集）
mgtd memo edit 12 --body "draft" --editor

# エディタを抑止（--body のみ適用）
mgtd memo edit 12 --body "final" --no-editor
```

#### 3. ✅ `--set-label` の削除（機能重複の解消）

**修正内容**:
- ✅ `memo edit` から `--set-label` フラグを削除
- ✅ ラベルの完全置換は `memo label set` コマンドに一元化
- ✅ `packages/db/src/memoRepository.ts` の `setMemoLabels` 関数は保持（`memo label set` で使用）
- ✅ 旧フラグ使用時の移行ガイダンスを表示
- ✅ テストコード追加（6テスト）

**品質保証**:
- ✅ 全30テスト合格
- ✅ CHANGELOG.md更新（v0.1.1エントリ）
- ✅ 破壊的変更の明確な文書化

### 🔄 今後の改善予定

- オートコンプリートの動的生成（将来的に `mgtd completion` コマンド化）
- リリースパッケージ化
- さらなる e2e テスト強化

---

## 備考

- 動作確認例:
  ```bash
  pnpm install
  pnpm build
  pnpm run mgtd:install
  export PATH="$HOME/.local/bin:$PATH"
  mgtd init --db ~/.local/share/mgtd/issues.db --force
  mgtd memo create --body 'first memo' --label test
  mgtd memo list --json
  mgtd memo --help
  ```
- Node 22.18.0 上での開発を前提。Node 24 系を利用する場合は `pnpm rebuild better-sqlite3` を推奨。
