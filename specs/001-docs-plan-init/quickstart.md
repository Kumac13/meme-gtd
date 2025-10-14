# Quickstart: Memo Command CLI Requirements Alignment

**Feature**: Memo Command CLI Requirements Alignment
**Date**: 2025-10-14
**For**: Developers implementing this feature

## Overview

このガイドは、mgtdのmemoコマンドをGitHub CLI準拠に修正するための実装手順を提供します。変更は主にCLIレイヤー（`packages/cli`）に集中しており、コア層やデータベース層への影響は最小限です。

---

## Prerequisites

- Node.js 22.18.0以上
- pnpm 9.0.0
- Git（ブランチ`001-docs-plan-init`にチェックアウト済み）

---

## Implementation Steps

### Phase 1: エディタ起動ヘルパーの拡張

**ファイル**: `packages/cli/src/lib/editor.ts`

**現状**:

```typescript
export async function promptEditor(initialContent?: string): Promise<string> {
  // 既存のエディタ起動ロジック
}
```

**変更内容**:

```typescript
export interface EditorOptions {
  editor?: boolean;       // --editor フラグ
  noEditor?: boolean;     // --no-editor フラグ
  initialContent?: string;
}

/**
 * エディタ起動の制御を行うヘルパー関数
 * 優先順位: --no-editor > --editor > デフォルト動作
 */
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

**テスト**: `packages/cli/test/lib/editor.test.ts`（新規作成）

```typescript
import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { maybePromptEditor } from '../../src/lib/editor.js';

describe('maybePromptEditor', () => {
  it('should throw error when both editor and noEditor are true', async () => {
    await assert.rejects(
      () => maybePromptEditor({ editor: true, noEditor: true }),
      /Cannot specify both/
    );
  });

  it('should return undefined when noEditor is true', async () => {
    const result = await maybePromptEditor({ noEditor: true, initialContent: 'test' });
    assert.strictEqual(result, undefined);
  });

  // その他のテストケース...
});
```

---

### Phase 2: `memo create`コマンドの更新

**ファイル**: `packages/cli/src/commands/memo/create.ts`

**変更1**: フラグ定義の更新

```typescript
static flags = {
  body: Flags.string({
    char: 'b',
    summary: 'Inline memo content',
    description: 'Provide the memo Markdown directly on the command line.'
  }),
  'body-file': Flags.string({  // ← kebab-case
    char: 'f',
    summary: 'Load memo content from a file or stdin',
    description: 'Use "-" to read from stdin; otherwise supply a path to a Markdown file.'
  }),
  editor: Flags.boolean({  // ← 新規
    summary: 'Open editor to edit content',
    description: 'Force open the editor even if --body is provided.',
    exclusive: ['no-editor']
  }),
  'no-editor': Flags.boolean({  // ← 新規
    summary: 'Skip opening editor',
    description: 'Do not open the editor automatically.'
  }),
  label: Flags.string({
    char: 'l',
    summary: 'Apply labels',
    description: 'Attach one or more labels during capture.',
    multiple: true
  }),
  project: Flags.integer({
    char: 'p',
    summary: 'Associate projects',
    description: 'Link memo to one or more project IDs.',
    multiple: true
  }),
  json: Flags.boolean({
    char: 'j',
    summary: 'Return JSON output',
    description: 'Return the created memo payload in JSON format.',
    default: false
  })
} as const;
```

**変更2**: 旧オプション検出ロジック

```typescript
async run(): Promise<void> {
  // 旧オプション検出
  const legacyFlags = {
    '--bodyFile': '--body-file'
  };

  for (const [legacy, modern] of Object.entries(legacyFlags)) {
    if (process.argv.includes(legacy)) {
      this.error(
        `Unknown flag: ${legacy}\n` +
        `Did you mean: ${modern}?`
      );
    }
  }

  const { args, flags } = await this.parse(MemoCreate);
  // ... 続く
}
```

**変更3**: エディタ起動ロジックの更新

```typescript
async run(): Promise<void> {
  // ... 旧オプション検出 ...

  const { args, flags } = await this.parse(MemoCreate);
  const { config } = await loadConfig({ createIfMissing: true });
  const logger = flags.json ? null : createLogger(config);

  let body = flags.body ?? args.body ?? '';

  if (!body && flags['body-file']) {
    body = await loadBodyFromFile(flags['body-file']);
  }

  // 新しいエディタ起動ロジック
  const editorContent = await maybePromptEditor({
    editor: flags.editor,
    noEditor: flags['no-editor'],
    initialContent: body
  });

  if (editorContent) {
    body = editorContent;
  }

  if (!body.trim()) {
    this.error('Memo body cannot be empty.');
  }

  // ... サービス呼び出し ...
}
```

**変更4**: Usage と Examples の更新

```typescript
static usage = [
  '<%= command.id %> [--body <text> | --body-file <path>] [--label <name> ...] [--project <id> ...] [--json]'
];

