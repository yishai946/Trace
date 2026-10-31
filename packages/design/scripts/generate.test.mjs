// Guards that the code design system fully covers source/tokens.json and that generated files are current.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { camel, generate, paths, readSource } from './generate.mjs';

const tokens = readSource();
const { css, ts } = generate(tokens);

test('generated files match source/tokens.json (run `pnpm --filter @trace/design generate`)', () => {
  assert.equal(readFileSync(paths.css, 'utf8'), css, 'tokens.css is stale');
  assert.equal(readFileSync(paths.ts, 'utf8'), ts, 'tokens.ts is stale');
});

test('every color token exists in every theme, in CSS and TS', () => {
  const themeBlocks = css.split('}').filter((b) => b.includes('[data-theme='));
  assert.equal(themeBlocks.length, tokens.color.themes.length);
  for (const t of tokens.color.tokens) {
    for (const block of themeBlocks) assert.match(block, new RegExp(`--${t.name}:`), `CSS missing --${t.name}`);
    const count = ts.split(`      ${camel(t.name)}: `).length - 1;
    assert.equal(count, tokens.color.themes.length, `TS missing color ${t.name} in some theme`);
  }
});

test('every non-color token and type style exists in CSS and TS', async () => {
  const mod = await import('../src/generated/tokens.ts');
  for (const [key, fam] of Object.entries(tokens)) {
    if (['name', 'version', 'color', 'type', 'meta'].includes(key)) continue;
    for (const t of fam.tokens) {
      assert.match(css, new RegExp(`--${t.name}:`), `CSS missing --${t.name}`);
      const flat = mod[camel(key)]?.[camel(t.name)];
      const themed = Object.values(mod.themes).every((th) => th[camel(key)]?.[camel(t.name)] !== undefined);
      assert.ok(flat !== undefined || themed, `TS missing ${key}.${t.name}`);
    }
  }
  for (const name of Object.keys(tokens.type.families)) assert.match(css, new RegExp(`--font-${name}:`));
  for (const g of tokens.type.groups) {
    for (const s of g.styles) {
      assert.match(css, new RegExp(`--text-${s.name}:`), `CSS missing --text-${s.name}`);
      assert.ok(mod.typography[camel(s.name)], `TS missing typography.${s.name}`);
    }
  }
});

test('every component in the artifact has its guidelines and preview in source/', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
  const dir = new URL('../source/components/', import.meta.url);
  const comps = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.ok(comps.length > 0);
  for (const c of comps) {
    assert.ok(existsSync(new URL(`${c.name}/README.md`, dir)), `${c.name} missing README.md`);
    assert.ok(existsSync(new URL(`${c.name}/preview.html`, dir)), `${c.name} missing preview.html`);
  }
  const sync = JSON.parse(readFileSync(new URL('../source/sync.json', import.meta.url), 'utf8'));
  for (const c of comps) assert.ok(sync.files[`components/${c.name}/README.md`], `${c.name} not in sync.json`);
});
