import {
  canChangeRallyPoint,
  canEditMissionDetails,
  detectPhotoType,
  generateJoinCode,
  type RandomInt,
} from '@trace/domain';
import type { PointGeometry } from '@trace/schemas';
import { type CreateMissionBody, type Mission } from '@trace/schemas';
import type { z } from 'zod';
import { eq } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import type { Actor } from '../../auth/auth.plugin';
import type { Db } from '../../db';
import { lkpPoints, missionPhotos, missions } from '../../db/schema';
import { missionEnded, unsupportedPhoto } from '../../errors';
import { missionPhotoKey } from '../../storage';
import { lockMission } from '../lockMission';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { getMission } from './missions.read';

/** The request body plus the commander who creates the mission and will manage it. */
export type CreateMissionInput = z.output<typeof CreateMissionBody> & { commanderId: string };

const JOIN_CODE_ATTEMPTS = 5;
const UNIQUE_VIOLATION = '23505';

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
        const actor: Actor = { role: 'commander', userId: input.commanderId };
        await recordEvent(tx, {
          missionId: created.id,
          actor,
          type: 'mission.created',
          subject: { kind: 'mission', id: created.id, label: input.name },
          details: {},
        });
        if (input.lkp) {
          const [lkp] = await tx
            .insert(lkpPoints)
            .values({
              missionId: created.id,
              position: input.lkp.position,
              observedAt: new Date(input.lkp.observedAt),
              setBy: input.commanderId,
            })
            .returning({ id: lkpPoints.id });
          if (!lkp) throw new Error('LKP insert returned no row');
          await recordEvent(tx, {
            missionId: created.id,
            actor,
            type: 'lkp.changed',
            subject: { kind: 'lkp', id: lkp.id, label: null },
            details: { observedAt: new Date(input.lkp.observedAt).toISOString(), previousObservedAt: null },
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

/**
 * Moves the rally point (UC-C05). The mission has exactly one, so the new point replaces the old one. A mission that
 * ended is read-only. The status is locked while checking, so an ending mission cannot slip through.
 */
export async function updateRallyPoint(
  { db, realtime }: ServiceDeps,
  missionId: string,
  rallyPoint: PointGeometry,
): Promise<Mission> {
  await db.transaction(async (tx) => {
    await lockMission(tx, missionId, {
      allowed: canChangeRallyPoint,
      refusal: () => missionEnded('The rally point of an ended mission cannot be changed'),
    });
    await tx.update(missions).set({ rallyPoint, updatedAt: new Date() }).where(eq(missions.id, missionId));
  });
  const mission = await getMission(db, missionId);
  realtime.publish({
    type: 'rally.changed',
    missionId,
    rallyPoint: mission.rallyPoint,
    updatedAt: mission.updatedAt,
  });
  return mission;
}

/**
 * Saves or replaces the missing person's photo. The content must really be a JPEG, PNG or WebP image.
 * An ended mission is read-only (UC-C03 edits only an active or paused mission).
 */
export async function setMissionPhoto(
  { db, realtime, photos }: ServiceDeps,
  missionId: string,
  data: Buffer,
): Promise<Mission> {
  const contentType = detectPhotoType(data);
  await db.transaction(async (tx) => {
    // Locked, so two uploads cannot leave the bucket with one photo and the row with the other's type and version.
    await lockMission(tx, missionId, {
      allowed: canEditMissionDetails,
      refusal: () => missionEnded('The photo of an ended mission cannot be changed'),
    });
    if (!contentType) throw unsupportedPhoto();
    await photos.put(missionPhotoKey(missionId), { contentType, data });
    await tx
      .insert(missionPhotos)
      .values({ missionId, contentType })
      .onConflictDoUpdate({ target: missionPhotos.missionId, set: { contentType, data: null, updatedAt: new Date() } });
  });
  const mission = await getMission(db, missionId);
  realtime.publish({ type: 'mission.updated', missionId: mission.id, mission });
  return mission;
}
