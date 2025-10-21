# API Contract Changes: Include Labels in Responses

**Feature**: Include Labels in API Responses
**Date**: 2025-10-21
**Type**: Additive (Backward Compatible)

## Overview

This document specifies the changes to existing API endpoints to include label information in responses.

## Changed Endpoints

### 1. GET /api/memos

**Purpose**: List all memos

**Response Schema Changes**:

```diff
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "type": { "type": "string", "enum": ["memo"] },
      "title": { "type": "null" },
      "bodyMd": { "type": "string" },
      "status": { "type": "null" },
      "scheduledOn": { "type": "null" },
      "meta": { "type": "object" },
      "isBookmarked": { "type": "boolean" },
      "isDeleted": { "type": "boolean" },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" },
+     "labels": {
+       "type": "array",
+       "items": { "type": "string" },
+       "description": "Array of label names assigned to this memo"
+     }
    },
-   "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt"]
+   "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt", "labels"]
  }
}
```

**Example Response** (After):

```json
[
  {
    "id": 1,
    "type": "memo",
    "title": null,
    "bodyMd": "First memo",
    "status": null,
    "scheduledOn": null,
    "meta": {},
    "isBookmarked": true,
    "isDeleted": false,
    "createdAt": "2025-10-13T10:28:50.411Z",
    "updatedAt": "2025-10-20T11:19:24.925Z",
    "labels": ["important", "work"]
  },
  {
    "id": 2,
    "type": "memo",
    "bodyMd": "Second memo",
    "labels": []
  }
]
```

---

### 2. GET /api/memos/:id

**Purpose**: Get memo detail

**Response Schema Changes**:

```diff
{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "type": { "type": "string", "enum": ["memo"] },
    "title": { "type": "null" },
    "bodyMd": { "type": "string" },
    "status": { "type": "null" },
    "scheduledOn": { "type": "null" },
    "meta": { "type": "object" },
    "isBookmarked": { "type": "boolean" },
    "isDeleted": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
+   "labels": {
+     "type": "array",
+     "items": { "type": "string" },
+     "description": "Array of label names assigned to this memo"
+   },
    "commentsCount": { "type": "integer", "minimum": 0 }
  },
- "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt"]
+ "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt", "labels"]
}
```

**Example Response** (After):

```json
{
  "id": 1,
  "type": "memo",
  "title": null,
  "bodyMd": "First memo with details",
  "status": null,
  "scheduledOn": null,
  "meta": {},
  "isBookmarked": true,
  "isDeleted": false,
  "createdAt": "2025-10-13T10:28:50.411Z",
  "updatedAt": "2025-10-20T11:19:24.925Z",
  "labels": ["important", "urgent", "work"],
  "commentsCount": 3
}
```

---

### 3. GET /api/tasks

**Purpose**: List all tasks

**Query Parameters**: No changes
- `status`: Filter by task status (optional)
- `bookmarked`: Filter by bookmark status (optional)

**Response Schema Changes**:

```diff
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": { "type": "integer" },
      "type": { "type": "string", "enum": ["task"] },
      "title": { "type": "string" },
      "bodyMd": { "type": "string" },
      "status": {
        "type": "string",
        "enum": ["open", "next", "waiting", "scheduled", "done", "canceled"]
      },
      "scheduledOn": { "type": "string", "format": "date", "nullable": true },
      "meta": { "type": "object" },
      "isBookmarked": { "type": "boolean" },
      "isDeleted": { "type": "boolean" },
      "createdAt": { "type": "string", "format": "date-time" },
      "updatedAt": { "type": "string", "format": "date-time" },
+     "labels": {
+       "type": "array",
+       "items": { "type": "string" },
+       "description": "Array of label names assigned to this task"
+     }
    },
-   "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt"]
+   "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt", "labels"]
  }
}
```

**Example Response** (After):

