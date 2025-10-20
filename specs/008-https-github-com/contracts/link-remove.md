# CLI Contract: mgtd link remove

**Command**: `mgtd link remove`
**Purpose**: 指定したリンクIDのリンクを削除
**User Story**: P3 - Remove Obsolete Links

## Command Signature

```bash
mgtd link remove <link-id> [--yes] [--json]
```

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<link-id>` | number | **Yes** | 削除するリンクのID |

## Flags

| Flag | Alias | Type | Required | Description |
|------|-------|------|----------|-------------|
| `--yes` | `-y` | boolean | No | 確認プロンプトをスキップ（デフォルト: false） |
| `--json` | `-j` | boolean | No | JSON形式で出力（デフォルト: false） |

## Input Validation

### Required Validations

1. **ID Format**: link-idは正の整数
   - 非数値 → oclif自動エラー
   - 0以下 → エラー: `Link ID must be positive`

2. **ID Existence**: link-idが存在するか
   - 不在 → エラー: `Link #<id> not found`

## Confirmation Prompt

### Interactive Mode (`--yes`なし)

削除前に確認プロンプトを表示：

```
Delete link #<id> (<source-id> --<type>--> <target-id>)? (y/N):
```

**User Response**:
- `y` または `Y` → 削除実行
- `n`、`N`、Enter、その他 → キャンセル（エラーなし、exit code 0）

### Non-Interactive Mode (`--yes`あり)

確認プロンプトなしで即座に削除実行。

## Output

### Success (Human-Readable) - 削除実行

```
Link #<id> deleted
```

### Success (Human-Readable) - キャンセル

```
Cancelled
```

### Success (JSON) - 削除実行

```json
{
  "deleted": true,
  "linkId": <id>
}
```

### Success (JSON) - キャンセル

```json
{
  "deleted": false,
  "linkId": <id>,
  "reason": "User cancelled"
}
```

### Error Cases

| Error Condition | Exit Code | Error Message |
|-----------------|-----------|---------------|
| Link ID not found | 1 | `Link #<id> not found` |
| Link ID ≤ 0 | 1 | `Link ID must be positive` |

## Examples

### Example 1: Interactive削除（確認あり）

```bash
$ mgtd link remove 42

Delete link #42 (5 --parent--> 10)? (y/N): y
Link #42 deleted
```

### Example 2: Interactive削除（キャンセル）

```bash
$ mgtd link remove 42

Delete link #42 (5 --parent--> 10)? (y/N): n
Cancelled
```

### Example 3: Non-interactive削除（`--yes`）

```bash
$ mgtd link remove 42 --yes

Link #42 deleted
```

### Example 4: JSON出力（削除）

```bash
$ mgtd link remove 42 --yes --json

{
  "deleted": true,
  "linkId": 42
}
```

### Example 5: JSON出力（キャンセル）

```bash
$ mgtd link remove 42 --json

Delete link #42 (5 --parent--> 10)? (y/N): n
{
  "deleted": false,
  "linkId": 42,
  "reason": "User cancelled"
}
```

### Example 6: エラーケース - 存在しないID

```bash
$ mgtd link remove 999

Error: Link #999 not found
```

## Implementation Notes

### Confirmation Prompt Implementation

oclifには標準の確認プロンプト機能がないため、`readline`または`inquirer`ライブラリを使用：

**Option A: readline (minimal)**
```typescript
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const answer = await new Promise<string>(resolve => {
  rl.question(`Delete link #${id} ...? (y/N): `, resolve);
});
rl.close();

if (answer.toLowerCase() !== 'y') {
  this.log('Cancelled');
  return;
}
```

**Option B: @inquirer/prompts (推奨)**
```typescript
import { confirm } from '@inquirer/prompts';

const shouldDelete = await confirm({
  message: `Delete link #${id} (${link.sourceIssueId} --${link.linkType}--> ${link.targetIssueId})?`,
  default: false
});

if (!shouldDelete) {
  this.log('Cancelled');
  return;
}
```

**Decision**: research.mdで既存コマンドの確認プロンプト実装を調査して決定（Phase 1で確認）

### Link Info Retrieval for Prompt

確認メッセージに`(<source-id> --<type>--> <target-id>)`を表示するため、削除前にlinkを取得：

```typescript
const link = linkRepository.getLinkById(db, linkId); // throws if not found
// ... show confirmation with link details
linkRepository.deleteLink(db, linkId);
```

### `--yes` + `--json` Interaction

両方指定時:
1. 確認プロンプトスキップ
2. JSON出力

```bash
$ mgtd link remove 42 --yes --json
{"deleted":true,"linkId":42}
```

## Test Scenarios

### Contract Tests

1. ✅ Delete link with confirmation (y)
2. ✅ Cancel deletion (n)
3. ✅ Delete link with --yes (no prompt)
4. ✅ JSON output on deletion
5. ✅ JSON output on cancellation
6. ❌ Non-existent link ID → error
7. ❌ Invalid link ID (≤0) → error
8. ✅ --yes + --json combination

## Dependencies

### Confirmation Prompt Library

**Recommended**: `@inquirer/prompts`（既存プロジェクトで使用されているか要確認）

**Fallback**: `readline`（Node.js標準ライブラリ）

**Research Required**: 既存のmemo/taskコマンドで削除確認の実装があるか確認（Phase 1調査項目）
