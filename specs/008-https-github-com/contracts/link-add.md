# CLI Contract: mgtd link add

**Command**: `mgtd link add`
**Purpose**: タスク/メモ間のリンクを作成
**User Story**: P1 - Create Parent-Child Task Relationships

## Command Signature

```bash
mgtd link add --type <type> --source <issue-id> --target <issue-id> [--json]
```

## Arguments

なし（全てフラグで指定）

## Flags

| Flag | Alias | Type | Required | Description |
|------|-------|------|----------|-------------|
| `--type` | `-t` | string | **Yes** | リンクタイプ: `parent`, `child`, `relates`, `derived_from` |
| `--source` | `-s` | number | **Yes** | リンク元のissue ID |
| `--target` | `-T` | number | **Yes** | リンク先のissue ID |
| `--json` | `-j` | boolean | No | JSON形式で出力（デフォルト: false） |

**Note**: `-t`は`--target`と競合するため、`--target`のaliasは大文字`-T`を使用

## Input Validation

### Required Validations

1. **Type Validation**: `--type`は以下の値のみ許可
   - `parent`
   - `child`
   - `relates`
   - `derived_from`
   - その他の値 → エラー: `Invalid link type: <value>`

2. **ID Format**: source/targetは正の整数
   - 非数値 → oclif自動エラー（型チェック）
   - 0以下 → エラー: `Issue ID must be positive`

3. **ID Existence**: source/target issueが存在するか
   - 不在 → エラー: `Issue #<id> not found`

4. **Self-Reference**: source ≠ target
   - 同じID → エラー: `Cannot link issue to itself`

5. **Duplicate Check**: 同じ(source, target, type)が未存在
   - 既存 → エラー: `Link already exists (source: <s>, target: <t>, type: <type>)`

6. **Deleted Issue**: 削除済み（is_deleted=1）issueへのリンク禁止
   - 削除済み → エラー: `Issue #<id> not found` (論理削除は不可視扱い)

## Output

### Success (Human-Readable)

```
Link created: #<link-id> (<source-id> --<type>--> <target-id>)
```

**Example**:
```
Link created: #42 (5 --parent--> 10)
```

### Success (JSON)

```json
{
  "id": 42,
  "sourceIssueId": 5,
  "targetIssueId": 10,
  "linkType": "parent",
  "createdAt": "2025-10-18T12:34:56.789Z"
}
```

### Error Cases

| Error Condition | Exit Code | Error Message |
|-----------------|-----------|---------------|
| Invalid type | 1 | `Invalid link type: <value>. Must be one of: parent, child, relates, derived_from` |
| Source ID not found | 1 | `Issue #<id> not found` |
| Target ID not found | 1 | `Issue #<id> not found` |
| Self-reference | 1 | `Cannot link issue to itself (ID: <id>)` |
| Duplicate link | 1 | `Link already exists (source: <s>, target: <t>, type: <type>)` |
| Circular reference (future) | 1 | `Circular parent-child relationship detected` |

## Examples

### Example 1: 親子関係の作成（子→親の視点）

```bash
$ mgtd link add --type parent --source 5 --target 10

Link created: #1 (5 --parent--> 10)
```

**Interpretation**: タスク5の親はタスク10

### Example 2: 親子関係の作成（親→子の視点）

```bash
$ mgtd link add --type child --source 10 --target 5

Link created: #2 (10 --child--> 5)
```

**Interpretation**: タスク10の子はタスク5（Example 1と実質同じ関係）

### Example 3: 関連タスクの作成

```bash
$ mgtd link add -t relates -s 3 -T 8

Link created: #3 (3 --relates--> 8)
```

### Example 4: メモからタスクへの派生

```bash
$ mgtd link add --type derived_from --source 15 --target 2

Link created: #4 (15 --derived_from--> 2)
```

**Interpretation**: タスク15はメモ2から派生

### Example 5: JSON出力

```bash
$ mgtd link add --type parent --source 5 --target 10 --json

{
  "id": 1,
  "sourceIssueId": 5,
  "targetIssueId": 10,
  "linkType": "parent",
  "createdAt": "2025-10-18T12:34:56.789Z"
}
```

### Example 6: エラーケース - 自己参照

```bash
$ mgtd link add --type parent --source 5 --target 5

Error: Cannot link issue to itself (ID: 5)
```

### Example 7: エラーケース - 重複

```bash
$ mgtd link add --type parent --source 5 --target 10
Link created: #1 (5 --parent--> 10)

$ mgtd link add --type parent --source 5 --target 10
Error: Link already exists (source: 5, target: 10, type: parent)
```

## Implementation Notes

### Flag Alias Conflict Resolution

`--type`と`--target`が両方`-t`を使いたいケース：
- **Solution**: `--type`を`-t`、`--target`を`-T`（大文字）に割り当て
- **Alternative**: `--target`のaliasなし（`--source`も`-s`のみ）

### Parent vs Child Semantics

ユーザーは2つの方法で同じ関係を表現可能：
- `--type parent --source <child> --target <parent>`
- `--type child --source <parent> --target <child>`

DB上は別レコードとして保存（typeが異なる）。`mgtd link list`でどちらの視点でも表示。

## Test Scenarios

### Contract Tests

1. ✅ Valid parent link creation
2. ✅ Valid child link creation
3. ✅ Valid relates link creation
4. ✅ Valid derived_from link creation
5. ❌ Invalid type → error
6. ❌ Non-existent source ID → error
7. ❌ Non-existent target ID → error
8. ❌ Self-reference → error
9. ❌ Duplicate link → error
10. ✅ JSON output format validation
