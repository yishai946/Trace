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
