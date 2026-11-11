import { boundsOf, type Bounds, type LngLat } from '@trace/geo';
import { emptyMissionMapData, type MissionMapData } from '@trace/map';
import type { Mission, MissionPolygon } from '@trace/schemas';
import type { Feature } from 'geojson';

export interface MissionArea {
  data: MissionMapData;
  /** Frames every polygon, the LKP and the rally point; null while the mission shows none of them. */
  bounds: Bounds | null;
}

/** A moment as the hour on the searcher's phone, e.g. `13:05`. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/**
 * The mission area on the map, drawn with the shared Trace Console style: its polygons and, once the mission is
 * known, its LKP and rally point. Never other searchers' positions (decisions 31, 32).
 */
export function toMissionArea(polygons: MissionPolygon[], mission?: Pick<Mission, 'lkp' | 'rallyPoint'>): MissionArea {
  const lkp = mission?.lkp ?? null;
  const features: Feature[] = [
    ...polygons.map((p) => p.geometry),
    ...(lkp ? [lkp.position] : []),
    ...(mission ? [mission.rallyPoint] : []),
  ].map((geometry) => ({ type: 'Feature', geometry, properties: {} }));

  return {
    data: {
      ...emptyMissionMapData,
      polygons: polygons.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        coverage: p.coverage,
        geometry: p.geometry,
      })),
      lkp: lkp ? { id: 'lkp', position: lkp.position.coordinates as LngLat, time: formatTime(lkp.observedAt) } : null,
      rally: mission ? (mission.rallyPoint.coordinates as LngLat) : null,
    },
    bounds: features.length ? boundsOf({ type: 'FeatureCollection', features }) : null,
  };
}
