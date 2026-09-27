// Builds the site's images from the originals in photos/ (which stay local):
// sharp crops, resizes, and lightly corrects each photo, then the EWWW.io API
// compresses it to a lossy JPEG and a WebP. Output goes to public/images/.
//
//   npm run images            # builds only what's missing
//   npm run images -- --force # rebuilds everything
//
// Reads EWWW_API_KEY from .env (via `node --env-file=.env`). Every output is
// stripped of metadata, so no EXIF or GPS data from the originals is published.

import { execFile } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const PHOTOS = path.join(ROOT, 'photos');
const OUT = path.join(ROOT, 'public', 'images');
const PUBLIC = path.join(ROOT, 'public');
const EWWW = 'https://optimize.exactlywww.com';
const USER_AGENT = 'chriselkins.io-image-build/1.0';
const TIMEOUT_MS = 120_000;

const force = process.argv.includes('--force');
const apiKey = process.env.EWWW_API_KEY?.trim();

// Gentle, non-generative corrections: a touch of contrast, saturation, and clarity.
const polish = (img) =>
  img.linear(1.06, -8).modulate({ saturation: 1.03 }).sharpen({ sigma: 0.6, m1: 0.5, m2: 1.5 });

const photos = [
  {
    name: 'headshot',
    source: 'chris-headshot.jpg',
    widths: [320, 640, 960],
    ratio: 1,
  },
  {
    name: 'outdoors',
    source: 'chris-outdoors.jpg',
    widths: [480, 960],
    ratio: 0.8,
    // 4:5 crop around the face from the 3024x4032 original.
    extract: { left: 0, top: 320, width: 2720, height: 3400 },
  },
];

const exists = (file) => access(file).then(() => true, () => false);
const redact = (text) => (apiKey ? text.replaceAll(apiKey, '[redacted]') : text);

