import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib/content';
import { profile } from '../lib/profile';

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: `${profile.name} · Writing`,
    description: 'Short technical notes on problems I solve repeatedly.',
    site: context.site ?? 'https://chriselkins.io',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: `/writing/${post.id}/`,
      categories: post.data.tags,
    })),
  });
}
