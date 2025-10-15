# CLI Command Contracts: 統合ラベル管理システム

**Feature**: 006-memo-task | **Date**: 2025-10-15

## Command: `mgtd label list`

**Purpose**: List all labels in the database

**Usage**:
```bash
mgtd label list [--json]
```

**Arguments**: None

**Flags**:
| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--json` | boolean | No | Output as JSON array |

**Output** (default):
```
1	bug
2	feature
3	urgent
```

**Output** (`--json`):
```json
[
  {
    "id": 1,
    "name": "bug",
    "description": null,
    "created_at": "2025-10-15T10:00:00Z"
  },
  {
    "id": 2,
    "name": "feature",
    "description": "New features",
    "created_at": "2025-10-15T10:01:00Z"
  }
]
```

**Exit Codes**:
- 0: Success
- 1: General error

---

## Command: `mgtd label create`

**Purpose**: Create a new label

**Usage**:
```bash
mgtd label create <name> [--description <text>] [--json]
```

**Arguments**:
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Label name (case-sensitive, unique) |

**Flags**:
| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--description`, `-d` | string | No | Label description |
| `--json` | boolean | No | Output as JSON object |

**Output** (default):
```
Label 'documentation' created
```

**Output** (`--json`):
```json
{
  "id": 5,
  "name": "documentation",
  "description": "Documentation updates",
  "created_at": "2025-10-15T12:00:00Z"
}
```

**Error Cases**:
- Duplicate name: `Label 'bug' already exists`
- Empty name: `Label name is required`

**Exit Codes**:
- 0: Success
- 1: Label already exists or validation error

---

## Command: `mgtd label set`

**Purpose**: Assign a label to an issue (memo or task)

**Usage**:
```bash
mgtd label set <issue-id> <label-id> [--json]
```

**Arguments**:
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `issue-id` | integer | Yes | Issue ID (memo or task) |
| `label-id` | integer | Yes | Label ID |

**Flags**:
| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--json` | boolean | No | Output as JSON object |

**Output** (default):
```
Label assigned to issue #5
```

**Output** (`--json`):
```json
{
  "issue_id": 5,
  "label_id": 2,
  "assigned_at": "2025-10-15T12:05:00Z"
}
```

**Error Cases**:
- Issue not found: `Issue #999 not found`
- Issue deleted: `Issue not found or deleted`
- Label not found: `Label #999 not found`

**Exit Codes**:
- 0: Success (including idempotent re-assignment)
- 1: Issue or label not found

---

## Command: `mgtd label delete`

**Purpose**: Delete a label (CASCADE removes from all issues)

**Usage**:
```bash
mgtd label delete <name> [--json]
```

**Arguments**:
| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Label name |

**Flags**:
| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--json` | boolean | No | Output as JSON object |

**Output** (default):
```
Label 'obsolete' deleted
```

**Output** (`--json`):
```json
{
  "name": "obsolete",
  "deleted": true
}
```

**Error Cases**:
- Label not found: `Label 'nonexistent' not found`

**Exit Codes**:
- 0: Success
- 1: Label not found

---

## Removed Commands

The following commands must be deleted and return "command not found":

- `mgtd memo label`
- `mgtd memo label create`
- `mgtd memo label set`
- `mgtd memo label remove`
- `mgtd task label`
- `mgtd task label create`
- `mgtd task label set`
- `mgtd task label remove`

**Expected Behavior**: Command not recognized by CLI (not just deprecation warning)
