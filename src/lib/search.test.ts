import { describe, expect, it } from 'vitest';
import {
  HISTORY_SIZE,
  addToHistory,
  mergeSuggestions,
  parseHistory,
  parseSuggestions,
  removeFromHistory,
  urlFromQuery,
} from './search';

describe('urlFromQuery', () => {
  it('opens full http and https URLs as typed', () => {
    expect(urlFromQuery('https://example.com')).toBe('https://example.com/');
    expect(urlFromQuery('HTTPS://Example.com/Path?q=1#top')).toBe('https://example.com/Path?q=1#top');
    expect(urlFromQuery('http://localhost:4321/tools/')).toBe('http://localhost:4321/tools/');
    expect(urlFromQuery('http://192.168.1.1')).toBe('http://192.168.1.1/');
  });

  it('opens domains over https, with any port, path, or query', () => {
    expect(urlFromQuery('example.com')).toBe('https://example.com/');
    expect(urlFromQuery('Example.COM')).toBe('https://example.com/');
    expect(urlFromQuery('github.com/chriselkins')).toBe('https://github.com/chriselkins');
    expect(urlFromQuery('www.example.co.uk')).toBe('https://www.example.co.uk/');
    expect(urlFromQuery('example.com:8080/status?full=1')).toBe('https://example.com:8080/status?full=1');
    expect(urlFromQuery('socket.io')).toBe('https://socket.io/');
    expect(urlFromQuery('bücher.de')).toBe('https://xn--bcher-kva.de/');
  });

  it('ignores trailing spaces', () => {
    expect(urlFromQuery('example.com  ')).toBe('https://example.com/');
  });

  it('searches when the text starts with a space', () => {
    expect(urlFromQuery(' example.com')).toBeNull();
    expect(urlFromQuery(' https://example.com')).toBeNull();
  });

  it('searches words, phrases, and names that only look like domains', () => {
    for (const query of [
      '',
      '   ',
      'weather',
      'what is example.com',
      'node.js',
      'package.json',
      'index.html',
      'e.g.',
      '1.2.3',
      'a..b.com',
      'localhost:3000',
      '192.168.1.1',
      'user@example.com',
      'example.com@evil.example',
    ]) {
      expect(urlFromQuery(query), query).toBeNull();
    }
  });

  it('never opens other schemes', () => {
    for (const query of [
      'javascript:alert(1)',
      'data:text/html,<b>hi</b>',
      'file:///etc/passwd',
      'chrome://settings',
      'mailto:me@example.com',
      'ftp://example.com',
    ]) {
      expect(urlFromQuery(query), query).toBeNull();
    }
  });
});

describe('parseSuggestions', () => {
  it('reads the suggestions from Google and DuckDuckGo replies', () => {
    const google = ['weather', ['weather radar', 'weather today'], [], { 'google:suggestsubtypes': [[512], [512, 433]] }];
    expect(parseSuggestions(google)).toEqual(['weather radar', 'weather today']);
    expect(parseSuggestions(['café', ['café du monde', 'café bustelo']])).toEqual(['café du monde', 'café bustelo']);
  });

  it('finds none in anything else', () => {
    for (const data of [[], ['weather'], ['weather', 'radar'], {}, null, 'weather', [null, [1, null, {}]]]) {
      expect(parseSuggestions(data), JSON.stringify(data)).toEqual([]);
    }
  });
});

describe('parseHistory', () => {
  it('reads a saved history', () => {
    expect(parseHistory(['weather radar', 'github.com/chriselkins'])).toEqual(['weather radar', 'github.com/chriselkins']);
    expect(parseHistory(['weather', 1, null, 'news'])).toEqual(['weather', 'news']);
  });

  it('finds none in anything else', () => {
    for (const data of [null, {}, 'weather', 42, [1, null, {}]]) {
      expect(parseHistory(data), JSON.stringify(data)).toEqual([]);
    }
  });
});

describe('addToHistory', () => {
  it('puts a search at the front, trimmed', () => {
    expect(addToHistory(['weather'], '  node.js streams ')).toEqual(['node.js streams', 'weather']);
    expect(addToHistory([], 'github.com/chriselkins')).toEqual(['github.com/chriselkins']);
  });

  it('moves a search I made before to the front, as I typed it this time', () => {
    expect(addToHistory(['weather', 'Café du Monde', 'news'], 'café du monde')).toEqual(['café du monde', 'weather', 'news']);
  });

  it('ignores blank searches', () => {
    const history = ['weather'];
    expect(addToHistory(history, '   ')).toBe(history);
  });

  it(`keeps the newest ${HISTORY_SIZE}`, () => {
    const full = Array.from({ length: HISTORY_SIZE }, (_, i) => `search ${i}`);
    const next = addToHistory(full, 'newest');
    expect(next).toHaveLength(HISTORY_SIZE);
    expect(next[0]).toBe('newest');
    expect(next.at(-1)).toBe(`search ${HISTORY_SIZE - 2}`);
  });
});

describe('removeFromHistory', () => {
  it('removes a search in any case and keeps the rest in order', () => {
    expect(removeFromHistory(['weather', 'News', 'maps'], 'news')).toEqual(['weather', 'maps']);
    expect(removeFromHistory(['weather'], 'maps')).toEqual(['weather']);
  });
});

describe('mergeSuggestions', () => {
  const history = ['weather radar', 'news', 'Weather Tomorrow', 'wells fargo', 'weather'];

  it('puts my past searches that start with what I typed first, most recent first', () => {
    expect(mergeSuggestions(history, 'wea', ['weather', 'weather channel', 'WEATHER RADAR'])).toEqual([
      { text: 'weather radar', past: true },
      { text: 'Weather Tomorrow', past: true },
      { text: 'weather', past: true },
      { text: 'weather channel', past: false },
    ]);
  });

  it('ignores case and leading spaces in what I typed', () => {
    expect(mergeSuggestions(history, '  WEATHER T', [])).toEqual([{ text: 'Weather Tomorrow', past: true }]);
  });

  it('only matches the start of a past search', () => {
    expect(mergeSuggestions(history, 'radar', ['radar map'])).toEqual([{ text: 'radar map', past: false }]);
    expect(mergeSuggestions(history, 'weather ', [])).toEqual([
      { text: 'weather radar', past: true },
      { text: 'Weather Tomorrow', past: true },
    ]);
  });

  it('shows at most five past searches and eight suggestions in all', () => {
    const past = Array.from({ length: 7 }, (_, i) => `weather ${i}`);
    const engine = Array.from({ length: 10 }, (_, i) => `weather news ${i}`);
    expect(mergeSuggestions(past, 'weather', engine)).toEqual([
      ...past.slice(0, 5).map((text) => ({ text, past: true })),
      ...engine.slice(0, 3).map((text) => ({ text, past: false })),
    ]);
  });

  it("shows only my past searches when the engine has none, and only the engine's when none of mine match", () => {
    expect(mergeSuggestions(history, 'ne', [])).toEqual([{ text: 'news', past: true }]);
    expect(mergeSuggestions(history, 'maps', ['maps', 'maps directions'])).toEqual([
      { text: 'maps', past: false },
      { text: 'maps directions', past: false },
    ]);
    expect(mergeSuggestions([], 'maps', [])).toEqual([]);
  });
});
