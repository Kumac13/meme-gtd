# Research: Add "inbox" and "someday" Task Statuses

**Feature**: 027-task-status-someday-inbox
**Date**: 2025-11-17
**Status**: Complete

## 1. Current TaskStatus Type Definition

**Location**: `packages/shared/src/index.ts:3-9`

**Current Implementation**:
```typescript
export type TaskStatus =
  | 'open'
  | 'next'
  | 'waiting'
  | 'scheduled'
  | 'done'
  | 'canceled';
```

**Decision**: Extend this type to include `'inbox'` and `'someday'`

**Rationale**:
- TypeScript union type allows easy extension
- Single source of truth in shared package ensures type consistency across all packages
- No breaking changes since we're adding new valid values, not removing existing ones

**Alternatives Considered**:
- Using string literals everywhere: Rejected because it loses type safety and creates maintenance burden
- Creating separate enum class: Rejected because TypeScript's union types are idiomatic and well-supported by tooling

---

## 2. Zod Schema Validation

**Location**: `packages/api/src/schemas/taskSchemas.ts:6`

**Current Implementation**:
```typescript
export const TaskStatusSchema = z.enum(['open', 'next', 'waiting', 'scheduled', 'done', 'canceled']);
```

**Decision**: Extend enum to `['open', 'next', 'waiting', 'scheduled', 'done', 'canceled', 'inbox', 'someday']`

**Rationale**:
- Zod schemas provide runtime validation for API requests
- API schema must stay in sync with TypeScript type
- Current schema is already defined with z.enum, making extension straightforward
- Order in enum should follow GTD workflow: inbox → open → next → waiting → scheduled → someday → done → canceled

**Alternatives Considered**:
- Creating separate schemas for different contexts: Rejected because it creates divergence and maintenance overhead
- Using z.string() with refinement: Rejected because z.enum provides better error messages and OpenAPI generation

---

## 3. CLI Status Options

**Location**: `packages/cli/src/commands/task/create.ts:47`

**Current Implementation**:
```typescript
status: Flags.string({
  char: 's',
  summary: 'Initial status',
  description: 'Set task status (open, next, waiting, scheduled, done, canceled). Default: open',
  options: ['open', 'next', 'waiting', 'scheduled', 'done', 'canceled'],
  default: 'open'
}),
```

**Decision**: Add 'inbox' and 'someday' to options array

**Rationale**:
- @oclif/core's `options` array provides autocomplete and validation
- Description text must be updated to reflect new statuses
- Default should remain 'open' for backward compatibility (FR-014)

**Affected Files**:
- `packages/cli/src/commands/task/create.ts` (creation default)
- `packages/cli/src/commands/task/edit.ts` (status update)
- `packages/cli/src/commands/task/list.ts` (status filter)

**Alternatives Considered**:
- Changing default to 'inbox': Rejected because spec FR-014 requires maintaining existing behavior for direct creation
- Removing 'open' status: Rejected because spec FR-018 requires preserving existing tasks unchanged

---

## 4. Web UI Status Select Component

**Location**: `packages/web/src/components/TaskForm.tsx:9, 158-174`

**Current Implementation**:
```typescript
type TaskStatus = 'open' | 'next' | 'waiting' | 'scheduled' | 'done' | 'canceled';

// ...

<select id="status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
  <option value="open">Open</option>
  <option value="next">Next</option>
  <option value="waiting">Waiting</option>
  <option value="scheduled">Scheduled</option>
  {mode === 'edit' && (
    <>
      <option value="done">Done</option>
      <option value="canceled">Canceled</option>
    </>
  )}
</select>
```

**Decision**: Add `<option value="inbox">Inbox</option>` and `<option value="someday">Someday</option>` to dropdown

**Rationale**:
- Direct addition to existing select element maintains UI consistency
- Should follow GTD workflow order: Inbox → Open → Next → Waiting → Scheduled → Someday (with Done/Canceled in edit mode)
- Type definition must be updated to include new statuses

**Display Order Decision**:
Per spec FR-017, statuses should display in GTD workflow order:
1. Inbox (unprocessed capture)
2. Open (general backlog)
3. Next (prioritized actions)
4. Waiting (blocked/delegated)
5. Scheduled (time-specific)
6. Someday (deferred ideas)
7. Done (completed)
8. Canceled (abandoned)

**Alternatives Considered**:
- Alphabetical ordering: Rejected because it doesn't reflect workflow logic
- Grouping by "active" vs "inactive": Rejected because GTD workflow sequence is more intuitive

---

## 5. Memo Promotion Default Status

**Location**: `packages/web/src/components/TaskForm.tsx:54-55`

**Current Implementation**:
```typescript
const validStatuses = ['open', 'next', 'waiting', 'scheduled'] as const;
const promotionStatus = validStatuses.includes(status as any) ? status as 'open' | 'next' | 'waiting' | 'scheduled' : 'open';
```

**Decision**: Change default to 'inbox' and include 'inbox' in valid promotion statuses

**Updated Implementation**:
```typescript
const validStatuses = ['inbox', 'open', 'next', 'waiting', 'scheduled'] as const;
const promotionStatus = validStatuses.includes(status as any) ? status as 'inbox' | 'open' | 'next' | 'waiting' | 'scheduled' : 'inbox';
```

**Rationale**:
- Spec FR-015 explicitly requires memo promotion to default to "inbox"
- This aligns with GTD workflow: captured memos need triage before becoming actionable tasks
- Users can still manually select other statuses during promotion

