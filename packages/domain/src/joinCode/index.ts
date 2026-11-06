// Letters and digits that cannot be confused when read aloud or typed: no 0/O, 1/I/L.
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = [2, 3];

/** Returns a uniformly random integer in [0, max). The caller supplies a cryptographic source. */
export type RandomInt = (max: number) => number;

/** A mission's join code, in the format shown in the wireframes, e.g. `K7-4Q2` (UC-C02, decision 6). */
export function generateJoinCode(randomInt: RandomInt): string {
  return GROUPS.map((length) => Array.from({ length }, () => CHARSET.charAt(randomInt(CHARSET.length))).join('')).join(
    '-',
  );
}

const JOIN_CODE_PATTERN = new RegExp(`^[${CHARSET}]{2}-[${CHARSET}]{3}$`);

export function isJoinCode(value: string): boolean {
  return JOIN_CODE_PATTERN.test(value);
}

/** The path of a join link, after the base address, e.g. `/j/K7-4Q2` (wireframe Cd05). */
const JOIN_PATH = 'j';

/**
 * The link a searcher opens or scans to join a mission (decision 6). `base` is where Field answers join links: a web
 * address in production, or the app's own scheme (`trace-field://`) in development.
 */
export function joinLink(base: string, code: string): string {
  const root = base.endsWith('/') ? base : `${base}/`;
  return `${root}${JOIN_PATH}/${code}`;
}

/** The join code in a join link, or null when the text is not one. Accepts a bare code too, as typed by hand. */
export function joinCodeFromLink(text: string): string | null {
  const trimmed = text.trim();
  const code = trimmed.split('/').at(-1)?.toUpperCase() ?? '';
  const isLink = trimmed.includes('/');
  if (isLink && trimmed.split('/').at(-2) !== JOIN_PATH) return null;
  return isJoinCode(code) ? code : null;
}
