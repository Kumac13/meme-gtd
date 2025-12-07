import type { CalendarEventExternal } from '@schedule-x/calendar';

export interface Task {
  id: number;
  title: string | null;
  status: string;
  // New scheduling fields (ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS)
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isAllDay: boolean;
  // New execution fields (for fallback display)
  actualStart: string | null;
  actualEnd: string | null;
  // Deprecated fields (kept for backward compatibility)
  scheduledOn: string | null;
  startTime: string | null;
  endTime: string | null;
  endDate: string | null;
}

/**
 * Convert a task to a calendar event.
 * Priority: scheduledStart > actualStart (fallback for tasks without schedule but with execution time)
 */
export function taskToCalendarEvent(task: Task): CalendarEventExternal | null {
  // Determine which datetime to use for positioning
  // Priority: scheduledStart, then fallback to actualStart
  const effectiveStart = task.scheduledStart ?? task.actualStart;
  const effectiveEnd = task.scheduledEnd ?? task.actualEnd;

  // If no scheduling info and no fallback, skip this task
  if (!effectiveStart) {
    // Fallback to deprecated fields for backward compatibility
    if (!task.scheduledOn) {
      return null;
    }
    return taskToCalendarEventLegacy(task);
  }

  const title = task.title || `Task #${task.id}`;

  let start: Temporal.PlainDate | Temporal.ZonedDateTime;
  let end: Temporal.PlainDate | Temporal.ZonedDateTime;

  const timezone = 'Asia/Tokyo';

  // Logic:
  // 1. isAllDay=true → all-day event
  // 2. effectiveEnd exists → timed event (use effectiveStart ~ effectiveEnd)
  // 3. No effectiveEnd but scheduledStart exists → all-day (user requirement: scheduleのendがない場合)
  // 4. No effectiveEnd and no scheduledStart (only actualStart) → don't show (in progress)

  if (task.isAllDay) {
    // All-day event
    const startDate = effectiveStart.split('T')[0];
    const endDate = effectiveEnd ? effectiveEnd.split('T')[0] : startDate;
    start = Temporal.PlainDate.from(startDate);
    end = Temporal.PlainDate.from(endDate);
  } else if (task.scheduledStart && task.scheduledEnd) {
    // Timed event with scheduled start and end (complete schedule)
    const startDateTime = Temporal.PlainDateTime.from(task.scheduledStart);
    start = startDateTime.toZonedDateTime(timezone);
    const endDateTime = Temporal.PlainDateTime.from(task.scheduledEnd);
    end = endDateTime.toZonedDateTime(timezone);
  } else if (task.scheduledStart) {
    // Scheduled start without scheduled end → display as all-day
    // (actualEnd is ignored when scheduledStart exists without scheduledEnd)
    const startDate = task.scheduledStart.split('T')[0];
    start = Temporal.PlainDate.from(startDate);
    end = Temporal.PlainDate.from(startDate);
  } else if (task.actualStart && task.actualEnd) {
    // No schedule, but has complete actual times → display actual times
    const startDateTime = Temporal.PlainDateTime.from(task.actualStart);
    start = startDateTime.toZonedDateTime(timezone);
    const endDateTime = Temporal.PlainDateTime.from(task.actualEnd);
    end = endDateTime.toZonedDateTime(timezone);
  } else {
    // Only actualStart without end (task in progress) → don't show
    return null;
  }

  return {
    id: task.id,
    title,
    start,
    end,
  };
}

/**
 * Legacy conversion for backward compatibility with old fields
 * Legacy events are treated as scheduled
 */
function taskToCalendarEventLegacy(task: Task): CalendarEventExternal | null {
  if (!task.scheduledOn) {
    return null;
  }

  const title = task.title || `Task #${task.id}`;

  let start: Temporal.PlainDate | Temporal.ZonedDateTime;
  let end: Temporal.PlainDate | Temporal.ZonedDateTime;

  const timezone = 'Asia/Tokyo';

  if (task.startTime) {
    // Task has a specific time - use ZonedDateTime
    const startDateTime = Temporal.PlainDateTime.from(`${task.scheduledOn}T${task.startTime}`);
    start = startDateTime.toZonedDateTime(timezone);
    if (task.endTime) {
      const endDateStr = task.endDate || task.scheduledOn;
      const endDateTime = Temporal.PlainDateTime.from(`${endDateStr}T${task.endTime}`);
      end = endDateTime.toZonedDateTime(timezone);
    } else {
      // Default to 1 hour duration
      end = start.add({ hours: 1 });
    }
  } else {
    // All-day event - use PlainDate
    start = Temporal.PlainDate.from(task.scheduledOn);
    end = Temporal.PlainDate.from(task.endDate || task.scheduledOn);
  }

  return {
    id: task.id,
    title,
    start,
    end,
  };
}

export function tasksToCalendarEvents(tasks: Task[]): CalendarEventExternal[] {
  return tasks
    .filter((task) => task.status !== 'canceled')
    .map(taskToCalendarEvent)
    .filter((event): event is CalendarEventExternal => event !== null);
}

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateRange(date: string, view: 'month' | 'week' | 'day'): { from: string; to: string } {
  // Parse date as local time by adding time component
  const currentDate = new Date(date + 'T00:00:00');

  if (view === 'month') {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      from: formatLocalDate(firstDay),
      to: formatLocalDate(lastDay),
    };
  } else if (view === 'week') {
    // Monday-based week (0=Sun, 1=Mon, ..., 6=Sat)
    // Calculate days since Monday: Sun=6, Mon=0, Tue=1, ...
    const dayOfWeek = currentDate.getDay();
    const daysSinceMonday = (dayOfWeek + 6) % 7;
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - daysSinceMonday);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return {
      from: formatLocalDate(startOfWeek),
      to: formatLocalDate(endOfWeek),
    };
  } else {
    return {
      from: date,
      to: date,
    };
  }
}
