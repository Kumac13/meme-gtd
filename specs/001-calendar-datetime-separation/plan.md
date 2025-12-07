# Implementation Plan: Calendar Datetime Separation

**Branch**: `001-calendar-datetime-separation` | **Date**: 2025-12-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-calendar-datetime-separation/spec.md`

## Summary

Separate scheduled (planned) times from actual (executed) times for tasks. Calendar displays scheduled times with fallback to actual times. Task detail panel shows both. Automatic recording of actual_start on "next" and actual_end on "done" status transitions.

## Technical Context

**Language/Version**: TypeScript 5.5.4 / Node.js 22+
**Primary Dependencies**: Fastify 5.2.0, better-sqlite3, React 19.2.0, @oclif/core 4.0.0, Zod 3.23.8
**Storage**: SQLite (better-sqlite3) - existing `issues` table
**Testing**: vitest (unit), integration tests via tsx
**Target Platform**: macOS/Linux CLI, Web browser
**Project Type**: Monorepo (pnpm workspaces) with packages: api, cli, db, web, shared
**Performance Goals**: Calendar queries < 100ms for typical data volume
**Constraints**: Local timezone (Asia/Tokyo hardcoded), ISO 8601 datetime format without timezone offset
**Scale/Scope**: Personal GTD app, single user, ~1000 tasks

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution file is template state (no specific gates defined). Proceeding with standard best practices:

- [x] Changes are backward compatible (deprecated fields preserved)
- [x] Test-first development for backend changes (per CLAUDE.md)
- [x] Documentation updates included (FR-014)
- [x] No breaking API changes without version bump

## Project Structure

### Documentation (this feature)

```text
specs/001-calendar-datetime-separation/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API schema changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
packages/
├── shared/src/index.ts      # Shared types (IssueBase, Task)
├── db/
│   ├── src/taskRepository.ts    # Data access layer
│   └── test/taskRepository.test.ts
├── api/
│   ├── src/schemas/taskSchemas.ts
│   ├── src/handlers/taskHandlers.ts
│   └── docs/api/openapi.yaml
├── web/src/
│   ├── utils/calendarMapper.ts
│   ├── pages/Calendar.tsx
│   └── components/
│       ├── calendar/TaskDetailPanel.tsx
│       └── ScheduleSection.tsx
└── cli/src/commands/task/
    ├── create.ts
    └── edit.ts

schema/
└── 007_add_calendar_datetime_fields.sql  # Migration (partially exists)

docs/
├── cli-commands.md
└── requirements.md
```

**Structure Decision**: Existing monorepo structure. Changes span all packages due to full-stack feature.

## Complexity Tracking

No violations requiring justification.

---

## Implementation Chunks

### Chunk 1: DB Migration (Foundation)

**Goal**: Add new columns and migrate existing data

**Files**:
- `schema/007_add_calendar_datetime_fields.sql` (update existing)

**SQL additions needed**:
```sql
-- Add notify_before_minutes column (for future notification feature)
ALTER TABLE issues ADD COLUMN notify_before_minutes INTEGER;

-- Add index for actual_start (fallback display queries)
CREATE INDEX IF NOT EXISTS idx_issues_actual_start ON issues(actual_start);
```

**Note**: Migration file already has basic columns. Need to add:
1. `notify_before_minutes` column
2. Index on `actual_start` for fallback queries
3. Review data migration for `actual_start` on done tasks

---

### Chunk 2: Repository Layer

**Goal**: Update taskRepository to handle new fields with automatic timestamp behavior

**Files**:
- `packages/db/src/taskRepository.ts`
- `packages/db/test/taskRepository.test.ts`

**Changes**:
1. Add new fields to `CreateTaskInput` / `UpdateTaskInput`:
   - `scheduledStart?: string`
   - `scheduledEnd?: string`
   - `isAllDay?: boolean`
   - `actualStart?: string`
   - `actualEnd?: string`

2. Update `taskRowToTask` mapper to read new columns

3. Update `setTaskStatus`:
   - `next` → auto-set `actual_start` to current datetime
   - `done` → auto-set `actual_end` to current datetime

4. Add `calendarFrom` / `calendarTo` filters to `listTasks`:
   - Query: `(scheduled_start IN range) OR (scheduled_start IS NULL AND actual_start IN range)`

5. Remove writes to deprecated fields (`scheduled_on`, `start_time`, `end_date`, `end_time`)

---

### Chunk 3: Shared Types

**Goal**: Update type definitions for all packages

**Files**:
- `packages/shared/src/index.ts`

**Changes**:
```typescript
export interface IssueBase extends Timestamped {
  // New fields
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isAllDay: boolean;
  actualStart: string | null;
  actualEnd: string | null;

