# Feature Specification: Version Command Implementation

**Feature Branch**: `004-https-github-com`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "https://github.com/Kumac13/meme-gtd/issues/5 を進めたい"

## User Scenarios & Testing

### User Story 1 - Display Version with --version Flag (Priority: P1) 🎯 MVP

ユーザーが`mgtd --version`を実行すると、現在インストールされているCLIのバージョン番号が表示される。これにより、ユーザーは自分が使用しているバージョンを確認でき、サポート時のトラブルシューティングやアップデート判断に役立つ。

**Why this priority**: バージョン確認は標準的なCLIツールの基本機能であり、ユーザーサポートやバグレポートに必須。最も基本的な機能として最優先で実装すべき。

**Independent Test**: `mgtd --version`を実行し、バージョン番号が表示されることを確認。

**Acceptance Scenarios**:

1. **Given** CLIがインストールされている状態で、**When** `mgtd --version`を実行する、**Then** 現在のバージョン番号（例: `0.1.0`）が標準出力に表示される
2. **Given** CLIがインストールされている状態で、**When** `mgtd --version`を実行する、**Then** コマンドは正常終了（終了コード0）する

---

### User Story 2 - Display Version with -v Short Flag (Priority: P2)

ユーザーが`mgtd -v`を実行すると、`--version`と同じ動作をする。短縮フラグにより、頻繁にバージョンを確認するパワーユーザーの操作性が向上する。

**Why this priority**: 短縮フラグは多くのCLIツールで標準的な慣習であり、ユーザー体験を向上させる。P1の実装後に追加する価値がある。

**Independent Test**: `mgtd -v`を実行し、`--version`と同じ出力が得られることを確認。

**Acceptance Scenarios**:

1. **Given** CLIがインストールされている状態で、**When** `mgtd -v`を実行する、**Then** 現在のバージョン番号が標準出力に表示される
2. **Given** CLIがインストールされている状態で、**When** `mgtd -v`を実行する、**Then** `--version`と同一の出力フォーマットで表示される

---

### User Story 3 - Version Command with Additional Information (Priority: P3)

ユーザーが`mgtd version`というサブコマンドを実行すると、バージョン番号に加えて追加情報（ビルド日時、Node.jsバージョン要件など）が表示される。詳細な環境情報により、高度なトラブルシューティングが可能になる。

**Why this priority**: 追加情報は高度なトラブルシューティングに有用だが、基本的なバージョン確認には不要。Nice-to-have機能として後回しにできる。

**Independent Test**: `mgtd version`を実行し、バージョン番号と追加情報が表示されることを確認。

**Acceptance Scenarios**:

1. **Given** CLIがインストールされている状態で、**When** `mgtd version`を実行する、**Then** バージョン番号、Node.jsバージョン要件、ビルド情報が表示される
2. **Given** CLIがインストールされている状態で、**When** `mgtd version --json`を実行する、**Then** JSON形式で詳細情報が出力される

---

### User Story 4 - Document Version Management Strategy (Priority: P1) 🎯 MVP

プロジェクトのドキュメント（docs/またはREADME.md）にバージョン管理方針を明記する。これにより、開発者とメンテナーはバージョン番号の更新方法、リリースプロセス、セマンティックバージョニングのルールを理解できる。

**Why this priority**: Issue #5の本来の要求「versionをどのように管理するかの検討」に対応する重要な成果物。バージョン確認コマンドと同等に重要。

**Independent Test**: docs/versioning.md または README.md にバージョン管理セクションが存在し、以下の内容を含むことを確認。

**Acceptance Scenarios**:

1. **Given** プロジェクトのドキュメントを確認する状態で、**When** バージョン管理に関するセクションを読む、**Then** Fixed Versioning採用の理由が記載されている
2. **Given** プロジェクトのドキュメントを確認する状態で、**When** バージョン管理に関するセクションを読む、**Then** SemVerのルール（MAJOR/MINOR/PATCH）が具体例付きで説明されている
3. **Given** プロジェクトのドキュメントを確認する状態で、**When** バージョン管理に関するセクションを読む、**Then** リリースプロセスの手順がコマンド例付きで記載されている
4. **Given** プロジェクトのドキュメントを確認する状態で、**When** バージョン管理に関するセクションを読む、**Then** gitタグの命名規則が明示されている
5. **Given** プロジェクトのドキュメントを確認する状態で、**When** バージョン管理に関するセクションを読む、**Then** CHANGELOGの管理方法が説明されている

