import type { MissionStatus, MissionStopReason } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Actor } from '../../auth/auth.plugin';
import { missions, participations } from '../../db/schema';
import { missionEnded } from '../../errors';
import { lockMission } from '../lockMission';
import { publishMessage, storeMessage } from '../messages/messages.service';
import { findParticipant } from '../participants/participants.read';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { getMission } from './missions.read';

/** The open task statuses: the ones "the search ends" finishes. */
const OPEN_TASKS = ['ready', 'searching', 'paused'] as const;

type EndSpec = {
  missionId: string;
  commander: Extract<Actor, { role: 'commander' }>;
  /** The new status and the columns that say how the mission ended. */
  set: Partial<typeof missions.$inferInsert> & { status: Extract<MissionStatus, 'ended_located' | 'ended_stopped'> };
  outcome: 'located' | 'stopped';
  /** For the Timeline, when the search was stopped. */
  reason?: MissionStopReason;
  /** What the searchers still in the field read. */
  message: string;
  allowed: (status: MissionStatus) => boolean;
};

/**
 * The end of a mission, shared by "the missing person was located" (UC-C16) and "the search was stopped" (UC-C17):
 * the mission row is locked, the status and how it ended are saved, every open task finishes, the Timeline records it
 * and the searchers who have not ended their activity get a message (and a push). Searchers, assignments and routes
 * stay, so safety tracking goes on until each one ends their activity (decision 65).
 */
export async function endMission(deps: ServiceDeps, spec: EndSpec): Promise<Mission> {
  const { db, realtime } = deps;
  const { missionId, commander, set, outcome, reason, message, allowed } = spec;
  const result = await db.transaction(async (tx) => {
    await lockMission(tx, missionId, { allowed, refusal: () => missionEnded('The mission has already ended') });
    const endedAt = new Date();
    await tx
      .update(missions)
      .set({ ...set, endedAt, updatedAt: endedAt })
      .where(eq(missions.id, missionId));
    const finished = await tx
      .update(participations)
      .set({ taskStatus: 'finished' })
      .where(and(eq(participations.missionId, missionId), inArray(participations.taskStatus, [...OPEN_TASKS])))
      .returning({ id: participations.id });
    const [row] = await tx.select({ name: missions.name }).from(missions).where(eq(missions.id, missionId));
    const event = await recordEvent(tx, {
      missionId,
      actor: commander,
      type: 'mission.ended',
      subject: { kind: 'mission', id: missionId, label: row?.name ?? null },
      details: reason ? { outcome, reason } : { outcome },
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
            body: message,
            target: { kind: 'mission' },
            recipientIds: inField.map((participation) => participation.id),
          });
    return { finishedIds: finished.map((participation) => participation.id), event, stored };
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
