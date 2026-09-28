import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// CloudFormation doesn't allow YAML aliases, so NoIndexHeadersPolicy repeats the site's security
// headers. These checks keep the copy in step with SecurityHeadersPolicy.
const template = parse(readFileSync(new URL('./site.yaml', import.meta.url), 'utf8'), { logLevel: 'error' });
const policy = (name: string) => template.Resources[name].Properties.ResponseHeadersPolicyConfig;
const site = policy('SecurityHeadersPolicy');
const noindex = policy('NoIndexHeadersPolicy');

describe('NoIndexHeadersPolicy', () => {
  it('matches the site policy apart from the referrer and X-Robots-Tag', () => {
    expect({ ...noindex.SecurityHeadersConfig, ReferrerPolicy: undefined }).toEqual({
      ...site.SecurityHeadersConfig,
      ReferrerPolicy: undefined,
    });
    expect(noindex.CustomHeadersConfig.Items.filter((h: { Header: string }) => h.Header !== 'X-Robots-Tag')).toEqual(
      site.CustomHeadersConfig.Items,
    );
    expect(noindex.RemoveHeadersConfig).toEqual(site.RemoveHeadersConfig);
  });

  it('keeps pages out of search engines and sends no referrer', () => {
    expect(noindex.SecurityHeadersConfig.ReferrerPolicy.ReferrerPolicy).toBe('no-referrer');
    expect(noindex.CustomHeadersConfig.Items).toContainEqual({ Header: 'X-Robots-Tag', Value: 'noindex, nofollow', Override: true });
    expect(site.SecurityHeadersConfig.ReferrerPolicy.ReferrerPolicy).toBe('strict-origin-when-cross-origin');
  });
});

// SuggestFunction's code runs here as it would on CloudFront, which hands it each query string value
// as sent, still percent-encoded.
describe('SuggestFunction', () => {
  const handler = new Function(`${template.Resources.SuggestFunction.Properties.FunctionCode}\nreturn handler;`)();
  const run = (uri: string, query: Record<string, string>) =>
    handler({
      request: {
        method: 'GET',
        uri,
        querystring: Object.fromEntries(Object.entries(query).map(([name, value]) => [name, { value }])),
        headers: {},
        cookies: {},
      },
    });

  it('sends each search box to its engine with a fixed query plus q', () => {
    expect(run('/tools/suggest/google', { q: 'caf%C3%A9' })).toMatchObject({
      uri: '/complete/search',
      querystring: 'client=firefox&q=caf%C3%A9',
    });
    expect(run('/tools/suggest/youtube', { q: 'lofi%20beats' })).toMatchObject({
      uri: '/complete/search',
      querystring: 'client=firefox&ds=yt&q=lofi%20beats',
    });
    expect(run('/tools/suggest/duckduckgo', { q: 'weather' })).toMatchObject({ uri: '/ac/', querystring: 'type=list&q=weather' });
  });

  it('drops every other parameter, so a JSONP callback never reaches Google', () => {
    const query = { callback: 'alert', jsonp: 'alert', client: 'youtube', q: 'test' };
    expect(run('/tools/suggest/google', query).querystring).toBe('client=firefox&q=test');
  });

  it('refuses a q that could add a parameter, and paths it does not know', () => {
    for (const q of ['', 'x&callback=alert', 'x=1', 'a b', 'x#y']) {
      expect(run('/tools/suggest/google', { q }).statusCode, q).toBe(400);
    }
    expect(run('/tools/suggest/google', {}).statusCode).toBe(400);
    expect(run('/tools/suggest/bing', { q: 'test' }).statusCode).toBe(400);
  });

  it('handles every suggestion path, ahead of /tools/*', () => {
    const { CacheBehaviors: behaviors, Origins: origins } = template.Resources.Distribution.Properties.DistributionConfig;
    const hosts = { google: 'suggestqueries.google.com', youtube: 'suggestqueries.google.com', duckduckgo: 'duckduckgo.com' };
    for (const [engine, host] of Object.entries(hosts)) {
      const path = `/tools/suggest/${engine}`;
      // CloudFront takes the first behavior that matches. The template only has exact and trailing-* patterns.
      const behavior = behaviors.find(({ PathPattern: pattern }: { PathPattern: string }) =>
        pattern.endsWith('*') ? path.startsWith(pattern.slice(0, -1)) : path === pattern,
      );
      expect(origins.find(({ Id }: { Id: string }) => Id === behavior.TargetOriginId).DomainName, path).toBe(host);
      expect(behavior.FunctionAssociations, path).toEqual([
        { EventType: 'viewer-request', FunctionARN: 'SuggestFunction.FunctionMetadata.FunctionARN' },
      ]);
    }
  });
});