async function ewww(file, filename, type, options) {
  const form = new FormData();
  form.append('api_key', apiKey);
  form.append('metadata', '0');
  for (const [key, value] of Object.entries(options)) form.append(key, String(value));
  form.append('file', new Blob([file], { type }), filename);

  const res = await fetch(`${EWWW}/v2/`, {
    method: 'POST',
    body: form,
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = Buffer.from(await res.arrayBuffer());
  if (!res.ok) throw new Error(`EWWW returned HTTP ${res.status} for ${filename}`);
  return body;
}

const isJpeg = (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const isWebp = (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
const isPng = (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47;

/** Compresses through EWWW; falls back to sharp's own encoder if EWWW can't do better. */
async function optimizeJpeg(image, filename) {
  const upload = await image.clone().jpeg({ quality: 92 }).toBuffer();
  const result = await ewww(upload, filename, 'image/jpeg', { lossy: 1 });
  if (isJpeg(result)) return { data: result, via: 'EWWW' };
  if (result.length > 0) throw new Error(`EWWW did not return a JPEG for ${filename}: ${redact(result.toString('utf8', 0, 200))}`);
  return { data: await image.clone().jpeg({ quality: 80, mozjpeg: true }).toBuffer(), via: 'sharp (no EWWW savings)' };
}

async function optimizeWebp(image, filename) {
  const upload = await image.clone().png().toBuffer();
  // Quality 72 keeps each WebP 20-30% smaller than EWWW's already-tight lossy JPEG.
  const result = await ewww(upload, filename.replace(/\.webp$/, '.png'), 'image/png', { webp: 1, lossy: 1, quality: 72 });
  if (isWebp(result)) return { data: result, via: 'EWWW' };
  throw new Error(`EWWW did not return a WebP for ${filename}: ${redact(result.toString('utf8', 0, 200))}`);
}

async function optimizePng(image, filename) {
  const upload = await image.clone().png().toBuffer();
  const result = await ewww(upload, filename, 'image/png', { lossy: 0 });
  if (isPng(result)) return { data: result, via: 'EWWW' };
  if (result.length > 0) throw new Error(`EWWW did not return a PNG for ${filename}: ${redact(result.toString('utf8', 0, 200))}`);
  return { data: upload, via: 'sharp (no EWWW savings)' };
}

async function save(file, { data, via }) {
  await writeFile(file, data);
  console.log(`  ${path.relative(ROOT, file)}  ${(data.length / 1024).toFixed(1)} KB  (${via})`);
}

async function verifyKey() {
  if (!apiKey) throw new Error('EWWW_API_KEY is not set. Add it to .env and run `npm run images`.');
  const form = new FormData();
  form.append('api_key', apiKey);
  const res = await fetch(`${EWWW}/verify/`, {
    method: 'POST',
    body: form,
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30_000),
  });
  const text = (await res.text()).trim();
  let status = text;
  try {
    const json = JSON.parse(text);
    status = json.status ?? json.error ?? text;
  } catch {}
  if (!String(status).startsWith('great')) throw new Error(`EWWW key check failed: ${redact(String(status)).slice(0, 120)}`);
}

async function buildPhoto({ name, source, widths, ratio, extract }) {
  console.log(`${name}:`);
  for (const width of widths) {
    const jpg = path.join(OUT, `${name}-${width}.jpg`);
    const webp = path.join(OUT, `${name}-${width}.webp`);
    const needJpg = force || !(await exists(jpg));
    const needWebp = force || !(await exists(webp));
    if (!needJpg && !needWebp) {
      console.log(`  ${name}-${width}: up to date`);
      continue;
    }
    let image = sharp(await readFile(path.join(PHOTOS, source))).rotate();
    if (extract) image = image.extract(extract);
    image = polish(image.resize(width, Math.round(width / ratio), { fit: 'cover', kernel: 'lanczos3' }));
    // Settle the pixels once so the JPEG and WebP start from the same image.
    const base = sharp(await image.png().toBuffer());
    if (needJpg) await save(jpg, await optimizeJpeg(base, path.basename(jpg)));
    if (needWebp) await save(webp, await optimizeWebp(base, path.basename(webp)));
  }
}

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Link-preview card (1200x630), rendered with headless Chromium so it uses the site's own fonts. */
async function buildOgImage() {
  const file = path.join(OUT, 'og.jpg');
  if (!force && (await exists(file))) {
    console.log('og: up to date');
    return;
  }
  const chrome = process.env.CHROME_PATH || (await findBrowser());
  if (!chrome) {
    console.warn('og: skipped (no Chromium found; set CHROME_PATH to build it)');
    return;
  }
  console.log('og:');

  const { parse } = await import('yaml');
  const profile = parse(await readFile(path.join(ROOT, 'src/data/profile.yaml'), 'utf8'));
  const font = (p) => readFile(path.join(ROOT, 'node_modules', p)).then((b) => b.toString('base64'));
  const inter = await font('@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2');
  const mono = await font('@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2');
  const photo = (await readFile(path.join(OUT, 'headshot-640.jpg'))).toString('base64');
  const role = profile.roles[0];

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${mono}) format('woff2');font-weight:100 800}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;background:#070b12;color:#e6ebf2;font-family:Inter;
background-image:radial-gradient(900px 500px at 100% 0,rgb(79 209 193/.12),transparent 70%),radial-gradient(700px 400px at 0 100%,rgb(240 179 91/.06),transparent 70%)}
.card{position:absolute;inset:40px;border:1px solid #243046;border-radius:28px;padding:64px 72px;display:flex;align-items:center;gap:64px}
.text{flex:1}
.eyebrow{font-family:Mono;font-size:22px;letter-spacing:.14em;text-transform:uppercase;color:#4fd1c1}
h1{margin-top:22px;font-size:96px;font-weight:650;letter-spacing:-.045em;line-height:1}
.headline{margin-top:24px;font-size:36px;font-weight:500;line-height:1.3;letter-spacing:-.015em;color:#e6ebf2}
.role{margin-top:34px;font-family:Mono;font-size:21px;color:#7d899c}
.photo{width:300px;height:300px;padding:7px;border:1px solid #243046;border-radius:30px;background:#0b111b}
.photo img{width:100%;height:100%;border-radius:23px;display:block}
</style></head><body><div class="card"><div class="text">
<p class="eyebrow">chriselkins.io</p>
<h1>${esc(profile.name)}</h1>
<p class="headline">${esc(profile.headline)}</p>
<p class="role">${esc(role.title)} · ${esc(role.organization)} · CISSP</p>
</div><div class="photo"><img src="data:image/jpeg;base64,${photo}" alt=""></div></div></body></html>`;

  const tmp = path.join(os.tmpdir(), `og-${process.pid}`);
  await mkdir(tmp, { recursive: true });
  try {
    await writeFile(path.join(tmp, 'og.html'), html);
    await promisify(execFile)(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1200,630',
        '--virtual-time-budget=3000',
        `--user-data-dir=${path.join(tmp, 'profile')}`,
        `--screenshot=${path.join(tmp, 'og.png')}`,
        `file://${path.join(tmp, 'og.html')}`,
      ],
      { timeout: 60_000 },
    );
    const image = sharp(await readFile(path.join(tmp, 'og.png'))).resize(1200, 630, { fit: 'cover' });
    await save(file, await optimizeJpeg(image, 'og.jpg'));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

async function findBrowser() {
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const { stdout } = await promisify(execFile)('which', [name]);
      if (stdout.trim()) return stdout.trim();
    } catch {}
  }
  return null;
}

/** 180x180 home-screen icon from the favicon mark, on a full-bleed background. */
async function buildTouchIcon() {
  const file = path.join(PUBLIC, 'apple-touch-icon.png');
  if (!force && (await exists(file))) {
    console.log('apple-touch-icon: up to date');
    return;
  }
  console.log('apple-touch-icon:');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="180" height="180">
  <rect width="64" height="64" fill="#0b111b"/>
  <path d="M41.5 21.2 A14 14 0 1 0 41.5 42.8" fill="none" stroke="#4fd1c1" stroke-width="6.5" stroke-linecap="round"/>
  <circle cx="44.5" cy="32" r="3.6" fill="#f0b35b"/></svg>`;
  await save(file, await optimizePng(sharp(Buffer.from(svg)).resize(180, 180), 'apple-touch-icon.png'));
}

try {
  await mkdir(OUT, { recursive: true });
  await verifyKey();
  for (const photo of photos) await buildPhoto(photo);
  await buildOgImage();
  await buildTouchIcon();
} catch (err) {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
}
