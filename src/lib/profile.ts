import { parse } from 'yaml';
import { z } from 'astro/zod';
import raw from '../data/profile.yaml?raw';

// YYYY-MM, or just YYYY when the month isn't known (YAML reads a bare 2026 as a number).
const yearMonth = z.coerce.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, { error: 'Use YYYY-MM or YYYY' });
const titled = z.object({ title: z.string(), body: z.string() });

const schema = z.strictObject({
  name: z.string(),
  headline: z.string(),
  description: z.string(),
  intro: z.string(),
  location: z.strictObject({
    city: z.string(),
    region: z.string(),
    regionCode: z.string(),
    country: z.string(),
  }),
  email: z.email().optional(),
  links: z.strictObject({ linkedin: z.url(), github: z.url(), credly: z.url().optional() }),
  roles: z
    .array(
      z.strictObject({
        organization: z.string(),
        url: z.url(),
        // Path to a light-on-dark logo in public/, shown for the primary role.
        logo: z.string().startsWith('/').optional(),
        title: z.string(),
        start: yearMonth,
        end: yearMonth.optional(),
        location: z.string(),
        summary: z.string(),
        highlights: z.array(z.string()),
      }),
    )
    .min(1),
  earlier: z.string().optional(),
  alsoWorkedOn: z.array(z.string()).default([]),
  lanes: z.array(titled),
  motto: z.string(),
  principles: z.array(titled),
  stack: z.array(z.strictObject({ label: z.string(), items: z.array(z.string()) })),
  certifications: z.array(
    z.strictObject({
      name: z.string(),
      abbreviation: z.string(),
      issuer: z.string(),
      issued: yearMonth,
      expires: yearMonth.optional(),
      credentialId: z.string().optional(),
      url: z.url().optional(),
    }),
  ),
  about: z.array(z.string()).min(1),
  contact: z.string(),
});

export type Profile = z.infer<typeof schema>;
export type Role = Profile['roles'][number];

export const profile: Profile = schema.parse(parse(raw));
