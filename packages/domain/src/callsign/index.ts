/**
 * A searcher's callsign: the two-digit number that identifies them everywhere (map, list, alerts, Inspector).
 * Trace Console design system: always two digits with a leading zero, e.g. `07`.
 */
export function formatCallsign(callsign: number): string {
  if (!Number.isInteger(callsign) || callsign < 0 || callsign > 99) {
    throw new RangeError(`Callsign must be an integer between 0 and 99, got ${callsign}`);
  }
  return String(callsign).padStart(2, '0');
}

/** Callsigns given to searchers who join: `01` to `99`. */
const FIRST_CALLSIGN = 1;
const LAST_CALLSIGN = 99;

/** The lowest callsign no searcher in the mission has, or null when all are taken (UC-F02). */
export function nextCallsign(taken: Iterable<number>): number | null {
  const used = new Set(taken);
  for (let callsign = FIRST_CALLSIGN; callsign <= LAST_CALLSIGN; callsign++) {
    if (!used.has(callsign)) return callsign;
  }
  return null;
}