static examples = [
  '$ mgtd memo create --body "Call back supplier"',
  '$ mgtd memo create --body-file notes.md --label inbox --label vendor',
  '$ mgtd memo create --label backlog --json',
  '$ mgtd memo create --body "draft" --editor',
  '$ mgtd memo create --body "final" --no-editor'
];
```

---

### Phase 3: `memo edit`コマンドの更新

**ファイル**: `packages/cli/src/commands/memo/edit.ts`

**変更1**: フラグ定義の更新

```typescript
static flags = {
  body: Flags.string({
    char: 'b',
    summary: 'Replace memo text inline',
    description: 'Provide the full memo Markdown content as a string.'
  }),
  'body-file': Flags.string({  // ← kebab-case
    char: 'f',
    summary: 'Replace memo text from file/stdin',
    description: 'Use "-" to read from stdin or pass a file path.'
  }),
  'add-label': Flags.string({  // ← kebab-case
    char: 'a',
    summary: 'Labels to add',
    description: 'Append one or more labels without removing existing ones.',
    multiple: true
  }),
  'remove-label': Flags.string({  // ← kebab-case
    char: 'r',
    summary: 'Labels to remove',
    description: 'Drop one or more labels from the memo.',
    multiple: true
  }),
  // setLabel: 削除
  editor: Flags.boolean({  // ← 新規
    summary: 'Open editor to edit content',
    description: 'Force open the editor.',
    exclusive: ['no-editor']
  }),
  'no-editor': Flags.boolean({  // ← 新規
    summary: 'Skip opening editor',
    description: 'Do not open the editor.'
  }),
  project: Flags.integer({
    char: 'p',
    summary: 'Set related project IDs',
    description: 'Override the memo project links with the provided IDs.',
    multiple: true
  }),
  json: Flags.boolean({
    char: 'j',
    summary: 'Return JSON output',
    description: 'Emit the updated memo payload as JSON.',
    default: false
  })
} as const;
```

**変更2**: 旧オプション検出ロジック

```typescript
async run(): Promise<void> {
  // 旧オプション検出
  const legacyFlags = {
    '--bodyFile': '--body-file',
    '--addLabel': '--add-label',
    '--removeLabel': '--remove-label',
    '--setLabel': 'removed (use: mgtd memo label set)'
  };

  for (const [legacy, modern] of Object.entries(legacyFlags)) {
    if (process.argv.includes(legacy) || process.argv.includes(legacy.replace('--', '-').charAt(1))) {
      if (legacy === '--setLabel') {
        this.error(
          `--set-label has been removed from 'memo edit'.\n` +
          `Use 'mgtd memo label set <id> --label <name>...' instead.`
        );
      } else {
        this.error(
          `Unknown flag: ${legacy}\n` +
          `Did you mean: ${modern}?`
        );
      }
    }
  }

  const { args, flags } = await this.parse(MemoEdit);
  // ... 続く
}
```

**変更3**: エディタ起動ロジックの更新

```typescript
async run(): Promise<void> {
  // ... 旧オプション検出 ...

  const { args, flags } = await this.parse(MemoEdit);
  const { config } = await loadConfig({ createIfMissing: true });
  const service = new MemoService({ config });

  let body: string | undefined = flags.body;

  if (!body && flags['body-file']) {
    body = await loadBodyFromFile(flags['body-file']);
  }

  // デフォルト動作の判定
  const hasContentFlags = flags.body || flags['body-file'];
  const hasLabelFlags = flags['add-label'] || flags['remove-label'];
  const hasProjectFlags = flags.project;

  // フラグがない場合、既存本文をエディタで開く
  if (!hasContentFlags && !hasLabelFlags && !hasProjectFlags && !flags.editor && !flags['no-editor']) {
    const memo = service.show(args.id);
    body = await promptEditor(memo.bodyMd);
  } else {
    // フラグがある場合、maybePromptEditorを使用
    const editorContent = await maybePromptEditor({
      editor: flags.editor,
      noEditor: flags['no-editor'],
      initialContent: body
    });

    if (editorContent) {
      body = editorContent;
    }
  }

  const updateResult = service.edit({
    id: args.id,
    bodyMd: body,
    addLabels: flags['add-label'],
    removeLabels: flags['remove-label'],
    projectIds: flags.project
  });

  // setLabels() 呼び出しを削除

  if (flags.json) {
    this.log(JSON.stringify({ memo: updateResult }, null, 2));
    return;
  }

  this.log(`Updated memo #${updateResult.id}`);
}
```

**変更4**: Usage と Examples の更新

```typescript
static usage = [
  '<%= command.id %> <memoId> [--body <text> | --body-file <path>]',
  '<%= command.id %> <memoId> [--add-label <name> ...] [--remove-label <name> ...]',
  '<%= command.id %> <memoId> [--project <id> ...] [--json]'
];

