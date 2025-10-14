# CLI Flag Changes Contract

**Feature**: Memo Command CLI Requirements Alignment
**Date**: 2025-10-14
**Version**: v0.1.1

## Overview

このドキュメントは、mgtdのmemoコマンドにおけるCLIフラグの変更を詳細に定義します。すべての変更はGitHub CLI準拠を目指し、後方互換性のない破壊的変更を含みます。

---

## 1. `memo create` Command

### Current Flags (v0.1.0)

```typescript
Flags:
  -b, --body STRING          Inline memo content
  -f, --bodyFile PATH        Load memo content from a file or stdin
  -l, --label NAME           Apply labels (multiple)
  -p, --project ID           Associate projects (multiple)
  -j, --json                 Return JSON output
```

### New Flags (v0.1.1)

```typescript
Flags:
  -b, --body STRING          Inline memo content
  -f, --body-file PATH       Load memo content from a file or stdin
  -l, --label NAME           Apply labels (multiple)
  -p, --project ID           Associate projects (multiple)
      --editor               Open editor to edit content
      --no-editor            Skip opening editor
  -j, --json                 Return JSON output
```

### Changes

| Old Flag | New Flag | Change Type | Description |
|----------|----------|-------------|-------------|
| `--bodyFile` | `--body-file` | **BREAKING** | camelCase → kebab-case |
| N/A | `--editor` | **NEW** | 強制的にエディタを起動 |
| N/A | `--no-editor` | **NEW** | エディタの自動起動を抑止 |

### Migration Examples

```bash
# Before (v0.1.0)
mgtd memo create --bodyFile notes.md --label inbox

# After (v0.1.1)
mgtd memo create --body-file notes.md --label inbox

# New: Force editor even with --body
mgtd memo create --body "draft" --editor

# New: Skip editor entirely
mgtd memo create --body "final" --no-editor
```

### Error Messages

```bash
# Using old flag
$ mgtd memo create --bodyFile notes.md
Error: Unknown flag: --bodyFile
Did you mean: --body-file?

# Conflicting flags
$ mgtd memo create --editor --no-editor
Error: --editor cannot be used with --no-editor
```

---

## 2. `memo edit` Command

### Current Flags (v0.1.0)

```typescript
Flags:
  -b, --body STRING          Replace memo text inline
  -f, --bodyFile PATH        Replace memo text from file/stdin
  -a, --addLabel NAME        Labels to add (multiple)
  -r, --removeLabel NAME     Labels to remove (multiple)
  -s, --setLabel NAME        Overwrite label set (multiple)
  -p, --project ID           Set related project IDs (multiple)
  -j, --json                 Return JSON output
```

### New Flags (v0.1.1)

```typescript
Flags:
  -b, --body STRING          Replace memo text inline
  -f, --body-file PATH       Replace memo text from file/stdin
  -a, --add-label NAME       Labels to add (multiple)
  -r, --remove-label NAME    Labels to remove (multiple)
  -p, --project ID           Set related project IDs (multiple)
      --editor               Open editor to edit content
      --no-editor            Skip opening editor
  -j, --json                 Return JSON output
```

### Changes

| Old Flag | New Flag | Change Type | Description |
|----------|----------|-------------|-------------|
| `--bodyFile` | `--body-file` | **BREAKING** | camelCase → kebab-case |
| `--addLabel` | `--add-label` | **BREAKING** | camelCase → kebab-case |
| `--removeLabel` | `--remove-label` | **BREAKING** | camelCase → kebab-case |
| `--setLabel` | **REMOVED** | **BREAKING** | `memo label set`に一元化 |
| N/A | `--editor` | **NEW** | 強制的にエディタを起動 |
| N/A | `--no-editor` | **NEW** | エディタの自動起動を抑止 |

### Migration Examples

