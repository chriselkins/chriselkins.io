import { getCollection } from 'astro:content';

/** Drafts are visible while developing and never ship in a production build. */
const includeDrafts = import.meta.env.DEV;

export async function getPosts() {
  const posts = await getCollection('writing', ({ data }) => includeDrafts || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export async function getProjects() {
  const projects = await getCollection('projects', ({ data }) => includeDrafts || !data.draft);
  return projects.sort((a, b) => a.data.order - b.data.order);
}

/** Rough reading time for a Markdown body, in whole minutes. */
export function readingMinutes(markdown: string | undefined): number {
  const words = (markdown ?? '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 230));
}