```json
[
  {
    "id": 10,
    "type": "task",
    "title": "Fix authentication bug",
    "bodyMd": "Users can't log in",
    "status": "open",
    "scheduledOn": "2025-10-22",
    "meta": {},
    "isBookmarked": false,
    "isDeleted": false,
    "createdAt": "2025-10-20T14:30:00.000Z",
    "updatedAt": "2025-10-20T14:30:00.000Z",
    "labels": ["bug", "urgent"]
  }
]
```

---

### 4. GET /api/tasks/:id

**Purpose**: Get task detail

**Response Schema Changes**:

```diff
{
  "type": "object",
  "properties": {
    "id": { "type": "integer" },
    "type": { "type": "string", "enum": ["task"] },
    "title": { "type": "string" },
    "bodyMd": { "type": "string" },
    "status": {
      "type": "string",
      "enum": ["open", "next", "waiting", "scheduled", "done", "canceled"]
    },
    "scheduledOn": { "type": "string", "format": "date", "nullable": true },
    "meta": { "type": "object" },
    "isBookmarked": { "type": "boolean" },
    "isDeleted": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" },
+   "labels": {
+     "type": "array",
+     "items": { "type": "string" },
+     "description": "Array of label names assigned to this task"
+   },
    "commentsCount": { "type": "integer", "minimum": 0 }
  },
- "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt"]
+ "required": ["id", "type", "title", "bodyMd", "status", "scheduledOn", "meta", "isBookmarked", "isDeleted", "createdAt", "updatedAt", "labels"]
}
```

**Example Response** (After):

```json
{
  "id": 10,
  "type": "task",
  "title": "Fix authentication bug",
  "bodyMd": "Users can't log in with OAuth",
  "status": "open",
  "scheduledOn": "2025-10-22",
  "meta": {},
  "isBookmarked": false,
  "isDeleted": false,
  "createdAt": "2025-10-20T14:30:00.000Z",
  "updatedAt": "2025-10-20T14:30:00.000Z",
  "labels": ["bug", "security", "urgent"],
  "commentsCount": 2
}
```

## Unchanged Endpoints

All other endpoints remain unchanged:
- POST /api/memos
- PATCH /api/memos/:id
- DELETE /api/memos/:id
- POST /api/memos/:id/promote
- POST /api/memos/:id/bookmark
- POST /api/memos/:id/unbookmark
- POST /api/tasks
- PATCH /api/tasks/:id
- DELETE /api/tasks/:id
- POST /api/tasks/:id/close
- POST /api/tasks/:id/cancel
- POST /api/tasks/:id/reopen
- POST /api/tasks/:id/bookmark
- POST /api/tasks/:id/unbookmark
- All comment endpoints
- All label endpoints
- All link endpoints

## Backward Compatibility

**Guarantee**: Existing API consumers will continue to work without modification.

**Reasoning**:
- Adding a new required field to responses is backward compatible
- Clients that don't expect the field will ignore it
- Clients that do expect the field can start using it immediately
- No breaking changes to existing fields
- No changes to request formats

## Versioning

**API Version**: No version bump required (additive change only)

**OpenAPI Spec**: Will be regenerated to reflect new `labels` field

**Client Libraries**: Will be regenerated from updated OpenAPI spec

## Testing Contract

### Happy Path Tests

1. **List with labels**: GET /api/memos returns items with populated `labels` arrays
2. **List without labels**: GET /api/tasks returns items with empty `labels: []`
3. **Detail with labels**: GET /api/memos/:id returns item with `labels` array
4. **Detail without labels**: GET /api/tasks/:id returns `labels: []`

### Edge Case Tests

1. **Many labels**: Item with 20+ labels returns all labels
2. **Special characters**: Labels with Unicode/special chars returned correctly
3. **Sorted order**: Labels are alphabetically sorted
4. **No duplicates**: Duplicate label assignments appear once

### Error Cases (No Changes)

- 404 when item not found (unchanged)
- 400 for invalid query parameters (unchanged)
