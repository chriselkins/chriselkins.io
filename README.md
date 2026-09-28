# chriselkins.io

My personal site: a static [Astro](https://astro.build) site driven by one data file and a folder of Markdown.

## Commands

```sh
npm install
npm run dev       # http://localhost:4321, drafts visible
npm run build     # static site in dist/, drafts left out
npm run preview   # serve dist/ locally
npm test          # unit tests for the tools page math
npm run check     # type-check .astro and .ts files
npm run images    # rebuild images (see below)
npm run deploy    # build and publish to S3 + CloudFront
```

Node 22.12 or newer.

## Content

| What | Where |
| --- | --- |
| Name, headline, roles, What I do, How I work, stack, certification, About text, contact line | `src/data/profile.yaml` |
| Selected initiatives | `src/content/projects/*.md` |
| Writing | `src/content/writing/*.md` |
| Public PGP and SSH keys (served at `/pgp.asc` and `/ssh.pub`, linked in the footer) | `public/pgp.asc`, `public/ssh.pub` |

`profile.yaml` feeds the home page, About, Work, Contact, the résumé at `/resume/`, and the JSON-LD structured data. It is validated at build time, so a typo fails the build instead of shipping. To publish an email address, uncomment `email:` in it.

The first role in `profile.yaml` is my primary one (Speakeasy): it leads the hero, gets its own highlighted row with its logo, and is featured on the Work page, with the companies I own grouped after it. Any mention of a company from `roles` in page text becomes a link to its website automatically (`src/components/Linked.astro`).

A new note is a Markdown file in `src/content/writing/`:

```md
---
title: Changing large MySQL tables without taking the site down
description: One or two sentences for the list page, RSS, and link previews.
date: 2026-10-01
tags: [MySQL, Operations]
draft: true
---
```

Drafts show up in `npm run dev` with a Draft badge and are left out of production builds, RSS, and the sitemap. Delete the `draft` line to publish.

Projects work the same way: `featured: true` puts one on the home page (sorted by `order`; with an odd count the first spans the full row), and `resume: true` lists it under Selected initiatives on the résumé. Smaller supporting work goes in `alsoWorkedOn` in `profile.yaml`.

## Tools

`/tools/` is my start page: a row of shortcuts (Plex, YouTube, Gmail, Outlook, AWS, and IPTorrents), Central, Eastern, India, and UTC time plus Unix timestamps (type into any field or drag a slider), ChatGPT and Gemini prompt boxes that start a new chat in a new tab (Enter sends, Shift+Enter adds a line), and Google and DuckDuckGo search boxes that open results in a new tab. A Conversions button at the end of the shortcuts opens length (metric and imperial) and temperature (Celsius and Fahrenheit) converters in a dialog, each with a slider and a Show Table toggle for a quick reference table (-20 to 50 °C in 5° steps, and 1 to 10 cm), plus a CIDR subnet calculator beside the temperature one. The Google box has focus when the page opens, and a URL or domain typed into it (`github.com/chriselkins`) opens that site instead of searching; start with a space to search it anyway. The Plex shortcut has no fixed address: each time the page opens, it looks up `kubrick.chriscelkins.com` with Cloudflare's DNS over HTTPS and builds the server's plex.direct URL from the IP (`src/lib/plex.ts`). The page has no site header or footer, is `noindex`, and is left out of the navigation and sitemap. The conversion logic is in `src/lib/time.ts`, `src/lib/length.ts`, `src/lib/temperature.ts`, and `src/lib/cidr.ts`, and the URL check in `src/lib/search.ts`, with tests beside them. The URL check knows real domains from IANA's list of top-level domains in `src/lib/tlds.txt`; to refresh it, download https://data.iana.org/TLD/tlds-alpha-by-domain.txt over it.

The Chrome extension that makes it my new tab page lives in `extension/`. It also fills Gemini's prompt box from a `?prompt=` link, since Gemini has no such parameter of its own; that's how the tools page's Gemini box works. Every build zips it to `/downloads/chris-new-tab.zip`, which the tools page links to. To install: unzip it, open `chrome://extensions`, turn on Developer mode, choose Load unpacked, and select the `chris-new-tab` folder. After changing the extension, bump `version` in `extension/manifest.json`.

## Images

Original photos go in `photos/`, which is git-ignored because originals can carry EXIF and GPS data. `npm run images` crops, resizes, and lightly corrects them with sharp, compresses each through the [EWWW.io API](https://docs.ewww.io/article/114-compress-api-reference) as a JPEG and a WebP, and writes metadata-free copies to `public/images/`. It also renders the link-preview card (`og.jpg`, using headless Chromium) and `apple-touch-icon.png`.

It needs `EWWW_API_KEY` in `.env`, only builds files that are missing (so it doesn't spend credits twice), and `npm run images -- --force` rebuilds everything.

## Hosting

The site is served from a private S3 bucket through CloudFront at `https://chriselkins.io`, all defined in [`infra/site.yaml`](infra/site.yaml) (CloudFormation stack `chriselkins-io-site` in us-east-1):

- ACM certificate for `chriselkins.io`, validated in Route 53
- S3 bucket `chriselkins-io-site`: public access blocked, encrypted, versioned (old versions expire after 30 days), TLS-only
- CloudFront, pay-as-you-go: Origin Access Control to the bucket, HTTPS only (TLS 1.2+), HTTP/2 and HTTP/3, IPv6, compression, the 404 page, a CloudFront Function that serves `/about/` from `about/index.html` and redirects `/about` to `/about/`, and a response headers policy with the Content-Security-Policy, HSTS (two years, `includeSubDomains`, `preload`, so every subdomain must serve HTTPS), and other security headers. `/tools/*` and `/downloads/*` get a copy of that policy that adds `X-Robots-Tag: noindex, nofollow` and sends no referrer; `infra/site.test.ts` fails if the two policies drift apart
- Route 53 A and AAAA alias records for the apex

`npm run deploy` builds the site, uploads it with explicit content types and cache headers (hashed assets cached for a year, pages revalidated), removes files that are no longer in the build, and invalidates CloudFront. `npm run deploy:infra` applies changes to the stack after editing `infra/site.yaml`. Both use the default AWS CLI profile.
