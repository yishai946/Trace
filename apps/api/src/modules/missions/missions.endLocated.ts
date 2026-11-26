import { canEndMissionLocated } from '@trace/domain';
import type { EndMissionLocatedBody, Mission } from '@trace/schemas';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import { missions, participations } from '../../db/schema';
import { missionEnded } from '../../errors';
import { lockMission } from '../lockMission';
import { publishMessage, storeMessage } from '../messages/messages.service';
import { findParticipant } from '../participants/participants.read';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { getMission } from './missions.read';

/** What the searchers read when the mission ends as located. */
const LOCATED_MESSAGE = 'הנעדר אותר והמסע הסתיים. הפסיקו את החיפוש, וכשתסיימו לחזור מהשטח לחצו "סיימתי פעילות".';

/** The open task statuses: the ones "the search ends" finishes. */
const OPEN_TASKS = ['ready', 'searching', 'paused'] as const;

type EndInput = {
  missionId: string;
  commander: Extract<Actor, { role: 'commander' }>;
  located: z.output<typeof EndMissionLocatedBody>;
};

/**
 * Ends the mission because the missing person was located (UC-C16, decisions 18, 52, 65, 97). Only the commander ends,
 * from Active or Paused. Every open search task finishes; the searchers, their assignments and routes stay, so safety
 * tracking goes on until each one presses "סיימתי פעילות". The searchers still in the field get a message (and a push).
 * The mission row is locked, so a change that races the ending either completes before it or is refused after it.
 */
export async function endMissionLocated(deps: ServiceDeps, input: EndInput): Promise<Mission> {
  const { db, realtime } = deps;
  const { missionId, commander, located } = input;
  const result = await db.transaction(async (tx) => {
    await lockMission(tx, missionId, {
      allowed: canEndMissionLocated,
      refusal: () => missionEnded('The mission has already ended'),
    });
    const endedAt = new Date();
    await tx
      .update(missions)
      .set({
        status: 'ended_located',
        locatedPosition: located.position,
        locatedAt: new Date(located.locatedAt),
        locatedNote: located.note,
        endedAt,
        updatedAt: endedAt,
      })
      .where(eq(missions.id, missionId));
    const finished = await tx
      .update(participations)
      .set({ taskStatus: 'finished' })
      .where(and(eq(participations.missionId, missionId), inArray(participations.taskStatus, [...OPEN_TASKS])))
      .returning({ id: participations.id });
    const [mission] = await tx.select({ name: missions.name }).from(missions).where(eq(missions.id, missionId));
    const event = await recordEvent(tx, {
      missionId,
      actor: commander,
      type: 'mission.ended',
      subject: { kind: 'mission', id: missionId, label: mission?.name ?? null },
      details: { outcome: 'located' },
      occurredAt: endedAt,
    });
    const inField = await tx
      .select({ id: participations.id })
      .from(participations)
      .where(and(eq(participations.missionId, missionId), ne(participations.status, 'ended')));
    const stored =
      inField.length === 0
        ? null
        : await storeMessage(tx, {
            missionId,
            sentBy: commander.userId,
            urgency: 'important',
            body: LOCATED_MESSAGE,
            target: { kind: 'mission' },
            recipientIds: inField.map((row) => row.id),
          });
    return { finishedIds: finished.map((row) => row.id), event, stored };
  });

  const mission = await getMission(db, missionId);
  realtime.publish({ type: 'mission.updated', missionId, mission });
  for (const id of result.finishedIds) {
    const participant = await findParticipant(deps, missionId, id);
    if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
  }
  realtime.publish({ type: 'timeline.recorded', missionId, event: result.event });
  if (result.stored) publishMessage(deps, missionId, result.stored);
  return mission;
}
