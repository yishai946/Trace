import { PolygonGeometry, type MissionPolygon } from '@trace/schemas';
import { sql } from 'drizzle-orm';
import type { Db, Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { polygons } from '../../db/schema';

// Raw SQL with explicit aliases: inside a subquery, Drizzle's unqualified column names would bind to the inner table.
const activeSearchers = sql<number>`(
  select count(*)::int from participations p where p.polygon_id = polygons.id and p.status = 'assigned'
    and p.task_status in ('ready', 'searching', 'paused')
)`;

const polygonColumns = {
  id: polygons.id,
  missionId: polygons.missionId,
  name: polygons.name,
  status: polygons.status,
  geometry: asGeoJson(polygons.geometry),
  activeSearchers,
  coverage: polygons.coverage,
  createdAt: polygons.createdAt,
  updatedAt: polygons.updatedAt,
};

// Callers always filter on `deleted_at is null`: deleted polygons exist only for history.
export const selectPolygons = (db: Db | Tx) => db.select(polygonColumns).from(polygons).$dynamic();
export type PolygonRow = Awaited<ReturnType<typeof selectPolygons>>[number];

export function toPolygon(row: PolygonRow): MissionPolygon {
  return {
    ...row,
    geometry: PolygonGeometry.parse(JSON.parse(row.geometry)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
