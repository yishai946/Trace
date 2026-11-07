import { canChangeLkp, isLkpCandidate } from '@trace/domain';
import {
  PointGeometry,
  type CreateSightingBody,
  type Lkp,
  type LkpDecision,
  type LkpDecisionResult,
  type LkpPoint,
  type Sighting,
} from '@trace/schemas';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { lkpPoints, missions, participations, searchers, sightings, users } from '../../db/schema';
import { AppError, notFound } from '../../errors';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type CreateSightingInput = z.output<typeof CreateSightingBody> & { missionId: string; reportedBy: string };

interface CurrentLkp {
  position: string;
  observedAt: Date;
}

const toLkp = (lkp: CurrentLkp): Lkp => ({
  position: PointGeometry.parse(JSON.parse(lkp.position)),
  observedAt: lkp.observedAt.toISOString(),
});

const sightingColumns = {
  id: sightings.id,
  missionId: sightings.missionId,
  // The order the mission's sightings were added: 1, 2, …
  number: sql<number>`(row_number() over (partition by ${sightings.missionId} order by ${sightings.createdAt}, ${sightings.id}))::int`,
  position: asGeoJson(sightings.position),
  observedAt: sightings.observedAt,
  description: sightings.description,
  source: sightings.source,
  reporterRole: users.role,
  reporterName: users.name,
  callsign: participations.callsign,
  lkpDecision: sightings.lkpDecision,
  createdAt: sightings.createdAt,
};

// A searcher's callsign is per mission, so the join to participations is on the sighting's mission.
const selectSightings = (db: Db | Tx) =>
  db
    .select(sightingColumns)
    .from(sightings)
    .innerJoin(users, eq(users.id, sightings.reportedBy))
    .leftJoin(searchers, eq(searchers.userId, sightings.reportedBy))
    .leftJoin(
      participations,
      and(eq(participations.searcherId, searchers.id), eq(participations.missionId, sightings.missionId)),
    )
    .$dynamic();
type SightingRow = Awaited<ReturnType<typeof selectSightings>>[number];

function toSighting(row: SightingRow, current: CurrentLkp | undefined): Sighting {
  return {
    id: row.id,
    missionId: row.missionId,
    number: row.number,
    position: PointGeometry.parse(JSON.parse(row.position)),
    observedAt: row.observedAt.toISOString(),
    description: row.description,
    source: row.source,
    reportedBy: { role: row.reporterRole, name: row.reporterName, callsign: row.callsign },
    lkpDecision: row.lkpDecision,
    lkpCandidate: isLkpCandidate(row, current?.observedAt ?? null),
    createdAt: row.createdAt.toISOString(),
  };
}

async function currentLkp(db: Db | Tx, missionId: string): Promise<CurrentLkp | undefined> {
  const [row] = await db
    .select({ position: asGeoJson(lkpPoints.position), observedAt: lkpPoints.observedAt })
    .from(lkpPoints)
    .where(eq(lkpPoints.missionId, missionId))
    .orderBy(desc(lkpPoints.createdAt))
    .limit(1);
  return row;
}

/** Locks the mission row so concurrent LKP changes in one mission run one after another. */
async function lockMission(tx: Tx, missionId: string) {
  const [mission] = await tx
    .select({ status: missions.status })
    .from(missions)
    .where(eq(missions.id, missionId))
    .for('update');
  if (!mission) throw notFound('Mission');
  if (!canChangeLkp(mission.status)) {
    throw new AppError(409, 'MISSION_ENDED', 'LKP and sightings of an ended mission cannot be changed');
  }
}

/**
 * The mission's sightings, oldest first. The route's access check has already answered 404 for an unknown mission.
 * The row number is computed over the whole mission before the query filters, so it is stable.
 */
export async function listSightings(db: Db, missionId: string): Promise<Sighting[]> {
  const current = await currentLkp(db, missionId);
  const rows = await selectSightings(db)
    .where(eq(sightings.missionId, missionId))
    .orderBy(asc(sightings.createdAt), asc(sightings.id));
  return rows.map((row) => toSighting(row, current));
}

