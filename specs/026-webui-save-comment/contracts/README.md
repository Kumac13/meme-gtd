# API Contracts: Keyboard Shortcuts for Save and Comment Actions

**Phase**: 1 (Design & Contracts)
**Date**: 2025-11-11
**Feature**: [spec.md](../spec.md) | [plan.md](../plan.md)

## Overview

This feature is a **UI-only enhancement** with no API changes. This directory exists for completeness but contains no new API contracts.

## API Changes

**Status**: ❌ NONE

No API endpoints are added, modified, or removed. The feature uses existing API contracts:

### Existing APIs Used (No Changes)

#### Tasks API
- `POST /api/tasks` - Create task (used by TaskForm)
- `PUT /api/tasks/:id` - Update task (used by TaskForm)
- `GET /api/tasks` - List tasks (not affected)
- `GET /api/tasks/:id` - Get task details (not affected)

#### Memos API
- `POST /api/memos` - Create memo (used by MemoForm)
- `PUT /api/memos/:id` - Update memo (used by EditableContent)
- `GET /api/memos` - List memos (not affected)

#### Comments API
- `POST /api/tasks/:id/comments` - Add task comment (used by CommentSection)
- `POST /api/memos/:id/comments` - Add memo comment (used by CommentSection)

#### Projects API
- `POST /api/projects` - Create project (used by ProjectForm, if modified)
- `PUT /api/projects/:id` - Update project (used by ProjectForm, if modified)

## Request/Response Changes

**Status**: ❌ NONE

All request and response schemas remain unchanged. The keyboard shortcut triggers the same API calls as clicking the Save/Comment button, with identical:

- Request headers
- Request body structure
- Response status codes
- Response body structure
- Error handling

## Authentication/Authorization

**Status**: ♻️ UNCHANGED

No changes to authentication or authorization logic. The keyboard shortcut operates within the same user session and permissions as button clicks.

## Rate Limiting

**Status**: ♻️ UNCHANGED

No changes to rate limiting. The feature does not increase API call frequency (same number of calls, different trigger mechanism).

## Versioning

**Status**: ❌ NOT APPLICABLE

No API version changes required.

## Breaking Changes

**Status**: ✅ NONE

This is a non-breaking, additive UI enhancement.

## Client-Side Type Definitions

**Status**: ♻️ UNCHANGED

All TypeScript types remain the same:

```typescript
// Existing types - no changes
interface Task {
  id: string;
  title: string;
  body?: string;
  status: TaskStatus;
  projectId?: string;
  labels?: Label[];
}

interface Memo {
  id: string;
  body: string;
  createdAt: string;
}

interface Comment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
}
```

## Summary

**Zero API contract changes**:

- ✅ No new endpoints
- ✅ No modified endpoints
- ✅ No schema changes
- ✅ No authentication changes
- ✅ No breaking changes
- ✅ 100% backward compatible

This is a **pure frontend feature** requiring no backend coordination.