---

### Edge Cases

- `--version`と他のフラグを同時に指定した場合の挙動（例: `mgtd memo list --version`）
- バージョン情報が取得できない場合のエラーハンドリング
- 複数のバージョンフラグを同時指定した場合（例: `mgtd --version -v`）

## Requirements

### Functional Requirements

- **FR-001**: System MUST display version number when `--version` flag is provided
- **FR-002**: System MUST display version number when `-v` short flag is provided
- **FR-003**: `--version` and `-v` flags MUST work at the top level (e.g., `mgtd --version`) regardless of subcommands
- **FR-004**: Version number MUST be read from package.json (`packages/cli/package.json`)
- **FR-005**: Version output MUST be written to standard output (stdout)
- **FR-006**: System MUST exit with code 0 after displaying version
- **FR-007**: System MUST provide a `version` subcommand for detailed information (Priority P3)
- **FR-008**: `version` subcommand MUST support `--json` flag for machine-readable output (Priority P3)
- **FR-009**: When `--version` or `-v` is specified, system MUST NOT execute other commands or flags
- **FR-010**: Version display MUST complete in under 100ms
- **FR-011**: Project documentation MUST include version management strategy section (Priority P1)
- **FR-012**: Version management documentation MUST explain Fixed Versioning approach and rationale
- **FR-013**: Version management documentation MUST provide SemVer rules with concrete examples
- **FR-014**: Version management documentation MUST document release process with command examples
- **FR-015**: Version management documentation MUST specify git tagging convention

### Key Entities

この機能はデータエンティティを導入しません。既存のpackage.jsonからバージョン情報を読み取るのみです。

## Success Criteria

### Measurable Outcomes

- **SC-001**: ユーザーは`mgtd --version`または`mgtd -v`を実行することで、1秒以内にバージョン番号を確認できる
- **SC-002**: バージョン確認コマンドは100%の確率で正常終了する（終了コード0）
- **SC-003**: バージョン番号の表示は、package.jsonの値と常に一致する
- **SC-004**: サポート問い合わせやバグレポートで、ユーザーは自身のバージョンを正確に報告できる
- **SC-005**: `version`サブコマンドは、トラブルシューティングに必要な環境情報を提供する（Priority P3）
- **SC-006**: 開発者とメンテナーは、バージョン管理ドキュメントを参照することで、正しいリリースプロセスを実行できる
- **SC-007**: 新しいコントリビューターは、ドキュメントを読むことで、バージョン番号をどのように更新すべきか理解できる

## Version Management Strategy

### Overview

このセクションは、Issue #5の要求「versionをどのように管理するかの検討」に対応します。

### Versioning Approach: Fixed Versioning

**決定**: 全パッケージで統一バージョンを採用（Fixed Versioning）

**理由**:
- 全パッケージが `private: true` で外部公開しない
- パッケージ間に密結合な依存関係（`workspace:*`）
- 単一のCLIツールとしてユーザーに配布
- 現状が既に統一バージョン（0.1.0）で運用中

**運用方法**:
- ルートの `package.json` のバージョンをマスターとする
- リリース時に全パッケージのバージョンを一括更新
- ユーザーは単一のバージョン番号のみを意識

### Semantic Versioning Rules

**SemVer 2.0.0** (`MAJOR.MINOR.PATCH`) に準拠:

| 変更タイプ | バージョン更新 | 例 |
|-----------|--------------|-----|
| **Breaking Changes**<br>既存フラグ名変更、コマンド削除、非互換な動作変更 | MAJOR | 0.1.1 → 1.0.0 |
| **New Features**<br>新コマンド追加、新フラグ追加（後方互換）、機能拡張 | MINOR | 0.1.0 → 0.2.0 |
| **Bug Fixes**<br>バグ修正、ドキュメント修正、リファクタリング | PATCH | 0.1.0 → 0.1.1 |

