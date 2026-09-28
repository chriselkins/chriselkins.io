// An accurate "now" for the tools page: Akamai's time service, corrected for the network round trip.
// The page falls back to this device's clock when the service can't be reached.
export const TIME_SOURCE = 'https://time.akamai.com/?ms';

/** Akamai answers with seconds since the epoch, like "1790557227.050". Returns milliseconds. */
export function parseServerTime(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d{10}(\.\d{1,3})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 1000);
}

/**
 * How far the server's clock is ahead of the device's, in whole milliseconds, taking its reading as the
 * middle of the round trip. Whole, so "now" stays a whole number of milliseconds too.
 */
export const clockOffset = (sentAt: number, roundTrip: number, serverTime: number) =>
  Math.round(serverTime - (sentAt + roundTrip / 2));

/**
 * Asks the time service a few times and keeps the reading with the shortest round trip, the way NTP
 * does, since that one has the least room for error. Returns null when every request fails.
 */
export async function measureClockOffset(samples = 3): Promise<{ offset: number; roundTrip: number } | null> {
  let best: { offset: number; roundTrip: number } | null = null;
  for (let i = 0; i < samples; i++) {
    try {
      const sentAt = Date.now();
      const started = performance.now();
      const response = await fetch(TIME_SOURCE, { cache: 'no-store', signal: AbortSignal.timeout(3000) });
      const serverTime = parseServerTime(await response.text());
      const roundTrip = performance.now() - started;
      if (!response.ok || serverTime === null) continue;
      if (!best || roundTrip < best.roundTrip) best = { offset: clockOffset(sentAt, roundTrip, serverTime), roundTrip };
    } catch {
      // Offline, timed out, or blocked: try the next sample.
    }
  }
  return best;
}

/** "0.4 s behind", "2.1 s ahead", or "right on time", for an offset from measureClockOffset. */
export function describeOffset(offset: number): string {
  const seconds = Math.abs(offset) / 1000;
  if (seconds < 0.05) return 'right on time';
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s ${offset > 0 ? 'behind' : 'ahead'}`;
}
