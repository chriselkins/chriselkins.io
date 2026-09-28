import { describe, expect, it } from 'vitest';
import {
  formatOffset,
  formatWallTime,
  friendlyTime,
  instantFromWallTime,
  offsetMinutes,
  parseInZone,
  parseUnix,
  relativeTime,
  wallTime,
  zoneAbbreviation,
} from './time';

const CHI = 'America/Chicago';
const NYC = 'America/New_York';
const DEN = 'America/Denver';
const LAX = 'America/Los_Angeles';
const IND = 'Asia/Kolkata';
const UTC = 'UTC';

// Sat Sep 26 2026, 2:30:05 PM in Chicago (CDT).
const NOW = Date.UTC(2026, 8, 26, 19, 30, 5);

describe('offsets', () => {
  it('knows daylight and standard time', () => {
    expect(offsetMinutes(NOW, CHI)).toBe(-300);
    expect(offsetMinutes(Date.UTC(2026, 0, 15, 12), CHI)).toBe(-360);
    expect(offsetMinutes(NOW, NYC)).toBe(-240);
    expect(offsetMinutes(NOW, IND)).toBe(330);
    expect(offsetMinutes(NOW, UTC)).toBe(0);
  });

  it('formats offsets with a real minus sign', () => {
    expect(formatOffset(-300)).toBe('UTC−05:00');
    expect(formatOffset(330)).toBe('UTC+05:30');
    expect(formatOffset(0)).toBe('UTC+00:00');
  });

  it('names US zones by season', () => {
    expect(zoneAbbreviation(NOW, CHI)).toBe('CDT');
    expect(zoneAbbreviation(Date.UTC(2026, 0, 15, 12), CHI)).toBe('CST');
    expect(zoneAbbreviation(NOW, NYC)).toBe('EDT');
    expect(zoneAbbreviation(NOW, IND, 'IST')).toBe('IST');
  });

  it('switches Mountain and Pacific between daylight and standard time too', () => {
    const JAN = Date.UTC(2026, 0, 15, 12);
    expect([zoneAbbreviation(NOW, DEN), offsetMinutes(NOW, DEN)]).toEqual(['MDT', -360]);
    expect([zoneAbbreviation(JAN, DEN), offsetMinutes(JAN, DEN)]).toEqual(['MST', -420]);
    expect([zoneAbbreviation(NOW, LAX), offsetMinutes(NOW, LAX)]).toEqual(['PDT', -420]);
    expect([zoneAbbreviation(JAN, LAX), offsetMinutes(JAN, LAX)]).toEqual(['PST', -480]);
    // Daylight time ends at 2 AM local on Nov 1, 2026: 1:59 AM MDT, then 1:00 AM MST.
    expect(zoneAbbreviation(Date.UTC(2026, 10, 1, 7, 59), DEN)).toBe('MDT');
    expect(zoneAbbreviation(Date.UTC(2026, 10, 1, 8, 0), DEN)).toBe('MST');
  });
});

