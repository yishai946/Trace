import { boundsOf, type LngLat } from '@trace/geo';
import type { MissionMapData } from '@trace/map';
import type { MapFocus, PointTarget } from '../MissionMap';

const at = (center: LngLat): MapFocus => ({ center });

function centerOf([west, south, east, north]: readonly [number, number, number, number]): LngLat {
  return [(west + east) / 2, (south + north) / 2];
}

/** Fits one polygon, by its own boundary. */
export function polygonFocus(data: MissionMapData, polygonId: string): MapFocus | null {
  const polygon = data.polygons.find((p) => p.id === polygonId);
  if (!polygon) return null;
  const bounds = boundsOf(polygon.geometry);
  return { center: centerOf(bounds), bounds };
}

/** Centers on a clicked LKP, sighting or report symbol. */
export function pointFocus(data: MissionMapData, target: PointTarget): MapFocus | null {
  const point =
    target.kind === 'sighting'
      ? data.sightings.find((s) => s.id === target.id)
      : target.kind === 'report'
        ? data.reports.find((r) => r.id === target.id)
        : target.id === 'lkp' || target.id === data.lkp?.id
          ? data.lkp
          : data.lkpHistory.find((p) => p.id === target.id);
  return point ? at(point.position) : null;
}

/**
 * Where "back to the search area" goes: the LKP, else the rally point, else all of the mission's polygons.
 * Null when the mission has none of them.
 */
export function searchAreaFocus(data: MissionMapData): MapFocus | null {
  if (data.lkp) return at(data.lkp.position);
  if (data.rally) return at(data.rally);
  if (data.polygons.length === 0) return null;
  const bounds = boundsOf({
    type: 'FeatureCollection',
    features: data.polygons.map((p) => ({ type: 'Feature', properties: {}, geometry: p.geometry })),
  });
  return { center: centerOf(bounds), bounds };
}
