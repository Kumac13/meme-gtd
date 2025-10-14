# init / memo 実装ロードマップ（更新用）

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

### 🔧 要件不一致の修正計画（v0.1.1）

**背景**: `docs/cli_requirement.md` との照合により、以下の要件不一致が判明。GitHub CLI 準拠の原則に従い修正が必要。

#### 1. オプション命名規則の統一（kebab-case 化）

**問題点**:
- ❌ 現状: `--bodyFile`, `--addLabel`, `--removeLabel`, `--setLabel` (camelCase)
- ✅ 要件: `--body-file`, `--add-label`, `--remove-label` (kebab-case, GitHub CLI 準拠)

**影響範囲**: `memo create`, `memo edit`, `memo promote`, `memo comment add/edit`

**修正内容**:
- [ ] 全 memo コマンドのフラグ定義を kebab-case に変更
- [ ] テストコード・ドキュメントの表記を更新

#### 2. `--editor` / `--no-editor` フラグの追加

**要件（cli_requirement.md:157, 211）**:
- `memo create`: `--editor` / `--no-editor` で強制起動/抑止
- `memo edit`: 既存本文をエディタで編集（デフォルト動作）
- `memo comment add`: エディタでコメント作成

**問題点**:
- ❌ 現状は「本文が空の場合に自動起動」のみで、明示的な制御ができない
- ❌ `--body` 指定時でも `--editor` で上書き編集できるべき（GitHub CLI 準拠）

**修正内容**:
- [ ] `memo create` に `--editor` / `--no-editor` フラグを追加
- [ ] `memo edit` に `--editor` / `--no-editor` フラグを追加
- [ ] `memo comment add` に `--editor` / `--no-editor` フラグを追加
- [ ] エディタ起動ロジックをフラグ優先度に従って整理

**期待される動作**:
```bash
# 既存本文をエディタで編集（デフォルト）
mgtd memo edit 12

# エディタを強制起動（--body 指定時も上書き編集）
mgtd memo edit 12 --body "draft" --editor

# エディタを抑止（--body のみ適用）
mgtd memo edit 12 --body "final" --no-editor
```

#### 3. `--set-label` の削除（機能重複の解消）

**問題点**:
- `memo edit --set-label` と `memo label set` が機能重複
- GitHub CLI には `--set-label` が存在しない（`--add-label` / `--remove-label` のみ）

**修正内容**:
- [ ] `memo edit` から `--set-label` フラグを削除
- [ ] ラベルの完全置換は `memo label set` コマンドに一元化
- [ ] `packages/db/src/memoRepository.ts` の `setMemoLabels` 関数は保持（`memo label set` で使用）

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
