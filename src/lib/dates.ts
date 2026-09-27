const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-09" → "Sep 2026"; a bare "2026" stays "2026". */
export function monthYear(ym: string): string {
  const [year, month] = ym.split('-').map(Number);
  return month ? `${MONTHS[month - 1]} ${year}` : String(year);
}

/** "2026-09" → "2026" */
export function year(ym: string): string {
  return ym.slice(0, 4);
}

/** "Sep 2026 – Present" style range. */
export function range(start: string, end?: string): string {
  return `${monthYear(start)} – ${end ? monthYear(end) : 'Present'}`;
}

/** Post dates are written as plain YYYY-MM-DD, so format them in UTC to avoid an off-by-one day. */
export function postDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
