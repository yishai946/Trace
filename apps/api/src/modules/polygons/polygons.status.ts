import { polygonStatusChange } from '@trace/domain';
import { type ActiveSearchersDetails, type MissionPolygon, type SetPolygonStatusBody } from '@trace/schemas';
import { and, eq, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import { participations, polygons, searchers } from '../../db/schema';
import { AppError } from '../../errors';
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

/**
 * Marks a polygon Completed at any Coverage, or returns a Completed one to Active (UC-C07, decisions 56, 57, 90).
 * Completed with active searchers is refused with their list until the commander confirms; on confirmation their tasks
 * finish, they stay assigned (decision 100) and get an important message. Back to Active changes only the status:
 * routes and Coverage stay and go on accumulating. Asking for the status the polygon already has changes nothing.
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
    if (change === 'unchanged') return { polygon: toPolygon(existing), finishedIds: [], stored: null };

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

    await tx.update(polygons).set({ status: input.status }).where(eq(polygons.id, polygonId));
    const finishedIds = open.map((participation) => participation.id);
    if (finishedIds.length > 0) {
      await tx.update(participations).set({ taskStatus: 'finished' }).where(inArray(participations.id, finishedIds));
    }
    const stored =
      finishedIds.length === 0
        ? null
        : await storeMessage(tx, {
            missionId,
            sentBy: actor.userId,
            urgency: 'important',
            body: completedMessage(existing.name),
            target: { kind: 'polygons', polygonIds: [polygonId] },
            recipientIds: finishedIds,
          });
    return { polygon: toPolygon(await findPolygon(tx, missionId, polygonId)), finishedIds, stored };
  });

  realtime.publish({ type: 'polygon.saved', missionId, polygon: result.polygon });
  for (const id of result.finishedIds) {
    const participant = await findParticipant(deps, missionId, id);
    if (participant) realtime.publish({ type: 'participant.updated', missionId, participant });
  }
  if (result.stored) publishMessage(deps, missionId, result.stored);
  return result.polygon;
}
