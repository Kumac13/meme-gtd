# Research: Memo Command CLI Requirements Alignment

**Feature**: Memo Command CLI Requirements Alignment
**Date**: 2025-10-14
**Status**: Complete

## Overview

このドキュメントは、mgtdのmemoコマンドをGitHub CLI準拠に修正するための技術調査結果をまとめたものです。主要な変更点（オプション命名規則の統一、エディタ起動の明示的制御、機能重複の解消）について、実装方法とベストプラクティスを調査しました。

---

## 1. oclif CLIフレームワークにおけるフラグ命名規則

### 調査内容

oclifでのフラグ定義において、kebab-caseとcamelCaseの変換がどのように行われるか、および旧オプションに対するエラーメッセージの提供方法を調査。

### 調査結果

**oclif フラグ定義の基本**:

```typescript
import { Flags } from '@oclif/core';

static flags = {
  // kebab-caseで定義すると、CLIでは --body-file として使用可能
  bodyFile: Flags.string({
    char: 'f',
    description: 'Load content from file'
  }),

  // または明示的に kebab-case を name で指定
  'body-file': Flags.string({
    char: 'f',
    description: 'Load content from file'
  })
}
```

**oclif v3の自動変換**:
- フラグ名がcamelCaseで定義された場合、oclifは自動的にkebab-caseのCLIオプションに変換する（例: `bodyFile` → `--body-file`）
- ただし、現在のコードでは`bodyFile`というプロパティ名を使用しており、これが`--bodyFile`として認識されている可能性がある（oclif v2以前の挙動）

**破壊的変更への対応**:
- oclifには非推奨フラグ（deprecated flags）の仕組みがある
- しかし、仕様では完全に削除してエラーメッセージを提示することが要求されている
- カスタムエラーメッセージは、`parse()`後に手動でチェックして提供する必要がある

### Decision

**選択した方法**: フラグ定義をkebab-case形式のプロパティ名に変更し、oclif v3の標準動作に従う。

```typescript
static flags = {
  'body-file': Flags.string({
    char: 'f',
    description: 'Load content from file or stdin'
  }),
  'add-label': Flags.string({
    char: 'a',
    description: 'Add labels',
    multiple: true
  }),
  'remove-label': Flags.string({
    char: 'r',
    description: 'Remove labels',
    multiple: true
  })
}
```

**旧オプション検出**:
- `process.argv`を直接チェックし、`--bodyFile`, `--addLabel`などの旧形式を検出
- 検出した場合、適切なエラーメッセージと正しいkebab-case形式を提示してエラー終了

### Rationale

- oclif v3の標準機能を最大限活用することで、フレームワークの恩恵を受けられる
- kebab-caseはGitHub CLI、Docker CLI、kubectl等の業界標準
- 自動変換に頼らず、明示的にkebab-caseで定義することで、意図が明確になる

### Alternatives Considered

**Alternative 1**: エイリアス機能で両方をサポート
- **却下理由**: 仕様で「完全に削除」が要求されており、後方互換性は提供しない方針

**Alternative 2**: oclifのdeprecated機能を使用
- **却下理由**: deprecatedは「将来削除予定」のシグナルだが、今回は即座に削除してエラーを返す必要がある

---

## 2. エディタ起動の制御パターン

### 調査内容

`--editor` / `--no-editor`フラグによるエディタ起動の制御ロジックと、GitHub CLIの実装パターンを調査。

### 調査結果

**GitHub CLIの動作**:

```bash
# デフォルト: 本文がない場合エディタ起動
gh issue create

# --body指定でもエディタで編集したい場合
gh issue create --body "draft" --editor

# エディタを完全に抑止（スクリプト用）
gh issue create --body "final" --no-editor
```

**優先順位**:
1. `--no-editor`が指定されている場合、エディタを起動しない（最優先）
2. `--editor`が指定されている場合、エディタを強制起動
3. どちらも指定されていない場合、デフォルト動作（本文が空ならエディタ起動）

**エディタ起動の実装パターン**:

