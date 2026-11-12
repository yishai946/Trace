import { boundsOf, type Bounds, type LngLat } from '@trace/geo';
import { emptyMissionMapData, type MissionMapData } from '@trace/map';
import type { Mission, MissionPolygon } from '@trace/schemas';
import type { Feature } from 'geojson';

export interface MissionArea {
  data: MissionMapData;
  /** Frames every polygon, the LKP and the rally point; null while the mission shows none of them. */
  bounds: Bounds | null;
}

/** Degrees kept around a lone point (about 500 m), so the map does not zoom in as far as it can. */
const POINT_MARGIN = 0.005;

function frame(features: Feature[]): Bounds {
  const [west, south, east, north] = boundsOf({ type: 'FeatureCollection', features });
  return west === east && south === north
    ? [west - POINT_MARGIN, south - POINT_MARGIN, east + POINT_MARGIN, north + POINT_MARGIN]
    : [west, south, east, north];
}

/** A moment as the hour on the searcher's phone, e.g. `13:05`. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

/** A moment as its date and hour on the searcher's phone, e.g. `3.10, 11:20`. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  return `${date}, ${formatTime(iso)}`;
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
    bounds: features.length ? frame(features) : null,
  };
}