```bash
# Before (v0.1.0)
mgtd memo edit 12 --bodyFile scratch.md
mgtd memo edit 7 --addLabel triage --removeLabel backlog
mgtd memo edit 5 --setLabel feature,bug

# After (v0.1.1)
mgtd memo edit 12 --body-file scratch.md
mgtd memo edit 7 --add-label triage --remove-label backlog
mgtd memo label set 5 --label feature --label bug

# New: Edit with editor (default if no flags)
mgtd memo edit 12

# New: Update without editor
mgtd memo edit 12 --body "update" --no-editor
```

### Error Messages

```bash
# Using old flags
$ mgtd memo edit 12 --bodyFile scratch.md
Error: Unknown flag: --bodyFile
Did you mean: --body-file?

$ mgtd memo edit 12 --addLabel bug
Error: Unknown flag: --addLabel
Did you mean: --add-label?

# Using removed flag
$ mgtd memo edit 12 --setLabel feature,bug
Error: --set-label has been removed from 'memo edit'.
Use 'mgtd memo label set <id> --label <name>...' instead.
```

---

## 3. `memo promote` Command

### Current Flags (v0.1.0)

```typescript
Flags:
  -t, --title STRING         Task title
  -b, --body STRING          Task body
  -f, --bodyFile PATH        Load task body from file/stdin
  -l, --label NAME           Apply labels (multiple)
  -p, --project ID           Associate projects (multiple)
  -a, --addLabel NAME        Labels to add (multiple)
  -r, --removeLabel NAME     Labels to remove (multiple)
  -j, --json                 Return JSON output
```

### New Flags (v0.1.1)

```typescript
Flags:
  -t, --title STRING         Task title
  -b, --body STRING          Task body
  -f, --body-file PATH       Load task body from file/stdin
  -l, --label NAME           Apply labels (multiple)
  -p, --project ID           Associate projects (multiple)
  -a, --add-label NAME       Labels to add (multiple)
  -r, --remove-label NAME    Labels to remove (multiple)
  -j, --json                 Return JSON output
```

### Changes

| Old Flag | New Flag | Change Type | Description |
|----------|----------|-------------|-------------|
| `--bodyFile` | `--body-file` | **BREAKING** | camelCase → kebab-case |
| `--addLabel` | `--add-label` | **BREAKING** | camelCase → kebab-case |
| `--removeLabel` | `--remove-label` | **BREAKING** | camelCase → kebab-case |

### Migration Examples

```bash
# Before (v0.1.0)
mgtd memo promote 12 --title "Buy groceries" --bodyFile details.md

# After (v0.1.1)
mgtd memo promote 12 --title "Buy groceries" --body-file details.md
```

---

## 4. `memo comment add` Command

### Current Flags (v0.1.0)

```typescript
Flags:
  -b, --body STRING          Comment text
  -f, --bodyFile PATH        Load comment from file/stdin
  -j, --json                 Return JSON output
```

### New Flags (v0.1.1)

```typescript
Flags:
  -b, --body STRING          Comment text
  -f, --body-file PATH       Load comment from file/stdin
      --editor               Open editor to edit content
      --no-editor            Skip opening editor
  -j, --json                 Return JSON output
```

### Changes

| Old Flag | New Flag | Change Type | Description |
|----------|----------|-------------|-------------|
| `--bodyFile` | `--body-file` | **BREAKING** | camelCase → kebab-case |
| N/A | `--editor` | **NEW** | 強制的にエディタを起動 |
| N/A | `--no-editor` | **NEW** | エディタの自動起動を抑止 |

### Migration Examples

```bash
# Before (v0.1.0)
mgtd memo comment add 12 --bodyFile comment.md

# After (v0.1.1)
mgtd memo comment add 12 --body-file comment.md

# New: Create comment with editor
mgtd memo comment add 12 --editor
```

---

## 5. `memo comment edit` Command

### Current Flags (v0.1.0)

```typescript
Flags:
  -b, --body STRING          Updated comment text
  -f, --bodyFile PATH        Load comment from file/stdin
  -j, --json                 Return JSON output
```

### New Flags (v0.1.1)

```typescript
Flags:
  -b, --body STRING          Updated comment text
  -f, --body-file PATH       Load comment from file/stdin
  -j, --json                 Return JSON output
```

