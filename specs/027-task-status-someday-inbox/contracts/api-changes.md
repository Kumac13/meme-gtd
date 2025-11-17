# API Contract Changes: Add "inbox" and "someday" Task Statuses

**Feature**: 027-task-status-someday-inbox
**Date**: 2025-11-17
**OpenAPI File**: `packages/api/docs/api/openapi.yaml`

## Overview

This document describes the changes required to the OpenAPI 3.0 specification to support the new task statuses `inbox` and `someday`. All `status` enum definitions must be updated from 6 values to 8 values.

---

## Changes Required

### 1. POST /api/tasks - Request Body Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: 1212-1218

**Current**:
```yaml
status:
  type: string
  enum:
    - open
    - next
    - waiting
    - scheduled
    - done
    - canceled
  description: Task status (defaults to "open")
```

**Updated** (GTD workflow order per FR-017):
```yaml
status:
  type: string
  enum:
    - inbox
    - open
    - next
    - waiting
    - scheduled
    - someday
    - done
    - canceled
  description: |
    Task status (defaults to "open")
    - inbox: Newly captured task, not yet triaged
    - open: Reviewed but not prioritized
    - next: High-priority next action
    - waiting: Blocked or delegated
    - scheduled: Time-specific commitment
    - someday: Deferred non-actionable idea
    - done: Completed
    - canceled: Abandoned
```

---

### 2. POST /api/tasks - Response Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: 1254-1260

**Current**:
```yaml
status:
  type: string
  enum:
    - open
    - next
    - waiting
    - scheduled
    - done
    - canceled
  description: Current task status
```

**Updated**:
```yaml
status:
  type: string
  enum:
    - inbox
    - open
    - next
    - waiting
    - scheduled
    - someday
    - done
    - canceled
  description: Current task status (see request body for detailed descriptions)
```

---

### 3. GET /api/tasks - Query Parameter Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: ~1336-1342 (approximate)

**Current**:
```yaml
- schema:
    type: string
    enum:
      - open
      - next
      - waiting
      - scheduled
      - done
      - canceled
  in: query
  name: status
  required: false
  description: Filter by task status
```

**Updated**:
```yaml
- schema:
    type: string
    enum:
      - inbox
      - open
      - next
      - waiting
      - scheduled
      - someday
      - done
      - canceled
  in: query
  name: status
  required: false
  description: Filter tasks by status (e.g., ?status=inbox returns only inbox tasks)
```

---

### 4. PUT /api/tasks/{id} - Request Body Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: ~1600-1610 (approximate, located in PUT /api/tasks/{id} endpoint)

**Current** (assumed similar to POST):
```yaml
status:
  type: string
  enum:
    - open
    - next
    - waiting
    - scheduled
    - done
    - canceled
  description: Updated task status
```

**Updated**:
```yaml
status:
  type: string
  enum:
    - inbox
    - open
    - next
    - waiting
    - scheduled
    - someday
    - done
    - canceled
  description: Updated task status (all transitions allowed)
```

---

### 5. PUT /api/tasks/{id} - Response Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: ~1650-1660 (approximate, located in PUT /api/tasks/{id} response schema)

**Current** (assumed similar to POST response):
```yaml
status:
  type: string
  enum:
    - open
    - next
    - waiting
    - scheduled
    - done
    - canceled
  description: Current task status
```

**Updated**:
```yaml
status:
  type: string
  enum:
    - inbox
    - open
    - next
    - waiting
    - scheduled
    - someday
    - done
    - canceled
  description: Current task status
```

---

### 6. GET /api/tasks (List Response) - Task Item Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: ~1400-1410 (approximate, in GET /api/tasks response schema array items)

**Current** (assumed):
```yaml
status:
  type: string
  enum:
    - open
    - next
    - waiting
    - scheduled
    - done
    - canceled
  description: Current task status
```

**Updated**:
```yaml
status:
  type: string
  enum:
    - inbox
    - open
    - next
    - waiting
    - scheduled
    - someday
    - done
    - canceled
  description: Current task status
```

---

### 7. POST /api/memos/{id}/promote - Response Status Enum

