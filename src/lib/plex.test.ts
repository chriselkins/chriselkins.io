import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupPlexUrl, plexUrl } from './plex';

describe('plexUrl', () => {
  it('puts the IP, with dashes for dots, into the plex.direct address', () => {
    expect(plexUrl('158.120.161.246')).toBe(
      'https://158-120-161-246.da4170b7efc8482da56e40d66d96c95a.plex.direct:32400/web/index.html#!/',
    );
    expect(plexUrl('158.120.161.99')).toBe(
      'https://158-120-161-99.da4170b7efc8482da56e40d66d96c95a.plex.direct:32400/web/index.html#!/',
    );
  });

  it('rejects anything that is not an IPv4 address', () => {
    for (const value of ['', '158.120.161', '158.120.161.256', '158.120.161.246.1', '158.120.161.2x', '2001:db8::1', 'kubrick.chriscelkins.com']) {
      expect(plexUrl(value), value).toBeNull();
    }
  });
});

describe('lookupPlexUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  const respond = (body: unknown, ok = true) => {
    const fetch = vi.fn(async () => ({ ok, json: async () => body }));
    vi.stubGlobal('fetch', fetch);
    return fetch;
  };

  it('asks Cloudflare for the A record and uses the first one', async () => {
    const fetch = respond({ Answer: [{ type: 5, data: 'home.example.net.' }, { type: 1, data: '158.120.161.99' }] });
    expect(await lookupPlexUrl()).toBe(
      'https://158-120-161-99.da4170b7efc8482da56e40d66d96c95a.plex.direct:32400/web/index.html#!/',
    );
    expect(fetch).toHaveBeenCalledWith('https://cloudflare-dns.com/dns-query?name=kubrick.chriscelkins.com&type=A', {
      headers: { accept: 'application/dns-json' },
    });
  });

  it('returns null when the name has no A record or the lookup fails', async () => {
    respond({ Status: 3 });
    expect(await lookupPlexUrl()).toBeNull();
    respond({}, false);
    expect(await lookupPlexUrl()).toBeNull();
  });
});
