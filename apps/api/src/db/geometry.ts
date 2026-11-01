import type { Point, Polygon } from 'geojson';
import { customType } from 'drizzle-orm/pg-core';
import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

/** WGS84, the coordinate system of GeoJSON and the maps. ITM is only for display. */
export const SRID = 4326;

const geometry = <T extends Point | Polygon>(type: T['type']) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => `geometry(${type},${SRID})`,
    // Values are written as GeoJSON; PostGIS converts them.
    toDriver: (value): SQL => sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(value)}), ${SRID})`,
  });

export const pointColumn = geometry<Point>('Point');
export const polygonColumn = geometry<Polygon>('Polygon');

/** Reads a geometry column back as GeoJSON text. Parse it with the matching zod schema. */
export function asGeoJson(column: AnyColumn): SQL<string> {
  return sql<string>`ST_AsGeoJSON(${column})`;
}
