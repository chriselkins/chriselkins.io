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
