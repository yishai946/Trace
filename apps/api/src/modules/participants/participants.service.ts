import { canJoinMission, nextCallsign } from '@trace/domain';
import { PointGeometry, type JoinPreview, type OwnParticipation, type Participant } from '@trace/schemas';
import type { LngLat } from '@trace/geo';
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, searchers } from '../../db/schema';
import { AppError, notFound } from '../../errors';

/** The mission behind a join code, as shown before the searcher confirms (UC-F02). 404 for a code no mission has. */
export async function previewJoin(db: Db, code: string): Promise<JoinPreview> {
  const [mission] = await db
    .select({
      name: missions.name,
      status: missions.status,
      missingPersonName: missions.missingPersonName,
      missingPersonAge: missions.missingPersonAge,
    })
    .from(missions)
    .where(eq(missions.joinCode, code));
  if (!mission) throw notFound('Mission');
  return {
    name: mission.name,
    status: mission.status,
    missingPerson: { name: mission.missingPersonName, age: mission.missingPersonAge },
  };
}

const ownColumns = {
  id: participations.id,
  callsign: participations.callsign,
  status: participations.status,
  polygonId: participations.polygonId,
  taskStatus: participations.taskStatus,
};

export interface JoinResult {
  missionId: string;
  participation: OwnParticipation;
  /** True when the searcher became Available now: a new participation, or one that had ended. */
  joined: boolean;
}

/**
 * Adds the searcher to the mission of a join code as Available, with the lowest free callsign (UC-F02). A searcher
 * taking part in the mission gets the same participation back (decision 69), whatever the mission's status. A new
 * searcher, or one whose participation ended, joins only an active mission (decision 82); the ended participation
 * returns to Available with its callsign (State and Rules §2), never a second one. The mission row is locked, so two
 * joins never take one callsign and a mission being paused or ended cannot be joined meanwhile.
 */
export async function joinMission(db: Db, searcherId: string, code: string): Promise<JoinResult> {
  return db.transaction(async (tx) => {
    const [mission] = await tx
      .select({ id: missions.id, status: missions.status })
      .from(missions)
      .where(eq(missions.joinCode, code))
      .for('update');
    if (!mission) throw notFound('Mission');

    const [existing] = await tx
      .select(ownColumns)
      .from(participations)
      .where(and(eq(participations.missionId, mission.id), eq(participations.searcherId, searcherId)));
    if (existing && existing.status !== 'ended') {
      return { missionId: mission.id, participation: existing, joined: false };
    }

    if (!canJoinMission(mission.status)) {
      throw new AppError(409, 'MISSION_NOT_ACTIVE', 'Only an active mission can be joined');
    }
    if (existing) {
      const [rejoined] = await tx
        .update(participations)
        .set({ status: 'available', polygonId: null, taskStatus: null })
        .where(eq(participations.id, existing.id))
        .returning(ownColumns);
      if (!rejoined) throw new Error('Participation update returned no row');
      return { missionId: mission.id, participation: rejoined, joined: true };
    }
    const taken = await tx
      .select({ callsign: participations.callsign })
      .from(participations)
      .where(eq(participations.missionId, mission.id));
    const callsign = nextCallsign(taken.map((row) => row.callsign));
    if (callsign === null) throw new AppError(409, 'MISSION_FULL', 'The mission has no free callsign');

    const [participation] = await tx
      .insert(participations)
      .values({ missionId: mission.id, searcherId, callsign })
      .returning(ownColumns);
    if (!participation) throw new Error('Participation insert returned no row');
    return { missionId: mission.id, participation, joined: true };
  });
}

/** The mission's searchers. The route's access check has already answered 404 for an unknown mission. */
export async function listParticipants(db: Db, missionId: string): Promise<Participant[]> {
  const rows = await db
    .select({
      id: participations.id,
      searcherId: participations.searcherId,
      name: searchers.name,
      phone: searchers.phone,
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
