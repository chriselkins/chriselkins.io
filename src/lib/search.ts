import IANA_TLDS from './tlds.txt?raw';

// Every top-level domain in the root zone, from
// https://data.iana.org/TLD/tlds-alpha-by-domain.txt (download it again to refresh).
// Checking against the real list keeps "node.js" a search and "socket.io" a site.
const TLDS = new Set(
  IANA_TLDS.split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((tld) => tld.toLowerCase()),
);

function parse(text: string) {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/**
 * The address to open when a search box holds a site instead of a query: a
 * full http(s) URL, or a domain with an optional port, path, and query
 * (github.com/chriselkins). Anything with a space in it, including a leading
 * space, stays a search, as does every other scheme (javascript:, data:, file:).
 */
export function urlFromQuery(query: string): string | null {
  const text = query.trimEnd();
  if (!text || /\s/.test(text)) return null;

  const full = parse(text);
  if (full?.protocol === 'https:' || full?.protocol === 'http:') return full.href;

  const bare = parse(`https://${text}`);
  if (!bare || bare.username || bare.password) return null;
  const labels = bare.hostname.split('.');
  const isDomain =
    labels.length > 1 && labels.every((label) => /^[a-z0-9-]+$/.test(label)) && TLDS.has(labels[labels.length - 1]);
  return isDomain ? bare.href : null;
}
