import { PointGeometry, type Participant } from '@trace/schemas';
import type { LngLat } from '@trace/geo';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, searchers } from '../../db/schema';
import { notFound } from '../../errors';

export async function listParticipants(db: Db, missionId: string): Promise<Participant[]> {
  const [mission] = await db.select({ id: missions.id }).from(missions).where(eq(missions.id, missionId));
  if (!mission) throw notFound('Mission');

  const rows = await db
    .select({
      id: participations.id,
      searcherId: participations.searcherId,
      name: searchers.name,
      callsign: participations.callsign,
      status: participations.status,
      polygonId: participations.polygonId,
      taskStatus: participations.taskStatus,
      position: asGeoJson(participations.lastPosition),
      positionAt: participations.lastPositionAt,
    })
    .from(participations)
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(eq(participations.missionId, missionId))
    .orderBy(asc(participations.callsign));

  return rows.map((row) => ({
    ...row,
    position: row.position ? (PointGeometry.parse(JSON.parse(row.position)).coordinates as LngLat) : null,
    positionAt: row.positionAt?.toISOString() ?? null,
  }));
}
