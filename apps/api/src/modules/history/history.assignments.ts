import type { AssignmentRecord } from '@trace/schemas';
import { asc, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { assignments, participations, polygons, searchers } from '../../db/schema';

/** Every assignment of the mission, oldest first: who searched where and when (UC-C20, decision 53). */
export async function listAssignments(db: Db, missionId: string): Promise<AssignmentRecord[]> {
  const rows = await db
    .select({
      id: assignments.id,
      participantId: participations.id,
      callsign: participations.callsign,
      name: searchers.name,
      polygonId: polygons.id,
      polygonName: polygons.name,
      assignedAt: assignments.assignedAt,
      endedAt: assignments.endedAt,
    })
    .from(assignments)
    .innerJoin(participations, eq(participations.id, assignments.participationId))
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .innerJoin(polygons, eq(polygons.id, assignments.polygonId))
    .where(eq(participations.missionId, missionId))
    .orderBy(asc(assignments.assignedAt), asc(participations.callsign));
  return rows.map((row) => ({
    ...row,
    assignedAt: row.assignedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  }));
}