static examples = [
  '$ mgtd memo edit 12 --body-file scratch.md',
  '$ mgtd memo edit 7 --add-label triage --remove-label backlog',
  '$ mgtd memo edit 4 --project 3 --project 8 --json',
  '$ mgtd memo edit 12',  // エディタで編集（デフォルト）
  '$ mgtd memo edit 12 --body "update" --no-editor'
];
```

---

### Phase 4: その他のコマンドの更新

同様の手順で以下のコマンドを更新：

1. **`memo promote`**: `--body-file`, `--add-label`, `--remove-label`をkebab-caseに
2. **`memo comment add`**: `--body-file`, `--editor`, `--no-editor`を追加
3. **`memo comment edit`**: `--body-file`をkebab-caseに

各コマンドで：
- フラグ定義の更新
- 旧オプション検出ロジックの追加
- Usage / Examples の更新

---

### Phase 5: テストの更新と追加

**既存テストの更新**:

すべてのテストコードで旧フラグ名を新フラグ名に置き換え：

```bash
# 例: packages/cli/test/commands/memo/create.test.ts
- flags: { bodyFile: 'notes.md' }
+ flags: { 'body-file': 'notes.md' }
```

**新規テストの追加**:

```typescript
// packages/cli/test/commands/memo/create.test.ts

describe('memo create with legacy flags', () => {
  it('should reject --bodyFile with helpful error', async () => {
    // process.argvを模擬して旧オプションを検出
  });
});

describe('memo create with editor flags', () => {
  it('should respect --no-editor', async () => {
    // エディタ抑止のテスト
  });

  it('should force editor with --editor', async () => {
    // エディタ強制起動のテスト
  });

  it('should error when both --editor and --no-editor', async () => {
    // 相互排他のテスト
  });
});
```

**E2Eテストの更新**:

```typescript
// packages/cli/test/integration/cli.test.ts

describe('CLI integration: memo commands', () => {
  it('memo create --body-file works end-to-end', async () => {
    // テンポラリファイル作成 → コマンド実行 → DB確認
  });

  it('memo edit --set-label shows migration message', async () => {
    // エラーメッセージの確認
  });
});
```

---

### Phase 6: ドキュメントの更新

**1. README.mdの更新**:

すべてのコマンド例をkebab-caseに置き換え：

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
mgtd memo label set 12 --label feature --label bug
```
```

**2. CHANGELOG.mdの作成/更新**:

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

### Fixed

- GitHub CLI準拠のオプション命名規則に統一
```

---

## Testing Strategy

### 1. Unit Tests

```bash
# 各パッケージのテストを実行
pnpm --filter meme-gtd-cli test
pnpm --filter meme-gtd-core test
pnpm --filter meme-gtd-db test
```

### 2. Integration Tests

```bash
# E2Eテストを実行
pnpm --filter meme-gtd-cli test:integration
```

### 3. Manual Testing

```bash
# ビルドとインストール
pnpm build
pnpm run mgtd:install

# 動作確認
mgtd memo create --body-file test.md --label test
mgtd memo edit 1 --add-label feature
mgtd memo edit 1 --set-label bug  # エラーメッセージ確認
```

---

## Rollout Plan

### Step 1: 実装とテスト

1. Phase 1-5を順番に実装
2. 各Phase完了後にユニットテストを実行
3. すべての実装完了後にE2Eテストを実行

### Step 2: ドキュメント更新

1. README.md更新
2. CHANGELOG.md作成
3. CLIヘルプの確認（`mgtd memo --help`）

### Step 3: コミット

```bash
# すべてのテストがパスすることを確認
pnpm test

# 変更をコミット
git add .
git commit -m "feat(cli): align memo commands with GitHub CLI conventions

- Change option naming to kebab-case (--body-file, --add-label, --remove-label)
- Add --editor / --no-editor flags for explicit editor control
- Remove --set-label from memo edit (use memo label set instead)
- Update all tests and documentation

BREAKING CHANGE: All memo command options now use kebab-case.
See CHANGELOG.md for migration guide."
```

### Step 4: レビューとマージ

1. プルリクエスト作成
2. レビュー対応
3. mainブランチへマージ

---

## Troubleshooting

### 問題: `--bodyFile`が認識されない

**原因**: oclifの自動変換が期待通りに動作していない

**解決策**: フラグ定義を`'body-file'`として明示的にkebab-caseで定義する

### 問題: `--editor`と`--no-editor`の相互排他が機能しない

**原因**: oclifの`exclusive`オプションが正しく設定されていない

**解決策**: フラグ定義で`exclusive: ['no-editor']`を確認し、両方のフラグに設定する

### 問題: テストで旧オプションが検出されない

**原因**: `process.argv`の模擬が不十分

**解決策**: テスト時に`process.argv`を直接操作するか、コマンド実行をスタブする

---

## Next Steps

1. `/speckit.tasks`コマンドで詳細なタスクリストを生成
2. タスクリストに従って実装を進める
3. 各タスク完了後に進捗を更新

---

**Quickstart Guide completed**: 2025-10-14
**Ready for implementation**: ✅
