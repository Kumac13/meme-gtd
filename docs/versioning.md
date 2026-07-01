# バージョン管理ポリシー

> 目的: バージョニング方針（Fixed Versioning・SemVer判断基準・タグ/CHANGELOG規約）の定義
> 読むタイミング: バージョン番号の判断に迷ったとき、リリースルールを変更するとき
> 更新タイミング: バージョニングルール自体を変更するときのみ

実行手順（コマンド・コミット構成）は **release スキル** が唯一の正。本書はポリシーのみを定義する。

## Fixed Versioning（全パッケージ同一バージョン）

モノレポ内の全パッケージはルート `package.json` をマスターとして同一バージョンを共有する。

理由: 全パッケージが `private: true` で npm 非公開、`workspace:*` で密結合、配布物は単一のCLIツール（`mgtd`）。ユーザーが追うべきバージョン番号を1つにする。

## SemVer 判断基準

SemVer 2.0.0（`MAJOR.MINOR.PATCH`）に従う。

| 種別 | バンプ | 判断基準 | 例 |
|------|--------|---------|-----|
| Breaking Changes | MAJOR | 既存ユーザーがコマンド・スクリプトの変更を強いられる（フラグ改名、コマンド削除、出力形式の非互換変更） | `--body-file` → `--file` の改名 |
| New Features | MINOR | 後方互換の機能追加（新コマンド、新フラグ、既存機能の拡張） | `memo list --search` の追加 |
| Bug Fixes | PATCH | 後方互換のバグ修正、ユーザーに見えない内部リファクタリング、性能改善 | 削除コマンドのクラッシュ修正 |

判断に迷ったら「既存ユーザーはコマンドやスクリプトを変える必要があるか？」で判定する。Yesなら Breaking。判断がつかない場合は MINOR に倒す。

### バンプ不要の例外

- ドキュメントのみの変更
- テストのみの追加

### 1.0.0 の基準

コア機能が安定しテストが十分で、Breaking Changes が収束し、本番利用に耐えるドキュメントが揃った時点で 1.0.0 をリリースする。

## リリース方式

手動リリース（`npm version` ベース）。semantic-release / standard-version 等の自動化は使わない
（npm 非公開・リリース頻度が低い・キュレーションされたリリースノートを重視するため。頻度が大きく上がったら再検討）。

複数の機能を1リリースに束ねてよい。バンプは機能ごとではなくリリースごとに行い、開発中はバンプしない。

## Git タグ規約

- 形式: `vMAJOR.MINOR.PATCH`（`v` プレフィックス必須。例: `v0.2.0`）
- タグは CHANGELOG.md とバージョン番号を更新したコミットを指す
- push 済みのタグは削除・移動しない（履歴は不変）

## CHANGELOG 規約

ルートの `CHANGELOG.md` を手動で管理する（simplified [Keep a Changelog](https://keepachangelog.com/)。説明は日本語）。

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

| カテゴリ | 使うとき |
|----------|---------|
| Breaking Changes | 互換維持にユーザー側の対応が必要な変更（移行手順を必ず書く） |
| New Features | 機能追加 |
| Bug Fixes | 既存挙動の修正 |
| Tests | テストスイートの改善 |

## 参照

- [Semantic Versioning 2.0.0](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
