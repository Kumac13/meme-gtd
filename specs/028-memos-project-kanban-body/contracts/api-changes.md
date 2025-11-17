# API Contract Changes

**Feature**: 028-memos-project-kanban-body
**Date**: 2025-11-17

## Overview

This feature modifies one existing API endpoint to include `bodyMd` field in kanban project item responses.

**No new endpoints created** - changes are additive to existing endpoint.

---

## Modified Endpoint

### GET `/api/projects/:id`

**Description**: Get project details with all associated items (used for kanban view)

**Path Parameters**:
- `id` (number, required): Project ID

**Response Type**: `ProjectDetail`

#### Response Schema Changes

**BEFORE**:
```typescript
{
  id: number;
  name: string;
  description: string | null;
  viewMeta: {
    viewType: 'board' | 'table';
    columns?: string[];
  };
  items: Array<{
    id: number;
    projectId: number;
    issueId: number;
    position: number;
    viewMeta: { column?: string } | null;
    issue: {
      id: number;
      type: 'task' | 'memo';
      title: string;
      status: string | null;
      // ❌ bodyMd missing
    };
  }>;
  createdAt: string;
}
```

**AFTER**:
```typescript
{
  id: number;
  name: string;
  description: string | null;
  viewMeta: {
    viewType: 'board' | 'table';
    columns?: string[];
  };
  items: Array<{
    id: number;
    projectId: number;
    issueId: number;
    position: number;
    viewMeta: { column?: string } | null;
    issue: {
      id: number;
      type: 'task' | 'memo';
      title: string;
      bodyMd: string;  // ✏️ ADDED
      status: string | null;
    };
  }>;
  createdAt: string;
}
```

#### Example Response

**Request**:
```http
GET /api/projects/4 HTTP/1.1
Host: localhost:3000
Accept: application/json
```

**Response** (AFTER changes):
```json
{
  "id": 4,
  "name": "お金を可視化する",
  "description": null,
  "viewMeta": {
    "viewType": "board",
    "columns": ["Documents", "Inbox", "Next"]
  },
  "items": [
    {
      "id": 123,
      "projectId": 4,
      "issueId": 24,
      "position": 1.0,
      "viewMeta": {
        "column": "Documents"
      },
      "issue": {
        "id": 24,
        "type": "memo",
        "title": "",
        "bodyMd": "# お金について\n## Rule - Suica は極力使わない...",
        "status": null
      },
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    },
    {
      "id": 124,
      "projectId": 4,
      "issueId": 42,
      "position": 2.0,
      "viewMeta": {
        "column": "Next"
      },
      "issue": {
        "id": 42,
        "type": "task",
        "title": "Monthly budget review",
        "bodyMd": "Review all expenses from last month\n- Check credit card statements\n- Update budget spreadsheet",
        "status": "next"
      },
      "createdAt": "2025-01-16T09:00:00.000Z",
      "updatedAt": "2025-01-16T09:00:00.000Z"
    }
  ],
  "createdAt": "2025-01-10T12:00:00.000Z"
}
```

**Status Codes**:
- `200 OK`: Success
- `404 Not Found`: Project not found
- `500 Internal Server Error`: Database error

---

## Breaking Change Analysis

**Is this a breaking change?** ❌ **NO**

