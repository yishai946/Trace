import { MissionParams } from '@trace/schemas';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import type { Db } from '../db';
import { missions, participations } from '../db/schema';
import { forbidden, notFound } from '../errors';
import { actorOf } from './auth.plugin';

/** Route guard: only commanders may call the route (permission matrix, spec §7). */
export async function commandersOnly(request: FastifyRequest) {
  if (actorOf(request).role !== 'commander') throw forbidden();
}

/**
 * Who may call a route under /missions/:missionId.
 * - `commander`: only the mission's own commander (create or edit polygons, list searchers' positions).
 * - `member`: its commander or a searcher who takes part in it, now or before (read the mission and its map).
 */
type MissionAccess = 'commander' | 'member';

/**
 * Route guard for /missions/:missionId routes. A mission the user has no part in answers 404, so its existence is not
 * revealed; a searcher in the mission asking for a commander action gets 403.
 */
export function missionAccess(db: Db, access: MissionAccess) {
  return async (request: FastifyRequest) => {
    const actor = actorOf(request);
    const { missionId } = MissionParams.parse(request.params);

    const [mission] = await db
      .select({ commanderId: missions.commanderId })
      .from(missions)
      .where(eq(missions.id, missionId));
    if (!mission) throw notFound('Mission');

    if (actor.role === 'commander') {
      if (mission.commanderId !== actor.userId) throw notFound('Mission');
      return;
    }

    const isMember =
      actor.searcherId !== null &&
      (
        await db
          .select({ id: participations.id })
          .from(participations)
          .where(and(eq(participations.missionId, missionId), eq(participations.searcherId, actor.searcherId)))
      ).length > 0;
    if (!isMember) throw notFound('Mission');
    if (access === 'commander') throw forbidden();
  };
}
