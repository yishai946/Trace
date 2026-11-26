import {
  searchFinishRefusal,
  searchFinishTarget,
  searchPauseRefusal,
  searchPauseTarget,
  startSearchRefusal,
  type SearchFinishRefusal,
  type SearchPauseAction,
  type SearchPauseRefusal,
  type StartSearchRefusal,
} from '@trace/domain';
import type { OwnParticipation } from '@trace/schemas';
import { AppError, missionEnded, participationEnded } from '../../errors';
import type { ServiceDeps } from '../serviceDeps';
import { moveTask } from './participants.task';

const REFUSALS: Record<StartSearchRefusal | SearchPauseRefusal | SearchFinishRefusal, () => AppError> = {
  mission_ended: () => missionEnded('The mission has ended'),
  mission_not_active: () => new AppError(409, 'MISSION_NOT_ACTIVE', 'The mission is paused'),
  participation_ended: () => participationEnded(),
  not_assigned: () => new AppError(409, 'NOT_ASSIGNED', 'The searcher is not assigned to a polygon'),
  task_not_ready: () => new AppError(409, 'TASK_NOT_READY', 'The search task is not at Ready'),
  task_not_searching: () => new AppError(409, 'TASK_NOT_SEARCHING', 'The search task is not searching'),
  task_not_paused: () => new AppError(409, 'TASK_NOT_PAUSED', 'The search task is not paused'),
  task_not_active: () => new AppError(409, 'TASK_NOT_ACTIVE', 'The search task is neither searching nor paused'),
};

type SearcherInput = { missionId: string; searcherId: string };

/**
 * Starts the searcher's search task (UC-F06): Ready becomes Searching. Only an assigned searcher in an active mission
 * may start; Paused and Ended block it. A task already searching is returned as it is.
 */
export function startSearch(deps: ServiceDeps, input: SearcherInput): Promise<OwnParticipation> {
  return moveTask(deps, {
    ...input,
    target: 'searching',
    refuse: (state) => {
      const refusal = startSearchRefusal(state);
      return refusal && REFUSALS[refusal]();
    },
  });
}

/**
 * Personal Pause or Resume (UC-F07): Searching and Paused swap. Tracking for safety goes on either way; the phone
 * labels points taken while paused as safety, so they stay out of Coverage (decision 71). A paused mission outranks a
 * personal Pause: no Resume until the mission is active again.
 */
export function pauseOrResumeSearch(
  deps: ServiceDeps,
  input: SearcherInput & { action: SearchPauseAction },
): Promise<OwnParticipation> {
  const { action, ...searcher } = input;
  return moveTask(deps, {
    ...searcher,
    target: searchPauseTarget(action),
    refuse: (state) => {
      const refusal = searchPauseRefusal(action, state);
      return refusal && REFUSALS[refusal]();
    },
  });
}

/**
 * "סיימתי חיפוש" (UC-F08): Searching or Paused becomes Finished. The searcher stays assigned to the polygon (decision
 * 100), the activity does not end (decision 9) and the polygon is not marked Completed (decision 10); the route and
 * the Coverage already collected stay. The commander decides what comes next.
 */
export function finishSearch(deps: ServiceDeps, input: SearcherInput): Promise<OwnParticipation> {
  return moveTask(deps, {
    ...input,
    target: searchFinishTarget,
    refuse: (state) => {
      const refusal = searchFinishRefusal(state);
      return refusal && REFUSALS[refusal]();
    },
  });
}
