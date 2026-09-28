import { describe, expect, it } from 'vitest';
import { parseSuggestions, urlFromQuery } from './search';

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
