import { canEndMissionLocated } from '@trace/domain';
import type { EndMissionLocatedBody, Mission } from '@trace/schemas';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import { AppError } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { endMission } from './missions.end';

/** What the searchers read when the mission ends as located. */
const LOCATED_MESSAGE = 'הנעדר אותר והמסע הסתיים. הפסיקו את החיפוש, וכשתסיימו לחזור מהשטח לחצו "סיימתי פעילות".';

/** A phone clock may run a little ahead; a located time later than this from now is refused. */
const CLOCK_SKEW_MS = 5 * 60_000;

type EndInput = {
  missionId: string;
  commander: Extract<Actor, { role: 'commander' }>;
  located: z.output<typeof EndMissionLocatedBody>;
};

/**
 * Ends the mission because the missing person was located (UC-C16, decisions 18, 52, 65, 97). Only the commander ends,
 * from Active or Paused; the rest of the ending is shared with the stop (`endMission`).
 */
export async function endMissionLocated(deps: ServiceDeps, input: EndInput): Promise<Mission> {
  const { missionId, commander, located } = input;
  if (Date.parse(located.locatedAt) > Date.now() + CLOCK_SKEW_MS) {
    throw new AppError(400, 'VALIDATION_ERROR', 'The located time cannot be in the future');
  }
  return endMission(deps, {
    missionId,
    commander,
    outcome: 'located',
    message: LOCATED_MESSAGE,
    allowed: canEndMissionLocated,
    set: {
      status: 'ended_located',
      locatedPosition: located.position,
      locatedAt: new Date(located.locatedAt),
      locatedNote: located.note,
    },
  });
}