```typescript
async function shouldLaunchEditor(flags: Flags, hasBody: boolean): Promise<boolean> {
  // --no-editor が最優先
  if (flags.noEditor) {
    return false;
  }

  // --editor で強制起動
  if (flags.editor) {
    return true;
  }

  // デフォルト: 本文がなければ起動
  return !hasBody;
}
```

**相互排他チェック**:
- `--editor`と`--no-editor`が同時に指定された場合、エラーを返すのがベストプラクティス
- oclifの`exclusive`オプションを使用可能

### Decision

**選択した方法**: 以下のロジックを`packages/cli/src/lib/editor.ts`に実装

```typescript
export interface EditorOptions {
  editor?: boolean;
  noEditor?: boolean;
  initialContent?: string;
}

export async function maybePromptEditor(options: EditorOptions): Promise<string | undefined> {
  // 相互排他チェック
  if (options.editor && options.noEditor) {
    throw new Error('Cannot specify both --editor and --no-editor');
  }

  // --no-editor: エディタを起動しない
  if (options.noEditor) {
    return undefined;
  }

  // --editor: 強制起動
  if (options.editor) {
    return await promptEditor(options.initialContent);
  }

  // デフォルト: 初期コンテンツがなければ起動
  if (!options.initialContent) {
    return await promptEditor();
  }

  return undefined;
}
```

**フラグ定義**:

```typescript
static flags = {
  editor: Flags.boolean({
    description: 'Open editor to edit content',
    exclusive: ['no-editor']
  }),
  'no-editor': Flags.boolean({
    description: 'Skip opening editor'
  })
}
```

### Rationale

- GitHub CLIと同じ優先順位を採用することで、既存ユーザーの直感に合致
- `exclusive`オプションでフレームワークレベルでの相互排他を保証
- 新しいヘルパー関数`maybePromptEditor`を導入することで、各コマンドでの実装を統一

### Alternatives Considered

**Alternative 1**: `--no-editor`を優先（エラーなし）
- **却下理由**: 相互排他エラーの方がユーザーの意図を明確に伝えられる

**Alternative 2**: 各コマンドで個別実装
- **却下理由**: ロジックの重複が発生し、保守性が低下

---

## 3. `--set-label`フラグの削除と`memo label set`への一元化

### 調査内容

`memo edit --set-label`の削除に伴う影響範囲と、ユーザーへの移行ガイダンスの提供方法を調査。

### 調査結果

**現在の実装**:

```typescript
// memo edit.ts (現行)
if (flags.setLabel) {
  service.setLabels(args.id, flags.setLabel);
}
```

**`memo label set`コマンド**:
- 既に`packages/cli/src/commands/memo/label/set.ts`として実装済み
- `memoRepository.setMemoLabels()`関数を使用

**影響範囲**:
1. `packages/cli/src/commands/memo/edit.ts`: `setLabel`フラグの定義を削除
2. `packages/cli/src/commands/memo/edit.ts`: `setLabel`処理ロジックを削除
3. テストコード: `memo edit --set-label`を使用しているテストケースを更新
4. ドキュメント: `memo edit`のヘルプとREADMEを更新

**エラーメッセージの提供**:
- 旧オプション検出と同様に`process.argv`をチェック
- `--set-label`が検出された場合、以下のエラーメッセージを表示：

```
Error: --set-label has been removed from 'memo edit'.
Use 'mgtd memo label set <id> --label <name>...' instead.
```

### Decision

**選択した方法**: 以下の手順で削除

1. `memo edit.ts`から`setLabel`フラグ定義を削除
2. `setLabel`の処理ロジックを削除（`service.setLabels()`呼び出し）
3. コマンド実行時に`--set-label`または`-s`を検出した場合、移行ガイダンスを含むエラーを表示
4. `packages/db/src/memoRepository.ts`の`setMemoLabels`関数は保持（`memo label set`で使用）

**エラーメッセージ実装**:

```typescript
// memo edit.ts の run() メソッド冒頭
async run(): Promise<void> {
  // 旧オプション検出
  if (process.argv.includes('--set-label') || process.argv.includes('-s')) {
    this.error(
      '--set-label has been removed from \'memo edit\'.\n' +
      'Use \'mgtd memo label set <id> --label <name>...\' instead.'
    );
  }

  // ... 通常処理
}
```

