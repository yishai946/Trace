import { canChangePolygons, isActiveInPolygon, nextPolygonLetter } from '@trace/domain';
import { findOutside, isValidPolygon, type LngLat } from '@trace/geo';
import {
  PointGeometry,
  PolygonGeometry,
  type CreatePolygonBody,
  type MissionPolygon,
  type SearchersOutsideDetails,
  type UpdatePolygonBody,
} from '@trace/schemas';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, polygons, searchers } from '../../db/schema';
import { AppError, notFound } from '../../errors';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type CreatePolygonInput = z.output<typeof CreatePolygonBody>;
export type UpdatePolygonInput = z.output<typeof UpdatePolygonBody>;

// Raw SQL with explicit aliases: inside a subquery, Drizzle's unqualified column names would bind to the inner table.
const activeSearchers = sql<number>`(
  select count(*)::int from participations p where p.polygon_id = polygons.id and p.status = 'assigned'
)`;

const polygonColumns = {
  id: polygons.id,
  missionId: polygons.missionId,
  letter: polygons.letter,
  name: polygons.name,
  status: polygons.status,
  geometry: asGeoJson(polygons.geometry),
  activeSearchers,
  createdAt: polygons.createdAt,
  updatedAt: polygons.updatedAt,
};

// Callers always filter on `deleted_at is null`: deleted polygons exist only for history.
const selectPolygons = (db: Db | Tx) => db.select(polygonColumns).from(polygons).$dynamic();
type PolygonRow = Awaited<ReturnType<typeof selectPolygons>>[number];

function toPolygon(row: PolygonRow): MissionPolygon {
  return {
    ...row,
    geometry: PolygonGeometry.parse(JSON.parse(row.geometry)),
    // Coverage is computed from search routes (UC-S02), which arrive with GPS tracking.
    coverage: null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Locks the mission row so concurrent polygon changes in one mission run one after another. */
async function lockActiveMission(tx: Tx, missionId: string) {
  const [mission] = await tx
    .select({ status: missions.status })
    .from(missions)
    .where(eq(missions.id, missionId))
    .for('update');
  if (!mission) throw notFound('Mission');
  if (!canChangePolygons(mission.status)) {
    throw new AppError(409, 'MISSION_NOT_ACTIVE', 'Polygons can be changed only while the mission is active');
  }
}

async function findPolygon(tx: Tx, missionId: string, polygonId: string): Promise<PolygonRow> {
  const [row] = await selectPolygons(tx).where(
    and(isNull(polygons.deletedAt), eq(polygons.missionId, missionId), eq(polygons.id, polygonId)),
  );
  if (!row) throw notFound('Polygon');
  return row;
}

/**
 * Rejects geometry that is not a valid search area: crossing rings, holes outside the outer ring, nested holes.
 * The shared check gives the client's error; PostGIS has the final word on anything it does not cover.
 */
async function assertValid(db: Db, geometry: CreatePolygonInput['geometry']) {
  const invalid = () => new AppError(400, 'INVALID_GEOMETRY', 'The polygon is not a valid search area');
  if (!isValidPolygon(geometry)) throw invalid();
  const [row] = await db.execute<{ valid: boolean }>(
    sql`select ST_IsValid(ST_GeomFromGeoJSON(${JSON.stringify(geometry)})) as valid`,
  );
  if (!row?.valid) throw invalid();
}

/** Searchers assigned to the polygon who would end up outside the new boundary. */
async function searchersOutside(
  tx: Tx,
  polygonId: string,
  geometry: CreatePolygonInput['geometry'],
): Promise<SearchersOutsideDetails['searchers']> {
  const rows = await tx
    .select({
      participantId: participations.id,
      callsign: participations.callsign,
      name: searchers.name,
      status: participations.status,
      polygonId: participations.polygonId,
      position: asGeoJson(participations.lastPosition),
    })
    .from(participations)
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(eq(participations.polygonId, polygonId));

  const located = rows
    .filter((row) => isActiveInPolygon(row, polygonId) && row.position)
    .map((row) => ({ ...row, position: PointGeometry.parse(JSON.parse(row.position)).coordinates as LngLat }));
  const byId = new Map(located.map((row) => [row.participantId, row]));

  return findOutside(
    located.map((row) => ({ id: row.participantId, position: row.position })),
    geometry,
  ).flatMap(({ id, meters }) => {
    const row = byId.get(id);
    return row ? [{ participantId: id, callsign: row.callsign, name: row.name, meters: Math.round(meters) }] : [];
  });
}

export async function listPolygons(db: Db, missionId: string): Promise<MissionPolygon[]> {
  const [mission] = await db.select({ id: missions.id }).from(missions).where(eq(missions.id, missionId));
  if (!mission) throw notFound('Mission');
  const rows = await selectPolygons(db)
    .where(and(isNull(polygons.deletedAt), eq(polygons.missionId, missionId)))
    .orderBy(asc(polygons.createdAt));
  return rows.map(toPolygon);
}

/** Draws a new polygon (UC-C06). It gets the next free letter and starts unassigned. Overlap is allowed. */
export async function createPolygon(db: Db, missionId: string, input: CreatePolygonInput): Promise<MissionPolygon> {
  await assertValid(db, input.geometry);
  return db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    // Deleted polygons keep their letters.
    const used = await tx.select({ letter: polygons.letter }).from(polygons).where(eq(polygons.missionId, missionId));
    const [created] = await tx
      .insert(polygons)
      .values({
        missionId,
        letter: nextPolygonLetter(used.map((p) => p.letter)),
        name: input.name ?? null,
        geometry: input.geometry,
      })
      .returning({ id: polygons.id });
    if (!created) throw new Error('Polygon insert returned no row');
    return toPolygon(await findPolygon(tx, missionId, created.id));
  });
}

/**
 * Renames a polygon or changes its boundary (UC-C06). A boundary that leaves assigned searchers outside is rejected
 * with their list, until the commander confirms it.
 */
export async function updatePolygon(
  db: Db,
  missionId: string,
  polygonId: string,
  input: UpdatePolygonInput,
): Promise<MissionPolygon> {
  if (input.geometry) await assertValid(db, input.geometry);
  return db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    await findPolygon(tx, missionId, polygonId);

    if (input.geometry && !input.confirmSearchersOutside) {
      const outside = await searchersOutside(tx, polygonId, input.geometry);
      if (outside.length > 0) {
        const details: SearchersOutsideDetails = { searchers: outside };
        throw new AppError(
          409,
          'SEARCHERS_OUTSIDE_POLYGON',
          'Active searchers would be outside the new boundary',
          details,
        );
      }
    }
    // TODO(realtime): notify the searchers left outside once Socket.IO and push notifications exist.
    // TODO(tracking): block the change while an affected searcher is offline (decision 86); needs connectivity state.

    await tx
      .update(polygons)
      .set({
        ...(input.geometry ? { geometry: input.geometry } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
      })
      .where(eq(polygons.id, polygonId));
    return toPolygon(await findPolygon(tx, missionId, polygonId));
  });
}

/** Removes a polygon from the active map (UC-C06). Blocked while a searcher is assigned; history stays. */
export async function deletePolygon(db: Db, missionId: string, polygonId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    const polygon = await findPolygon(tx, missionId, polygonId);
    if (polygon.activeSearchers > 0) {
      throw new AppError(409, 'POLYGON_HAS_ACTIVE_SEARCHERS', 'A polygon with active searchers cannot be deleted', {
        activeSearchers: polygon.activeSearchers,
      });
    }
    await tx.update(polygons).set({ deletedAt: new Date() }).where(eq(polygons.id, polygonId));
  });
}