**v1.0.0 到達基準**:
- Core機能（init, memo）の安定化完了
- 破壊的変更の収束
- プロダクション環境での利用可能品質

### Version Update Process

**手動更新方式** (`npm version` コマンド使用):

```bash
# 1. バージョン番号を決定（SemVerルールに従う）
# 2. CHANGELOG.mdを手動更新
# 3. ルートでバージョン更新
npm version minor -m "chore: bump version to %s"

# 4. 全パッケージのバージョンを同期
pnpm -r exec npm version $(node -p "require('./package.json').version") --no-git-tag-version

# 5. 変更をコミット
git add .
git commit -m "chore: release v0.2.0"

# 6. gitタグを作成
git tag v0.2.0

# 7. プッシュ（明示的な指示時のみ）
git push && git push --tags
```

**自動化ツールを採用しない理由**:
- semantic-release: 自動npm公開前提（本プロジェクトは非公開）
- standard-version: Conventional Commits前提（導入コスト）
- 現行の手動管理で十分機能している
- リリース頻度が高くない

### Git Tagging Convention

**形式**: `v0.1.0` （vプレフィックス付き）

**例**:
- `v0.1.0` - 初期リリース
- `v0.1.1` - パッチリリース
- `v0.2.0` - マイナーリリース
- `v1.0.0` - メジャーリリース

### CHANGELOG Management

**現行方式の継続** (手動編集):

**形式**:
```markdown
## X.Y.Z - YYYY-MM-DD

### Breaking Changes
- 変更内容の説明
  - 移行方法の説明

### New Features
- 機能追加の説明

### Bug Fixes
- 修正内容の説明

### Tests
- テストの追加/更新
```

**手動編集を継続する理由**:
- 詳細な説明文を記載可能（自動生成より分かりやすい）
- Breaking Changesに移行方法を明記可能
- 既存のCHANGELOG.mdで運用実績あり

### This Release (Issue #5 Implementation)

**推奨バージョン**: `0.1.0` → `0.2.0`

**理由**:
- 新機能追加（`--version`, `-v`, `version`コマンド）
- Breaking Changesなし（後方互換性維持）
- SemVerのMINOR更新に該当

**CHANGELOG追記予定**:
```markdown
## 0.2.0 - 2025-10-14

### New Features

- **バージョン確認コマンドの追加**: CLIのバージョンを確認する機能を実装
  - `mgtd --version` / `mgtd -v`: バージョン番号を表示
  - `mgtd version`: 詳細なバージョン情報を表示
  - `mgtd version --json`: JSON形式で環境情報を出力
```

## Assumptions

- **Assumption 1**: バージョン番号は`packages/cli/package.json`の`version`フィールドに記載されている
- **Assumption 2**: ビルドプロセスでは、package.jsonが常にdist/に含まれるか、実行時にアクセス可能である
- **Assumption 3**: oclifフレームワークは`--version`フラグのネイティブサポートを提供している可能性があるが、カスタム実装で上書き可能
- **Assumption 4**: バージョン番号のフォーマットはSemVer（`major.minor.patch`）に従う
- **Assumption 5**: `--version`と`-v`は、他のコマンドよりも優先して処理される
- **Assumption 6**: Fixed Versioningにより、全パッケージは常に同一バージョンを保つ
- **Assumption 7**: リリースプロセスは手動で実行され、自動化ツールは使用しない

## Scope

### In Scope

- `--version`フラグの実装
- `-v`短縮フラグの実装
- package.jsonからのバージョン読み取り
- バージョン情報の標準出力への表示
- `version`サブコマンドの実装（追加情報表示）
- `--json`フラグによるJSON出力（`version`サブコマンド）
- **バージョン管理指針のドキュメント化**（docs/またはREADME.mdへの追記）

### Out of Scope

- バージョン自動更新機能
- 複数バージョンの管理・切り替え
- セマンティックバージョニングの自動計算
- CHANGELOGの自動生成
- バージョン比較機能（他のバージョンとの比較）
- リモートリポジトリからの最新バージョンチェック
