export type PolygonPresenceChange = 'left' | 'returned';

/**
 * What a new position changes about a searcher's presence in the polygon they are assigned to (UC-S04, decision 14).
 * `outsideMeters` is the distance from the polygon (0 inside or on the boundary). `toleranceMeters` is the GPS margin
 * near the border: it is still TBD in the spec (decision 14), so it is configuration with no default, and 0 means the
 * exact boundary. `wasOutside` is the state the previous alert left: nothing repeats while it persists.
 */
export function nextPolygonPresence(input: {
  outsideMeters: number;
  toleranceMeters: number;
  wasOutside: boolean;
}): PolygonPresenceChange | null {
  const outside = input.outsideMeters > input.toleranceMeters;
  if (outside && !input.wasOutside) return 'left';
  if (!outside && input.wasOutside) return 'returned';
  return null;
}
