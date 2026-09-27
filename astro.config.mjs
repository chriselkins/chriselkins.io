// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://chriselkins.io',
  // Lossless whitespace removal. Astro 7's default ('jsx') can glue inline text together.
  compressHTML: true,
  integrations: [
    sitemap({
      // /tools/ is my personal start page, not part of the public site.
      filter: (page) => !new URL(page).pathname.startsWith('/tools'),
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'github-dark-default' },
  },
  vite: {
    // Keep every script and asset as a separate file so the CSP can stay at script-src 'self'.
    build: { assetsInlineLimit: 0 },
  },
});
