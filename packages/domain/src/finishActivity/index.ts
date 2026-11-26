/**
 * How far from the Rally Point a searcher is still "there" when they finish the activity, in meters. The spec leaves
 * the distance open (UC-F15, decision 30), so this is a provisional value of the app; it only decides the warning,
 * never whether the searcher may finish.
 */
export const FAR_FROM_RALLY_POINT_METERS = 300;

export type RallyPointAdvice = 'near' | 'far' | 'unknown';

/**
 * What to tell a searcher who finishes the activity (UC-F15, decision 30): `far` and `unknown` (no position) get the
 * recommendation to reach the Rally Point first; `near` gets none. Finishing is never blocked.
 */
export function rallyPointAdvice(distanceMeters: number | null): RallyPointAdvice {
  if (distanceMeters === null) return 'unknown';
  return distanceMeters > FAR_FROM_RALLY_POINT_METERS ? 'far' : 'near';
}
