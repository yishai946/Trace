import { acceptsTrackPoints, canJoinMission, isMissionEnded, nextCallsign } from '@trace/domain';
import { PointGeometry, type JoinPreview, type OwnParticipation, type Participant } from '@trace/schemas';
import type { LngLat } from '@trace/geo';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { assignments, missions, participations, polygons, searchers } from '../../db/schema';
import { AppError, notFound } from '../../errors';
import { CLOCK_SKEW_MS } from '../tracking/tracking.service';

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

/** The signed-in searcher's own participation in the mission (UC-F05). The route's access check found the mission. */
export async function getOwnParticipation(db: Db, missionId: string, searcherId: string): Promise<OwnParticipation> {
  const [participation] = await db
    .select(ownColumns)
    .from(participations)
    .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)));
  if (!participation) throw notFound('Mission');
  return participation;
}

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
      gpsUnavailableSince: participations.gpsUnavailableSince,
      batteryLevel: participations.batteryLevel,
      batteryMeasuredAt: participations.batteryMeasuredAt,
    })
    .from(participations)
    .innerJoin(searchers, eq(searchers.id, participations.searcherId))
    .where(eq(participations.missionId, missionId))
    .orderBy(asc(participations.callsign));

  return rows.map(({ batteryLevel, batteryMeasuredAt, ...row }) => ({
    ...row,
    battery:
      batteryLevel === null || batteryMeasuredAt === null
        ? null
        : { level: batteryLevel, measuredAt: batteryMeasuredAt.toISOString() },
    position: row.position ? (PointGeometry.parse(JSON.parse(row.position)).coordinates as LngLat) : null,
    positionAt: row.positionAt?.toISOString() ?? null,
    gpsUnavailableSince: row.gpsUnavailableSince?.toISOString() ?? null,
  }));
}

export interface AssignResult {
  participant: Participant;
  /** The polygon whose status changed (it became active with its first searcher), to send to the mission. */
  activatedPolygonId: string | null;
}

/**
 * Assigns a searcher to a polygon, or moves them to another one (UC-C09). Only the commander assigns (decision 7).
 * The searcher has one polygon and one search task at most (decision 40): a move ends the open assignment, which
 * stays in the history (decision 53), and starts a new task at Ready, so travelling between areas is not searching
 * and the searcher presses Start Search again (decision 28). An unassigned polygon becomes active. The participation
 * row is locked, so two assignments at once cannot both win.
 */
export async function assignParticipant(
  db: Db,
  input: { missionId: string; participantId: string; polygonId: string; commanderId: string },
): Promise<AssignResult> {
  const activatedPolygonId = await db.transaction(async (tx) => {
    // Shared lock: polygon deletes and boundary changes lock the mission for update, so they wait for this assignment
    // (and it for them); assignments in parallel do not block one another.
    const [mission] = await tx
      .select({ status: missions.status })
      .from(missions)
      .where(eq(missions.id, input.missionId))
      .for('share');
    if (!mission) throw notFound('Mission');
    if (isMissionEnded(mission.status)) throw new AppError(409, 'MISSION_ENDED', 'An ended mission is read-only');

    const [participation] = await tx
      .select({ id: participations.id, status: participations.status, polygonId: participations.polygonId })
      .from(participations)
      .where(and(eq(participations.id, input.participantId), eq(participations.missionId, input.missionId)))
      .for('update');
    if (!participation) throw notFound('Searcher');
    if (participation.status === 'ended') {
      throw new AppError(409, 'PARTICIPATION_ENDED', "The searcher's activity in this mission has ended");
    }

    const [polygon] = await tx
      .select({ id: polygons.id, status: polygons.status })
      .from(polygons)
      .where(
        and(eq(polygons.id, input.polygonId), eq(polygons.missionId, input.missionId), isNull(polygons.deletedAt)),
      );
    if (!polygon) throw new AppError(404, 'POLYGON_NOT_FOUND', 'The polygon is not on the mission map');
    if (participation.status === 'assigned' && participation.polygonId === polygon.id) return null;

    const now = new Date();
    await tx
      .update(assignments)
      .set({ endedAt: now })
      .where(and(eq(assignments.participationId, participation.id), isNull(assignments.endedAt)));
    await tx.insert(assignments).values({
      participationId: participation.id,
      polygonId: polygon.id,
      assignedBy: input.commanderId,
      assignedAt: now,
    });
    await tx
      .update(participations)
      .set({ status: 'assigned', polygonId: polygon.id, taskStatus: 'ready' })
      .where(eq(participations.id, participation.id));
    if (polygon.status !== 'unassigned') return null;
    await tx.update(polygons).set({ status: 'active' }).where(eq(polygons.id, polygon.id));
    return polygon.id;
  });

  const participant = (await listParticipants(db, input.missionId)).find((p) => p.id === input.participantId);
  if (!participant) throw notFound('Searcher');
  return { participant, activatedPolygonId };
}

