import {
  canEditMissionDetails,
  changedMissionDetails,
  detailChangesText,
  type MissionDetailField,
  type MissionDetailValues,
} from '@trace/domain';
import type { Mission, UpdateMissionDetailsBody } from '@trace/schemas';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { Tx } from '../../db';
import { missions } from '../../db/schema';
import { missionEnded, notFound } from '../../errors';
import { lockMission } from '../lockMission';
import type { PushMessage } from '../notifications/pushSender';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { getMission } from './missions.read';

export type MissionDetailsInput = z.output<typeof UpdateMissionDetailsBody>;

/** The stored details of the (locked) mission. */
async function storedDetails(tx: Tx, missionId: string): Promise<MissionDetailValues> {
  const [row] = await tx
    .select({
      name: missions.name,
      missingPersonName: missions.missingPersonName,
      missingPersonAge: missions.missingPersonAge,
      disappearedAt: missions.disappearedAt,
      description: missions.description,
      additionalInfo: missions.additionalInfo,
    })
    .from(missions)
    .where(eq(missions.id, missionId));
  if (!row) throw notFound('Mission');
  return { ...row, disappearedAt: row.disappearedAt?.toISOString() ?? null };
}

function valuesOf({ name, missingPerson }: MissionDetailsInput): MissionDetailValues {
  return {
    name,
    missingPersonName: missingPerson.name,
    missingPersonAge: missingPerson.age,
    disappearedAt: missingPerson.disappearedAt,
    description: missingPerson.description,
    additionalInfo: missingPerson.additionalInfo,
  };
}

/** The push to the searchers for a change the commander marked significant (decision 34). Tapping it opens the missing person's details. */
export function detailsPushMessage(missionId: string, fields: readonly MissionDetailField[]): PushMessage {
  return {
    title: 'פרטי הנעדר עודכנו',
    body: detailChangesText(fields),
    data: { missionId, screen: 'missing-person' },
  };
}

/**
 * Replaces the mission name and the missing-person details (UC-C03). Only an active or paused mission can be edited
 * (decision 94). The status is locked while checking, so an ending mission cannot slip through.
 * With `notifySearchers` the change is significant (decision 34): it is recorded on the Timeline in the same
 * transaction and the mission's active searchers get a push. Without it nothing is recorded or sent (decision 54).
 */
export async function updateMissionDetails(
  { db, realtime, push }: ServiceDeps,
  { missionId, actor, details }: { missionId: string; actor: Actor; details: MissionDetailsInput },
): Promise<Mission> {
  const significant = await db.transaction(async (tx) => {
    await lockMission(tx, missionId, {
      allowed: canEditMissionDetails,
      refusal: () => missionEnded('The details of an ended mission cannot be changed'),
    });
    const before = await storedDetails(tx, missionId);
    const { missingPerson } = details;
    await tx
      .update(missions)
      .set({
        name: details.name,
        missingPersonName: missingPerson.name,
        missingPersonAge: missingPerson.age,
        disappearedAt: missingPerson.disappearedAt ? new Date(missingPerson.disappearedAt) : null,
        description: missingPerson.description,
        additionalInfo: missingPerson.additionalInfo,
        updatedAt: new Date(),
      })
      .where(eq(missions.id, missionId));
    if (!details.notifySearchers) return null;
    const fields = changedMissionDetails(before, valuesOf(details));
    const event = await recordEvent(tx, {
      missionId,
      actor,
      type: 'mission.details_changed',
      subject: { kind: 'mission', id: missionId, label: details.name },
      details: { fields },
    });
    return { event, fields };
  });
  const mission = await getMission(db, missionId);
  realtime.publish({ type: 'mission.updated', missionId, mission });
  if (significant) {
    realtime.publish({ type: 'timeline.recorded', missionId, event: significant.event });
    void push.notifySearchers({ missionId, message: detailsPushMessage(missionId, significant.fields) });
  }
  return mission;
}
