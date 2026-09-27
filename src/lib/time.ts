/**
 * Time zone math on top of Intl, which knows every DST rule. An "instant" is
 * epoch milliseconds; "wall time" is what a clock in a given zone shows.
 */
export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function wallTime(instant: number, timeZone: string): WallTime {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(timeZone).formatToParts(new Date(instant))) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Minutes east of UTC for a zone at an instant (Chicago in summer: -300). */
/** Wall time read as if it were UTC. Unlike Date.UTC, years 1-99 stay literal. */
function wallAsUtc(w: WallTime): number {
  const d = new Date(0);
  d.setUTCFullYear(w.year, w.month - 1, w.day);
  d.setUTCHours(w.hour, w.minute, w.second, 0);
  return d.getTime();
}

export function offsetMinutes(instant: number, timeZone: string): number {
  const wholeSecond = Math.floor(instant / 1000) * 1000;
  return Math.round((wallAsUtc(wallTime(wholeSecond, timeZone)) - wholeSecond) / 60_000);
}

/**
 * Instant for a wall time in a zone. A time skipped by a DST jump lands after
 * the jump (2:30 AM on spring-forward day becomes 3:30 AM); a repeated time
 * picks the first occurrence. Same rules as Temporal's "compatible" mode.
 */
export function instantFromWallTime(w: WallTime, timeZone: string): number {
  const asUtc = wallAsUtc(w);
  const first = asUtc - offsetMinutes(asUtc, timeZone) * 60_000;
  const second = asUtc - offsetMinutes(first, timeZone) * 60_000;
  if (first === second) return first;
  const check = wallTime(second, timeZone);
  if (check.day === w.day && check.hour === w.hour && check.minute === w.minute) return second;
  return Math.max(first, second);
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** 2026-09-26 14:30:05 */
export function formatWallTime(w: WallTime): string {
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)} ${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}`;
}

/** UTC−05:00, UTC+05:30 (with a real minus sign). */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '−' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** CDT/CST, EDT/EST from Intl; zones without a US abbreviation pass one in. */
export function zoneAbbreviation(instant: number, timeZone: string, fixed?: string): string {
  if (fixed) return fixed;
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(new Date(instant))
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? '';
}

/** Sat, Sep 26 · 2:30 PM */
export function friendlyTime(instant: number, timeZone: string): string {
  const date = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
  const d = new Date(instant);
  return `${date.format(d)} · ${time.format(d)}`;
}

const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function validDate(year: number, month: number, day: number): boolean {
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Parses what a person types into a zone's field and returns an instant, or
 * null if it can't be understood. Parts left out (the date, or the time) are
 * kept from `current`. Accepts, among others:
 *   2026-09-26 14:30   2026-09-26T14:30:05   9/26/2026 2:30 pm   9/26 3pm
 *   14:30   2:30pm   3 PM   noon   midnight
 *   2026-09-26T19:30:00Z / +05:30 (an absolute instant, zone ignored)
 */
export function parseInZone(text: string, timeZone: string, current: number): number | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;

  // Absolute ISO 8601 instant with Z or an explicit offset.
  if (/^\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?\s?(z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const iso = s.replace(' ', 'T').replace(/\s/, '').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
    const ms = Date.parse(iso.toUpperCase());
    return Number.isNaN(ms) ? null : ms;
  }

  const base = wallTime(current, timeZone);
  let { year, month, day } = base;
  let rest = s;

  // Date part.
  let m: RegExpMatchArray | null;
  if ((m = rest.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[t ]|$)/))) {
    [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    rest = rest.slice(m[0].length);
  } else if ((m = rest.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?(?: |,|$)/))) {
    month = Number(m[1]);
    day = Number(m[2]);
    if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    rest = rest.slice(m[0].length);
  } else if ((m = rest.match(/^(?:[a-z]{3,9},? )?([a-z]{3})[a-z]*\.? (\d{1,2})(?:,? (\d{4}))?(?:,? |$)/))) {
    const index = MONTH_NAMES.indexOf(m[1]);
    if (index === -1) return null;
    month = index + 1;
    day = Number(m[2]);
    if (m[3]) year = Number(m[3]);
    rest = rest.slice(m[0].length);
  }
  if (!validDate(year, month, day)) return null;

  // Time part (optional when a date was given).
  rest = rest.replace(/^(at|@) /, '').trim();
  let { hour, minute, second } = base;
  if (rest === 'noon') {
    [hour, minute, second] = [12, 0, 0];
  } else if (rest === 'midnight') {
    [hour, minute, second] = [0, 0, 0];
  } else if (rest) {
    const t = rest.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.\d+)?(?: ?([ap])\.?(?:m\.?)?)?$/);
    if (!t) return null;
    hour = Number(t[1]);
    minute = t[2] ? Number(t[2]) : 0;
    second = t[3] ? Number(t[3]) : 0;
    const meridiem = t[4];
    if (meridiem) {
      if (hour < 1 || hour > 12) return null;
      hour = (hour % 12) + (meridiem === 'p' ? 12 : 0);
    }
    if (hour > 23 || minute > 59 || second > 59) return null;
  }

  return instantFromWallTime({ year, month, day, hour, minute, second }, timeZone);
}

/**
 * Parses a Unix timestamp. Seconds by default; 13+ digit values (anything
 * beyond year ~5138 in seconds) are treated as milliseconds.
 */
export function parseUnix(text: string): number | null {
  const s = text.trim().replace(/[,_\s]/g, '');
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  const ms = Math.abs(n) >= 1e11 ? n : n * 1000;
  // JavaScript dates span ±8.64e15 ms; also keep to years 1-9999 for display.
  if (ms < -62135596800000 || ms > 253402300799999) return null;
  return Math.round(ms);
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365.25 * 24 * 3600e3],
  ['month', 30.44 * 24 * 3600e3],
  ['week', 7 * 24 * 3600e3],
  ['day', 24 * 3600e3],
  ['hour', 3600e3],
  ['minute', 60e3],
  ['second', 1e3],
];

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "in 3 hours", "2 days ago", "now". */
export function relativeTime(instant: number, now: number): string {
  const diff = instant - now;
  if (Math.abs(diff) < 1000) return 'now';
  for (const [unit, size] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= size || unit === 'second') {
      return relativeFormat.format(Math.round(diff / size), unit);
    }
  }
  return 'now';
}
