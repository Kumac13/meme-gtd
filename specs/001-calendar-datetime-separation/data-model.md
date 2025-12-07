# Data Model: Calendar Datetime Separation

**Date**: 2025-12-07
**Status**: Complete

## Entity Changes

### Issue (Task) Entity

#### New Fields

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| `scheduled_start` | TEXT | Yes | NULL | Planned start datetime (ISO 8601: `YYYY-MM-DDTHH:MM:SS`) |
| `scheduled_end` | TEXT | Yes | NULL | Planned end datetime (ISO 8601) |
| `is_all_day` | INTEGER | No | 0 | All-day event flag (0=false, 1=true) |
| `actual_start` | TEXT | Yes | NULL | Actual start datetime (ISO 8601) |
| `actual_end` | TEXT | Yes | NULL | Actual end datetime (ISO 8601) |
| `notify_before_minutes` | INTEGER | Yes | NULL | Minutes before start to notify (future use) |

#### Deprecated Fields (Read-Only)

| Field | Status | Replacement |
|-------|--------|-------------|
| `scheduled_on` | Deprecated | `scheduled_start` (date portion) |
| `start_time` | Deprecated | `scheduled_start` (time portion) |
| `end_date` | Deprecated | `scheduled_end` or `actual_end` (date portion) |
| `end_time` | Deprecated | `scheduled_end` or `actual_end` (time portion) |
| `duration` | Deprecated | Calculate from `scheduled_start` - `scheduled_end` |

---

## TypeScript Types

### IssueBase Interface (Updated)

```typescript
export interface IssueBase extends Timestamped {
  id: number;
  type: IssueType;
  title: string | null;
  bodyMd: string;
  status: TaskStatus | null;

  // New scheduling fields
  scheduledStart: string | null;  // ISO 8601 datetime
  scheduledEnd: string | null;    // ISO 8601 datetime
  isAllDay: boolean;

  // New execution fields
  actualStart: string | null;     // ISO 8601 datetime
  actualEnd: string | null;       // ISO 8601 datetime

  // Deprecated fields (read-only, for backward compatibility)
  /** @deprecated Use scheduledStart date portion */
  scheduledOn: string | null;
  /** @deprecated Use scheduledStart time portion */
  startTime: string | null;
  /** @deprecated Use scheduledEnd or actualEnd date portion */
  endDate: string | null;
  /** @deprecated Use scheduledEnd or actualEnd time portion */
  endTime: string | null;
  /** @deprecated Calculate from scheduled times */
  duration: number | null;

  meta: unknown;
  isBookmarked: boolean;
  isDeleted: boolean;
}
```

### CreateTaskInput (Updated)

```typescript
export interface CreateTaskInput {
  title: string;
  bodyMd: string;
  status?: TaskStatus;

  // New fields
  scheduledStart?: string;  // ISO 8601
  scheduledEnd?: string;    // ISO 8601
  isAllDay?: boolean;

  // Deprecated (do not use in new code)
  scheduledOn?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  duration?: number;

  labels?: string[];
  projectIds?: number[];
}
```

### UpdateTaskInput (Updated)

```typescript
export interface UpdateTaskInput {
  id: number;
  title?: string;
  bodyMd?: string;
  status?: TaskStatus;

  // New fields
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  isAllDay?: boolean;
  actualStart?: string | null;   // User can manually override
  actualEnd?: string | null;     // User can manually override

  // Deprecated (do not use in new code)
  scheduledOn?: string | null;
  startTime?: string | null;
  endDate?: string | null;
  endTime?: string | null;
  duration?: number | null;

  addLabels?: string[];
  removeLabels?: string[];
  projectIds?: number[];
}
```

### ListTaskFilters (Updated)

```typescript
export interface ListTaskFilters {
  status?: TaskStatus;
  label?: string;
  labels?: string[];
  search?: string;
  searchTitle?: string;
  searchBody?: string;
  limit?: number;
  order?: 'asc' | 'desc';
  isBookmarked?: boolean;

  // Calendar range filters (NEW)
  calendarFrom?: string;  // ISO 8601 datetime
  calendarTo?: string;    // ISO 8601 datetime

  // Deprecated (for backward compatibility)
  scheduledFrom?: string; // YYYY-MM-DD
  scheduledTo?: string;   // YYYY-MM-DD
}
```

---