**Rationale**:
- Change is **additive** (adds `bodyMd` field, doesn't remove anything)
- Existing clients that don't use `bodyMd` continue to work
- TypeScript clients get new field automatically (no code changes required)
- Frontend components that ignore `bodyMd` are unaffected

**Affected Clients**:
- `packages/web` (will use new field)
- External API consumers (field is optional/ignored if not used)

**Migration Required**: None - existing clients compatible

---

## Backend Implementation Changes

### Repository Layer

**File**: `packages/db/src/projectItemRepository.ts`

**Function**: `getProjectItemsWithIssues(projectId: number)`

**SQL Change**:
```sql
-- ADD this column to SELECT
SELECT
  -- ... existing columns
  i.body_md as issue_body_md  -- ← ADD
FROM project_items pi
JOIN issues i ON pi.issue_id = i.id
WHERE pi.project_id = ?
```

**Mapping Change**:
```typescript
// Map database row to ProjectItemWithIssue
{
  // ... existing fields
  issue: {
    id: row.issue_id,
    type: row.issue_type,
    title: row.issue_title,
    bodyMd: row.issue_body_md,  // ← ADD mapping
    status: row.issue_status
  }
}
```

---

## Frontend Contract

### Component Props

**File**: `packages/web/src/components/KanbanCard.tsx`

**Props Type**: `KanbanCardProps`

```typescript
interface KanbanCardProps {
  item: ProjectItemWithIssue;  // Now includes issue.bodyMd
}
```

**Usage**:
```tsx
export default function KanbanCard({ item }: KanbanCardProps) {
  const firstLine = extractFirstLine(item.issue.bodyMd || '', 80);

  return (
    <div>
      {item.issue.type === 'memo' ? (
        <InlineMarkdownRenderer content={firstLine} />
      ) : (
        item.issue.title
      )}
    </div>
  );
}
```

---

## Contract Testing

### Test Cases

**File**: `packages/api/tests/integration/projects.test.ts` (or similar)

```typescript
describe('GET /api/projects/:id', () => {
  it('should include bodyMd in issue objects', async () => {
    // Create project with memo
    const project = await createProject({ name: 'Test' });
    const memo = await createMemo({ bodyMd: '# Test Heading\nBody' });
    await addIssueToProject(project.id, memo.id);

    // Fetch project
    const response = await api.get(`/projects/${project.id}`);

    // Verify bodyMd present
    expect(response.status).toBe(200);
    expect(response.data.items[0].issue.bodyMd).toBe('# Test Heading\nBody');
  });

  it('should include bodyMd for both memos and tasks', async () => {
    const project = await createProject({ name: 'Test' });
    const memo = await createMemo({ bodyMd: 'Memo body' });
    const task = await createTask({ title: 'Task', bodyMd: 'Task body' });
    await addIssueToProject(project.id, memo.id);
    await addIssueToProject(project.id, task.id);

    const response = await api.get(`/projects/${project.id}`);

    const memoItem = response.data.items.find(i => i.issue.type === 'memo');
    const taskItem = response.data.items.find(i => i.issue.type === 'task');

    expect(memoItem.issue.bodyMd).toBe('Memo body');
    expect(taskItem.issue.bodyMd).toBe('Task body');
  });
});
```

---

## Error Handling

### Scenario: Missing `body_md` in Database

**Should not occur** - `body_md` column is `TEXT NOT NULL`

**If it somehow occurs** (data corruption):
```typescript
// Repository should handle with default
bodyMd: row.issue_body_md || ''  // Fallback to empty string
```

Frontend handles empty string:
```typescript
if (!item.issue.bodyMd.trim()) {
  return <span>Memo #{item.issueId}</span>;
}
```

### Scenario: Very Large `bodyMd` (>1MB)

**Current behavior**: Database allows, API returns full content

**Performance impact**: Minimal (text compression via HTTP, only first line rendered)

**No change needed** - truncation happens on frontend

---

## Versioning

**API Version**: No version number change

**Rationale**:
- Additive change only
- Backward compatible
- No client migration required

**If versioning were needed** (hypothetical):
- `/api/v2/projects/:id` - new version with `bodyMd`
- `/api/v1/projects/:id` - old version without `bodyMd`

**Decision**: Not needed for this change

---

## Documentation Updates

**OpenAPI Schema** (`packages/api/docs/api/openapi.yaml`):

```yaml
components:
  schemas:
    ProjectItemWithIssue:
      type: object
      properties:
        # ... existing fields
        issue:
          type: object
          properties:
            id:
              type: integer
            type:
              type: string
              enum: [task, memo]
            title:
              type: string
            bodyMd:              # ← ADD
              type: string       # ← ADD
              description: "Markdown body content of the issue"  # ← ADD
            status:
              type: string
              nullable: true
```

**Generate TypeScript client** (after OpenAPI update):
```bash
cd packages/web
pnpm generate:api
```

---

## Summary

**Modified Endpoints**: 1 (`GET /api/projects/:id`)
**New Endpoints**: 0
**Breaking Changes**: No
**Type Changes**: Add `bodyMd: string` to `ProjectItemWithIssue.issue`
**Backend Changes**: Add `body_md` to SELECT query + response mapping
**Frontend Changes**: Use `item.issue.bodyMd` in KanbanCard
**Testing**: Integration test verifies `bodyMd` present in response
**Documentation**: Update OpenAPI schema
