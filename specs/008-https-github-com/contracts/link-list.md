# CLI Contract: mgtd link list

**Command**: `mgtd link list`
**Purpose**: 指定したタスク/メモに関連する全リンクを表示
**User Story**: P2 - View Task Relationships

## Command Signature

```bash
mgtd link list <issue-id> [--type <type>] [--json]
```

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `<issue-id>` | number | **Yes** | リンクを表示するissueのID |

## Flags

| Flag | Alias | Type | Required | Description |
|------|-------|------|----------|-------------|
| `--type` | `-t` | string | No | リンクタイプでフィルタ: `parent`, `child`, `relates`, `derived_from` |
| `--json` | `-j` | boolean | No | JSON形式で出力（デフォルト: false） |

## Input Validation

### Required Validations

1. **ID Format**: issue-idは正の整数
   - 非数値 → oclif自動エラー
   - 0以下 → エラー: `Issue ID must be positive`

2. **ID Existence**: issue-idが存在するか（チェックしない - 存在しなくても空リスト返す）
   - **Rationale**: リンクがないだけかissueが不在かを区別する必要性が低い

3. **Type Validation** (オプション指定時):
   - 無効な値 → エラー: `Invalid link type: <value>`

## Output

### Success (Human-Readable) - リンクあり

```
Links for issue #<id>:

  #<link-id>  <type>  →  Issue #<target-id>
  #<link-id>  <type>  ←  Issue #<source-id>
  ...
```

**Direction Indicators**:
- `→` (right arrow): 当該issueがsource（リンク先がtarget）
- `←` (left arrow): 当該issueがtarget（リンク元がsource）

**Example** (issue #5):
```
Links for issue #5:

  #1   parent        →  Issue #10
  #2   child         ←  Issue #10
  #3   relates       →  Issue #8
  #4   derived_from  →  Issue #2
```

**Interpretation**:
- `#1`: Issue 5の親はIssue 10
- `#2`: Issue 5はIssue 10の子
- `#3`: Issue 5はIssue 8に関連
- `#4`: Issue 5はIssue 2から派生

### Success (Human-Readable) - リンクなし

```
No links found for issue #<id>
```

### Success (JSON) - リンクあり

```json
[
  {
    "id": 1,
    "sourceIssueId": 5,
    "targetIssueId": 10,
    "linkType": "parent",
    "createdAt": "2025-10-18T10:00:00.000Z",
    "direction": "outgoing"
  },
  {
    "id": 2,
    "sourceIssueId": 10,
    "targetIssueId": 5,
    "linkType": "child",
    "createdAt": "2025-10-18T10:05:00.000Z",
    "direction": "incoming"
  }
]
```

**Additional Field** (`direction`):
- `"outgoing"`: 当該issueがsourceのリンク
- `"incoming"`: 当該issueがtargetのリンク

**Note**: この`direction`フィールドはJSON出力専用（DB上には存在しない）

### Success (JSON) - リンクなし

```json
[]
```

### Error Cases

| Error Condition | Exit Code | Error Message |
|-----------------|-----------|---------------|
| Invalid type filter | 1 | `Invalid link type: <value>. Must be one of: parent, child, relates, derived_from` |
| Issue ID ≤ 0 | 1 | `Issue ID must be positive` |

## Query Logic

### Bidirectional Search

指定されたissue IDに対して、source/target両方向でクエリ：

```sql
SELECT * FROM links
WHERE (source_issue_id = ? OR target_issue_id = ?)
  AND (? IS NULL OR link_type = ?)
ORDER BY created_at ASC
```

**Parameters**: `[issueId, issueId, typeFilter, typeFilter]`

### Direction Determination

各リンクレコードに対して：
- `sourceIssueId === 指定ID` → outgoing（→）
- `targetIssueId === 指定ID` → incoming（←）

## Examples

### Example 1: 全リンクの表示

```bash
$ mgtd link list 5

Links for issue #5:

  #1   parent        →  Issue #10
  #3   relates       →  Issue #8
```

### Example 2: typeフィルタ適用

```bash
$ mgtd link list 5 --type parent

Links for issue #5:

  #1   parent        →  Issue #10
```

### Example 3: リンクなしのケース

```bash
$ mgtd link list 99

No links found for issue #99
```

### Example 4: JSON出力

```bash
$ mgtd link list 5 --json

[
  {
    "id": 1,
    "sourceIssueId": 5,
    "targetIssueId": 10,
    "linkType": "parent",
    "createdAt": "2025-10-18T10:00:00.000Z",
    "direction": "outgoing"
  },
  {
    "id": 3,
    "sourceIssueId": 5,
    "targetIssueId": 8,
    "linkType": "relates",
    "createdAt": "2025-10-18T11:00:00.000Z",
    "direction": "outgoing"
  }
]
```

### Example 5: typeフィルタ + JSON

```bash
$ mgtd link list 5 --type parent --json

[
  {
    "id": 1,
    "sourceIssueId": 5,
    "targetIssueId": 10,
    "linkType": "parent",
    "createdAt": "2025-10-18T10:00:00.000Z",
    "direction": "outgoing"
  }
]
```

### Example 6: 双方向リンクの表示

```bash
$ mgtd link list 10

Links for issue #10:

  #1   parent        ←  Issue #5
  #2   child         →  Issue #5
```

**Interpretation**:
- Issue 10はIssue 5の親である（Issue 5から見たparentリンク）
- Issue 10の子はIssue 5である（Issue 10から見たchildリンク）

## Implementation Notes

### Direction Field (JSON Only)

`direction`フィールドはView層で計算：

```typescript
const links = linkRepository.listLinks(db, issueId, filters);
const enriched = links.map(link => ({
  ...link,
  direction: link.sourceIssueId === issueId ? 'outgoing' : 'incoming'
}));
```

### Formatting (Human-Readable)

Arrow direction:
- `→` (U+2192): outgoing
- `←` (U+2190): incoming

Column alignment（推奨）:
```
  #1   parent        →  Issue #10
  #12  relates       ←  Issue #3
```

固定幅でpadding調整。

### Empty Result Handling

- Human-Readable: 明示的メッセージ `"No links found for issue #<id>"`
- JSON: 空配列 `[]`

## Test Scenarios

### Contract Tests

1. ✅ List all links for issue with multiple links
2. ✅ List links with type filter (parent)
3. ✅ List links with type filter (child)
4. ✅ List links with type filter (relates)
5. ✅ List links with type filter (derived_from)
6. ✅ List links for issue with no links (empty)
7. ✅ JSON output format validation (with links)
8. ✅ JSON output format validation (empty)
9. ✅ Direction field correctness (outgoing)
10. ✅ Direction field correctness (incoming)
11. ✅ Bidirectional links displayed correctly
12. ❌ Invalid type filter → error
