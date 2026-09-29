import { readdirSync, readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { GET } from './chris-new-tab.zip';

// Windows' built-in unzip couldn't extract newtab.js while this zip was compressed (see
// chris-new-tab.zip.ts), so these keep the download stored and in step with extension/. The
// leading underscore keeps Astro from treating this file as a page.
const zip = new Uint8Array(await GET().arrayBuffer());
const source = new URL('../../../extension/', import.meta.url);
const names = readdirSync(source).sort();

describe('chris-new-tab.zip', () => {
  it("stores every file uncompressed, so Windows' built-in unzip can extract all of them", () => {
    const methods: Record<string, number> = {};
    unzipSync(zip, {
      filter: ({ name, compression }) => {
        methods[name] = compression;
        return false;
      },
    });
    expect(methods).toEqual(Object.fromEntries(names.map((name) => [`chris-new-tab/${name}`, 0])));
  });

  it('extracts to the same bytes as extension/', () => {
    const files = unzipSync(zip);
    for (const name of names) {
      expect(files[`chris-new-tab/${name}`], name).toEqual(new Uint8Array(readFileSync(new URL(name, source))));
    }
  });
});
