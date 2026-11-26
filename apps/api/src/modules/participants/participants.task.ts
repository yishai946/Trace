import type { MissionStatus, TaskStatus } from '@trace/domain';
import type { OwnParticipation } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import { missions, participations } from '../../db/schema';
import { notFound, type AppError } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { findParticipant, ownColumns } from './participants.read';

export interface TaskMoveInput {
  missionId: string;
  searcherId: string;
  /** The task status the move leads to. A task already there is returned as it is, without announcing anything. */
  target: TaskStatus;
  /** The domain's verdict on the current state: an error to throw, or null to accept the move. */
  refuse: (state: {
    missionStatus: MissionStatus;
    participationStatus: OwnParticipation['status'];
    taskStatus: OwnParticipation['taskStatus'];
  }) => AppError | null;
}

/**
 * Moves the searcher's search task to `target` (Start Search, Pause, Resume) and tells the commander. The participation
 * row is locked (and the mission row shared), so a double tap and a move to another polygon cannot interleave. Sending the same move again after
 * the answer was lost changes nothing and announces nothing.
 */
export async function moveTask(
  { db, realtime }: ServiceDeps,
  { missionId, searcherId, target, refuse }: TaskMoveInput,
): Promise<OwnParticipation> {
  const result = await db.transaction(async (tx) => {
    // A shared lock on the mission row first (the order a mission Pause or ending takes too), so a move waits for one
    // that is committing and then reads the new mission status, instead of starting a search in a paused mission.
    await tx.select({ id: missions.id }).from(missions).where(eq(missions.id, missionId)).for('share');
    const [participation] = await tx
      .select({ ...ownColumns, missionStatus: missions.status })
      .from(participations)
      .innerJoin(missions, eq(missions.id, participations.missionId))
      .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, searcherId)))
      .for('update', { of: participations });
    if (!participation) throw notFound('Mission');
    const { missionStatus, ...own } = participation;
    const unchanged = own.status === 'assigned' && own.taskStatus === target && missionStatus === 'active';
    if (unchanged) return { own, moved: false };
    const refusal = refuse({ missionStatus, participationStatus: own.status, taskStatus: own.taskStatus });
    if (refusal) throw refusal;
    await tx.update(participations).set({ taskStatus: target }).where(eq(participations.id, own.id));
    return { own: { ...own, taskStatus: target }, moved: true };
  });
  if (result.moved) {
    const participant = await findParticipant({ db, realtime }, missionId, result.own.id);
    if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
  }
  return result.own;
}
