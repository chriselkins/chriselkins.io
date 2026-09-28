import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

// Packs extension/ into a zip at build time, so the download always matches the
// source. Files sit in a chris-new-tab/ folder, ready for Chrome's "Load unpacked".
const source = path.join(process.cwd(), 'extension');

export function GET() {
  const files = Object.fromEntries(
    readdirSync(source)
      .sort()
      .map((name) => [`chris-new-tab/${name}`, new Uint8Array(readFileSync(path.join(source, name)))]),
  );
  // Stored, not compressed: fflate compresses a file with no repeated text, like newtab.js, into
  // a block with no distance codes, which is valid but which Windows' built-in unzip can't extract.
  // Compression only saved about 500 bytes. A fixed timestamp keeps the zip byte-for-byte
  // identical until the files change.
  const zip = zipSync(files, { level: 0, mtime: new Date('2026-01-01T12:00:00Z') });
  return new Response(zip, { headers: { 'Content-Type': 'application/zip' } });
}
