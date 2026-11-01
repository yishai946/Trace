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