/**
 * Ends a searcher's participation (UC-C18): Activity Ended. An active task and the open assignment end with it; the
 * route, reports and Coverage already collected stay (decision 70). Ending twice changes nothing. The searcher may
 * join the active mission again later and return as Available with the same participation.
 */
export async function endParticipation(
  db: Db,
  input: { missionId: string; participantId: string },
): Promise<Participant> {
  await db.transaction(async (tx) => {
    const [participation] = await tx
      .select({ id: participations.id, status: participations.status })
      .from(participations)
      .where(and(eq(participations.id, input.participantId), eq(participations.missionId, input.missionId)))
      .for('update');
    if (!participation) throw notFound('Searcher');
    if (participation.status === 'ended') return;
    await tx
      .update(assignments)
      .set({ endedAt: new Date() })
      .where(and(eq(assignments.participationId, participation.id), isNull(assignments.endedAt)));
    await tx
      .update(participations)
      .set({ status: 'ended', polygonId: null, taskStatus: null })
      .where(eq(participations.id, participation.id));
  });
  const participant = (await listParticipants(db, input.missionId)).find((p) => p.id === input.participantId);
  if (!participant) throw notFound('Searcher');
  return participant;
}

/**
 * Records whether the searcher's phone has GPS (UC-S01, decision 42). Losing it keeps the first moment it was lost, so
 * the commander sees for how long; getting it back clears it. Returns the participant only when the state changed.
 */
export async function setGpsStatus(
  db: Db,
  input: { missionId: string; searcherId: string; available: boolean },
): Promise<Participant | null> {
  const [participation] = await db
    .select({ id: participations.id, since: participations.gpsUnavailableSince })
    .from(participations)
    .where(and(eq(participations.missionId, input.missionId), eq(participations.searcherId, input.searcherId)));
  if (!participation) throw notFound('Mission');
  if (input.available === (participation.since === null)) return null;
  await db
    .update(participations)
    .set({ gpsUnavailableSince: input.available ? null : new Date() })
    .where(eq(participations.id, participation.id));
  return (await listParticipants(db, input.missionId)).find((p) => p.id === participation.id) ?? null;
}

/**
 * Records the phone's battery (UC-C10, decision 13). The newest reading wins, whatever order uploads arrive in; one
 * dated past the clock-skew tolerance is ignored, like a track point. Returns the participant only when the stored
 * reading changed. 409 once the searcher's activity ended.
 */
export async function setBattery(
  db: Db,
  input: { missionId: string; searcherId: string; level: number; measuredAt: string },
): Promise<Participant | null> {
  const measuredAt = new Date(input.measuredAt);
  const participationId = await db.transaction(async (tx) => {
    const [participation] = await tx
      .select({
        id: participations.id,
        status: participations.status,
        level: participations.batteryLevel,
        measuredAt: participations.batteryMeasuredAt,
      })
      .from(participations)
      .where(and(eq(participations.missionId, input.missionId), eq(participations.searcherId, input.searcherId)))
      .for('update');
    if (!participation) throw notFound('Mission');
    if (!acceptsTrackPoints(participation.status)) {
      throw new AppError(409, 'PARTICIPATION_ENDED', 'The activity in this mission has ended');
    }
    if (measuredAt.getTime() > Date.now() + CLOCK_SKEW_MS) return null;
    if (participation.measuredAt && participation.measuredAt.getTime() >= measuredAt.getTime()) return null;
    await tx
      .update(participations)
      .set({ batteryLevel: input.level, batteryMeasuredAt: measuredAt })
      .where(eq(participations.id, participation.id));
    return participation.id;
  });
  if (!participationId) return null;
  return (await listParticipants(db, input.missionId)).find((p) => p.id === participationId) ?? null;
}
