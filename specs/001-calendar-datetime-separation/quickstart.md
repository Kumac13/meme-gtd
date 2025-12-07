# Quickstart: Calendar Datetime Separation

**Date**: 2025-12-07
**Status**: Ready for implementation

## Overview

This feature separates scheduled (planned) times from actual (executed) times for tasks, enabling:
- Calendar display based on scheduled times
- Automatic tracking of when tasks were actually started and completed
- Manual override of auto-recorded execution times

## Key Concepts

### Scheduled vs Actual Times

| Field | Purpose | Auto-set |
|-------|---------|----------|
| `scheduledStart` | When task is planned to start | No |
| `scheduledEnd` | When task is planned to end | No |
| `actualStart` | When task actually started | Yes, on status → "next" |
| `actualEnd` | When task actually ended | Yes, on status → "done" |

### Calendar Display Priority

1. **Scheduled time** (primary): If `scheduledStart` exists, show task at that time
2. **Actual time** (fallback): If no `scheduledStart` but `actualStart` exists, show at actual time
3. **Not displayed**: If neither scheduled nor actual times exist

## Implementation Checklist

### Chunk 1: Database Migration
- [ ] Update `schema/007_add_calendar_datetime_fields.sql`:
  - [ ] Add `notify_before_minutes` column
  - [ ] Add index on `actual_start`
  - [ ] Verify data migration logic

### Chunk 2: Repository Layer
- [ ] Update `packages/db/src/taskRepository.ts`:
  - [ ] Add new fields to input/output types
  - [ ] Update `taskRowToTask` mapper
  - [ ] Update `setTaskStatus` for auto-timestamps
  - [ ] Add `calendarFrom`/`calendarTo` filters
  - [ ] Remove writes to deprecated fields
- [ ] Update tests in `packages/db/test/taskRepository.test.ts`

### Chunk 3: Shared Types
- [ ] Update `packages/shared/src/index.ts`:
  - [ ] Add new fields to `IssueBase`
  - [ ] Add deprecation JSDoc comments

### Chunk 4: API Layer
- [ ] Update `packages/api/src/schemas/taskSchemas.ts`
- [ ] Update `packages/api/src/handlers/taskHandlers.ts`
- [ ] Update `packages/api/docs/api/openapi.yaml`
- [ ] Run `pnpm --filter meme-gtd-api openapi:validate`

### Chunk 5: Web UI
- [ ] Update `packages/web/src/utils/calendarMapper.ts`
- [ ] Update `packages/web/src/pages/Calendar.tsx`
- [ ] Update `packages/web/src/components/calendar/TaskDetailPanel.tsx`
- [ ] Update `packages/web/src/components/ScheduleSection.tsx`

### Chunk 6: CLI
- [ ] Update `packages/cli/src/commands/task/create.ts`
- [ ] Update `packages/cli/src/commands/task/edit.ts`

### Chunk 7: Documentation
- [ ] Update `docs/cli-commands.md`
- [ ] Update `docs/requirements.md`

## Quick Reference

### Datetime Format

ISO 8601 without timezone: `YYYY-MM-DDTHH:MM:SS`

```typescript
// Example
const scheduledStart = "2025-01-15T09:00:00";
const actualEnd = "2025-01-15T16:30:00";
```

### Status Transition Effects

```typescript
// When status changes to "next"
task.actualStart = getCurrentDatetime(); // Auto-set

// When status changes to "done"
task.actualEnd = getCurrentDatetime();   // Auto-set

// When task reopened from "done"
task.actualEnd = null;                   // Cleared
task.actualStart;                        // Preserved
```

### Calendar Query

```sql
-- Scheduled first, actual fallback
WHERE (scheduled_start >= @from AND scheduled_start <= @to)
   OR (scheduled_start IS NULL AND actual_start >= @from AND actual_start <= @to)
```

### CLI Options

```bash
# Create task with schedule
mgtd task create -t "Meeting" --scheduled-start 2025-01-15T09:00:00 --scheduled-end 2025-01-15T10:00:00

# Create all-day event
mgtd task create -t "Holiday" --scheduled-start 2025-01-15T00:00:00 --all-day

# Edit actual times
mgtd task edit 123 --actual-start 2025-01-15T08:45:00 --actual-end 2025-01-15T10:15:00
```

## Testing Commands

```bash
# Build all packages
pnpm build

# Run API tests
pnpm --filter meme-gtd-api test

# Run DB tests
pnpm --filter meme-gtd-db test

# Validate OpenAPI spec
pnpm --filter meme-gtd-api openapi:validate

# Start dev server for manual testing
pnpm server:dev
```

## Related Files

| File | Purpose |
|------|---------|
| [spec.md](./spec.md) | Feature specification |
| [plan.md](./plan.md) | Implementation plan |
| [research.md](./research.md) | Design decisions |
| [data-model.md](./data-model.md) | Data model changes |
| [contracts/task-api-changes.yaml](./contracts/task-api-changes.yaml) | API schema changes |
