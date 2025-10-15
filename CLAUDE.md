# meme-gtd 開発ガイド

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
- 実装前に必ず`docs/requirements.md`を精読し、推測で実装しない
- 機能実装後はバージョン更新とタグ作成を必ず実行する
- issueやドキュメントの指示に忠実に従い、不要な推測や解釈を加えない
- 指示から外れる判断が必要な場合は事前に確認を取る
- 実装は論理的な区切りごとに小まめにコミットし、一度にまとめてコミットしない
- 機能追加や変更時は関連ドキュメント（README.mdやdocs/）を必ず更新する
