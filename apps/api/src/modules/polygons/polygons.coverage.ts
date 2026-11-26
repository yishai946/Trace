import { coveragePercent, type CoverageRoute } from '@trace/geo';
import { PointGeometry, PolygonGeometry, type TimelineEvent } from '@trace/schemas';
import { and, eq, gte, isNull, lt, or } from 'drizzle-orm';
import type { Tx } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { assignments, polygons, trackPoints } from '../../db/schema';
import type { ServiceDeps } from '../serviceDeps';
import { recordCoverageThresholds } from './polygons.coverageAlerts';
import { selectPolygons, toPolygon } from './polygons.read';

/** What a recalculation changed: the polygons whose Coverage differs, and the threshold alerts it recorded. */
export interface CoverageUpdate {
  polygonIds: string[];
  events: TimelineEvent[];
}

/**
 * The searchers' points that count toward one polygon: those recorded while the searcher was assigned to it
 * (decisions 39 and 72), grouped by assignment: a route never runs across the time the searcher was elsewhere. Safety points come too, because they break a run of counted segments.
 */
async function routesOf(tx: Tx, polygonId: string): Promise<{ routes: CoverageRoute[]; searched: boolean }> {
  const rows = await tx
    .select({
      assignmentId: assignments.id,
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
  const byAssignment = new Map<string, CoverageRoute>();
  for (const row of rows) {
    const route = byAssignment.get(row.assignmentId) ?? { points: [] };
    byAssignment.set(row.assignmentId, {
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
  return { routes: [...byAssignment.values()], searched: rows.some((row) => row.context === 'search') };
}

/**
 * Computes a polygon's Coverage Estimate again from its stored routes and saves it (UC-S02). Null until a Searching
 * point exists. Records the 80% / 90% thresholds it newly reached (UC-S02). Returns whether the saved value changed and
 * the alerts it recorded, for the caller to publish after the commit. The polygon row is locked, so two batches arriving together
 * leave the result of the last one, which sees both.
 * shortcut: recomputes the whole polygon on every batch; fine for a POC, cache or increment if it gets slow.
 */
export async function refreshCoverage(
  tx: Tx,
  polygonId: string,
): Promise<{ changed: boolean; events: TimelineEvent[] }> {
  const [polygon] = await tx
    .select({
      missionId: polygons.missionId,
      name: polygons.name,
      geometry: asGeoJson(polygons.geometry),
      coverage: polygons.coverage,
    })
    .from(polygons)
    .where(and(eq(polygons.id, polygonId), isNull(polygons.deletedAt)))
    .for('update');
  if (!polygon) return { changed: false, events: [] };
  const { routes, searched } = await routesOf(tx, polygonId);
  const next = searched ? coveragePercent(PolygonGeometry.parse(JSON.parse(polygon.geometry)), routes) : null;
  if (next === polygon.coverage) return { changed: false, events: [] };
  await tx.update(polygons).set({ coverage: next }).where(eq(polygons.id, polygonId));
  const events = await recordCoverageThresholds(tx, {
    missionId: polygon.missionId,
    id: polygonId,
    name: polygon.name,
    coverage: next,
  });
  return { changed: true, events };
}

/**
 * The polygons whose Coverage a new batch of points can change: those the searcher was assigned to at the time of
 * one of the points, however long ago (a late batch lands in the past). Their Coverage is refreshed; returns the ones
 * that changed and the threshold alerts recorded.
 */
export async function refreshCoverageOfPoints(
  tx: Tx,
  { participationId, recordedAt }: { participationId: string; recordedAt: Date[] },
): Promise<CoverageUpdate> {
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
  const update: CoverageUpdate = { polygonIds: [], events: [] };
  for (const polygonId of [...affected].sort()) {
    const { changed, events } = await refreshCoverage(tx, polygonId);
    if (changed) update.polygonIds.push(polygonId);
    update.events.push(...events);
  }
  return update;
}

/**
 * Tells the mission's members the new Coverage of the polygons that changed, and the commander the threshold alerts
 * recorded (after the transaction committed).
 */
export async function publishCoverage(
  { db, realtime }: Pick<ServiceDeps, 'db' | 'realtime'>,
  missionId: string,
  { polygonIds, events }: CoverageUpdate,
) {
  for (const polygonId of polygonIds) {
    const [row] = await selectPolygons(db).where(and(eq(polygons.id, polygonId), isNull(polygons.deletedAt)));
    if (row) realtime.publish({ type: 'polygon.saved', missionId, polygon: toPolygon(row) });
  }
  for (const event of events) realtime.publish({ type: 'timeline.recorded', missionId, event });
}
