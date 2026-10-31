// Values the lint configs allow as literals because the design system defines them inside text styles, not as tokens.
import { readFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync(new URL('../source/tokens.json', import.meta.url), 'utf8'));

/** Every font weight used by a Trace Console text style, e.g. [400, 600, 700]. */
export const fontWeights = [
  ...new Set((tokens.type?.groups ?? []).flatMap((g) => g.styles.map((s) => Number(s.fontWeight)))),
].sort((a, b) => a - b);