**File**: `packages/api/docs/api/openapi.yaml`
**Lines**: ~(search for "promote" endpoint)

**Note**: Memo promotion endpoint returns a task. The response status enum should also be updated to include `inbox` and `someday`.

**Updated**:
```yaml
status:
  type: string
  enum:
    - inbox     # NEW: Default for promoted memos (FR-015)
    - open
    - next
    - waiting
    - scheduled
    - someday
    - done
    - canceled
  description: Task status (defaults to "inbox" when promoting memos)
```

---

## Affected Endpoints Summary

| Endpoint | Method | Change Location | Impact |
|----------|--------|-----------------|--------|
| `/api/tasks` | POST | Request body `status` enum | Accept inbox/someday in create requests |
| `/api/tasks` | POST | Response `status` enum | Return inbox/someday in create responses |
| `/api/tasks` | GET | Query param `status` enum | Allow filtering by inbox/someday |
| `/api/tasks` | GET | Response array item `status` enum | Return inbox/someday in task list |
| `/api/tasks/{id}` | GET | Response `status` enum | Return inbox/someday in task detail |
| `/api/tasks/{id}` | PUT | Request body `status` enum | Accept inbox/someday in update requests |
| `/api/tasks/{id}` | PUT | Response `status` enum | Return inbox/someday in update responses |
| `/api/memos/{id}/promote` | POST | Response `status` enum | Return inbox as default for promoted tasks |

---

## Validation

After updating `openapi.yaml`, run the following validations:

```bash
# Validate OpenAPI syntax
pnpm --filter meme-gtd-api openapi:validate

# Bundle OpenAPI (combines all $refs)
pnpm --filter meme-gtd-api openapi:bundle

# Regenerate TypeScript client types for Web UI
pnpm --filter meme-gtd-web generate:api
```

---

## Implementation Steps

1. **Locate all status enums**: Search `openapi.yaml` for all occurrences of `enum:` with status values
   ```bash
   grep -n "enum:" packages/api/docs/api/openapi.yaml | grep -A 6 "open"
   ```

2. **Update each enum**: Add `inbox` and `someday` to every status enum found

3. **Maintain order**: Ensure all enums follow GTD workflow order (inbox → open → next → waiting → scheduled → someday → done → canceled)

4. **Update descriptions**: Add clarifying comments where helpful (especially for request body enums)

5. **Validate**: Run `openapi:validate` to ensure YAML syntax is correct

6. **Regenerate clients**: Run `sdk:generate-types` (API) and `generate:api` (Web) to update TypeScript types

---

## Testing API Contract

### Manual Testing with curl

```bash
# Create task with inbox status
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test inbox", "status": "inbox"}'

# Create task with someday status
curl -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test someday", "status": "someday"}'

# Filter by inbox status
curl http://localhost:3001/api/tasks?status=inbox

# Filter by someday status
curl http://localhost:3001/api/tasks?status=someday

# Update task to inbox
curl -X PUT http://localhost:3001/api/tasks/1 \
  -H "Content-Type: application/json" \
  -d '{"status": "inbox"}'
```

### Expected Responses

All requests should return **200/201** with valid task objects containing the new status values. Invalid status values should return **400 Bad Request** with Zod validation error.

---

## Notes

- OpenAPI spec is **auto-generated** from Zod schemas via `packages/api/scripts/generate-openapi.ts`
- After updating Zod schemas in `packages/api/src/schemas/taskSchemas.ts`, regenerate OpenAPI:
  ```bash
  pnpm --filter meme-gtd-api openapi:generate
  ```
- This auto-generation may eliminate the need for manual YAML edits, depending on implementation
- Verify generation script includes new status values after Zod schema updates

---

## Related Files

- `packages/api/src/schemas/taskSchemas.ts` (Zod schemas - primary source)
- `packages/api/scripts/generate-openapi.ts` (OpenAPI generation script)
- `packages/api/docs/api/openapi.yaml` (Generated OpenAPI specification)
- `packages/web/src/api/*` (Auto-generated TypeScript API client)

**Recommendation**: Update Zod schemas first, then regenerate OpenAPI spec using the script, rather than editing YAML manually.
