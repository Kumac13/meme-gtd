export interface Task {
  id: number;
  title: string | null;
  status: string;
  scheduledOn: string | null;
  startTime: string | null;
  endTime: string | null;
  endDate: string | null;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  _options?: {
    additionalClasses?: string[];
  };
}

export function taskToCalendarEvent(task: Task): CalendarEvent | null {
  if (!task.scheduledOn) {
    return null;
  }

  const isDone = task.status === 'done';
  const title = task.title || `Task #${task.id}`;

  let start: string;
  let end: string;

  if (task.startTime) {
    start = `${task.scheduledOn} ${task.startTime}`;
    if (task.endTime) {
      const endDateStr = task.endDate || task.scheduledOn;
      end = `${endDateStr} ${task.endTime}`;
    } else {
      end = start;
    }
  } else {
    start = task.scheduledOn;
    end = task.endDate || task.scheduledOn;
  }

  return {
    id: String(task.id),
    title,
    start,
    end,
    _options: {
      additionalClasses: [isDone ? 'task-done' : 'task-pending'],
    },
  };
}

export function tasksToCalendarEvents(tasks: Task[]): CalendarEvent[] {
  return tasks
    .filter((task) => task.status !== 'canceled')
    .map(taskToCalendarEvent)
    .filter((event): event is CalendarEvent => event !== null);
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
