---
name: release
description: Version bump and release procedure for meme-gtd. Use after completing any new feature or bug fix implementation (mandatory per CLAUDE.md, even without explicit instruction), or when the user asks to release, bump the version, or create a tag. Covers SemVer decision, CHANGELOG.md update, cross-package version sync, commit structure, and git tag.
---

# Release / バージョンバンプ手順

新機能・修正の実装完了後に**必ず**実行する（人間からの明示的な指示がなくても自動実行）。
このスキルがリリース手順の唯一の正。バージョニングポリシー（Fixed Versioning・1.0.0基準）は `docs/versioning.md` を参照。

## 例外（バージョンバンプ不要）

- ドキュメントのみの変更
- テストのみの追加

## 1. バージョン番号の決定（SemVer）

| 変更内容 | バンプ | 例 |
|---|---|---|
| Breaking Changes（API互換性が壊れる変更） | MAJOR | 0.1.0 → 1.0.0 |
| New Features（後方互換の機能追加） | MINOR | 0.1.0 → 0.2.0 |
| Bug Fixes（後方互換のバグ修正） | PATCH | 0.1.0 → 0.1.1 |

## 2. CHANGELOG.md の更新（実装コミットに含める）

**バージョン更新前に**、実装コミットの時点で CHANGELOG.md に新バージョンのエントリを記載する。
フォーマット（simplified Keep a Changelog、既存エントリの書き方に合わせる。説明は日本語）:

```markdown
## X.Y.Z - YYYY-MM-DD

### Breaking Changes
- 破壊的変更の説明
  - ユーザー向け移行手順

### New Features
- 新機能の説明
  - 使用例や補足

### Bug Fixes
- バグ修正の説明
  - 何が壊れていたかの背景

### Tests
- テストの追加・更新
```

## 3. コミット構成（必ず2コミットに分ける）

1. **実装コミット**: `feat: 機能の説明` または `fix: 修正内容`（CHANGELOG.md のエントリを含む）
2. **バージョンコミット**: `chore: bump version to vX.Y.Z`

## 4. バージョン更新コマンド

```bash
# ルートでバージョン更新（タグは作らない）
npm version [patch|minor|major] --no-git-tag-version

# 全パッケージのバージョンを同期
pnpm -r exec npm version $(node -p "require('./package.json').version") --no-git-tag-version

# 変更をステージング
git add .

# バージョンバンプのコミット（実装コミットとは別）
git commit -m "chore: bump version to vX.Y.Z"

# gitタグを作成（vプレフィックス必須）
git tag vX.Y.Z
```

## 5. Push（明示的な指示がある場合のみ）

Push前に必ずローカル検証を通すこと（CLAUDE.md「Push前のローカル検証」参照）:

```bash
pnpm --filter meme-gtd-api lint && pnpm --filter meme-gtd-api openapi:validate && pnpm --filter meme-gtd-api test && pnpm build && pnpm knip
```

```bash
git push && git push --tags
```

## 注意事項

- タグは push 後に削除・移動しない（履歴は不変）
- タグは CHANGELOG.md とバージョン番号を更新したコミットを指すこと
- 新機能・スキーマ変更の場合は `README.md` と関連 `docs/` の更新も完了していること（更新トリガー表: `docs/CLAUDE.md`）
