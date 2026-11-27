import { canStopMission } from '@trace/domain';
import type { Mission, StopMissionBody } from '@trace/schemas';
import type { z } from 'zod';
import type { Actor } from '../../auth/auth.plugin';
import type { ServiceDeps } from '../serviceDeps';
import { endMission } from './missions.end';

/** What the searchers read when the search is stopped. */
const STOPPED_MESSAGE = 'החיפוש הופסק והמסע הסתיים. הפסיקו את החיפוש, וכשתסיימו לחזור מהשטח לחצו "סיימתי פעילות".';

type StopInput = {
  missionId: string;
  commander: Extract<Actor, { role: 'commander' }>;
  stop: z.output<typeof StopMissionBody>;
};

/**
 * Ends the mission without locating the missing person (UC-C17, decisions 52, 65, 96). Only the commander stops it,
 * from Active or Paused, with a reason from the list and an optional note; the rest is shared with the located ending.
 */
export function stopMission(deps: ServiceDeps, { missionId, commander, stop }: StopInput): Promise<Mission> {
  return endMission(deps, {
    missionId,
    commander,
    outcome: 'stopped',
    message: STOPPED_MESSAGE,
    allowed: canStopMission,
    set: { status: 'ended_stopped', stopReason: stop.reason, stopNote: stop.note },
  });
}
