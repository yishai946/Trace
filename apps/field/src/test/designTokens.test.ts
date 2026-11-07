// @vitest-environment node
/// <reference types="node" />
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const eslint = new ESLint({ cwd: repoRoot });

async function designErrors(code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}apps/field/src/components/Example.tsx` });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
}

describe('design tokens in the Field app (ESLint)', () => {
  it.each([
    ['a hex color', `color: '#ff0000'`],
    ['a named color', `backgroundColor: 'red'`],
    ['raw spacing', `padding: 16`],
    ['a raw radius', `borderRadius: 3`],
    ['a raw font size', `fontSize: 15`],
    ['a raw height', `height: 20`],
    ['a raw minimum width', `minWidth: 26`],
    ['a raw maximum height', `maxHeight: 80`],
  ])('rejects %s', async (_name, style) => {
    expect(await designErrors(`export const s = { ${style} };\n`)).not.toEqual([]);
  });

  it('accepts tokens, zero, percentages and layout keywords', async () => {
    const errors = await designErrors(
      `import { spacing, size } from '@trace/design';\n` +
        `export const s = { padding: spacing.space6, height: size.headerH, width: '100%', minHeight: 0, flex: 1 };\n`,
    );
    expect(errors).toEqual([]);
  });
});
