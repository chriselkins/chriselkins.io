// My Plex server: the dynamic DNS name that follows my home IP, and the ID in
// its plex.direct address (the name its certificate is issued for).
export const PLEX_HOST = 'kubrick.chriscelkins.com';
const PLEX_ID = 'da4170b7efc8482da56e40d66d96c95a';

/** The Plex web app at this IPv4 address: 158.120.161.246 opens https://158-120-161-246.<id>.plex.direct:32400/web/. */
export function plexUrl(ip: string): string | null {
  const octets = ip.split('.');
  if (octets.length !== 4 || !octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255)) return null;
  return `https://${octets.join('-')}.${PLEX_ID}.plex.direct:32400/web/index.html#!/`;
}

/** Looks up the server's current IP with Cloudflare's DNS over HTTPS and returns its Plex address. */
export async function lookupPlexUrl(): Promise<string | null> {
  const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${PLEX_HOST}&type=A`, {
    headers: { accept: 'application/dns-json' },
  });
  if (!response.ok) return null;
  const { Answer = [] }: { Answer?: { type: number; data: string }[] } = await response.json();
  // Type 1 is an A record; a CNAME in the chain comes back as type 5.
  const ip = Answer.find((record) => record.type === 1)?.data;
  return ip ? plexUrl(ip) : null;
}
