import type { OwnParticipation } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import { participations } from '../../db/schema';
import { notFound } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { getOwnParticipation } from './participants.read';
import { endParticipation } from './participants.service';

/**
 * "סיימתי פעילות / יצאתי מהשטח" (UC-F15, decision 30): the searcher ends their own participation. It is the same
 * Activity Ended as the commander's (UC-C18): the open assignment and the task end, the route and Coverage stay, track
 * points are refused from now on, and the searcher may join the active mission again as Available (decision 70). It
 * works whatever the mission's status, since safety tracking runs until this moment (decisions 20, 65). Asking again
 * changes nothing.
 */
export async function finishActivity(
  deps: ServiceDeps,
  input: { missionId: string; searcherId: string },
): Promise<OwnParticipation> {
  const [participation] = await deps.db
    .select({ id: participations.id })
    .from(participations)
    .where(and(eq(participations.missionId, input.missionId), eq(participations.searcherId, input.searcherId)));
  if (!participation) throw notFound('Mission');
  await endParticipation(deps, { missionId: input.missionId, participantId: participation.id });
  return getOwnParticipation(deps.db, input.missionId, input.searcherId);
}
