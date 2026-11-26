import { coveragePercent, type CoverageRoute } from '@trace/geo';
import { PointGeometry, PolygonGeometry } from '@trace/schemas';
import { and, eq, gte, isNull, lt, or } from 'drizzle-orm';
import type { Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { assignments, polygons, trackPoints } from '../../db/schema';
import type { ServiceDeps } from '../serviceDeps';
import { selectPolygons, toPolygon } from './polygons.read';

/**
 * The searchers' points that count toward one polygon: those recorded while the searcher was assigned to it
 * (decisions 39 and 72), grouped by searcher. Safety points come too, because they break a run of counted segments.
 */
async function routesOf(tx: Tx, polygonId: string): Promise<{ routes: CoverageRoute[]; searched: boolean }> {
  const rows = await tx
    .select({
      participationId: trackPoints.participationId,
      position: asGeoJson(trackPoints.position),
      recordedAt: trackPoints.recordedAt,
      accuracy: trackPoints.accuracy,
      context: trackPoints.context,
    })
    .from(assignments)
    .innerJoin(
      trackPoints,
      and(
        eq(trackPoints.participationId, assignments.participationId),
        gte(trackPoints.recordedAt, assignments.assignedAt),
        or(isNull(assignments.endedAt), lt(trackPoints.recordedAt, assignments.endedAt)),
      ),
    )
    .where(eq(assignments.polygonId, polygonId));
  const byParticipation = new Map<string, CoverageRoute>();
  for (const row of rows) {
    const route = byParticipation.get(row.participationId) ?? { points: [] };
    byParticipation.set(row.participationId, {
      points: [
        ...route.points,
        {
          position: PointGeometry.parse(JSON.parse(row.position)).coordinates,
          recordedAt: row.recordedAt.getTime(),
          accuracy: row.accuracy,
          context: row.context,
        },
      ],
    });
  }
  return { routes: [...byParticipation.values()], searched: rows.some((row) => row.context === 'search') };
}

/**
 * Computes a polygon's Coverage Estimate again from its stored routes and saves it (UC-S02). Null until a Searching
 * point exists. Returns whether the saved value changed. The polygon row is locked, so two batches arriving together
 * leave the result of the last one, which sees both.
 * shortcut: recomputes the whole polygon on every batch; fine for a POC, cache or increment if it gets slow.
 */
export async function refreshCoverage(tx: Tx, polygonId: string): Promise<boolean> {
  const [polygon] = await tx
    .select({ geometry: asGeoJson(polygons.geometry), coverage: polygons.coverage })
    .from(polygons)
    .where(and(eq(polygons.id, polygonId), isNull(polygons.deletedAt)))
    .for('update');
  if (!polygon) return false;
  const { routes, searched } = await routesOf(tx, polygonId);
  const next = searched ? coveragePercent(PolygonGeometry.parse(JSON.parse(polygon.geometry)), routes) : null;
  if (next === polygon.coverage) return false;
  await tx.update(polygons).set({ coverage: next }).where(eq(polygons.id, polygonId));
  return true;
}

/**
 * The polygons whose Coverage a new batch of points can change: those the searcher was assigned to at the time of
 * one of the points, however long ago (a late batch lands in the past). Their Coverage is refreshed; returns the ones
 * that changed.
 */
export async function refreshCoverageOfPoints(
  tx: Tx,
  { participationId, recordedAt }: { participationId: string; recordedAt: Date[] },
): Promise<string[]> {
  const times = recordedAt.map((at) => at.getTime());
  const own = await tx
    .select({ polygonId: assignments.polygonId, from: assignments.assignedAt, to: assignments.endedAt })
    .from(assignments)
    .where(eq(assignments.participationId, participationId));
  const affected = new Set(
    own
      .filter(({ from, to }) => times.some((at) => at >= from.getTime() && (!to || at < to.getTime())))
      .map(({ polygonId }) => polygonId),
  );
  const changed: string[] = [];
  for (const polygonId of [...affected].sort()) {
    if (await refreshCoverage(tx, polygonId)) changed.push(polygonId);
  }
  return changed;
}

/** Tells the mission's members the new Coverage of the polygons that changed (after the transaction committed). */
export async function publishCoverage(
  { db, realtime }: Pick<ServiceDeps, 'db' | 'realtime'>,
  missionId: string,
  polygonIds: string[],
) {
  for (const polygonId of polygonIds) {
    const [row] = await selectPolygons(db).where(and(eq(polygons.id, polygonId), isNull(polygons.deletedAt)));
    if (row) realtime.publish({ type: 'polygon.saved', missionId, polygon: toPolygon(row) });
  }
}
