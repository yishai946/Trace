// Builds src/generated/tokens.css (web) and src/generated/tokens.ts (web + React Native) from source/tokens.json.
// source/ is a verbatim copy of the Trace Console design-system artifact; never edit generated files by hand.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const paths = {
  source: join(root, 'source', 'tokens.json'),
  css: join(root, 'src', 'generated', 'tokens.css'),
  ts: join(root, 'src', 'generated', 'tokens.ts'),
};

const ALIAS = /^\{([A-Za-z0-9][A-Za-z0-9_.-]*)\}$/;

export const camel = (name) => name.replace(/[-.]([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());

/** Resolves a token value to { [themeId]: string }. A plain value applies to every theme; missing themes inherit the first. */
function perTheme(value, themeIds) {
  if (typeof value === 'object' && value !== null) {
    const first = value[themeIds[0]];
    return Object.fromEntries(themeIds.map((id) => [id, String(value[id] ?? first)]));
  }
  return Object.fromEntries(themeIds.map((id) => [id, String(value)]));
}

const isThemed = (value) => typeof value === 'object' && value !== null;

/** "12px" -> 12 for React Native; anything else stays a string. */
const toNative = (value) => (/^-?\d+(\.\d+)?(px)?$/.test(value) ? Number.parseFloat(value) : value);

const jsdoc = (text, indent) => (text ? `${indent}/** ${String(text).replace(/\*\//g, '*\\/')} */\n` : '');

export function generate(tokens) {
  const themeIds = tokens.color.themes.map((t) => t.id);
  const colorTokens = tokens.color.tokens;
  const byName = new Map(colorTokens.map((t) => [t.name, t]));

  const resolveColor = (token, seen = new Set()) => {
    if (seen.has(token.name)) throw new Error(`Alias cycle at color token "${token.name}"`);
    seen.add(token.name);
    const raw = perTheme(token.value, themeIds);
    return Object.fromEntries(
      themeIds.map((id) => {
        const match = ALIAS.exec(raw[id]);
        if (!match) return [id, raw[id]];
        const target = byName.get(match[1]);
        if (!target) throw new Error(`Color token "${token.name}" aliases missing token "${match[1]}"`);
        return [id, resolveColor(target, new Set(seen))[id]];
      }),
    );
  };

  // Every family except color and type has the shape { tokens: [{ name, value, usage }] }.
  const families = Object.entries(tokens).filter(([key, val]) => {
    if (['name', 'version', 'color', 'type', 'meta'].includes(key)) return false;
    if (!val || !Array.isArray(val.tokens))
      throw new Error(`Unknown token family "${key}": expected { tokens: [...] }`);
    return true;
  });
  const themedFamilies = families.filter(([, f]) => f.tokens.some((t) => isThemed(t.value)));
  const flatFamilies = families.filter(([, f]) => !f.tokens.some((t) => isThemed(t.value)));

  const fontFamilies = tokens.type?.families ?? {};
  const typeStyles = (tokens.type?.groups ?? []).flatMap((g) => g.styles.map((s) => ({ ...s, family: g.family })));

  // ---------- CSS ----------
  const css = [`/* ${tokens.name}: generated from source/tokens.json by scripts/generate.mjs. Do not edit. */`];
  themeIds.forEach((id, i) => {
    css.push(`${i === 0 ? ':root, ' : ''}[data-theme="${id}"] {`);
    for (const t of colorTokens) {
      const raw = perTheme(t.value, themeIds)[id];
      const alias = ALIAS.exec(raw);
      css.push(`  --${t.name}: ${alias ? `var(--${alias[1]})` : raw};`);
    }
    for (const [, fam] of themedFamilies) {
      for (const t of fam.tokens) css.push(`  --${t.name}: ${perTheme(t.value, themeIds)[id]};`);
    }
    css.push('}');
  });
  css.push(':root {');
  for (const [, fam] of flatFamilies) for (const t of fam.tokens) css.push(`  --${t.name}: ${t.value};`);
  for (const [name, stack] of Object.entries(fontFamilies)) css.push(`  --font-${name}: ${stack};`);
  for (const s of typeStyles) {
    css.push(`  --text-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${s.family});`);
  }
  css.push('}', '');

  // ---------- TypeScript ----------
  const ts = [
    `// ${tokens.name}: generated from source/tokens.json by scripts/generate.mjs. Do not edit.`,
    '',
    `export const themeIds = ${JSON.stringify(themeIds)} as const;`,
    'export type ThemeId = (typeof themeIds)[number];',
    '',
    'export const themes = {',
  ];
  for (const theme of tokens.color.themes) {
    ts.push(`  ${theme.id}: {`, `    name: ${JSON.stringify(theme.name)},`, '    color: {');
    for (const t of colorTokens) {
      ts.push(jsdoc(t.usage, '      ') + `      ${camel(t.name)}: ${JSON.stringify(resolveColor(t)[theme.id])},`);
    }
    ts.push('    },');
    for (const [key, fam] of themedFamilies) {
      ts.push(`    ${camel(key)}: {`);
      for (const t of fam.tokens) {
        const v = perTheme(t.value, themeIds)[theme.id];
        ts.push(jsdoc(t.usage, '      ') + `      ${camel(t.name)}: ${JSON.stringify(toNative(v))},`);
      }
      ts.push('    },');
    }
    ts.push('  },');
  }
  ts.push('} as const;', '', 'export type Theme = (typeof themes)[ThemeId];');
  ts.push(`export type ColorToken = keyof Theme['color'];`, '');

  for (const [key, fam] of flatFamilies) {
    ts.push(`export const ${camel(key)} = {`);
    for (const t of fam.tokens)
      ts.push(jsdoc(t.usage, '  ') + `  ${camel(t.name)}: ${JSON.stringify(toNative(t.value))},`);
    ts.push('} as const;', '');
  }

  ts.push('/** `css`: full stack for the web. `native`: the first family, for React Native `fontFamily`. */');
  ts.push('export const fontFamilies = {');
  for (const [name, stack] of Object.entries(fontFamilies)) {
    const native = stack
      .split(',')[0]
      .trim()
      .replace(/^["']|["']$/g, '');
    ts.push(`  ${camel(name)}: { css: ${JSON.stringify(stack)}, native: ${JSON.stringify(native)} },`);
  }
  ts.push('} as const;', '');

  ts.push('export const typography = {');
  for (const s of typeStyles) {
    ts.push(
      jsdoc(s.usage, '  ') +
        `  ${camel(s.name)}: { fontFamily: fontFamilies.${camel(s.family)}.native, fontSize: ${toNative(s.fontSize)}, ` +
        `lineHeight: ${JSON.stringify(toNative(String(s.lineHeight)))}, fontWeight: ${JSON.stringify(s.fontWeight)} },`,
    );
  }
  ts.push('} as const;', '');

  return { css: css.join('\n'), ts: ts.join('\n') };
}

export function readSource() {
  return JSON.parse(readFileSync(paths.source, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { css, ts } = generate(readSource());
  mkdirSync(dirname(paths.css), { recursive: true });
  writeFileSync(paths.css, css);
  writeFileSync(paths.ts, ts);
  console.log('Generated', paths.css, 'and', paths.ts);
}
