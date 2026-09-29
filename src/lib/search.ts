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

/**
 * The suggestions in a reply from Google's or DuckDuckGo's suggestion service, which both look like
 * ["what I typed", ["suggestion", ...], ...]. Anything else has none.
 */
export function parseSuggestions(data: unknown): string[] {
  const suggestions = Array.isArray(data) ? data[1] : undefined;
  return Array.isArray(suggestions) ? suggestions.filter((s): s is string => typeof s === 'string') : [];
}

/** Each search box remembers my last 1,000 searches. */
export const HISTORY_SIZE = 1000;

/** A row in a search box's suggestions: one of my past searches, or one of the engine's. */
export interface Suggestion {
  text: string;
  past: boolean;
}

/** A search history as saved, an array of searches with the most recent first. Anything else is empty. */
export function parseHistory(data: unknown): string[] {
  return Array.isArray(data) ? data.filter((s): s is string => typeof s === 'string') : [];
}

/** My history without a search, in any case. */
export function removeFromHistory(history: string[], search: string): string[] {
  const key = search.toLowerCase();
  return history.filter((past) => past.toLowerCase() !== key);
}

/**
 * My history with a search at the front. One I've made before moves up instead of showing twice, even
 * in different case, and only the newest HISTORY_SIZE are kept.
 */
export function addToHistory(history: string[], query: string): string[] {
  const search = query.trim();
  if (!search) return history;
  return [search, ...removeFromHistory(history, search)].slice(0, HISTORY_SIZE);
}

/**
 * What a search box suggests for what I've typed, as the browser's address bar does: up to five of my
 * past searches that start with it, most recent first, then the engine's suggestions that aren't among
 * them, eight in all.
 */
export function mergeSuggestions(history: string[], typed: string, suggestions: string[]): Suggestion[] {
  const prefix = typed.trimStart().toLowerCase();
  const past = history.filter((search) => search.toLowerCase().startsWith(prefix)).slice(0, 5);
  const shown = new Set(past.map((search) => search.toLowerCase()));
  return [
    ...past.map((text) => ({ text, past: true })),
    ...suggestions.filter((text) => !shown.has(text.toLowerCase())).map((text) => ({ text, past: false })),
  ].slice(0, 8);
}
