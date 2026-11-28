import { polygonStatusChange } from '@trace/domain';
import { type ActiveSearchersDetails, type MissionPolygon, type SetPolygonStatusBody } from '@trace/schemas';
import { and, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import { participations, polygons, searchers } from '../../db/schema';
import { AppError } from '../../errors';
import { recordEvent } from '../timeline/timeline.service';
import { publishMessage, storeMessage } from '../messages/messages.service';
import { findParticipant } from '../participants/participants.read';
import type { ServiceDeps } from '../serviceDeps';
import { findPolygon, lockActiveMission } from './polygons.service';
import { toPolygon } from './polygons.read';

type StatusInput = z.output<typeof SetPolygonStatusBody>;

/** The tasks Completed ends: the open ones. A finished task needs no ending and no message. */
const OPEN_TASKS = ['ready', 'searching', 'paused'] as const;

const completedMessage = (polygonName: string) =>
  `הפוליגון "${polygonName}" סומן כהושלם. משימת החיפוש שלך הסתיימה. המתן להנחיות המפקד.`;

const restartedMessage = (polygonName: string) =>
  `הפוליגון "${polygonName}" חזר לפעיל. משימת החיפוש שלך חודשה. המתן להנחיות המפקד.`;

/**
 * Marks a polygon Completed at any Coverage, or returns a Completed one to Active (UC-C07, decisions 56, 57, 90).
 * Completed with active searchers is refused with their list until the commander confirms; on confirmation their tasks
 * finish, they stay assigned (decision 100) and get an important message. Back to Active changes only the status:
 * routes and Coverage stay and go on accumulating; with `restartSearchers` the assigned searchers' finished tasks go back
 * to ready and they get an important message (issue #346). Asking for the status the polygon already has changes nothing.
 */
export async function setPolygonStatus(
  deps: ServiceDeps,
  { missionId, polygonId, input, actor }: { missionId: string; polygonId: string; input: StatusInput; actor: Actor },
): Promise<MissionPolygon> {
  const { db, realtime } = deps;
  const result = await db.transaction(async (tx) => {
    await lockActiveMission(tx, missionId);
    const existing = await findPolygon(tx, missionId, polygonId);
    const change = polygonStatusChange(existing.status, input.status);
    if (change === 'refused') {
      throw new AppError(409, 'INVALID_STATUS_CHANGE', 'Only a Completed polygon can return to Active');
    }
    if (change === 'unchanged') return { polygon: toPolygon(existing), finishedIds: [], stored: null, event: null };

    const open =
      input.status === 'completed'
        ? await tx
            .select({
              id: participations.id,
              searcherId: participations.searcherId,
              callsign: participations.callsign,
              name: searchers.name,
            })
            .from(participations)
            .innerJoin(searchers, eq(searchers.id, participations.searcherId))
            .where(
              and(
                eq(participations.polygonId, polygonId),
                eq(participations.status, 'assigned'),
                inArray(participations.taskStatus, [...OPEN_TASKS]),
              ),
            )
            .for('update', { of: participations })
        : [];
    if (open.length > 0 && !input.confirmActiveSearchers) {
      const details: ActiveSearchersDetails = {
        searchers: open.map(({ id, callsign, name }) => ({ participantId: id, callsign, name })),
      };
      throw new AppError(409, 'POLYGON_SEARCHERS_ACTIVE', 'The polygon has active searchers', details);
    }

    const restartIds =
      input.status === 'active' && input.restartSearchers
        ? (
            await tx
              .select({ id: participations.id })
              .from(participations)
              .where(
                and(
                  eq(participations.polygonId, polygonId),
                  eq(participations.status, 'assigned'),
                  eq(participations.taskStatus, 'finished'),
                ),
              )
              .for('update')
          ).map((participation) => participation.id)
        : [];
    await tx.update(polygons).set({ status: input.status }).where(eq(polygons.id, polygonId));
    const finishedIds = open.map((participation) => participation.id);
    const changedIds = [...finishedIds, ...restartIds];
    if (finishedIds.length > 0) {
      await tx.update(participations).set({ taskStatus: 'finished' }).where(inArray(participations.id, finishedIds));
    }
    if (restartIds.length > 0) {
      await tx.update(participations).set({ taskStatus: 'ready' }).where(inArray(participations.id, restartIds));
    }
    const stored =
      changedIds.length === 0
        ? null
        : await storeMessage(tx, {
            missionId,
            sentBy: actor.userId,
            urgency: 'important',
            body: input.status === 'completed' ? completedMessage(existing.name) : restartedMessage(existing.name),
            target: { kind: 'polygons', polygonIds: [polygonId] },
            recipientIds: changedIds,
          });
    const event = await recordEvent(tx, {
      missionId,
      actor,
      subject: { kind: 'polygon', id: polygonId, label: existing.name },
      ...(input.status === 'completed'
        ? ({ type: 'polygon.completed', details: { endedTasks: finishedIds.length } } as const)
        : ({ type: 'polygon.reactivated', details: {} } as const)),
    });
    return { polygon: toPolygon(await findPolygon(tx, missionId, polygonId)), finishedIds: changedIds, stored, event };
  });

  realtime.publish({ type: 'polygon.saved', missionId, polygon: result.polygon });
  for (const id of result.finishedIds) {
    const participant = await findParticipant(deps, missionId, id);
    if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
  }
  if (result.stored) publishMessage(deps, missionId, result.stored);
  if (result.event) realtime.publish({ type: 'timeline.recorded', missionId, event: result.event });
  return result.polygon;
}