async function findSighting(tx: Tx, missionId: string, sightingId: string): Promise<SightingRow> {
  // Numbers come from a window over the mission, so select its rows and pick one.
  const rows = await selectSightings(tx).where(eq(sightings.missionId, missionId));
  const row = rows.find((candidate) => candidate.id === sightingId);
  if (!row) throw notFound('Sighting');
  return row;
}

/** Adds a sighting (UC-C04). It shows on the map at once and never becomes the LKP by itself (decision 59). */
export async function createSighting(db: Db, input: CreateSightingInput): Promise<Sighting> {
  return db.transaction(async (tx) => {
    await lockMission(tx, input.missionId);
    const [created] = await tx
      .insert(sightings)
      .values({
        missionId: input.missionId,
        reportedBy: input.reportedBy,
        source: input.source,
        position: input.position,
        observedAt: new Date(input.observedAt),
        description: input.description,
      })
      .returning({ id: sightings.id });
    if (!created) throw new Error('Sighting insert returned no row');
    const row = await findSighting(tx, input.missionId, created.id);
    return toSighting(row, await currentLkp(tx, input.missionId));
  });
}

/**
 * The commander's answer to the LKP suggestion. Accepting adds a new LKP point and keeps the old ones as history;
 * rejecting changes nothing but the sighting. Only an undecided sighting later than the current LKP can be decided.
 */
export async function decideLkp(
  db: Db,
  input: { missionId: string; sightingId: string; decision: LkpDecision; userId: string },
): Promise<LkpDecisionResult> {
  return db.transaction(async (tx) => {
    await lockMission(tx, input.missionId);
    const found = await findSighting(tx, input.missionId, input.sightingId);
    const current = await currentLkp(tx, input.missionId);
    if (!isLkpCandidate(found, current?.observedAt ?? null)) {
      throw new AppError(
        409,
        'SIGHTING_NOT_LKP_CANDIDATE',
        'The sighting was already decided or is not later than the current LKP',
        { lkpDecision: found.lkpDecision },
      );
    }
    await tx
      .update(sightings)
      .set({ lkpDecision: input.decision, decidedAt: new Date() })
      .where(eq(sightings.id, found.id));
    if (input.decision === 'accepted') {
      await tx.insert(lkpPoints).values({
        missionId: input.missionId,
        position: PointGeometry.parse(JSON.parse(found.position)),
        observedAt: found.observedAt,
        sightingId: found.id,
        setBy: input.userId,
      });
    }
    const lkp = await currentLkp(tx, input.missionId);
    if (!lkp) throw new Error('The mission has no LKP');
    const updated = await findSighting(tx, input.missionId, found.id);
    return { sighting: toSighting(updated, lkp), lkp: toLkp(lkp) };
  });
}

/** Every LKP the mission had, newest first. The first is the current one (decision 58). */
export async function listLkps(db: Db, missionId: string): Promise<LkpPoint[]> {
  const rows = await db
    .select({
      id: lkpPoints.id,
      position: asGeoJson(lkpPoints.position),
      observedAt: lkpPoints.observedAt,
      sightingId: lkpPoints.sightingId,
      setBy: users.name,
      createdAt: lkpPoints.createdAt,
    })
    .from(lkpPoints)
    .leftJoin(users, eq(users.id, lkpPoints.setBy))
    .where(eq(lkpPoints.missionId, missionId))
    .orderBy(desc(lkpPoints.createdAt));
  return rows.map((row, index) => ({
    id: row.id,
    position: PointGeometry.parse(JSON.parse(row.position)),
    observedAt: row.observedAt.toISOString(),
    current: index === 0,
    sightingId: row.sightingId,
    setBy: row.setBy,
    createdAt: row.createdAt.toISOString(),
  }));
}
