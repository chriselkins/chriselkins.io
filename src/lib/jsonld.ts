import { profile } from './profile';

/** schema.org Person for the home page, built from profile.yaml. */
export function personJsonLd(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': new URL('/#person', site).href,
    name: profile.name,
    url: site.href,
    image: new URL('/images/headshot-960.jpg', site).href,
    description: profile.description,
    jobTitle: profile.roles[0].title,
    worksFor: profile.roles.map((role) => ({
      '@type': 'Organization',
      name: role.organization,
      url: role.url,
    })),
    address: {
      '@type': 'PostalAddress',
      addressLocality: profile.location.city,
      addressRegion: profile.location.regionCode,
      addressCountry: profile.location.country,
    },
    sameAs: Object.values(profile.links),
    hasCredential: profile.certifications.map((cert) => ({
      '@type': 'EducationalOccupationalCredential',
      name: `${cert.name} (${cert.abbreviation})`,
      credentialCategory: 'certification',
      recognizedBy: { '@type': 'Organization', name: cert.issuer },
      ...(cert.url && { url: cert.url }),
    })),
    knowsAbout: profile.stack.flatMap((group) => group.items),
    ...(profile.email && { email: `mailto:${profile.email}` }),
  };
}

export function articleJsonLd(site: URL, post: { title: string; description: string; date: Date; updated?: Date; url: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date.toISOString(),
    dateModified: (post.updated ?? post.date).toISOString(),
    url: post.url,
    mainEntityOfPage: post.url,
    author: { '@type': 'Person', '@id': new URL('/#person', site).href, name: profile.name, url: site.href },
  };
}