### Changes

| Old Flag | New Flag | Change Type | Description |
|----------|----------|-------------|-------------|
| `--bodyFile` | `--body-file` | **BREAKING** | camelCase → kebab-case |

### Migration Examples

```bash
# Before (v0.1.0)
mgtd memo comment edit 12 45 --bodyFile updated.md

# After (v0.1.1)
mgtd memo comment edit 12 45 --body-file updated.md
```

---

## 6. `memo label set` Command (Unchanged)

このコマンドは既にkebab-caseを使用しているため、変更なし。

```typescript
Flags:
  -l, --label NAME           Labels to set (multiple, required)
  -j, --json                 Return JSON output
```

**注意**: `memo edit --set-label`が削除されたことで、このコマンドが唯一のラベル完全置換の方法となります。

---

## Flag Validation Rules

### 1. Mutual Exclusivity

```typescript
// --editor と --no-editor は相互排他
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

### 2. Editor Launch Priority

```
Priority (high to low):
1. --no-editor    → Never launch editor
2. --editor       → Always launch editor
3. Default        → Launch if content is empty
```

### 3. Legacy Flag Detection

```typescript
// コマンド実行時にprocess.argvをチェック
const legacyFlags = ['--bodyFile', '--addLabel', '--removeLabel', '--setLabel'];
const usedLegacyFlags = process.argv.filter(arg =>
  legacyFlags.some(legacy => arg.startsWith(legacy))
);

if (usedLegacyFlags.length > 0) {
  // 適切なエラーメッセージを表示
}
```

---

## Breaking Changes Summary

| Command | Removed Flags | Renamed Flags | New Flags |
|---------|--------------|---------------|-----------|
| `memo create` | - | `--bodyFile` → `--body-file` | `--editor`, `--no-editor` |
| `memo edit` | `--setLabel` | `--bodyFile` → `--body-file`<br>`--addLabel` → `--add-label`<br>`--removeLabel` → `--remove-label` | `--editor`, `--no-editor` |
| `memo promote` | - | `--bodyFile` → `--body-file`<br>`--addLabel` → `--add-label`<br>`--removeLabel` → `--remove-label` | - |
| `memo comment add` | - | `--bodyFile` → `--body-file` | `--editor`, `--no-editor` |
| `memo comment edit` | - | `--bodyFile` → `--body-file` | - |

---

## Testing Contract

各コマンドのテストケースは以下をカバーする必要があります：

### 1. Positive Cases

- ✅ 新しいkebab-caseフラグが正常に動作する
- ✅ `--editor`フラグでエディタが起動する
- ✅ `--no-editor`フラグでエディタが抑止される
- ✅ デフォルト動作（本文なし→エディタ起動）が機能する

### 2. Negative Cases

- ✅ 旧camelCaseフラグを使用するとエラーが表示される
- ✅ `--setLabel`を使用するとエラーと移行ガイドが表示される
- ✅ `--editor`と`--no-editor`を同時使用するとエラーが表示される
- ✅ エラーメッセージに正しいフラグ名が含まれる

### 3. Edge Cases

- ✅ `--body-file`で存在しないファイルを指定するとエラー
- ✅ `--body-file -`で標準入力から読み込める
- ✅ 本文が空の場合にバリデーションエラーが発生する

---

## Documentation Updates Required

### 1. Command Help Text

各コマンドファイルの`static usage`と`static examples`を更新

```typescript
static usage = [
  '<%= command.id %> [--body <text> | --body-file <path>] [--label <name> ...] [--json]'
];

static examples = [
  '$ mgtd memo create --body-file notes.md --label inbox',
  '$ mgtd memo create --editor',
  '$ mgtd memo create --body "text" --no-editor'
];
```

### 2. README.md

すべてのコマンド例をkebab-caseに更新

### 3. CHANGELOG.md

v0.1.1の破壊的変更セクションに詳細を追加

---

**Contract completed**: 2025-10-14
**Implementation ready**: ✅
