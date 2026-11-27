import type { OwnActivity } from '@trace/schemas';
import { isMissionEnded } from '@trace/domain';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { missions, participations, polygons } from '../../db/schema';
import { notFound } from '../../errors';
import { listOwnReports } from '../reports/reports.read';
import { listOwnSightings } from '../sightings/sightings.service';

/**
 * What a searcher did in an ended mission: their participation, reports and sightings, and nothing of other
 * searchers (UC-F17, decision 95). A mission that has not ended, or that the searcher is not part of, is 404: the
 * history holds ended missions only.
 */
export async function getOwnActivity(
  db: Db,
  { missionId, searcherId, userId }: { missionId: string; searcherId: string; userId: string },
): Promise<OwnActivity> {
  const [row] = await db
    .select({
      missionStatus: missions.status,
      callsign: participations.callsign,
      joinedAt: participations.joinedAt,
      status: participations.status,
      taskStatus: participations.taskStatus,
      polygonId: polygons.id,
      polygonName: polygons.name,
    })
    .from(participations)
    .innerJoin(missions, eq(missions.id, participations.missionId))
    .leftJoin(polygons, eq(polygons.id, participations.polygonId))
    .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)));
  if (!row || !isMissionEnded(row.missionStatus)) throw notFound('Ended mission');

  const [reports, sightings] = await Promise.all([
    listOwnReports(db, { missionId, userId }),
    listOwnSightings(db, { missionId, userId }),
  ]);
  return {
    callsign: row.callsign,
    joinedAt: row.joinedAt.toISOString(),
    status: row.status,
    taskStatus: row.taskStatus,
    polygon: row.polygonId && row.polygonName ? { id: row.polygonId, name: row.polygonName } : null,
    reports,
    sightings,
  };
}
