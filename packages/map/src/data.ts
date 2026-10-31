import { formatCallsign } from '@trace/domain';
import type { LngLat, Polygon } from '@trace/geo';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

export type PolygonStatus = 'unassigned' | 'active' | 'completed';
export type UnitState = 'normal' | 'warning' | 'offline' | 'sos';

export interface MapPolygon {
  id: string;
  /** The polygon's letter, e.g. `A`. */
  letter: string;
  status: PolygonStatus;
  /** Coverage estimate in percent, or null before any searching. */
  coverage: number | null;
  geometry: Polygon;
}

export interface MapUnit {
  id: string;
  callsign: number;
  /** `warning` covers out of bounds, low battery and weak GPS; `offline` is lost connection. */
  state: UnitState;
  position: LngLat;
}

export interface MapTrack {
  unitId: string;
  positions: LngLat[];
}

export interface MapPoint {
  id: string;
  position: LngLat;
  /** Local time label, e.g. `13:05`. */
  time?: string;
}

export interface MapReport extends MapPoint {
  hazard: boolean;
}

/** Everything a mission shows on the map. */
export interface MissionMapData {
  polygons: MapPolygon[];
  units: MapUnit[];
  tracks: MapTrack[];
  lkp: MapPoint | null;
  lkpHistory: MapPoint[];
  sightings: MapPoint[];
  rally: LngLat | null;
  reports: MapReport[];
}

export const emptyMissionMapData: MissionMapData = {
  polygons: [],
  units: [],
  tracks: [],
  lkp: null,
  lkpHistory: [],
  sightings: [],
  rally: null,
  reports: [],
};

export const SOURCE = {
  polygons: 'trace-polygons',
  tracks: 'trace-tracks',
  units: 'trace-units',
  lkp: 'trace-lkp',
  lkpHistory: 'trace-lkp-history',
  sightings: 'trace-sightings',
  rally: 'trace-rally',
  reports: 'trace-reports',
} as const;

type SourceId = (typeof SOURCE)[keyof typeof SOURCE];

const collection = <G extends Geometry>(features: Feature<G>[]): FeatureCollection<G> => ({
  type: 'FeatureCollection',
  features,
});

const point = (position: LngLat, properties: Record<string, unknown>): Feature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: position },
  properties,
});

/** Converts mission data to the GeoJSON each overlay source expects. */
export function toMissionSources(data: MissionMapData): Record<SourceId, FeatureCollection> {
  return {
    [SOURCE.polygons]: collection(
      data.polygons.map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: p.geometry,
        properties: {
          id: p.id,
          status: p.status,
          label:
            p.status === 'completed'
              ? `${p.letter} הושלם`
              : p.status === 'unassigned'
                ? `${p.letter} לא משובץ`
                : `${p.letter} ${Math.round(p.coverage ?? 0)}%`,
        },
      })),
    ),
    [SOURCE.tracks]: collection(
      data.tracks
        .filter((t) => t.positions.length > 1)
        .map((t) => ({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: t.positions },
          properties: { unitId: t.unitId },
        })),
    ),
    [SOURCE.units]: collection(
      data.units.map((u) => point(u.position, { id: u.id, state: u.state, callsign: formatCallsign(u.callsign) })),
    ),
    [SOURCE.lkp]: collection(
      data.lkp ? [point(data.lkp.position, { label: `LKP ${data.lkp.time ?? ''}`.trim() })] : [],
    ),
    [SOURCE.lkpHistory]: collection(data.lkpHistory.map((p) => point(p.position, { id: p.id }))),
    [SOURCE.sightings]: collection(data.sightings.map((p) => point(p.position, { id: p.id, time: p.time ?? '' }))),
    [SOURCE.rally]: collection(data.rally ? [point(data.rally, {})] : []),
    [SOURCE.reports]: collection(data.reports.map((r) => point(r.position, { id: r.id, hazard: r.hazard }))),
  };
}
