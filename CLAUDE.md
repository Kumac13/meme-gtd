# meme-gtd 開発ガイド

## CLAUDE.md Writing Guidelines

**When updating this file, apply these principles (based on Anthropic's official recommendations):**

1. **Use emphasis for critical rules**: "IMPORTANT", "YOU MUST", "<critical-safety>" tags
2. **Provide concrete examples**: Show exact commands, not abstract descriptions
3. **Keep it concise**: CLAUDE.md becomes part of every prompt—avoid overwhelming content
4. **Use structure**: XML-style tags, clear sections, bullet points over paragraphs
5. **Iterate based on AI behavior**: Test what actually improves instruction-following

**Critical safety rules belong in:**
- Prominent position (early in file, impossible to miss)
- Both positive examples (✅ do this) and negative examples (❌ never do this)
- Clear explanation of consequences (e.g., "wipes production DB")

## 参照資料

1. **`docs/gtd.md`** - GTDワークフローの概念図
2. **`docs/requirements.md`** - 実装要件とデータモデル（最重要）
3. **`docs/cli-commands.md`** - CLIコマンド仕様
4. **GitHub CLI (`gh`)** - UX設計の参照元（`gh issue`, `gh project`コマンド）

## 開発時の原則

- ファイル作成・更新前に内容を提示して承認を得る
- CLIコマンドのオプションは全て明示的に記載（省略表記禁止）
- GitHub CLIのコマンド仕様は公式ドキュメントで必ず確認
- コマンド・ファイルは全体を提示（部分的な省略禁止）
- 実装前に`docs/requirements.md`を必ず参照
- **新しいコマンド追加時は必ず`packages/cli/src/index.ts`の`MULTIWORD_COMMANDS`配列に登録する**（スペース区切り構文の必須要件）
- **バックエンド（API/DB）を変更・追加する際は、必ず対応するテストを書くこと**（テストなしでのバックエンド変更は禁止）

## <critical-safety>Push前のローカル検証（必須）</critical-safety>

**IMPORTANT: git push する前に必ずローカルでCIと同じチェックを実行すること**

```bash
pnpm --filter meme-gtd-api lint && pnpm --filter meme-gtd-api openapi:validate && pnpm --filter meme-gtd-api test && pnpm build
```

1. コード変更
2. `pnpm --filter meme-gtd-api lint` - ESLintエラーがないことを確認
3. `pnpm --filter meme-gtd-api openapi:validate` - OpenAPI specが有効であることを確認
4. `pnpm --filter meme-gtd-api test` - テストが全て通ることを確認
5. `pnpm build` - ビルドが成功することを確認
6. 全て通ったら `git commit && git push`

## ユーザーへの確認前にビルドすること

**IMPORTANT: PRやコード変更をユーザーに報告・確認を求める前に、必ずビルドして動作確認すること**

ユーザーに「確認してください」と言う前に自分で確認する。ビルドエラーや動作不良をユーザーに発見させない。

## アプリ内言語の統一（英語）

**IMPORTANT: Web UI、CLI出力、エラーメッセージなど、アプリケーション内の全てのユーザー向けテキストは英語で統一する**

- ボタンラベル、フォームラベル、プレースホルダー: 英語
- エラーメッセージ、成功メッセージ: 英語
- CLI出力、ヘルプテキスト: 英語
- コメント、ドキュメント: 日本語OK（開発者向け）

## ユーザーとの対話ルール

**IMPORTANT: ユーザーとの対話は以下のルールに従うこと**

- 常に日本語で応答する
- 丁寧語、ですます調を使用する（執事のように）
- 絵文字は使用しない

## <critical-safety>AI Safety: Test Environment Usage</critical-safety>

**IMPORTANT - YOU MUST READ THIS BEFORE ANY CLI OPERATION**

### Past Incident (Issue #48)
AI accidentally **wiped production database** (172KB → 0KB) by executing `mgtd` commands directly during testing.

### Absolute Rule

**✅ CORRECT - Use test wrapper:**
```bash
pnpm mgtd:test task create -t "Test" --no-editor
pnpm mgtd:test memo list --json
pnpm mgtd:test project create "Test Project"
```

**❌ WRONG - Direct execution (DESTROYS PRODUCTION):**
```bash
mgtd task create -t "Test"        # 🚨 DANGER: Modifies production DB
mgtd memo list                     # 🚨 DANGER: Reads production DB
mgtd project create "Test Project" # 🚨 DANGER: Writes to production
```

### Why This Matters

- `mgtd` defaults to production DB: `~/.local/share/mgtd/issues.db`
- `pnpm mgtd:test` automatically sets test environment:
  - `DB_PATH=$PWD/test-data/test.db`
  - `MGTD_CONFIG_PATH=$PWD/test-data/context.json`
- **One mistake = complete data loss**

### YOU MUST
1. Always use `pnpm mgtd:test` for CLI operations
2. Never run `mgtd` directly
3. Verify production DB unchanged after testing

## 本番環境とテスト環境の完全分離（厳守）

**🚨 絶対ルール**: 開発・検証・テストでは**必ずテスト環境**を使用。本番環境には**絶対に触れない**。

### 環境定義

#### 本番環境（Production）
- **DB**: `~/.local/share/mgtd/issues.db`（172KB以上の実データ）
- **Config**: `~/.config/mgtd/context.json`（本番DBパスを記載）
- **APIサーバー**: ポート3000（`pnpm server:start`）
- **Web UI**: http://localhost:3000（APIサーバーから配信）
- **CLI**: デフォルト設定（環境変数なし）

#### テスト環境（Test/Development）
- **DB**: `./test-data/test.db`（プロジェクトルート配下）
- **Config**: テスト用一時config（環境変数で指定）
- **APIサーバー**: ポート3001（`pnpm server:dev`）
- **Web UI**: http://localhost:3001（APIサーバーから配信）
- **CLI**: 環境変数でテストDB指定

### 厳守事項

#### ✅ 必ず実行すること
- 検証・テストは**必ずテスト環境**（ポート3001、test-data/test.db）を使用
- API検証は `curl http://localhost:3001/api/...` を使用
- **CLI検証は必ず `pnpm mgtd:test` を使用**（test wrapper - 上記「AI Safety」セクション参照）
- Web UI検証は http://localhost:3001 にアクセス

#### ❌ 絶対禁止
- **本番DB（~/.local/share/mgtd/issues.db）への読み書き**
- **本番APIサーバー（ポート3000）へのアクセス**
- **本番Web UI（http://localhost:3000）での検証**
- **`mgtd`コマンドの直接実行**（デフォルトで本番DBを使用、必ず `pnpm mgtd:test` を使用）

### テスト環境の使用方法

#### APIサーバー検証
```bash
# テストAPIサーバー起動（ポート3001、test-data/test.db使用）
pnpm server:dev

# API検証（必ずポート3001を使用）
curl http://localhost:3001/api/memos
curl http://localhost:3001/api/tasks
```

#### Web UI検証
```bash
# テストAPIサーバーが起動していることを確認
# ブラウザで http://localhost:3001 にアクセス
```

#### CLI検証

**<critical-safety>IMPORTANT: YOU MUST use test wrapper for ALL CLI operations</critical-safety>**

**Past incident**: AI accidentally wiped production DB (172KB → 0KB) by running `mgtd` directly.

**✅ ALWAYS use this wrapper:**
```bash
# Task operations (test DB)
pnpm mgtd:test task create -t "Test Task" --no-editor
pnpm mgtd:test task list --json

# Memo operations (test DB)
pnpm mgtd:test memo create --body "Test memo" --no-editor
pnpm mgtd:test memo list --json

# Project operations (test DB)
pnpm mgtd:test project create "Test Project"
pnpm mgtd:test project list --json
```

**Why `pnpm mgtd:test` is required**:
- Automatically sets `DB_PATH=$PWD/test-data/test.db` (test database)
- Automatically sets `MGTD_CONFIG_PATH=$PWD/test-data/context.json` (test config)
- Prevents accidental production DB contamination

**❌ NEVER run `mgtd` directly** (uses production DB by default)

**First-time test DB initialization**:
```bash
pnpm mgtd:test init -d $PWD/test-data/test.db -f
```

#### 自動テスト（統合テスト）
```javascript
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mgtd-test-'));
const configPath = path.join(tmp, 'context.json');
const dbPath = path.join(tmp, 'issues.db');
const env = {
  ...process.env,
  MGTD_CONFIG_PATH: configPath
};

// この env を使ってコマンド実行
const init = runCli(['init', '-d', dbPath, '-f', '-j'], { env });
```

### 間違えた場合の対処

本番DBを誤って変更してしまった場合：
1. **即座に作業を停止**
2. 変更内容を報告
3. ユーザーの指示を仰ぐ

本番環境は実際のユーザーデータを含むため、一切の変更を加えてはならない。

## <critical-safety>本番DBマイグレーション手順</critical-safety>

**IMPORTANT: 本番DBへのマイグレーションはユーザーの明示的な指示がある場合のみ実行**

### マイグレーションが必要なケース

新しいスキーマバージョン（`schema/XXX_*.sql`）を追加した場合、本番DBにも適用が必要。

### 事前準備（必須）

```bash
# 1. 本番DBのバックアップを作成
cp ~/.local/share/mgtd/issues.db ~/.local/share/mgtd/backup/issues_$(date +%Y-%m-%d_%H%M%S).db

# 2. バックアップを確認
ls -la ~/.local/share/mgtd/backup/
```

### マイグレーション実行方法

**`mgtd init` は使用禁止**: 既存DBに対して `--force` なしでは実行拒否、`--force` ありではDB削除

**正しい方法**: sqlite3で直接SQLを実行

```bash
# マイグレーションファイルを直接実行
sqlite3 ~/.local/share/mgtd/issues.db < schema/XXX_migration_name.sql

# 実行結果を確認
sqlite3 ~/.local/share/mgtd/issues.db ".schema issues" | head -20
```

### マイグレーション後の確認

```bash
# 1. 新しいカラムが追加されていることを確認
sqlite3 ~/.local/share/mgtd/issues.db "PRAGMA table_info(issues);"

# 2. データ移行の結果を確認（移行SQLがある場合）
sqlite3 ~/.local/share/mgtd/issues.db "SELECT id, title, new_column FROM issues LIMIT 5;"

# 3. アプリケーションの動作確認
pnpm server:start  # 本番サーバー起動してエラーがないことを確認
```

### ロールバック手順

問題が発生した場合：

```bash
# バックアップから復元
cp ~/.local/share/mgtd/backup/issues_YYYY-MM-DD_HHMMSS.db ~/.local/share/mgtd/issues.db
```

## バージョン管理の自動実行

新機能の実装が完了し、PRを作成する前に、**必ず以下を実行する**：

### 1. バージョン番号の決定

`docs/versioning.md`のSemVerルールに従って判断：
- **Breaking Changes** → MAJOR（例: 0.1.0 → 1.0.0）
- **New Features** → MINOR（例: 0.1.0 → 0.2.0）
- **Bug Fixes** → PATCH（例: 0.1.0 → 0.1.1）

### 2. バージョン更新の実行

```bash
# ルートでバージョン更新（タグは作らない）
npm version [patch|minor|major] --no-git-tag-version

# 全パッケージのバージョンを同期
pnpm -r exec npm version $(node -p "require('./package.json').version") --no-git-tag-version

# 変更をステージング
git add .

# バージョンバンプのコミット（実装コミットとは別）
git commit -m "chore: bump version to vX.Y.Z"

# gitタグを作成
git tag vX.Y.Z
```

### 3. コミット構成

実装は**2つのコミット**に分ける：
1. **実装コミット**: `feat: 機能の説明` または `fix: 修正内容`
2. **バージョンコミット**: `chore: bump version to vX.Y.Z`

### 4. CHANGELOG.mdの事前更新

実装コミット時点で、CHANGELOGに新バージョンのエントリを含める（バージョン更新前に記載）。

### 注意事項

- **自動実行**: 人間から明示的な指示がなくても、新機能実装後は必ずバージョン更新を実行する
- **判断基準**: 実装内容からSemVerルールを適用して自動判断
- **例外**: ドキュメントのみの変更、テストのみの追加はバージョン更新不要

## 過去の指摘事項に基づく行動指針

- GitHub CLIを実装する前に公式仕様を必ず調査・確認する
- CLIコマンドのオプションは`[options]`などで省略せず全文を記載する
- ファイル内容は`...`で省略せず全体を提示する
- ファイルを書き出す際は事前に承認を得てから実行する
- 実装前に必ず`docs/requirements.md`を精読し、その内容に沿って実装する
- 機能実装後はバージョン更新とタグ作成を必ず実行する
- issueやドキュメントに記載された手順だけを実行し、不明点は都度確認して進める
- 指示から外れる判断が必要な場合は事前に確認を取る
- 実装中は論理的な区切りごとにコミットを作成し、変更は順次記録する
- 機能追加や変更時は関連ドキュメント（README.mdやdocs/）を必ず更新する

## Active Technologies
- TypeScript 5.5.4 / React 19.2.0 / Node.js 22+ (020-web-label-management)
- SQLite database (already implemented with `labels` and `issue_labels` tables) (020-web-label-management)
- TypeScript 5.5.4 / React 19.2.0 / Node.js 22+ + React Router DOM 7.9.4, Vite 7.1.11 (021-tasks-status-url)
- N/A (URL-based state only, no backend changes) (021-tasks-status-url)
- TypeScript 5.5.4, Node.js 22+ + React 19.2.0, React Router DOM 7.9.4, Fastify 5.2.0, better-sqlite3 (023-web-memo-task)
- SQLite database (already has promote endpoint implemented) (023-web-memo-task)
- TypeScript 5.5.4 / Node.js 22+ (024-tasks-memos-label)
- SQLite database with existing schema: (024-tasks-memos-label)
- SQLite (better-sqlite3) - existing `issues` table (025-a)
- TypeScript 5.5.4 / React 19.2.0 / Node.js 22+ + React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11, Tailwind CSS 4.1.14 (026-webui-save-comment)
- N/A (UI-only feature, no data model changes) (026-webui-save-comment)
- TypeScript 5.5.4 / Node.js 22+ + React 19.2.0, React Router DOM 7.9.4, Vite 7.1.11, Tailwind CSS 4.1.14 (029-task)
- N/A (クライアント側のみ、既存のAPIから取得したデータを使用) (029-task)
- SQLite (better-sqlite3) - 既存のissuesテーブルを使用 (001-webui)
- SQLite (better-sqlite3) - 既存の`links`テーブルを使用 (001-task-task-task)
- N/A（クライアントサイドのみ、既存APIを使用） (001-task-112-project)
- TypeScript 5.5.4 / Node.js 22.0.0+ + Fastify 5.2.0, @oclif/core 4.0.0, better-sqlite3 9.0.0, Zod 3.23.8 (001-demote)
- SQLite (既存のissues, links, issue_labels, issue_projectsテーブルを使用) (001-demote)
- TypeScript 5.5.4 + React 19.2.0, React Router DOM 7.9.4, Tailwind CSS 4.1.14 (001-link)
- N/A（既存API使用、バックエンド変更なし） (001-link)
- TypeScript 5.5.4 / React 19.2.0 / Node.js 22+ + react-markdown 10.1.0, remark-gfm 4.0.1, remark-breaks 4.0.0, rehype-raw (新規追加), rehype-sanitize (新規追加) (001-task-147-status)
- N/A (フロントエンドのみ、バックエンド変更なし) (001-task-147-status)
- TypeScript 5.5.4 / Node.js 22+ + Fastify 5.2.0, better-sqlite3, React 19.2.0, @oclif/core 4.0.0, Zod 3.23.8 (001-calendar-datetime-separation)

## Recent Changes
- 020-web-label-management: Added TypeScript 5.5.4 / React 19.2.0 / Node.js 22+
