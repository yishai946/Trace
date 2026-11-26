import { nextPolygonPresence } from '@trace/domain';
import { distanceOutsideMeters } from '@trace/geo';
import { MissionPolygonList, type MissionPolygon } from '@trace/schemas';
import { loadStep } from '../../offline/store';
import { useSession } from '../../state/session';
import type { Fix } from '../trackPoints';

/**
 * The GPS margin near the polygon border (UC-S04, decision 14). Still TBD in the spec, so it is configuration with no
 * invented default, the same as the API's `OUT_OF_POLYGON_TOLERANCE_METERS`: missing or invalid means 0, the exact
 * boundary.
 */
export function parseTolerance(value: string | undefined): number {
  const meters = Number(value?.trim());
  return value?.trim() && Number.isFinite(meters) && meters > 0 ? meters : 0;
}

// Expo inlines `process.env.EXPO_PUBLIC_*` by its literal name at build time.
const toleranceMeters = parseTolerance(process.env.EXPO_PUBLIC_OUT_OF_POLYGON_TOLERANCE_METERS);

/**
 * Whether the searcher is outside the polygon after a batch of fixes, by the same domain rule as the server
 * (`nextPolygonPresence`): judged by the newest fix, and unchanged while the state persists or without fixes.
 */
export function judgeFixes(input: {
  fixes: Fix[];
  polygon: MissionPolygon['geometry'];
  toleranceMeters: number;
  wasOutside: boolean;
}): boolean {
  const newest = input.fixes.reduce<Fix | null>(
    (best, fix) => (!best || fix.timestamp > best.timestamp ? fix : best),
    null,
  );
  if (!newest) return input.wasOutside;
  const change = nextPolygonPresence({
    outsideMeters: distanceOutsideMeters([newest.coords.longitude, newest.coords.latitude], input.polygon),
    toleranceMeters: input.toleranceMeters,
    wasOutside: input.wasOutside,
  });
  return change === 'left' ? true : change === 'returned' ? false : input.wasOutside;
}

/**
 * Judges a batch of fixes against the polygon saved on the phone and tells the session, so the map warns at once with
 * no connection (UC-S04). Only a searcher who is Searching in a polygon can be outside it, as on the server. Without
 * a saved polygon nothing is known, so no warning shows.
 */
export async function noteLocalPresence(fixes: Fix[]): Promise<void> {
  const { missionId, participation, outsidePolygon, setOutsidePolygon } = useSession.getState();
  const polygonId = participation?.status === 'assigned' ? participation.polygonId : null;
  if (!missionId || !polygonId || participation?.taskStatus !== 'searching') {
    setOutsidePolygon(false);
    return;
  }
  const polygons = await loadStep(missionId, 'polygons', MissionPolygonList);
  const polygon = polygons?.find((p) => p.id === polygonId);
  // The searcher may have paused or moved while the polygon was read: that update already cleared the flag.
  const now = useSession.getState().participation;
  if (useSession.getState().missionId !== missionId || now?.polygonId !== polygonId || now.taskStatus !== 'searching') {
    return;
  }
  setOutsidePolygon(
    polygon ? judgeFixes({ fixes, polygon: polygon.geometry, toleranceMeters, wasOutside: outsidePolygon }) : false,
  );
}
