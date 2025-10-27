# API Endpoints Contract: Project Detail Views

**Feature**: 019-projects-implement-projects
**Created**: 2025-10-27

## Overview

This document defines the API contract for the Project Detail Page feature. **All endpoints are already implemented** in Feature #19 - this document serves as a reference for frontend implementation.

**Backend Implementation**: `/packages/api/src/routes/projects.ts`

## Endpoints Used

### GET /api/projects/:id

Retrieve complete project details including all associated items.

**URL**: `/api/projects/:id`

**Method**: `GET`

**URL Parameters**:
- `id` (required): Project ID (integer)

**Request Headers**:
```
Content-Type: application/json
```

**Response** (200 OK):
```json
{
  "id": 5,
  "name": "Q1 2025 Goals",
  "description": "High priority tasks for Q1",
  "viewMeta": {
    "viewType": "board",
    "columns": ["Open", "In Progress", "Done"]
  },
  "createdAt": "2025-01-01T00:00:00Z",
  "items": [
    {
      "id": 1,
      "projectId": 5,
      "issueId": 33,
      "position": 1.0,
      "viewMeta": { "column": "Open" },
      "createdAt": "2025-01-02T00:00:00Z",
      "updatedAt": "2025-01-02T00:00:00Z",
      "issue": {
        "id": 33,
        "type": "task",
        "title": "Implement authentication"
      }
    },
    {
      "id": 2,
      "projectId": 5,
      "issueId": 45,
      "position": 1.0,
      "viewMeta": { "column": "Done" },
      "createdAt": "2025-01-03T00:00:00Z",
      "updatedAt": "2025-01-03T00:00:00Z",
      "issue": {
        "id": 45,
        "type": "memo",
        "title": "Meeting notes from Jan 3"
      }
    }
  ]
}
```

**Response** (404 Not Found):
```json
{
  "error": "Project not found",
  "statusCode": 404
}
```

**Response** (500 Internal Server Error):
```json
{
  "error": "Internal server error",
  "statusCode": 500
}
```

**Frontend Usage**:
```typescript
import { ProjectsService } from '../api/services/ProjectsService';

const project = await ProjectsService.getProject(String(id));
```

**Use Cases**:
- Initial page load for `/projects/:id/kanban`
- Initial page load for `/projects/:id/list`
- Refresh after item operations

---

### PATCH /api/projects/:id/items/:issueId

Update project item position and/or column.

**URL**: `/api/projects/:id/items/:issueId`

**Method**: `PATCH`

**URL Parameters**:
- `id` (required): Project ID (integer)
- `issueId` (required): Issue ID (integer)

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "column": "Done",
  "position": 2.5
}
```

**Request Body Fields**:
- `column` (optional): string - New column name (must exist in project.viewMeta.columns)
- `position` (optional): number - New position within column (fractional for ordering)

**Note**: At least one field (column or position) must be provided.

**Response** (200 OK):
```json
{
  "id": 1,
  "projectId": 5,
  "issueId": 33,
  "position": 2.5,
  "viewMeta": { "column": "Done" },
  "createdAt": "2025-01-02T00:00:00Z",
  "updatedAt": "2025-01-27T10:30:00Z"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Column 'Invalid' does not exist in project",
  "statusCode": 400
}
```

**Response** (404 Not Found):
```json
{
  "error": "Project item not found",
  "statusCode": 404
}
```

**Response** (500 Internal Server Error):
```json
{
  "error": "Internal server error",
  "statusCode": 500
}
```

**Frontend Usage**:
```typescript
import { ProjectsService } from '../api/services/ProjectsService';

// Drag-and-drop: move item to new column
await ProjectsService.updateProjectItem(projectId, issueId, {
  column: 'Done',
  position: 2.5
});
```

**Use Cases**:
- Drag-and-drop card between columns
- Reorder card within same column
- Update item metadata

---

### POST /api/projects/:id/items

Add an item (task or memo) to the project.

**URL**: `/api/projects/:id/items`

**Method**: `POST`

**URL Parameters**:
- `id` (required): Project ID (integer)

**Request Headers**:
```
Content-Type: application/json
```

**Request Body**:
```json
{
  "issueId": 67,
  "column": "Open",
  "position": 1.0
}
```

**Request Body Fields**:
- `issueId` (required): number - Issue ID to add (must exist)
- `column` (optional): string - Initial column (defaults to first column if board view)
- `position` (optional): number - Initial position (defaults to end of column)

**Response** (201 Created):
```json
{
  "id": 10,
  "projectId": 5,
  "issueId": 67,
  "position": 1.0,
  "viewMeta": { "column": "Open" },
  "createdAt": "2025-01-27T10:35:00Z",
  "updatedAt": "2025-01-27T10:35:00Z"
}
```

**Response** (400 Bad Request):
```json
{
  "error": "Issue ID is required",
  "statusCode": 400
}
```

**Response** (404 Not Found):
```json
{
  "error": "Project not found",
  "statusCode": 404
}
```

**Response** (409 Conflict):
```json
{
  "error": "Issue already exists in project",
  "statusCode": 409
}
```

**Response** (500 Internal Server Error):
```json
{
  "error": "Internal server error",
  "statusCode": 500
}
```

**Frontend Usage**:
```typescript
import { ProjectsService } from '../api/services/ProjectsService';

