import { generateJoinCode, type RandomInt } from '@trace/domain';
import { PointGeometry, type CreateMissionBody, type Mission } from '@trace/schemas';
import type { z } from 'zod';
import { desc, eq, inArray } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { Actor } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { lkpPoints, missions, participations } from '../../db/schema';
import { notFound } from '../../errors';

/** The request body plus the commander who creates the mission and will manage it. */
export type CreateMissionInput = z.output<typeof CreateMissionBody> & { commanderId: string };

const JOIN_CODE_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

const missionColumns = {
  id: missions.id,
  name: missions.name,
  status: missions.status,
  joinCode: missions.joinCode,
  missingPersonName: missions.missingPersonName,
  missingPersonAge: missions.missingPersonAge,
  disappearedAt: missions.disappearedAt,
  description: missions.description,
  additionalInfo: missions.additionalInfo,
  rallyPoint: asGeoJson(missions.rallyPoint),
  createdAt: missions.createdAt,
  updatedAt: missions.updatedAt,
};

const selectMissions = (db: Db) => db.select(missionColumns).from(missions);
type MissionRow = Awaited<ReturnType<typeof selectMissions>>[number];
interface LkpRow {
  missionId: string;
  position: string;
  observedAt: Date;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

function toMission(row: MissionRow, lkp: LkpRow | undefined): Mission {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    joinCode: row.joinCode,
    missingPerson: {
      name: row.missingPersonName,
      age: row.missingPersonAge,
      disappearedAt: iso(row.disappearedAt),
      description: row.description,
      additionalInfo: row.additionalInfo,
    },
    rallyPoint: PointGeometry.parse(JSON.parse(row.rallyPoint)),
    lkp: lkp
      ? { position: PointGeometry.parse(JSON.parse(lkp.position)), observedAt: lkp.observedAt.toISOString() }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** The current LKP of each mission: its newest point. */
async function currentLkps(db: Db, missionIds: string[]): Promise<Map<string, LkpRow>> {
  if (missionIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([lkpPoints.missionId], {
      missionId: lkpPoints.missionId,
      position: asGeoJson(lkpPoints.position),
      observedAt: lkpPoints.observedAt,
    })
    .from(lkpPoints)
    .where(inArray(lkpPoints.missionId, missionIds))
    .orderBy(lkpPoints.missionId, desc(lkpPoints.createdAt));
  return new Map(rows.map((row) => [row.missionId, row]));
}

function isJoinCodeConflict(error: unknown): boolean {
  const cause = error instanceof Error && 'cause' in error ? error.cause : error;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'code' in cause &&
    cause.code === UNIQUE_VIOLATION &&
    'constraint_name' in cause &&
    cause.constraint_name === 'missions_join_code_unique'
  );
}

/** A commander's own missions, or the missions a searcher takes part in, newest first. */
export async function listMissions(db: Db, actor: Actor): Promise<Mission[]> {
  let mine;
  if (actor.role === 'commander') {
    mine = eq(missions.commanderId, actor.userId);
  } else if (actor.searcherId) {
    const joined = db
      .select({ id: participations.missionId })
      .from(participations)
      .where(eq(participations.searcherId, actor.searcherId));
    mine = inArray(missions.id, joined);
  } else {
    return [];
  }
  const rows = await selectMissions(db).where(mine).orderBy(desc(missions.createdAt));
  const lkps = await currentLkps(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((row) => toMission(row, lkps.get(row.id)));
}

export async function getMission(db: Db, id: string): Promise<Mission> {
  const [row] = await selectMissions(db).where(eq(missions.id, id));
  if (!row) throw notFound('Mission');
  const lkps = await currentLkps(db, [id]);
  return toMission(row, lkps.get(id));
}

/** Creates an active mission with a unique join code (UC-C02). */
export async function createMission(
  db: Db,
  input: CreateMissionInput,
  random: RandomInt = (max) => randomInt(max),
): Promise<Mission> {
  for (let attempt = 1; ; attempt++) {
    try {
      const id = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(missions)
          .values({
            commanderId: input.commanderId,
            name: input.name,
            joinCode: generateJoinCode(random),
            missingPersonName: input.missingPerson.name,
            missingPersonAge: input.missingPerson.age,
            disappearedAt: input.missingPerson.disappearedAt ? new Date(input.missingPerson.disappearedAt) : null,
            description: input.missingPerson.description,
            additionalInfo: input.missingPerson.additionalInfo,
            rallyPoint: input.rallyPoint,
          })
          .returning({ id: missions.id });
        if (!created) throw new Error('Mission insert returned no row');
        if (input.lkp) {
          await tx.insert(lkpPoints).values({
            missionId: created.id,
            position: input.lkp.position,
            observedAt: new Date(input.lkp.observedAt),
          });
        }
        return created.id;
      });
      return await getMission(db, id);
    } catch (error) {
      if (attempt < JOIN_CODE_ATTEMPTS && isJoinCodeConflict(error)) continue;
      throw error;
    }
  }
}
