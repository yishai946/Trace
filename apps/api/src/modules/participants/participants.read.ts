import { isSearcherOffline, latestUpdateAt } from '@trace/domain';
import { PointGeometry, type JoinPreview, type OwnParticipation, type Participant } from '@trace/schemas';
import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { missions, participations, searchers } from '../../db/schema';
import { notFound } from '../../errors';
import type { Realtime } from '../../realtime';

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

export const ownColumns = {
  id: participations.id,
  callsign: participations.callsign,
  status: participations.status,
  polygonId: participations.polygonId,
  taskStatus: participations.taskStatus,
};

/** The signed-in searcher's own participation in the mission (UC-F05). The route's access check found the mission. */
export async function getOwnParticipation(db: Db, missionId: string, searcherId: string): Promise<OwnParticipation> {
  const [participation] = await db
    .select(ownColumns)
    .from(participations)
    .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)));
  if (!participation) throw notFound('Mission');
  return participation;
}

/** What reading the commander's view of searchers needs: the rows, and who holds the live connection. */
export interface ParticipantReadDeps {
  db: Db;
  realtime: Pick<Realtime, 'connectedSearcherIds'>;
}

/** The mission's searchers. The route's access check has already answered 404 for an unknown mission. */
export async function listParticipants(
  { db, realtime }: ParticipantReadDeps,
  missionId: string,
): Promise<Participant[]> {
  const now = new Date();
  const connected = await realtime.connectedSearcherIds(missionId);
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
      gpsUnavailableSince: participations.gpsUnavailableSince,
      batteryLevel: participations.batteryLevel,
      batteryMeasuredAt: participations.batteryMeasuredAt,
    })
    .from(participations)
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(eq(participations.missionId, missionId))
    .orderBy(asc(participations.callsign));

  return rows.map(({ batteryLevel, batteryMeasuredAt, ...row }) => {
    const lastUpdateAt = latestUpdateAt([row.positionAt, batteryMeasuredAt]);
    return {
      ...row,
      lastUpdateAt: lastUpdateAt?.toISOString() ?? null,
      offline: isSearcherOffline({ connected: connected.has(row.searcherId), lastUpdateAt, now }),
      battery:
        batteryLevel === null || batteryMeasuredAt === null
          ? null
          : { level: batteryLevel, measuredAt: batteryMeasuredAt.toISOString() },
      position: row.position ? PointGeometry.parse(JSON.parse(row.position)).coordinates : null,
      positionAt: row.positionAt?.toISOString() ?? null,
      gpsUnavailableSince: row.gpsUnavailableSince?.toISOString() ?? null,
    };
  });
}

/** One searcher of the mission as the commander sees them, or undefined when the mission has no such participant. */
export async function findParticipant(
  deps: ParticipantReadDeps,
  missionId: string,
  participantId: string,
): Promise<Participant | undefined> {
  return (await listParticipants(deps, missionId)).find((participant) => participant.id === participantId);
}
