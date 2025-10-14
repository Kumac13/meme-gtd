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

## 過去の指摘事項

- GitHub CLIの仕様を調査せずに実装
- オプション一覧を`[options]`で省略
- ファイル内容を`...`で省略
- 承認なしにファイルを書き出し
- requirements.mdを読まずに推測で実装
- **バージョン管理を忘れる（機能実装後、必ずバージョン更新とタグ作成を実行すること）**
