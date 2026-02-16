type TimelineDateBucket = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Earlier';

const HOUR_IN_MS = 60 * 60 * 1000;

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfWeekMonday(value: Date): Date {
  const day = value.getDay();
  const delta = day === 0 ? 6 : day - 1;
  const base = startOfLocalDay(value);
  base.setDate(base.getDate() - delta);
  return base;
}

export function getTimelineDateBucket(iso: string, now: Date = new Date()): TimelineDateBucket {
  const target = new Date(iso);
  const targetDay = startOfLocalDay(target).getTime();
  const today = startOfLocalDay(now).getTime();

  if (targetDay === today) return 'Today';
  if (targetDay === today - 24 * HOUR_IN_MS) return 'Yesterday';

  const weekStart = startOfWeekMonday(now).getTime();
  if (targetDay >= weekStart) return 'This Week';

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (targetDay >= monthStart) return 'This Month';

  return 'Earlier';
}

export function shouldShowGapTimestamp(previousIso: string | null, currentIso: string): boolean {
  if (!previousIso) return false;
  const previous = new Date(previousIso).getTime();
  const current = new Date(currentIso).getTime();
  return Math.abs(current - previous) >= HOUR_IN_MS;
}

export function formatTimelineTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const timeText = `${hours}:${minutes}`;

  const sameDay =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (sameDay) {
    return timeText;
  }

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}/${month}/${day} ${timeText}`;
}
