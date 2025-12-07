# Research: Calendar Datetime Separation

**Date**: 2025-12-07
**Status**: Complete

## Research Tasks

### 1. Datetime Format Decision

**Decision**: ISO 8601 local time without timezone offset (`YYYY-MM-DDTHH:MM:SS`)

**Rationale**:
- Existing codebase uses local time consistently
- `getLocalDateTime()` helper already returns local time
- Calendar UI hardcodes `Asia/Tokyo`
- Simplifies storage and comparison without timezone conversion

**Alternatives Considered**:
- ISO 8601 with timezone (e.g., `2025-01-15T09:00:00+09:00`): Rejected - unnecessary complexity for single-user app
- UTC storage with client conversion: Rejected - would require refactoring existing datetime handling

---

### 2. Calendar Query Strategy

**Decision**: Two-step fallback query
```sql
WHERE (scheduled_start >= @from AND scheduled_start <= @to)
   OR (scheduled_start IS NULL AND actual_start >= @from AND actual_start <= @to)
```

**Rationale**:
- Matches FR-012 requirement: "scheduledStart in range OR (scheduledStart IS NULL AND actualStart in range)"
- Ensures unplanned tasks with actual times are visible on calendar
- Index on both `scheduled_start` and `actual_start` for performance

**Alternatives Considered**:
- COALESCE(scheduled_start, actual_start): Rejected - harder to optimize with indexes
- Two separate queries with UNION: Rejected - more complex, same result

---

### 3. Status Transition Behavior

**Decision**: Auto-set datetime on status change

| Transition | Auto-set Field | Value |
|------------|---------------|-------|
| Any → `next` | `actual_start` | Current local datetime |
| Any → `done` | `actual_end` | Current local datetime |
| `done` → Any | Clear `actual_end` | NULL |

**Rationale**:
- Matches FR-004 and FR-005 requirements
- Edge case (spec): "when task is reopened, actual_end is cleared but actual_start is preserved"
- Auto-set only if field is not explicitly provided by user

**Alternatives Considered**:
- Always overwrite: Rejected - user should be able to correct auto-recorded values
- Never auto-set: Rejected - defeats the purpose of automatic tracking

---

### 4. All-Day Event Handling

**Decision**: `is_all_day` boolean flag with time fields set to null/ignored

**Rationale**:
- Explicit flag avoids ambiguity (vs inferring from missing time)
- When `is_all_day = true`:
  - `scheduled_start` stores date only (e.g., `2025-01-15T00:00:00`)
  - `scheduled_end` stores end date (e.g., `2025-01-17T23:59:59`)
  - Time portion is ignored in UI display
- Calendar UI already supports ScheduleX `isAllDay` property

**Alternatives Considered**:
- Infer from null time: Rejected - conflicts with "no time specified yet" case
- Separate date/time fields: Rejected - duplicates existing deprecated pattern

---

### 5. Data Migration Strategy

**Decision**: Transform existing fields to new fields in migration SQL

**Migration Rules**:
| Existing Fields | New Field | Condition |
|-----------------|-----------|-----------|
| `scheduled_on` + `start_time` | `scheduled_start` | Both non-null |
| `scheduled_on` (no time) | `scheduled_start`, `is_all_day=1` | `start_time` is null |
| `end_date` + `end_time` | `scheduled_end` | status != 'done' |
| `end_date` + `end_time` | `actual_end` | status = 'done' |
| (inferred from done status) | `actual_start` | From scheduled_on if available |

**Rationale**:
- Preserves user data without loss
- Done tasks get actual times (they were completed)
- Non-done tasks get scheduled times (they are planned)

**Alternatives Considered**:
- Leave migration to application code: Rejected - inconsistent state during rollout
- Require manual data correction: Rejected - poor user experience

---

### 6. Deprecated Field Handling

**Decision**: Keep deprecated fields read-only in database, remove writes from application code

**Rationale**:
- Enables rollback by reverting code only
- API returns both old and new fields for backward compatibility
- Old fields can be removed in future version (requires migration)

**Alternatives Considered**:
- Drop deprecated columns: Rejected - no rollback path
- Keep writing to both: Rejected - maintenance burden, data duplication

---

### 7. Calendar UI Display Priority

**Decision**: Scheduled time takes priority, actual time is fallback

**Display Rules**:
1. If `scheduled_start` exists → display at scheduled position
2. Else if `actual_start` exists → display at actual position (fallback)
3. Else → do not display on calendar

**Rationale**:
- Matches User Story 5: "calendar shows planned schedule when available"
- Completed tasks remain at scheduled position (planning view)
- Unplanned work still appears via actual times

**Alternatives Considered**:
- Always show actual if exists: Rejected - loses planning context
- Show both positions: Rejected - confusing UI

---

## Technology Decisions

### SQLite Indexes

Create indexes for calendar query performance:
- `idx_issues_scheduled_start` (already in migration)
- `idx_issues_scheduled_end` (already in migration)
- `idx_issues_actual_start` (needs to be added for fallback queries)

### Datetime Parsing

Use existing `getLocalDateTime()` helper for auto-setting:
```typescript
const { date, time } = getLocalDateTime();
const datetime = `${date}T${time}:00`; // YYYY-MM-DDTHH:MM:00
```

### Type Safety

Add strict null checking for datetime fields in shared types:
- All datetime fields are `string | null`
- `isAllDay` is `boolean` (default `false`)

---

## Unresolved Items

None. All clarifications from spec have been addressed:
- Calendar display priority: scheduled first, actual fallback ✓
- Data migration for done tasks: actual_start/actual_end set ✓
- User editing: CLI/API/UI all supported ✓
- All-day toggle: explicit flag in all interfaces ✓
- Documentation: included in Chunk 7 ✓
