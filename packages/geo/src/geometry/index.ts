import turfArea from '@turf/area';
import turfBbox from '@turf/bbox';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import kinks from '@turf/kinks';
import pointToPolygonDistance from '@turf/point-to-polygon-distance';
import type { GeoJSON } from 'geojson';
import type { Bounds, LngLat, Polygon } from '../types';

export function isInsidePolygon(point: LngLat, polygon: Polygon): boolean {
  return booleanPointInPolygon(point, polygon);
}

/** Meters from the point to the polygon boundary when the point is outside; 0 when inside or on the boundary. */
export function distanceOutsideMeters(point: LngLat, polygon: Polygon): number {
  return Math.max(0, pointToPolygonDistance(point, polygon, { units: 'meters' }));
}

export interface PositionedItem<Id> {
  id: Id;
  position: LngLat;
}

/**
 * Items that would be outside the polygon, with their distance from it.
 * Used before saving a polygon edit (UC-C06): active searchers left outside the new boundary trigger a warning.
 */
export function findOutside<Id>(items: PositionedItem<Id>[], polygon: Polygon): { id: Id; meters: number }[] {
  return items
    .map((item) => ({ id: item.id, meters: distanceOutsideMeters(item.position, polygon) }))
    .filter((item) => item.meters > 0);
}

export function areaSquareMeters(polygon: Polygon): number {
  return turfArea(polygon);
}

export function boundsOf(geojson: GeoJSON): Bounds {
  const [west, south, east, north] = turfBbox(geojson);
  return [west, south, east, north] as Bounds;
}

/** A polygon whose boundary does not cross itself. Drawing already blocks this; the server checks it again. */
export function isSimplePolygon(polygon: Polygon): boolean {
  return kinks(polygon).features.length === 0;
}
