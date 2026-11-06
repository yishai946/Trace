// Records which artifact version a synced folder came from, with a sha256 per file, so /sync-design can update only
// what changed. Usage: node scripts/record-sync.mjs <artifact-version> [console|wireframes]
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = {
  console: { dir: '../source/', artifact: 'https://claude.ai/artifact/GvJHGBe1kjkFFhRtEESJhY' },
  wireframes: { dir: '../wireframes/', artifact: 'https://claude.ai/artifact/6WxodGQXkq6KdPH1qhStV7' },
};
const [version, targetName = 'console'] = process.argv.slice(2);
const target = TARGETS[targetName];
if (!version || !target) throw new Error('Usage: node scripts/record-sync.mjs <artifact-version> [console|wireframes]');
const sourceDir = fileURLToPath(new URL(target.dir, import.meta.url));

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
  artifact: target.artifact,
  artifactPathPrefix: 'project/',
  version,
  syncedAt: new Date().toISOString(),
  files,
};
writeFileSync(join(sourceDir, 'sync.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`Recorded ${Object.keys(files).length} ${targetName} files at version ${version}`);