  // Deprecated (read-only)
  /** @deprecated Use scheduledStart */
  scheduledOn: string | null;
  /** @deprecated Use scheduledStart */
  startTime: string | null;
  /** @deprecated Use scheduledEnd */
  endDate: string | null;
  /** @deprecated Use scheduledEnd */
  endTime: string | null;
  duration: number | null;
}
```

---

### Chunk 4: API Layer

**Goal**: Expose new fields via API with calendar query support

**Files**:
- `packages/api/src/schemas/taskSchemas.ts`
- `packages/api/src/handlers/taskHandlers.ts`
- `packages/api/docs/api/openapi.yaml`

**Changes**:
1. Add Zod schemas for new fields
2. Add `calendarFrom` / `calendarTo` query parameters to list endpoint
3. Update OpenAPI spec

---

### Chunk 5: Web UI

**Goal**: Calendar displays scheduled (priority) or actual (fallback), detail panel shows both

**Files**:
- `packages/web/src/utils/calendarMapper.ts`
- `packages/web/src/pages/Calendar.tsx`
- `packages/web/src/components/calendar/TaskDetailPanel.tsx`
- `packages/web/src/components/ScheduleSection.tsx`

**Changes**:
1. **calendarMapper.ts**: Use `scheduledStart` for position, fallback to `actualStart`
2. **Calendar.tsx**: Use `calendarFrom/To` API params
3. **TaskDetailPanel.tsx**: Show scheduled section and actual section separately
4. **ScheduleSection.tsx**: Add `isAllDay` toggle, actual time editing

---

### Chunk 6: CLI

**Goal**: CLI commands support new datetime fields

**Files**:
- `packages/cli/src/commands/task/create.ts`
- `packages/cli/src/commands/task/edit.ts`

**Changes**:
1. `task create`:
   - `--scheduled-start <datetime>`
   - `--scheduled-end <datetime>`
   - `--all-day`

2. `task edit`:
   - `--scheduled-start <datetime>`
   - `--scheduled-end <datetime>`
   - `--actual-start <datetime>`
   - `--actual-end <datetime>`
   - `--all-day` / `--no-all-day`

---

### Chunk 7: Documentation

**Goal**: Update user-facing documentation

**Files**:
- `docs/cli-commands.md`
- `docs/requirements.md`

**Changes**:
1. Document new CLI options
2. Document new data model fields
3. Explain scheduled vs actual time concept

---

## Dependency Graph

```
Chunk 1 (DB Migration)
    ↓
Chunk 2 (Repository) ← depends on Chunk 1
    ↓
Chunk 3 (Shared Types) ← can parallel with Chunk 2
    ↓
Chunk 4 (API) ← depends on Chunks 2, 3
    ↓
Chunk 5 (Web UI) ← depends on Chunk 4
Chunk 6 (CLI) ← depends on Chunks 2, 3 (parallel with 4, 5)
    ↓
Chunk 7 (Documentation) ← after all chunks
```

---

## Risk Mitigation

1. **Data loss prevention**: Deprecated fields are preserved (not dropped)
2. **Rollback path**: DROP new columns to restore
3. **Backward compatibility**: API returns both old and new fields
4. **Staged deployment**: Each chunk independently testable

---

## Testing Strategy

- **Chunk 1**: Migration success, data migration verification
- **Chunk 2**: Unit tests for CRUD with new fields, auto-timestamp on status change
- **Chunk 3-4**: API validation, OpenAPI consistency
- **Chunk 5**: Calendar display priority, all-day events
- **Chunk 6**: CLI option parsing, datetime validation
- **Chunk 7**: Documentation accuracy

---

## Considerations

### 1. Migration File Location

- `schema/` at repo root is source
- `packages/db/dist/schema/` is build output
- `pnpm build` copies migration files

### 2. Timezone Handling

- Use local time without timezone offset: `YYYY-MM-DDTHH:MM:SS`
- `getLocalDateTime()` helper already exists
- `Asia/Tokyo` hardcoded in calendar UI

### 3. FTS Integration

When updating `listTasks` filters:
- Ensure `calendarFrom/To` works with FTS search
- Apply datetime filters to FTS query results
