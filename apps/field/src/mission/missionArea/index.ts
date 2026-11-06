import { boundsOf, type Bounds } from '@trace/geo';
import { emptyMissionMapData, type MissionMapData } from '@trace/map';
import type { MissionPolygon } from '@trace/schemas';

export interface MissionArea {
  data: MissionMapData;
  /** Frames every polygon; null while the mission has none. */
  bounds: Bounds | null;
}

/** The mission area on the map: its polygons, drawn with the shared Trace Console style. */
export function toMissionArea(polygons: MissionPolygon[]): MissionArea {
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
    },
    bounds: polygons.length
      ? boundsOf({ type: 'FeatureCollection', features: polygons.map((p) => ({ type: 'Feature', geometry: p.geometry, properties: {} })) })
      : null,
  };
}