### Rationale

- 機能の一元化により、ユーザーは「ラベル操作は`memo label`サブコマンド」という明確なメンタルモデルを持てる
- GitHub CLIには`--set-label`が存在せず、`--add-label` / `--remove-label`のみ提供されている
- `memo label set`コマンドが既に存在するため、削除による機能喪失はない

### Alternatives Considered

**Alternative 1**: `--set-label`をエイリアスとして残す
- **却下理由**: 仕様で明示的に削除が要求されており、機能重複の解消が目的

**Alternative 2**: `--set-label`を非推奨として警告のみ
- **却下理由**: 破壊的変更を即座に適用し、ユーザーに新しいパターンへの移行を促す方針

---

## 4. テスト戦略

### 調査内容

既存テストスイートの構成と、新しいフラグに対するテストカバレッジの確保方法を調査。

### 調査結果

**既存テスト構成**:

```
packages/cli/test/
├── commands/           # コマンドユニットテスト
│   └── memo/
│       ├── create.test.ts
│       ├── edit.test.ts
│       └── ...
└── integration/        # E2Eテスト
    └── cli.test.ts
```

**テストフレームワーク**: Node.js native test runner (`node:test`)

**必要なテストケース**:

1. **kebab-caseオプションの動作確認**
   - `--body-file`でファイルから読み込み
   - `--add-label`でラベル追加
   - `--remove-label`でラベル削除

2. **旧オプションのエラーメッセージ**
   - `--bodyFile`使用時に適切なエラーが表示される
   - `--addLabel`使用時に正しいkebab-caseが提案される

3. **エディタフラグの動作**
   - `--editor`で強制起動
   - `--no-editor`で抑止
   - 両方指定時にエラー
   - デフォルト動作（本文なし→エディタ起動）

4. **`--set-label`削除の確認**
   - `memo edit --set-label`がエラーを返す
   - エラーメッセージに`memo label set`への移行ガイダンスが含まれる

### Decision

**選択した方法**: 以下のテスト追加

```typescript
// packages/cli/test/commands/memo/create.test.ts

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('memo create with kebab-case flags', () => {
  it('should accept --body-file', async () => {
    // テスト実装
  });

  it('should reject --bodyFile with helpful error', async () => {
    // 旧オプション検出のテスト
  });
});

describe('memo create with editor flags', () => {
  it('should respect --no-editor', async () => {
    // エディタ抑止のテスト
  });

  it('should error when both --editor and --no-editor', async () => {
    // 相互排他のテスト
  });
});
```

**E2Eテスト**:

```typescript
// packages/cli/test/integration/cli.test.ts

describe('CLI integration: memo commands', () => {
  it('memo create --body-file works end-to-end', async () => {
    // ファイル作成 → コマンド実行 → DB確認
  });

  it('memo edit --set-label shows migration message', async () => {
    // エラーメッセージの確認
  });
});
```

### Rationale

- 既存テストフレームワーク（node:test）を継続使用することで、学習コストを削減
- ユニットテストとE2Eテストの両方でカバーすることで、回帰を防止
- 旧オプションのエラーメッセージテストにより、ユーザー体験の品質を保証

### Alternatives Considered

**Alternative 1**: 手動テストのみ
- **却下理由**: 回帰リスクが高く、CI/CDでの自動検証ができない

**Alternative 2**: 新しいテストフレームワークの導入（例: Vitest）
- **却下理由**: 既存プロジェクトとの一貫性を保つため、node:testを継続使用

---

## 5. ドキュメント更新戦略

### 調査内容

README、CLIヘルプ、コマンド説明の更新箇所と、移行ガイドの提供方法を調査。

### 調査結果

**更新対象**:

1. **CLIヘルプ（各コマンドの`static`プロパティ）**
   - `static usage`: 使用例をkebab-caseに更新
   - `static examples`: すべての例をkebab-caseに更新
   - フラグの`description`: エディタフラグの説明を追加