// Add task to project (from project detail page)
await ProjectsService.addProjectItem(projectId, {
  issueId: taskId,
  column: 'Open'
});
```

**Use Cases**:
- Add button on project detail page
- Quick add from search/dropdown

---

### DELETE /api/projects/:id/items/:issueId

Remove an item from the project.

**URL**: `/api/projects/:id/items/:issueId`

**Method**: `DELETE`

**URL Parameters**:
- `id` (required): Project ID (integer)
- `issueId` (required): Issue ID (integer)

**Request Headers**: None required

**Response** (204 No Content):
No response body.

**Response** (404 Not Found):
```json
{
  "error": "Project item not found",
  "statusCode": 404
}
```

**Response** (500 Internal Server Error):
```json
{
  "error": "Internal server error",
  "statusCode": 500
}
```

**Frontend Usage**:
```typescript
import { ProjectsService } from '../api/services/ProjectsService';

// Remove item from project
await ProjectsService.removeProjectItem(projectId, issueId);
```

**Use Cases**:
- Remove button on Kanban card
- Bulk remove operation

---

## Frontend Service Methods

All methods are available in `/packages/web/src/api/services/ProjectsService.ts`:

```typescript
export class ProjectsService {
  /**
   * Get project details with associated items
   * @param id Project ID
   * @returns Project with items
   */
  static async getProject(id: string): Promise<ProjectDetail>;

  /**
   * Update project item position and/or column
   * @param projectId Project ID
   * @param issueId Issue ID
   * @param data Update data (column, position)
   * @returns Updated project item
   */
  static async updateProjectItem(
    projectId: string | number,
    issueId: string | number,
    data: { column?: string; position?: number }
  ): Promise<ProjectItem>;

  /**
   * Add item to project
   * @param projectId Project ID
   * @param data Item data (issueId, column, position)
   * @returns Created project item
   */
  static async addProjectItem(
    projectId: string | number,
    data: { issueId: number; column?: string; position?: number }
  ): Promise<ProjectItem>;

  /**
   * Remove item from project
   * @param projectId Project ID
   * @param issueId Issue ID
   */
  static async removeProjectItem(
    projectId: string | number,
    issueId: string | number
  ): Promise<void>;
}
```

## Error Handling Patterns

### Standard Error Handling

```typescript
try {
  setLoading(true);
  setError(null);
  const result = await ProjectsService.updateProjectItem(projectId, issueId, { column: 'Done' });
  // Success: update local state
  setItems(prevItems => /* update logic */);
} catch (err) {
  setError(err instanceof Error ? err.message : 'Failed to update item');
  console.error('Update failed:', err);
  // Revert optimistic update if applicable
} finally {
  setLoading(false);
}
```

### Optimistic Update Pattern

```typescript
// 1. Optimistic update (immediate UI change)
setItems(prevItems => updateItemColumn(prevItems, itemId, newColumn));

// 2. API call
try {
  await ProjectsService.updateProjectItem(projectId, itemId, { column: newColumn });
  // Success: optimistic update already applied, nothing to do
} catch (err) {
  // 3. Revert on failure
  setItems(prevItems => revertItemColumn(prevItems, itemId, oldColumn));
  setError('Failed to move item: ' + err.message);
}
```

## Rate Limiting & Performance

**No rate limiting** currently implemented on backend.

**Performance Considerations**:
- Debounce multiple drag operations (only send final position)
- Batch updates if moving multiple items (future enhancement)
- Cache project data to avoid unnecessary refetches

## Data Consistency

### Concurrent Updates

**Scenario**: Two users drag same item simultaneously

**Backend Behavior**: Last write wins (optimistic locking not implemented)

**Frontend Handling**:
1. User A drags item to column "Done"
2. User B drags same item to column "In Progress"
3. Both requests succeed (last one wins)
4. Frontend refetches on next action or periodic refresh

**Recommendation**: Show warning if data becomes stale (future enhancement)

### Stale Data Detection

**Not currently implemented** - future enhancement considerations:
- WebSocket updates for real-time sync
- Polling for changes every N seconds
- ETag/If-Match headers for optimistic locking

## Testing Considerations

### Unit Tests

Test service methods with mocked fetch:
```typescript
import { ProjectsService } from './ProjectsService';

// Mock fetch
global.fetch = vi.fn();

test('getProject returns project detail', async () => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => mockProjectDetail
  });

  const result = await ProjectsService.getProject('5');
  expect(result).toEqual(mockProjectDetail);
});
```

### Integration Tests

Test API endpoints with real backend:
```typescript
test('PATCH /api/projects/:id/items/:issueId updates item', async () => {
  const response = await fetch('/api/projects/5/items/33', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ column: 'Done' })
  });

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.viewMeta.column).toBe('Done');
});
```

### E2E Tests

Test drag-and-drop with Playwright:
```typescript
test('drag card between columns', async ({ page }) => {
  await page.goto('/projects/5/kanban');

  // Drag card from Open to Done
  await page.dragAndDrop(
    '[data-card-id="33"]',
    '[data-column="Done"]'
  );

  // Verify API call
  const request = await page.waitForRequest(req =>
    req.url().includes('/api/projects/5/items/33') &&
    req.method() === 'PATCH'
  );

  expect(await request.postDataJSON()).toMatchObject({
    column: 'Done'
  });
});
```

## Backend Implementation Reference

**Location**: `/packages/api/src/routes/projects.ts`

**Handlers**: `/packages/api/src/handlers/projectHandlers.ts`

**Schemas**: `/packages/api/src/schemas/projectSchemas.ts`

**Database**: `/packages/db/src/projectRepository.ts`

All endpoints are fully implemented and tested.
