# Data Model: 統合ラベル管理システム

**Feature**: 006-memo-task | **Date**: 2025-10-15

## Entities

### Label (Existing - No Changes)

**Table**: `labels`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Label unique identifier |
| name | TEXT | NOT NULL, UNIQUE | Label name (case-sensitive) |
| description | TEXT | NULL | Optional label description |
| created_at | TEXT | NOT NULL, DEFAULT | ISO 8601 timestamp |

**Validation Rules**:
- name: Required, unique, case-sensitive
- description: Optional

**State Transitions**: None (labels are stateless)

### Issue (Existing - No Changes)

**Table**: `issues`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT | Issue unique identifier |
| type | TEXT | NOT NULL, CHECK ('memo' OR 'task') | Issue type |
| is_deleted | INTEGER | NOT NULL, DEFAULT 0 | Logical deletion flag (0=active, 1=deleted) |
| ... | ... | ... | Other fields not relevant to labels |

### IssueLabel (Existing - No Changes)

**Table**: `issue_labels`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| issue_id | INTEGER | PRIMARY KEY, FOREIGN KEY → issues(id) CASCADE | Reference to issue |
| label_id | INTEGER | PRIMARY KEY, FOREIGN KEY → labels(id) CASCADE | Reference to label |
| assigned_at | TEXT | NOT NULL, DEFAULT | ISO 8601 timestamp |

**Validation Rules**:
- Composite primary key (issue_id, label_id) prevents duplicates
- CASCADE DELETE on both foreign keys

## Relationships

```
Label (1) ←→ (N) IssueLabel (N) ←→ (1) Issue
```

- One label can be assigned to many issues (memo or task)
- One issue can have many labels
- IssueLabel is the junction table with CASCADE delete

## Repository Functions

### New: labelRepository.ts

```typescript
// List all labels in database
export function listAllLabels(db: Database): Label[];

// Create new label
export function createLabel(db: Database, name: string, description?: string): Label;

// Get single label by ID
export function getLabel(db: Database, id: number): Label;

// Get single label by name
export function getLabelByName(db: Database, name: string): Label | null;

// Delete label (CASCADE removes issue_labels)
export function deleteLabel(db: Database, name: string): void;

// Attach label to issue (reused from existing repos)
export function attachLabelToIssue(db: Database, issueId: number, labelId: number): void;
```

### Moved from memoRepository/taskRepository

```typescript
// Extract and centralize these functions:
// - attachLabels() → becomes attachLabelToIssue()
// - detachLabels() → not needed for `mgtd label set` (set is append-only)
```

## Service Layer

### LabelService

```typescript
export class LabelService {
  private readonly db: Database.Database;

  constructor(options: { config: MgtdConfig });

  // List all labels
  public list(): Label[];

  // Create label
  public create(name: string, description?: string): Label;

  // Delete label
  public delete(name: string): void;

  // Assign label to issue (memo or task)
  public assignToIssue(issueId: number, labelId: number): void;
}
```

## CLI Data Flow

```
User Input (CLI)
       ↓
Command (oclif)
       ↓
LabelService
       ↓
labelRepository
       ↓
SQLite Database
```

## Validation Summary

| Operation | Validation |
|-----------|------------|
| `label list` | None required |
| `label add` | Check name uniqueness (FR-003) |
| `label set` | Check issue exists and not deleted (FR-008), Check label exists |
| `label delete` | Check label exists, CASCADE handles issue_labels |

## Performance Considerations

- `label list`: Simple SELECT, no joins → <1ms for 1000 labels (SC-002)
- `label set`: Two lookups + INSERT → <5ms
- `label delete`: DELETE with CASCADE → <10ms for heavily-used labels
- All operations use indexed columns (id, name UNIQUE)