**Backend Memo Promotion**: `packages/api/src/routes/memo.ts` or `packages/core/src/memo.ts`
- Must ensure promote endpoint defaults to 'inbox' if no status provided
- Requires code review to locate and update promotion logic

**Alternatives Considered**:
- Keeping 'open' as default: Rejected per spec clarification Q1
- Removing status selection during promotion: Rejected because users want flexibility during triage

---

## 6. Database Schema

**Location**: `schema/*.sql` (SQLite migrations)

**Current Implementation**: Tasks table has `status TEXT` column

**Decision**: No migration required

**Rationale**:
- SQLite TEXT column accepts any string value
- Validation is enforced at application layer (Zod schemas, TypeScript types)
- Existing 'open' tasks will remain valid (FR-018)
- No database constraints need updating

**Data Integrity**:
- Application-layer validation prevents invalid status values from being inserted
- Existing data with status='open' is preserved
- No automatic migration to avoid data loss

**Alternatives Considered**:
- Adding CHECK constraint in SQLite: Rejected because schema changes require migrations, increasing deployment complexity
- Creating status enum table: Rejected as over-engineering for simple string validation

---

## 7. API Endpoint Changes

**Affected Endpoints** (per `packages/api/src/routes/task.ts`):
- `POST /api/tasks` - Create task (status in request body)
- `PUT /api/tasks/:id` - Update task (status in request body)
- `GET /api/tasks` - List tasks (status filter in query params)

**Decision**: No endpoint signature changes required

**Rationale**:
- Endpoints already accept `status` parameter
- Zod schema update handles validation automatically
- Query parameter filtering already supports status values

**OpenAPI Documentation**: `packages/api/docs/api/openapi.yaml`
- Must update `TaskStatus` enum in components/schemas section
- Ensures API documentation reflects new valid values

**Alternatives Considered**:
- Creating separate /inbox and /someday endpoints: Rejected as unnecessary API surface expansion
- Adding version header for new statuses: Rejected because this is a backward-compatible addition

---

## 8. URL-Based Filtering (Web UI)

**Location**: `packages/web/src/pages/Tasks.tsx` (uses React Router query params)

**Current Behavior**: URL like `/tasks?status=next` filters tasks by status

**Decision**: Verify existing implementation handles new statuses without code changes

**Rationale**:
- URL-based filtering uses status query parameter passed to API
- API already validates and filters by status value
- Once Zod schema is updated, filtering should work automatically

**Testing Required**:
- Navigate to `/tasks?status=inbox`
- Navigate to `/tasks?status=someday`
- Verify correct filtering behavior

**Alternatives Considered**:
- Creating dedicated routes `/tasks/inbox` and `/tasks/someday`: Rejected to maintain consistent routing pattern

---

## 9. Status Display Order (FR-017)

**Decision**: GTD Workflow Order

**Rationale**:
- Reflects natural task processing flow in Getting Things Done methodology
- Users review inbox → triage to open → prioritize to next → handle blockers (waiting) → schedule time-specific items → defer non-actionable (someday)
- Completed/canceled statuses appear last as terminal states

**Implementation**:
- CLI help text: Update status descriptions to list in workflow order
- Web UI dropdowns: Render options in workflow order
- API documentation: Document statuses in workflow order for clarity

---

## 10. Testing Strategy

**Unit Tests**:
- `packages/shared/test/types.test.ts`: Validate TaskStatus type accepts new values
- `packages/api/test/schemas.test.ts`: Validate Zod schemas accept 'inbox' and 'someday'

**Integration Tests**:
- `packages/api/test/task.test.ts`: Test creating/updating tasks with new statuses
- `packages/api/test/task.test.ts`: Test filtering by status=inbox and status=someday

**E2E Tests** (Playwright):
- `packages/web/tests/task-status.spec.ts`: Test UI status dropdown includes new options
- `packages/web/tests/task-status.spec.ts`: Test URL filtering with new statuses
- `packages/web/tests/task-status.spec.ts`: Test memo promotion defaults to 'inbox'

**Manual Testing Checklist**:
- Create task via CLI with --status inbox
- Create task via CLI with --status someday
- Filter tasks via CLI: `mgtd task list --status inbox`
- Create task via Web UI, verify status dropdown includes Inbox/Someday
- Navigate to /tasks?status=inbox in browser
- Promote memo to task, verify default status is 'inbox'

---

## 11. Migration Path

**Existing Data**: No migration required (FR-018)

**User Communication**:
- Changelog entry explaining new statuses
- Documentation update in README or user guide
- Optional: Suggest users with status='open' tasks consider triaging to 'inbox' if unprocessed

**Rollback Plan**:
- If issues arise, reverting code changes will restore previous behavior
- Existing 'inbox'/'someday' tasks in database will remain (status TEXT column accepts any value)
- Can add application-layer filter to hide tasks with new statuses if needed for temporary rollback

---

## Summary

All technical unknowns have been resolved. The implementation is a straightforward type/enum extension across 4 layers:

1. **Shared Types** (`packages/shared`): Extend TaskStatus union type
2. **API Validation** (`packages/api`): Extend Zod schema and update OpenAPI docs
3. **CLI** (`packages/cli`): Add status options to relevant commands
4. **Web UI** (`packages/web`): Update TaskStatus type, add dropdown options, change memo promotion default

No database migrations required. No breaking changes to existing functionality. Ready for implementation phase.
