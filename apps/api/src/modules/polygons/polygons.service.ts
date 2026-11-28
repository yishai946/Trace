import { canChangePolygons, nextPolygonName } from '@trace/domain';
import { isValidPolygon } from '@trace/geo';
import {
  type CreatePolygonBody,
  type MissionPolygon,
  type SearcherOfflineDetails,
  type SearchersOutsideDetails,
  type UpdatePolygonBody,
} from '@trace/schemas';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db, Tx } from '../../db';
import { polygons } from '../../db/schema';
import type { Actor } from '../../auth/auth.plugin';
import { AppError, notFound } from '../../errors';
import { lockMission } from '../lockMission';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { refreshCoverage } from './polygons.coverage';
import { alertSearchersOutside, searchersOutside } from './polygons.outside';
import { selectPolygons, toPolygon, type PolygonRow } from './polygons.read';

export type CreatePolygonInput = z.output<typeof CreatePolygonBody>;
export type UpdatePolygonInput = z.output<typeof UpdatePolygonBody>;

/** Locks the mission row so concurrent polygon changes in one mission run one after another. */
export const lockActiveMission = (tx: Tx, missionId: string) =>
  lockMission(tx, missionId, {
    allowed: canChangePolygons,
    refusal: () => new AppError(409, 'MISSION_NOT_ACTIVE', 'Polygons can be changed only while the mission is active'),
  });

export async function findPolygon(tx: Tx, missionId: string, polygonId: string): Promise<PolygonRow> {
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

/** The mission's polygons. The route's access check has already answered 404 for an unknown mission. */
export async function listPolygons(db: Db, missionId: string): Promise<MissionPolygon[]> {
  const rows = await selectPolygons(db)
    .where(and(isNull(polygons.deletedAt), eq(polygons.missionId, missionId)))
    .orderBy(asc(polygons.createdAt));
  return rows.map(toPolygon);
}

/** Draws a new polygon (UC-C06). Unnamed, it is called "פוליגון N"; it starts unassigned. Overlap is allowed. */
export async function createPolygon(
  { db, realtime }: ServiceDeps,
  missionId: string,
  input: CreatePolygonInput,
  actor: Actor,
): Promise<MissionPolygon> {
  await assertValid(db, input.geometry);
  const { polygon, event } = await db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    // Deleted polygons count, so a default name is never reused within the mission.
    const used = await tx.select({ name: polygons.name }).from(polygons).where(eq(polygons.missionId, missionId));
    const [created] = await tx
      .insert(polygons)
      .values({
        missionId,
        name: input.name ?? nextPolygonName(used.map((p) => p.name)),
        geometry: input.geometry,
      })
      .returning({ id: polygons.id, name: polygons.name });
    if (!created) throw new Error('Polygon insert returned no row');
    const event = await recordEvent(tx, {
      missionId,
      actor,
      type: 'polygon.created',
      subject: { kind: 'polygon', id: created.id, label: created.name },
      details: {},
    });
    return { polygon: toPolygon(await findPolygon(tx, missionId, created.id)), event };
  });
  realtime.publish({ type: 'polygon.saved', missionId, polygon });
  realtime.publish({ type: 'timeline.recorded', missionId, event });
  return polygon;
}

/**
 * Renames a polygon or changes its boundary (UC-C06). A boundary that leaves assigned searchers outside is rejected
 * with their list, until the commander confirms it, and one that leaves an Offline searcher outside is blocked until
 * they are back (decision 86). Once saved, the searchers left outside get an alert (decision 35).
 */
export async function updatePolygon(
  deps: ServiceDeps,
  {
    missionId,
    polygonId,
    input,
    actor,
  }: { missionId: string; polygonId: string; input: UpdatePolygonInput; actor: Actor },
): Promise<MissionPolygon> {
  const { db, realtime } = deps;
  if (input.geometry) await assertValid(db, input.geometry);
  const connected = input.geometry ? await realtime.connectedSearcherIds(missionId) : new Set<string>();
  const { polygon, event, outside, alerts } = await db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    const existing = await findPolygon(tx, missionId, polygonId);

    const outside = input.geometry ? await searchersOutside(tx, polygonId, input.geometry, connected) : [];
    const offline = outside.filter((searcher) => searcher.offline);
    if (offline.length > 0) {
      const details: SearcherOfflineDetails = {
        searchers: offline.map(({ participantId, callsign, name }) => ({ participantId, callsign, name })),
      };
      throw new AppError(
        409,
        'SEARCHER_OFFLINE',
        'An Offline searcher would be left outside the new boundary',
        details,
      );
    }
    if (outside.length > 0 && !input.confirmSearchersOutside) {
      const details: SearchersOutsideDetails = {
        searchers: outside.map(({ participantId, callsign, name, meters }) => ({
          participantId,
          callsign,
          name,
          meters,
        })),
      };
      throw new AppError(
        409,
        'SEARCHERS_OUTSIDE_POLYGON',
        'Active searchers would be outside the new boundary',
        details,
      );
    }

    await tx
      .update(polygons)
      .set({
        ...(input.geometry ? { geometry: input.geometry } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
      })
      .where(eq(polygons.id, polygonId));
    // A new boundary changes what part of the searched routes lies inside it (UC-S02).
    const coverage = input.geometry ? await refreshCoverage(tx, polygonId) : null;
    // A rename alone is not a significant event (decision 54); only a new boundary is recorded.
    const event = input.geometry
      ? await recordEvent(tx, {
          missionId,
          actor,
          type: 'polygon.boundary_changed',
          subject: { kind: 'polygon', id: polygonId, label: input.name ?? existing.name },
          details: { searchersOutside: outside.length },
        })
      : null;
    return {
      polygon: toPolygon(await findPolygon(tx, missionId, polygonId)),
      event,
      outside,
      alerts: coverage?.events ?? [],
    };
  });
  realtime.publish({ type: 'polygon.saved', missionId, polygon });
  if (event) realtime.publish({ type: 'timeline.recorded', missionId, event });
  for (const alert of alerts) realtime.publish({ type: 'timeline.recorded', missionId, event: alert });
  await alertSearchersOutside(deps, { missionId, polygonName: polygon.name, outside, actor });
  return polygon;
}

/** Removes a polygon from the active map (UC-C06). Blocked while a searcher has an open task; history stays. */
export async function deletePolygon(
  { db, realtime }: ServiceDeps,
  missionId: string,
  polygonId: string,
  actor: Actor,
): Promise<void> {
  const event = await db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    const polygon = await findPolygon(tx, missionId, polygonId);
    if (polygon.activeSearchers > 0) {
      throw new AppError(409, 'POLYGON_HAS_ACTIVE_SEARCHERS', 'A polygon with active searchers cannot be deleted', {
        activeSearchers: polygon.activeSearchers,
      });
    }
    await tx.update(polygons).set({ deletedAt: new Date() }).where(eq(polygons.id, polygonId));
    const event = await recordEvent(tx, {
      missionId,
      actor,
      type: 'polygon.deleted',
      subject: { kind: 'polygon', id: polygonId, label: polygon.name },
      details: {},
    });
    return event;
  });
  realtime.publish({ type: 'polygon.deleted', missionId, polygonId });
  realtime.publish({ type: 'timeline.recorded', missionId, event });
}
