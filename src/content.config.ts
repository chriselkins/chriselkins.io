import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // Drafts render in `npm run dev` and are left out of production builds.
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    area: z.string(),
    summary: z.string(),
    stack: z.array(z.string()).default([]),
    // Lower numbers sort first.
    order: z.number(),
    // Featured projects appear on the home page; resume ones on /resume/.
    featured: z.boolean().default(false),
    resume: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing, projects };
