import type { Mission } from '@trace/schemas';
import { PointGeometry } from '@trace/schemas';
import { desc, eq, inArray } from 'drizzle-orm';
import type { Actor } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { asGeoJson } from '../../db/geometry';
import { lkpPoints, missionPhotos, missions, participations, users } from '../../db/schema';
import { notFound } from '../../errors';
import { missionPhotoKey, readPhoto } from '../../storage';
import { isoOrNull } from '../isoOrNull';
import type { ServiceDeps } from '../serviceDeps';

const missionColumns = {
  id: missions.id,
  name: missions.name,
  status: missions.status,
  joinCode: missions.joinCode,
  commanderName: users.name,
  commanderPhone: users.phoneNumber,
  missingPersonName: missions.missingPersonName,
  missingPersonAge: missions.missingPersonAge,
  disappearedAt: missions.disappearedAt,
  description: missions.description,
  additionalInfo: missions.additionalInfo,
  rallyPoint: asGeoJson(missions.rallyPoint),
  photoUpdatedAt: missionPhotos.updatedAt,
  createdAt: missions.createdAt,
  updatedAt: missions.updatedAt,
};

const selectMissions = (db: Db) =>
  db
    .select(missionColumns)
    .from(missions)
    .innerJoin(users, eq(users.id, missions.commanderId))
    .leftJoin(missionPhotos, eq(missionPhotos.missionId, missions.id));
type MissionRow = Awaited<ReturnType<typeof selectMissions>>[number];
interface LkpRow {
  missionId: string;
  position: string;
  observedAt: Date;
}

/** The photo's address, with its version so a replaced photo is not served from a cache. */
const photoUrl = (missionId: string, updatedAt: Date) => `/api/missions/${missionId}/photo?v=${updatedAt.getTime()}`;

function toMission(row: MissionRow, lkp: LkpRow | undefined): Mission {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    joinCode: row.joinCode,
    commander: { name: row.commanderName, phoneNumber: row.commanderPhone },
    missingPerson: {
      name: row.missingPersonName,
      age: row.missingPersonAge,
      disappearedAt: isoOrNull(row.disappearedAt),
      description: row.description,
      additionalInfo: row.additionalInfo,
      photoUrl: row.photoUpdatedAt ? photoUrl(row.id, row.photoUpdatedAt) : null,
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

export interface MissionPhoto {
  contentType: string;
  data: Buffer;
  updatedAt: Date;
}

export async function getMissionPhoto(
  { db, photos }: Pick<ServiceDeps, 'db' | 'photos'>,
  missionId: string,
): Promise<MissionPhoto> {
  const [row] = await db
    .select({ contentType: missionPhotos.contentType, data: missionPhotos.data, updatedAt: missionPhotos.updatedAt })
    .from(missionPhotos)
    .where(eq(missionPhotos.missionId, missionId));
  const photo = row && (await readPhoto(photos, missionPhotoKey(missionId), row));
  if (!row || !photo) throw notFound('Photo');
  return { ...photo, updatedAt: row.updatedAt };
}
