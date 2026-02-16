import { describe, expect, it } from 'vitest';
import {
  formatTimelineTime,
  getTimelineDateBucket,
  shouldShowGapTimestamp,
} from '../../src/utils/memoTimeline';

describe('memoTimeline utilities', () => {
  it('returns Today for same local day', () => {
    const now = new Date('2026-02-14T12:00:00');
    expect(getTimelineDateBucket('2026-02-14T01:00:00', now)).toBe('Today');
  });

  it('returns Yesterday for previous day', () => {
    const now = new Date('2026-02-14T12:00:00');
    expect(getTimelineDateBucket('2026-02-13T23:00:00', now)).toBe('Yesterday');
  });

  it('returns This Week for dates after Monday start', () => {
    const now = new Date('2026-02-14T12:00:00');
    expect(getTimelineDateBucket('2026-02-12T09:30:00', now)).toBe('This Week');
  });

  it('returns This Month for dates in the same month but before this week', () => {
    // 2026-02-14 is Saturday; week starts Monday 2026-02-09
    const now = new Date('2026-02-14T12:00:00');
    expect(getTimelineDateBucket('2026-02-01T09:30:00', now)).toBe('This Month');
    expect(getTimelineDateBucket('2026-02-08T23:59:59', now)).toBe('This Month');
  });

  it('returns Earlier for dates older than this month', () => {
    const now = new Date('2026-02-14T12:00:00');
    expect(getTimelineDateBucket('2026-01-31T23:59:59', now)).toBe('Earlier');
    expect(getTimelineDateBucket('2025-12-25T09:00:00', now)).toBe('Earlier');
  });

  it('shows timestamp only when gap is one hour or more', () => {
    expect(shouldShowGapTimestamp('2026-02-14T10:00:00', '2026-02-14T10:59:59')).toBe(false);
    expect(shouldShowGapTimestamp('2026-02-14T10:00:00', '2026-02-14T11:00:00')).toBe(true);
  });

  it('formats timeline time as HH:mm', () => {
    expect(formatTimelineTime('2026-02-14T07:03:00')).toBe('07:03');
  });
});