2. **README.md**
   - 「使い方」セクションのコマンド例を更新
   - `--body-file`, `--add-label`, `--remove-label`への変更を反映

3. **docs/cli_requirement.md**
   - 参照元ドキュメントだが、今回の変更を反映済み（plan_init_memo.mdに記載）

**移行ガイドの提供**:
- CHANGELOG.mdに破壊的変更セクションを追加
- 各旧オプションから新オプションへのマッピングを明記

### Decision

**選択した方法**: 以下の順序でドキュメント更新

1. **各コマンドファイル内の更新**
   ```typescript
   static examples = [
     '$ mgtd memo create --body-file notes.md --label inbox',  // 更新
     '$ mgtd memo edit 12 --add-label bug --remove-label backlog'  // 更新
   ];
   ```

2. **README.md更新**
   ```markdown
   ## 使い方

   ### メモの作成

   ```bash
   # ファイルから読み込み
   mgtd memo create --body-file notes.md --label inbox

   # エディタで作成
   mgtd memo create --editor
   ```

   ### メモの編集

   ```bash
   # ラベル追加
   mgtd memo edit 12 --add-label feature

   # ラベル削除
   mgtd memo edit 12 --remove-label bug

   # ラベルの完全置換（v0.1.1以降）
   mgtd memo label set 12 --label feature,bug
   ```
   ```

3. **CHANGELOG.md追加**
   ```markdown
   ## [0.1.1] - 2025-10-14

   ### Breaking Changes

   - **オプション命名規則の変更**: すべてのmemoコマンドのオプションがkebab-caseに変更されました
     - `--bodyFile` → `--body-file`
     - `--addLabel` → `--add-label`
     - `--removeLabel` → `--remove-label`

   - **`--set-label`の削除**: `memo edit --set-label`が削除されました
     - 代わりに`mgtd memo label set <id> --label <name>...`を使用してください

   ### Added

   - `memo create`に`--editor` / `--no-editor`フラグを追加
   - `memo edit`に`--editor` / `--no-editor`フラグを追加
   - `memo comment add`に`--editor` / `--no-editor`フラグを追加
   ```

### Rationale

- CLIヘルプは`--help`で即座にアクセス可能なため、最優先で更新
- README.mdは新規ユーザーの主要な参照元
- CHANGELOGで破壊的変更を明示することで、既存ユーザーへの影響を最小化

### Alternatives Considered

**Alternative 1**: 移行ガイドを別ドキュメント化
- **却下理由**: CHANGELOGに含めることで、一箇所で変更履歴を管理できる

**Alternative 2**: READMEに移行ガイド専用セクション
- **却下理由**: v0.1.1以降の新規ユーザーには不要な情報となるため、CHANGELOGに集約

---

## Summary of Decisions

| 領域 | Decision | Rationale |
|-----|----------|-----------|
| **フラグ命名** | kebab-caseでフラグ定義、旧オプション検出でエラー | GitHub CLI準拠、業界標準、oclif v3の標準機能活用 |
| **エディタ制御** | `--no-editor` > `--editor` > デフォルト の優先順位 | GitHub CLIと同じ動作、相互排他でユーザー意図を明確化 |
| **`--set-label`削除** | 完全削除、`memo label set`への移行ガイダンス提供 | 機能一元化、GitHub CLI準拠、明確なメンタルモデル |
| **テスト** | node:test継続、ユニット + E2Eカバレッジ | 既存フレームワーク活用、回帰防止、CI/CD統合 |
| **ドキュメント** | CLIヘルプ最優先、README + CHANGELOG更新 | 即座にアクセス可能、新規・既存ユーザー両方をサポート |

---

## Next Steps

Phase 1に進み、以下を作成：

1. **data-model.md**: エンティティへの影響なし（フラグ定義のみの変更）
2. **contracts/flag-changes.md**: 各コマンドのフラグ変更の詳細仕様
3. **quickstart.md**: 開発者向けの実装ガイド
4. Agent contextの更新

---

**Research completed**: 2025-10-14
**All unknowns resolved**: ✅
