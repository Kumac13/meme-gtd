# API Contract Changes: Link Enhancement

**Feature**: Link Command Enhancement
**Date**: 2025-10-22
**Impact**: Error responses only - no endpoint, schema, or success response changes

## Overview

This enhancement adds two new validation errors to the existing link creation endpoint. No changes to request/response schemas, endpoints, or HTTP methods.

## Affected Endpoint

### POST /api/links

**URL**: `POST /api/links`
**Status**: Modified (error responses only)

#### Request Schema (No Changes)

```json
{
  "sourceIssueId": number,
  "targetIssueId": number,
  "linkType": "parent" | "child" | "relates" | "derived_from"
}
```

#### Success Response (No Changes)

**Status**: `201 Created`

```json
{
  "id": number,
  "sourceIssueId": number,
  "targetIssueId": number,
  "linkType": "parent" | "child" | "relates" | "derived_from",
  "createdAt": string  // ISO 8601
}
```

#### Error Responses (Enhanced)

**Existing Errors** (unchanged):

| Status | Code | Message Pattern | Trigger |
|--------|------|-----------------|---------|
| 400 | VALIDATION_ERROR | "Cannot link issue to itself (ID: {id})" | Self-reference |
| 400 | VALIDATION_ERROR | "Link already exists (source: {s}, target: {t}, type: {type})" | Duplicate link |
| 404 | NOT_FOUND | "Issue #{id} not found" | Source or target doesn't exist |
| 500 | INTERNAL_ERROR | "Internal server error" | Unexpected error |

**New Errors** (added):

| Status | Code | Message Pattern | Trigger | Applies To |
|--------|------|-----------------|---------|-----------|
| 400 | VALIDATION_ERROR | "Cannot create inverse parent-child link: Issue #{target} is already a {type} of Issue #{source}" | Inverse duplicate | parent, child only |
| 400 | VALIDATION_ERROR | "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #{source} is already an ancestor of Issue #{target})" | Circular hierarchy | parent, child only |

#### Error Response Schema (Unchanged)

```json
{
  "statusCode": number,
  "code": string,
  "message": string
}
```

**Example - Inverse Duplicate**:
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Cannot create inverse parent-child link: Issue #10 is already a child of Issue #5"
}
```

**Example - Circular Relationship**:
```json
{
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #5 is already an ancestor of Issue #10)"
}
```

## Enhanced Endpoint

### GET /api/issues/:id/links

**URL**: `GET /api/issues/:id/links`
**Status**: Enhanced (added query parameter)

#### Current Behavior (Missing Feature)

Currently returns ALL links for an issue with no filtering capability.

#### Enhanced Behavior (New)

Add optional `type` query parameter to filter links by type.

**Query Parameters**:

| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `type` | string | No | `parent`, `child`, `relates`, `derived_from` | Filter links by type |

**Examples**:
```
GET /api/issues/5/links                    # All links
GET /api/issues/5/links?type=parent       # Only parent links
GET /api/issues/5/links?type=child        # Only child links
GET /api/issues/5/links?type=relates      # Only relates links
```

#### Response Schema (Unchanged)

**Status**: `200 OK`

```json
[
  {
    "id": number,
    "sourceIssueId": number,
    "targetIssueId": number,
    "linkType": "parent" | "child" | "relates" | "derived_from",
    "createdAt": string,
    "direction": "outgoing" | "incoming"
  }
]
```

#### Error Responses (Unchanged)

| Status | Code | Message | Trigger |
|--------|------|---------|---------|
| 404 | NOT_FOUND | "Issue #{id} not found" | Issue doesn't exist |
| 400 | VALIDATION_ERROR | "Invalid link type" | Invalid type parameter (NEW) |
| 500 | INTERNAL_ERROR | "Internal server error" | Unexpected error |

#### Implementation Notes

**Schema update** (packages/api/src/schemas/linkSchemas.ts):
```typescript
export const ListLinksQuerySchema = z.object({
  type: LinkTypeSchema.optional().describe('Filter by link type')
});

