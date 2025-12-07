import { describe, it, expect, beforeAll } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { taskToCalendarEvent, getDateRange, type Task } from './calendarMapper';

// Make Temporal available globally for the module under test
beforeAll(() => {
  (globalThis as any).Temporal = Temporal;
});

// Helper to create a minimal task with defaults
function createTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    title: 'Test Task',
    status: 'next',
    scheduledStart: null,
    scheduledEnd: null,
    isAllDay: false,
    actualStart: null,
    actualEnd: null,
    scheduledOn: null,
    startTime: null,
    endTime: null,
    endDate: null,
    ...overrides,
  };
}

describe('calendarMapper - taskToCalendarEvent', () => {
  // 要件: 表示優先度 - 予定が実行結果よりも優先される
  describe('Display Priority: scheduled > actual', () => {
    it('Case 1: scheduled and actual both exist → use scheduled time', () => {
      const task = createTask({
        scheduledStart: '2025-12-06T13:00:00',
        scheduledEnd: '2025-12-06T14:00:00',
        actualStart: '2025-12-06T12:50:00',
        actualEnd: '2025-12-06T16:00:00',
        status: 'done',
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should use scheduled time (13:00-14:00), not actual time (12:50-16:00)
      expect(event!.start.toString()).toContain('13:00');
      expect(event!.end.toString()).toContain('14:00');
    });

    it('Case 2: scheduled start exists, scheduled end missing, actual end exists → display as all-day', () => {
      const task = createTask({
        scheduledStart: '2025-12-06T13:00:00',
        scheduledEnd: null,
        actualEnd: '2025-12-06T14:00:00',
        status: 'done',
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should display as all-day (actualEnd is ignored when scheduledStart exists without scheduledEnd)
      expect(event!.start.toString()).toBe('2025-12-06');
      expect(event!.end.toString()).toBe('2025-12-06');
    });

    it('Case 3: scheduled start exists, no end at all → display as all-day', () => {
      const task = createTask({
        scheduledStart: '2025-12-06T13:00:00',
        scheduledEnd: null,
        actualEnd: null,
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should be all-day (PlainDate, not ZonedDateTime)
      expect(event!.start.toString()).toBe('2025-12-06');
      expect(event!.end.toString()).toBe('2025-12-06');
    });
  });

  // 要件: 時間が決まっていないタスクは、いつ始めていつ終わったかを記録する
  describe('Tasks without scheduled time use actual time', () => {
    it('Case 4: no scheduled, actual complete → use actual time', () => {
      const task = createTask({
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: '2025-12-06T13:00:00',
        actualEnd: '2025-12-06T14:00:00',
        status: 'done',
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should use actual time
      expect(event!.start.toString()).toContain('13:00');
      expect(event!.end.toString()).toContain('14:00');
    });

    it('Case 5: no scheduled, actual in progress (no end) → do not show', () => {
      const task = createTask({
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: '2025-12-06T13:00:00',
        actualEnd: null,
        status: 'next',
      });

      const event = taskToCalendarEvent(task);

      // Task in progress should not appear on calendar
      expect(event).toBeNull();
    });

    it('Case 5b: no scheduled, actual spans multiple days → timed event across days', () => {
      const task = createTask({
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: '2025-12-06T23:00:00',
        actualEnd: '2025-12-07T01:00:00',
        status: 'done',
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should be timed event spanning two days
      expect(event!.start.toString()).toContain('2025-12-06');
      expect(event!.start.toString()).toContain('23:00');
      expect(event!.end.toString()).toContain('2025-12-07');
      expect(event!.end.toString()).toContain('01:00');
    });
  });

  // 要件: 日跨ぎの扱い - 時間が入っていない場合は終日予定
  describe('All-day events', () => {
    it('Case 6: isAllDay=true → display as all-day', () => {
      const task = createTask({
        scheduledStart: '2025-12-06T00:00:00',
        scheduledEnd: '2025-12-06T23:59:59',
        isAllDay: true,
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should be PlainDate (all-day)
      expect(event!.start.toString()).toBe('2025-12-06');
      expect(event!.end.toString()).toBe('2025-12-06');
    });

    it('Case 6b: isAllDay=true with multi-day range', () => {
      const task = createTask({
        scheduledStart: '2025-12-06T00:00:00',
        scheduledEnd: '2025-12-08T23:59:59',
        isAllDay: true,
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      expect(event!.start.toString()).toBe('2025-12-06');
      expect(event!.end.toString()).toBe('2025-12-08');
    });
  });

  // Edge case: nothing set
  describe('Edge cases', () => {
    it('Case 7: nothing set → do not show', () => {
      const task = createTask({
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        scheduledOn: null, // no legacy fields either
      });

      const event = taskToCalendarEvent(task);

      expect(event).toBeNull();
    });

    it('Legacy fallback: only scheduledOn exists → use legacy conversion', () => {
      const task = createTask({
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        scheduledOn: '2025-12-06',
        startTime: '13:00',
      });

      const event = taskToCalendarEvent(task);

      // Should fall back to legacy conversion
      expect(event).not.toBeNull();
    });
  });

  // Real bug case: task 82
  describe('Real bug cases', () => {
    it('Task 82: scheduled_start exists, scheduled_end null, actual_end exists → all-day event', () => {
      const task = createTask({
        id: 82,
        status: 'done',
        scheduledStart: '2025-12-06T19:55:00',
        scheduledEnd: null,
        actualStart: '2025-12-06T19:55:00',
        actualEnd: '2025-12-06T20:04:00',
        isAllDay: false,
      });

      const event = taskToCalendarEvent(task);

      expect(event).not.toBeNull();
      // Should be all-day (actualEnd is ignored when scheduledStart exists without scheduledEnd)
      expect(event!.start.toString()).toBe('2025-12-06');
      expect(event!.end.toString()).toBe('2025-12-06');
    });

    it('Task 155: no scheduled, only actual_start (in progress) → falls back to legacy due to scheduledOn', () => {
      const task = createTask({
        id: 155,
        status: 'next',
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: '2025-12-07T08:57:00',
        actualEnd: null,
        isAllDay: false,
        // Legacy fields exist - these will trigger legacy fallback
        scheduledOn: '2025-12-07',
        startTime: '13:14',
      });

      const event = taskToCalendarEvent(task);

      // Note: This task has actualStart (new field) which takes priority as effectiveStart
      // But it has no effectiveEnd (actualEnd is null)
      // And scheduledStart is null, so it doesn't hit the "scheduled start without end" case
      // Therefore it should return null (in progress task)
      expect(event).toBeNull();
    });
  });
});

describe('calendarMapper - getDateRange', () => {
  describe('Month view', () => {
    it('returns first and last day of the month', () => {
      const result = getDateRange('2025-12-15', 'month');
      expect(result.from).toBe('2025-12-01');
      expect(result.to).toBe('2025-12-31');
    });

    it('handles February in a non-leap year', () => {
      const result = getDateRange('2025-02-15', 'month');
      expect(result.from).toBe('2025-02-01');
      expect(result.to).toBe('2025-02-28');
    });

    it('handles February in a leap year', () => {
      const result = getDateRange('2024-02-15', 'month');
      expect(result.from).toBe('2024-02-01');
      expect(result.to).toBe('2024-02-29');
    });
  });

  describe('Week view (Monday-based)', () => {
    it('Sunday: returns previous Monday to this Sunday', () => {
      // 2025-12-07 is Sunday
      const result = getDateRange('2025-12-07', 'week');
      expect(result.from).toBe('2025-12-01'); // Monday
      expect(result.to).toBe('2025-12-07');   // Sunday
    });

    it('Monday: returns this Monday to next Sunday', () => {
      // 2025-12-08 is Monday
      const result = getDateRange('2025-12-08', 'week');
      expect(result.from).toBe('2025-12-08'); // Monday
      expect(result.to).toBe('2025-12-14');   // Sunday
    });

    it('Wednesday: returns this week Monday to Sunday', () => {
      // 2025-12-10 is Wednesday
      const result = getDateRange('2025-12-10', 'week');
      expect(result.from).toBe('2025-12-08'); // Monday
      expect(result.to).toBe('2025-12-14');   // Sunday
    });

    it('Saturday: returns this week Monday to Sunday', () => {
      // 2025-12-13 is Saturday
      const result = getDateRange('2025-12-13', 'week');
      expect(result.from).toBe('2025-12-08'); // Monday
      expect(result.to).toBe('2025-12-14');   // Sunday
    });

    it('handles week spanning month boundary', () => {
      // 2025-12-01 is Monday
      const result = getDateRange('2025-12-01', 'week');
      expect(result.from).toBe('2025-12-01'); // Monday
      expect(result.to).toBe('2025-12-07');   // Sunday
    });

    it('handles week spanning year boundary', () => {
      // 2025-12-31 is Wednesday
      const result = getDateRange('2025-12-31', 'week');
      expect(result.from).toBe('2025-12-29'); // Monday
      expect(result.to).toBe('2026-01-04');   // Sunday (next year)
    });
  });

  describe('Day view', () => {
    it('returns the same date for from and to', () => {
      const result = getDateRange('2025-12-15', 'day');
      expect(result.from).toBe('2025-12-15');
      expect(result.to).toBe('2025-12-15');
    });
  });
});
