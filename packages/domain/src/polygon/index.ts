/** Polygon lifecycle (State and Rules Reference §3). Coverage is a separate value and never sets the status. */
export const POLYGON_STATUSES = ['unassigned', 'active', 'completed'] as const;
export type PolygonStatus = (typeof POLYGON_STATUSES)[number];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The letter for the n-th polygon (0-based): A…Z, then AA, AB, … */
export function polygonLetter(index: number): string {
  if (!Number.isInteger(index) || index < 0) throw new RangeError(`Polygon index must be a non-negative integer`);
  let n = index + 1;
  let letter = '';
  while (n > 0) {
    const rest = (n - 1) % ALPHABET.length;
    letter = ALPHABET[rest] + letter;
    n = Math.floor((n - 1) / ALPHABET.length);
  }
  return letter;
}

/**
 * The first letter not used yet in the mission.
 * Letters of deleted polygons stay used, so history and reports never point at two different polygons.
 */
export function nextPolygonLetter(used: Iterable<string>): string {
  const taken = new Set(used);
  for (let i = 0; ; i++) {
    const letter = polygonLetter(i);
    if (!taken.has(letter)) return letter;
  }
}
