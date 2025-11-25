import type { CalendarEventExternal } from '@schedule-x/calendar';

export interface Task {
  id: number;
  title: string | null;
  status: string;
  scheduledOn: string | null;
  startTime: string | null;
  endTime: string | null;
  endDate: string | null;
}

export function taskToCalendarEvent(task: Task): CalendarEventExternal | null {
  if (!task.scheduledOn) {
    return null;
  }

  const isDone = task.status === 'done';
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
    _options: {
      additionalClasses: [isDone ? 'task-done' : 'task-pending'],
    },
  };
}

export function tasksToCalendarEvents(tasks: Task[]): CalendarEventExternal[] {
  return tasks
    .filter((task) => task.status !== 'canceled')
    .map(taskToCalendarEvent)
    .filter((event): event is CalendarEventExternal => event !== null);
}

export function getDateRange(date: string, view: 'month' | 'week' | 'day'): { from: string; to: string } {
  const currentDate = new Date(date);

  if (view === 'month') {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      from: firstDay.toISOString().split('T')[0],
      to: lastDay.toISOString().split('T')[0],
    };
  } else if (view === 'week') {
    const dayOfWeek = currentDate.getDay();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return {
      from: startOfWeek.toISOString().split('T')[0],
      to: endOfWeek.toISOString().split('T')[0],
    };
  } else {
    return {
      from: date,
      to: date,
    };
  }
}
