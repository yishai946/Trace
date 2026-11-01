/** Polygon lifecycle (State and Rules Reference §3). Coverage is a separate value and never sets the status. */
export const POLYGON_STATUSES = ['unassigned', 'active', 'completed'] as const;
export type PolygonStatus = (typeof POLYGON_STATUSES)[number];

/** The name a new polygon gets until the commander renames it. */
const DEFAULT_NAME = /^פוליגון (\d+)$/;

/**
 * The default name for a new polygon: "פוליגון N", one past the highest N among the mission's polygons. Deleted
 * polygons count too, so history and reports never show two different polygons under one default name.
 */
export function nextPolygonName(names: Iterable<string>): string {
  let highest = 0;
  for (const name of names) {
    const match = DEFAULT_NAME.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  return `פוליגון ${highest + 1}`;
}
