import { describe, expect, it } from 'vitest';
import { addDays, formatStay, isCalendarDate, nightsBetween, todayUtc } from './dates';

describe('dates', () => {
  it('accepts real calendar dates only', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    expect(isCalendarDate('2027-02-29')).toBe(false);
    expect(isCalendarDate('2026-13-01')).toBe(false);
    expect(isCalendarDate('2026-1-01')).toBe(false);
  });

  it('computes today and offsets in UTC, whatever the server zone', () => {
    const lateEvening = new Date('2026-10-30T23:30:00-07:00');
    expect(todayUtc(lateEvening)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(nightsBetween('2026-11-01', '2026-11-04')).toBe(3);
  });

  it('formats a stay as one range', () => {
    // ICU puts thin spaces around the dash.
    expect(formatStay('2026-11-03', '2026-11-06', 'en-US').replace(/\s/g, ' ')).toBe(
      'Nov 3 – 6, 2026',
    );
  });
});
