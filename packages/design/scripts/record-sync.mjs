// Records which artifact version source/ was synced from, with a sha256 per file, so /sync-design can update only what changed.
// Usage: node scripts/record-sync.mjs <artifact-version>
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceDir = fileURLToPath(new URL('../source/', import.meta.url));
const version = process.argv[2];
if (!version) throw new Error('Usage: node scripts/record-sync.mjs <artifact-version>');

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const files = Object.fromEntries(
  walk(sourceDir)
    .map((p) => relative(sourceDir, p).split(sep).join('/'))
    .filter((p) => p !== 'sync.json')
    .sort()
    .map((p) => [
      p,
      createHash('sha256')
        .update(readFileSync(join(sourceDir, p)))
        .digest('hex'),
    ]),
);

const record = {
  artifact: 'https://claude.ai/artifact/GvJHGBe1kjkFFhRtEESJhY',
  artifactPathPrefix: 'project/',
  version,
  syncedAt: new Date().toISOString(),
  files,
};
writeFileSync(join(sourceDir, 'sync.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`Recorded ${Object.keys(files).length} files at version ${version}`);
