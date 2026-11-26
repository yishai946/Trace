import { canPauseMission, canResumeMission, type MissionStatus } from '@trace/domain';
import type { Mission } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import type { Actor } from '../../auth/auth.plugin';
import { missions, participations } from '../../db/schema';
import { AppError, missionEnded } from '../../errors';
import { lockMission } from '../lockMission';
import { sendMessage } from '../messages/messages.service';
import { findParticipant } from '../participants/participants.read';
import type { ServiceDeps } from '../serviceDeps';
import { recordEvent } from '../timeline/timeline.service';
import { getMission } from './missions.read';

type Input = { missionId: string; commander: Actor };

/** What the searchers read when the commander pauses and when they resume (UC-C15, decisions 20 and 64). */
const PAUSED_MESSAGE = 'החיפוש הושהה. הפסיקו לחפש וחזרו ל־Rally Point. המעקב הבטיחותי נמשך.';
const RESUMED_MESSAGE = 'המסע חודש. כדי לחזור לחפש לחצו שוב "התחל חיפוש".';

const CHANGES = {
  pause: {
    allowed: canPauseMission,
    from: 'active',
    to: 'paused',
    event: 'mission.paused',
    message: PAUSED_MESSAGE,
    /** The search stops: a task that is searching pauses. A ready or finished task stays. */
    task: { from: 'searching', to: 'paused' },
  },
  resume: {
    allowed: canResumeMission,
    from: 'paused',
    to: 'active',
    event: 'mission.resumed',
    message: RESUMED_MESSAGE,
    /** Assignments stay; every paused task is back at Ready, and the searcher starts again (decision 64). */
    task: { from: 'paused', to: 'ready' },
  },
} as const;

type Change = (typeof CHANGES)[keyof typeof CHANGES];

/**
 * Pauses the search of an active mission (UC-C15): no search, safety tracking goes on, no new joins, and a personal
 * Resume is refused until the mission is resumed. Searching tasks pause; the searchers get a message to return to the
 * Rally Point. A mission that is already paused is returned as it is.
 */
export const pauseMission = (deps: ServiceDeps, input: Input) => change(deps, input, CHANGES.pause);

/**
 * Resumes a paused mission (UC-C15, decision 64): assignments stay, every paused task is back at Ready, so each
 * searcher presses "התחל חיפוש" again. A mission that is already active is returned as it is.
 */
export const resumeMission = (deps: ServiceDeps, input: Input) => change(deps, input, CHANGES.resume);

async function change(deps: ServiceDeps, { missionId, commander }: Input, rule: Change): Promise<Mission> {
  const { db, realtime } = deps;
  const result = await db.transaction(async (tx) => {
    await lockMission(tx, missionId, {
      allowed: (status: MissionStatus) => status === rule.from || status === rule.to,
      refusal: () => missionEnded('The mission has already ended'),
    });
    const [updated] = await tx
      .update(missions)
      .set({ status: rule.to, updatedAt: new Date() })
      .where(and(eq(missions.id, missionId), eq(missions.status, rule.from)))
      .returning({ name: missions.name });
    if (!updated) return null;
    const moved = await tx
      .update(participations)
      .set({ taskStatus: rule.task.to })
      .where(and(eq(participations.missionId, missionId), eq(participations.taskStatus, rule.task.from)))
      .returning({ id: participations.id });
    const event = await recordEvent(tx, {
      missionId,
      actor: commander,
      type: rule.event,
      subject: { kind: 'mission', id: missionId, label: updated.name },
      details: {},
    });
    return { movedIds: moved.map((row) => row.id), event };
  });
  const mission = await getMission(db, missionId);
  if (!result) return mission;

  realtime.publish({ type: 'mission.updated', missionId, mission });
  for (const id of result.movedIds) {
    const participant = await findParticipant(deps, missionId, id);
    if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
  }
  realtime.publish({ type: 'timeline.recorded', missionId, event: result.event });
  await notifySearchers(deps, { missionId, commander }, rule.message);
  return mission;
}

/** Tells the searchers still in the field. Nobody in the field means nobody to tell, not a failure. */
async function notifySearchers(deps: ServiceDeps, { missionId, commander }: Input, body: string): Promise<void> {
  try {
    await sendMessage(deps, {
      missionId,
      sentBy: commander.userId,
      message: { target: { kind: 'mission' }, urgency: 'important', body },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NO_RECIPIENTS') return;
    throw error;
  }
}
