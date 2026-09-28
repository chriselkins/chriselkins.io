import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIME_SOURCE, clockOffset, describeOffset, measureClockOffset, parseServerTime } from './clock';

const T = 1790557227000;

describe('parseServerTime', () => {
  it('reads seconds, with or without milliseconds', () => {
    expect(parseServerTime('1790557227.050')).toBe(1790557227050);
    expect(parseServerTime('1790557227\n')).toBe(1790557227000);
  });

  it('rejects anything else', () => {
    for (const text of ['', 'abc', '<html>', '-1790557227', '1790557227.0501', '17905572270']) {
      expect(parseServerTime(text), text).toBeNull();
    }
  });
});

describe('clockOffset', () => {
  it('matches the server reading to the middle of the round trip', () => {
    // Sent at T by the device, answered 200 ms later with T + 5,100: the server read T + 5,100 when
    // the device read T + 100, so the device is 5 seconds behind.
    expect(clockOffset(T, 200, T + 5100)).toBe(5000);
  });

  it('rounds to whole milliseconds, since round trips are timed to fractions of one', () => {
    expect(clockOffset(T, 200.6, T + 5100)).toBe(5000);
  });
});

describe('measureClockOffset', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the reading with the shortest round trip', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(T);
    const clock = vi.spyOn(performance, 'now');
    // Round trips of 300, 100, and 200 ms, each measured from 0.
    for (const roundTrip of [300, 100, 200]) clock.mockReturnValueOnce(0).mockReturnValueOnce(roundTrip);
    // Offsets of 5, 4, and 6 seconds.
    const answers = [T + 5000 + 150, T + 4000 + 50, T + 6000 + 100].map((ms) => (ms / 1000).toFixed(3));
    const fetch = vi.fn(async () => ({ ok: true, text: async () => answers.shift()! }));
    vi.stubGlobal('fetch', fetch);

    expect(await measureClockOffset()).toEqual({ offset: 4000, roundTrip: 100 });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith(TIME_SOURCE, expect.objectContaining({ cache: 'no-store' }));
  });

  it('returns null when the service cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await measureClockOffset()).toBeNull();
  });
});

describe('describeOffset', () => {
  it('says which way the device clock is off', () => {
    expect(describeOffset(20)).toBe('right on time');
    expect(describeOffset(400)).toBe('0.4 s behind');
    expect(describeOffset(-2100)).toBe('2.1 s ahead');
    expect(describeOffset(95_000)).toBe('95 s behind');
  });
});
