import { startSearchRefusal, type StartSearchRefusal } from '@trace/domain';
import type { OwnParticipation } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import { missions, participations } from '../../db/schema';
import { AppError, missionEnded, notFound, participationEnded } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { findParticipant, ownColumns } from './participants.read';

const REFUSALS: Record<StartSearchRefusal, () => AppError> = {
  mission_ended: () => missionEnded('The mission has ended'),
  mission_not_active: () => new AppError(409, 'MISSION_NOT_ACTIVE', 'The mission is paused'),
  participation_ended: () => participationEnded(),
  not_assigned: () => new AppError(409, 'NOT_ASSIGNED', 'The searcher is not assigned to a polygon'),
  task_not_ready: () => new AppError(409, 'TASK_NOT_READY', 'The search task is not at Ready'),
};

/**
 * Starts the searcher's search task (UC-F06): Ready becomes Searching. Only an assigned searcher in an active mission
 * may start; Paused and Ended block it. Pressing the button again after the answer was lost changes nothing and
 * announces nothing: a task already searching is returned as it is. The participation row is locked, so a double tap
 * and a move to another polygon cannot interleave.
 */
export async function startSearch(
  { db, realtime }: ServiceDeps,
  input: { missionId: string; searcherId: string },
): Promise<OwnParticipation> {
  const result = await db.transaction(async (tx) => {
    const [participation] = await tx
      .select({ ...ownColumns, missionStatus: missions.status })
      .from(participations)
      .innerJoin(missions, eq(missions.id, participations.missionId))
      .where(and(eq(participations.missionId, input.missionId), eq(participations.searcherId, input.searcherId)))
      .for('update', { of: participations });
    if (!participation) throw notFound('Mission');
    const { missionStatus, ...own } = participation;
    const unchanged = own.status === 'assigned' && own.taskStatus === 'searching' && missionStatus === 'active';
    if (unchanged) return { own, started: false };
    const refusal = startSearchRefusal({
      missionStatus,
      participationStatus: own.status,
      taskStatus: own.taskStatus,
    });
    if (refusal) throw REFUSALS[refusal]();
    await tx.update(participations).set({ taskStatus: 'searching' }).where(eq(participations.id, own.id));
    return { own: { ...own, taskStatus: 'searching' as const }, started: true };
  });
  if (result.started) {
    const participant = await findParticipant({ db, realtime }, input.missionId, result.own.id);
    if (participant) realtime.publish({ type: 'participant.updated', missionId: input.missionId, participant });
  }
  return result.own;
}