describe('wall time', () => {
  it('reads the same instant in every zone', () => {
    expect(formatWallTime(wallTime(NOW, CHI))).toBe('2026-09-26 14:30:05');
    expect(formatWallTime(wallTime(NOW, NYC))).toBe('2026-09-26 15:30:05');
    expect(formatWallTime(wallTime(NOW, IND))).toBe('2026-09-27 01:00:05');
    expect(formatWallTime(wallTime(NOW, UTC))).toBe('2026-09-26 19:30:05');
  });

  it('round-trips a wall time back to the instant', () => {
    for (const zone of [CHI, NYC, IND, UTC]) {
      expect(instantFromWallTime(wallTime(NOW, zone), zone)).toBe(NOW);
    }
  });

  it('moves a time skipped by spring-forward to after the jump', () => {
    // 2026-03-08 02:30 does not exist in Chicago; 03:30 CDT is 08:30Z.
    const t = instantFromWallTime({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, CHI);
    expect(t).toBe(Date.UTC(2026, 2, 8, 8, 30));
  });

  it('handles the hours right after spring-forward', () => {
    const t = instantFromWallTime({ year: 2026, month: 3, day: 8, hour: 5, minute: 0, second: 0 }, CHI);
    expect(t).toBe(Date.UTC(2026, 2, 8, 10, 0));
  });

  it('picks the first occurrence of a repeated fall-back time', () => {
    // 2026-11-01 01:30 happens twice in Chicago; the first is 01:30 CDT (06:30Z).
    const t = instantFromWallTime({ year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 }, CHI);
    expect(t).toBe(Date.UTC(2026, 10, 1, 6, 30));
  });

  it('formats a friendly label', () => {
    expect(friendlyTime(NOW, CHI)).toBe('Sat, Sep 26 · 2:30 PM');
    expect(friendlyTime(NOW, IND)).toBe('Sun, Sep 27 · 1:00 AM');
  });
});

describe('parseInZone', () => {
  it('parses a full date and time', () => {
    expect(parseInZone('2026-09-26 14:30', CHI, NOW)).toBe(Date.UTC(2026, 8, 26, 19, 30));
    expect(parseInZone('2026-09-26T14:30:05', CHI, NOW)).toBe(NOW);
    expect(parseInZone('9/27/2026 9:30 AM', IND, NOW)).toBe(Date.UTC(2026, 8, 27, 4, 0));
    expect(parseInZone('9/27/26 9:30am', IND, NOW)).toBe(Date.UTC(2026, 8, 27, 4, 0));
    expect(parseInZone('Sun, Sep 27 2026 9:30 AM', IND, NOW)).toBe(Date.UTC(2026, 8, 27, 4, 0));
    expect(parseInZone('September 27, 2026 at 9:30am', IND, NOW)).toBe(Date.UTC(2026, 8, 27, 4, 0));
  });

  it('keeps the current date in that zone when only a time is typed', () => {
    expect(parseInZone('2:30pm', CHI, NOW)).toBe(Date.UTC(2026, 8, 26, 19, 30));
    expect(parseInZone('3 PM', NYC, NOW)).toBe(Date.UTC(2026, 8, 26, 19, 0));
    // In India it is already Sep 27.
    expect(parseInZone('9:30 a.m.', IND, NOW)).toBe(Date.UTC(2026, 8, 27, 4, 0));
    expect(parseInZone('14:30:59', UTC, NOW)).toBe(Date.UTC(2026, 8, 26, 14, 30, 59));
    expect(parseInZone('12am', UTC, NOW)).toBe(Date.UTC(2026, 8, 26, 0, 0));
    expect(parseInZone('12pm', UTC, NOW)).toBe(Date.UTC(2026, 8, 26, 12, 0));
    expect(parseInZone('noon', UTC, NOW)).toBe(Date.UTC(2026, 8, 26, 12, 0));
    expect(parseInZone('midnight', UTC, NOW)).toBe(Date.UTC(2026, 8, 26, 0, 0));
  });

  it('keeps the current time of day when only a date is typed', () => {
    // 14:30:05 on Dec 25 in Chicago is standard time (UTC-6).
    expect(parseInZone('2026-12-25', CHI, NOW)).toBe(Date.UTC(2026, 11, 25, 20, 30, 5));
    expect(parseInZone('12/25', CHI, NOW)).toBe(Date.UTC(2026, 11, 25, 20, 30, 5));
  });

  it('treats an ISO string with an offset as an absolute instant', () => {
    expect(parseInZone('2026-09-26T19:30:05Z', IND, NOW)).toBe(NOW);
    expect(parseInZone('2026-09-27 01:00:05 +05:30', CHI, NOW)).toBe(NOW);
    expect(parseInZone('2026-09-27T01:00:05+0530', UTC, NOW)).toBe(NOW);
  });

  it('rejects things that are not times', () => {
    for (const bad of ['', '   ', 'hello', '13pm', '0am', '25:00', '14:60', '2026-02-30', '2026-13-01', '3m', 'sep', '9/31']) {
      expect(parseInZone(bad, CHI, NOW), bad).toBeNull();
    }
  });
});

describe('parseUnix', () => {
  it('reads seconds and milliseconds', () => {
    expect(parseUnix(String(NOW / 1000))).toBe(NOW);
    expect(parseUnix(String(NOW))).toBe(NOW);
    expect(parseUnix(' 1,790,451,005 ')).toBe(1_790_451_005_000);
    expect(parseUnix('0')).toBe(0);
    expect(parseUnix('-86400')).toBe(-86_400_000);
    expect(parseUnix('1790451005.5')).toBe(1_790_451_005_500);
  });

  it('rejects junk and out-of-range values', () => {
    expect(parseUnix('abc')).toBeNull();
    expect(parseUnix('12e3')).toBeNull();
    expect(parseUnix('')).toBeNull();
    expect(parseUnix('99999999999999999')).toBeNull();
  });
});

describe('relativeTime', () => {
  it('describes the distance from now', () => {
    expect(relativeTime(NOW, NOW)).toBe('now');
    expect(relativeTime(NOW + 3 * 3600e3, NOW)).toBe('in 3 hours');
    expect(relativeTime(NOW - 2 * 86400e3, NOW)).toBe('2 days ago');
    expect(relativeTime(NOW - 30e3, NOW)).toBe('30 seconds ago');
    expect(relativeTime(NOW + 400 * 86400e3, NOW)).toBe('next year');
  });
});