## Database Schema Changes

### Migration SQL

```sql
-- Migration: 007_add_calendar_datetime_fields

-- New scheduling fields
ALTER TABLE issues ADD COLUMN scheduled_start TEXT;
ALTER TABLE issues ADD COLUMN scheduled_end TEXT;
ALTER TABLE issues ADD COLUMN is_all_day INTEGER DEFAULT 0;

-- New execution fields
ALTER TABLE issues ADD COLUMN actual_start TEXT;
ALTER TABLE issues ADD COLUMN actual_end TEXT;

-- Future notification support
ALTER TABLE issues ADD COLUMN notify_before_minutes INTEGER;

-- Data migration: scheduled_on + start_time -> scheduled_start
UPDATE issues
SET scheduled_start = scheduled_on || 'T' || start_time || ':00'
WHERE scheduled_on IS NOT NULL AND start_time IS NOT NULL;

-- All-day events: scheduled_on without start_time
UPDATE issues
SET scheduled_start = scheduled_on || 'T00:00:00',
    is_all_day = 1
WHERE scheduled_on IS NOT NULL AND start_time IS NULL;

-- Scheduled end: end_date + end_time (non-done tasks)
UPDATE issues
SET scheduled_end = end_date || 'T' || end_time || ':00'
WHERE end_date IS NOT NULL AND end_time IS NOT NULL AND status != 'done';

-- Done tasks: migrate to actual times
UPDATE issues
SET actual_start = CASE
      WHEN scheduled_on IS NOT NULL AND start_time IS NOT NULL
      THEN scheduled_on || 'T' || start_time || ':00'
      WHEN scheduled_on IS NOT NULL
      THEN scheduled_on || 'T00:00:00'
      ELSE NULL
    END,
    actual_end = end_date || 'T' || COALESCE(end_time, '23:59') || ':00'
WHERE status = 'done' AND end_date IS NOT NULL;

-- Indexes for calendar queries
CREATE INDEX IF NOT EXISTS idx_issues_scheduled_start ON issues(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_issues_scheduled_end ON issues(scheduled_end);
CREATE INDEX IF NOT EXISTS idx_issues_actual_start ON issues(actual_start);
```

---

## State Transitions

### Status Change Effects

| From Status | To Status | Effect |
|-------------|-----------|--------|
| Any | `next` | Set `actual_start` = current datetime (if not set) |
| Any | `done` | Set `actual_end` = current datetime (if not set) |
| `done` | Any other | Clear `actual_end`, preserve `actual_start` |

### Validation Rules

1. **Time consistency**: If both `scheduled_start` and `scheduled_end` exist, `scheduled_end` must be >= `scheduled_start`
2. **All-day events**: When `is_all_day = true`, time portion is ignored (stored as 00:00:00 / 23:59:59)
3. **Nullable fields**: All datetime fields are optional (null = not set)

---

## Relationships

```
+----------------+       +----------------+
|     Task       |       |   Calendar UI  |
+----------------+       +----------------+
| scheduled_start|<----->| Event position |
| scheduled_end  |       | (primary)      |
| is_all_day     |       +----------------+
|                |
| actual_start   |<----->| Fallback       |
| actual_end     |       | position       |
+----------------+       +----------------+
        |
        v
+----------------+
| Task Detail UI |
+----------------+
| Scheduled:     |
|   start - end  |
| Actual:        |
|   start - end  |
+----------------+
```

---

## Query Examples

### Calendar Query (Scheduled + Actual Fallback)

```sql
SELECT * FROM issues
WHERE type = 'task' AND is_deleted = 0
  AND (
    (scheduled_start >= @from AND scheduled_start <= @to)
    OR (scheduled_start IS NULL AND actual_start >= @from AND actual_start <= @to)
  )
ORDER BY COALESCE(scheduled_start, actual_start);
```

### Find Tasks Without Schedule

```sql
SELECT * FROM issues
WHERE type = 'task' AND is_deleted = 0
  AND scheduled_start IS NULL
  AND actual_start IS NOT NULL;
```

### All-Day Events in Date Range

```sql
SELECT * FROM issues
WHERE type = 'task' AND is_deleted = 0
  AND is_all_day = 1
  AND DATE(scheduled_start) <= @endDate
  AND DATE(COALESCE(scheduled_end, scheduled_start)) >= @startDate;
```