export type ListLinksQuery = z.infer<typeof ListLinksQuerySchema>;
```

**Handler update** (packages/api/src/handlers/linkHandlers.ts):
```typescript
export async function listLinksHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Querystring: ListLinksQuery;  // NEW
  }>,
  reply: FastifyReply
) {
  const issueId = parseInt(request.params.id, 10);
  const linkService = new LinkService({ db: request.server.db });

  try {
    // Pass filter to service layer
    const filters = request.query.type
      ? { type: request.query.type }
      : undefined;

    const links = linkService.list(issueId, filters);  // ENHANCED

    const linksWithDirection = links.map((link) => ({
      ...link,
      direction: link.sourceIssueId === issueId ? 'outgoing' : 'incoming',
    }));

    return reply.status(200).send(linksWithDirection);
  } catch (error) {
    throw error;
  }
}
```

**Route update** (packages/api/src/routes/links.ts):
```typescript
server.get(
  '/api/issues/:id/links',
  {
    schema: {
      tags: ['Links'],
      summary: 'List issue links',
      description: 'List all links for a given issue with optional type filter',
      operationId: 'listIssueLinks',
      params: IssueIdForLinksParamsSchema,
      querystring: ListLinksQuerySchema,  // NEW
      response: {
        200: z.array(LinkWithDirectionSchema),
        400: ErrorResponseSchema,  // NEW (for invalid type)
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  },
  listLinksHandler
);
```

### DELETE /api/links/:id

**Status**: No changes
- Request schema: unchanged
- Response schema: unchanged
- Behavior: unchanged
- Error responses: unchanged

## Handler Changes Required

**File**: `packages/api/src/handlers/linkHandlers.ts`

**Current error mapping** (lines 41-52):
```typescript
catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('Cannot link issue to itself')) {
      throw new ValidationError(error.message);
    }
    if (error.message.includes('not found')) {
      const match = error.message.match(/Issue #(\d+)/);
      if (match) {
        throw new NotFoundError('Issue', parseInt(match[1], 10));
      }
    }
    if (error.message.includes('Link already exists')) {
      throw new ValidationError(error.message);
    }
  }
  throw error;
}
```

**Required additions**:
```typescript
// Add after existing checks
if (error.message.includes('Cannot create inverse parent-child link')) {
  throw new ValidationError(error.message);
}
if (error.message.includes('Circular relationship detected')) {
  throw new ValidationError(error.message);
}
```

## Backward Compatibility

### Breaking Changes: None

- ✅ All existing API clients continue to work
- ✅ No changes to request/response schemas
- ✅ No changes to success responses
- ✅ Only adds new error cases (clients should already handle 400 errors)

### Client Impact

**Existing clients**: Should already handle 400 VALIDATION_ERROR responses generically
- New error messages are human-readable and self-explanatory
- No action required from client developers

**Recommended**: Update client-side error message handling to recognize new error patterns for better UX

## OpenAPI/Swagger Changes

**Required updates**:
1. Add new error examples to POST /api/links endpoint documentation
2. Update operation description to mention new validations
3. Add to tags/categories: No changes

**Example OpenAPI snippet** (enhanced description):
```yaml
paths:
  /api/links:
    post:
      summary: Create link
      description: |
        Create a link between two issues. Validates:
        - Both issues exist
        - No self-reference
        - No duplicate link
        - No inverse parent-child link (NEW)
        - No circular parent-child hierarchy (NEW)
      operationId: createLink
      responses:
        '201':
          description: Link created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Link'
        '400':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
              examples:
                selfReference:
                  summary: Self-reference
                  value:
                    statusCode: 400
                    code: "VALIDATION_ERROR"
                    message: "Cannot link issue to itself (ID: 5)"
                duplicate:
                  summary: Duplicate link
                  value:
                    statusCode: 400
                    code: "VALIDATION_ERROR"
                    message: "Link already exists (source: 1, target: 2, type: parent)"
                inverseDuplicate:
                  summary: Inverse parent-child link (NEW)
                  value:
                    statusCode: 400
                    code: "VALIDATION_ERROR"
                    message: "Cannot create inverse parent-child link: Issue #10 is already a child of Issue #5"
                circularHierarchy:
                  summary: Circular hierarchy (NEW)
                  value:
                    statusCode: 400
                    code: "VALIDATION_ERROR"
                    message: "Circular relationship detected: Creating this link would form a cycle in the parent-child hierarchy (Issue #5 is already an ancestor of Issue #10)"
```

## Testing Updates

**File**: `packages/api/test/integration/links.test.ts`

**Required test cases**:
1. Test inverse duplicate detection (400 response)
2. Test circular hierarchy detection (400 response)
3. Verify error response format matches schema
4. Verify non-hierarchical links (relates, derived_from) are unaffected

**Example test**:
```typescript
test('POST /api/links - should reject inverse parent-child link', async () => {
  // Create task A as parent of task B
  await app.inject({
    method: 'POST',
    url: '/api/links',
    payload: {
      sourceIssueId: taskA.id,
      targetIssueId: taskB.id,
      linkType: 'parent'
    }
  });

  // Attempt to create task B as parent of task A (inverse)
  const response = await app.inject({
    method: 'POST',
    url: '/api/links',
    payload: {
      sourceIssueId: taskB.id,
      targetIssueId: taskA.id,
      linkType: 'parent'
    }
  });

  assert.strictEqual(response.statusCode, 400);
  const body = JSON.parse(response.body);
  assert.strictEqual(body.code, 'VALIDATION_ERROR');
  assert.ok(body.message.includes('Cannot create inverse parent-child link'));
});
```

## Performance Impact

**Expected response time increase**:
- Non-hierarchical links (relates, derived_from): 0ms (no change)
- Hierarchical links (parent, child): +20-50ms for cycle detection
- Still well within acceptable API response time (<100ms typical)

**HTTP status codes**: No changes
**Rate limiting**: No changes
**Authentication/Authorization**: No changes

## Summary

### What Changed

- ✅ Two new 400 error cases added (POST /api/links)
- ✅ One new query parameter added (GET /api/issues/:id/links) - **Feature Parity with CLI**
- ✅ New error case for invalid type parameter (GET /api/issues/:id/links)
- ❌ No endpoint URL changes
- ❌ No success response schema changes
- ❌ No breaking changes (all enhancements are backward compatible)

### Implementation Tasks

1. **POST /api/links** enhancements:
   - Update error mapping in `linkHandlers.ts` (2 new validation error conditions)
   - Add integration tests for circular detection
   - Add integration tests for inverse duplicate detection

2. **GET /api/issues/:id/links** enhancements:
   - Add `ListLinksQuerySchema` to `linkSchemas.ts`
   - Update `listLinksHandler` to accept and use query parameter
   - Update route schema in `links.ts` to include querystring
   - Add integration tests for type filtering
   - Add integration test for invalid type parameter (400 error)

3. **Documentation**:
   - Update OpenAPI/Swagger documentation
   - Update API documentation/changelog
   - Document feature parity achievement with CLI

### Migration Guide

**For API consumers**:
- No migration needed - all changes are backward compatible
- New query parameter `?type=` is optional
- Already handling 400 errors generically

**For API maintainers**:
1. Deploy updated handler code
2. Update API documentation
3. Inform clients of new features:
   - Enhanced validation (prevents data integrity issues)
   - New filtering capability (improves API usability)
