import { isMissionEnded, type MissionStatus } from '../mission';
import type { ParticipationStatus, TaskStatus } from '../participation';

export type SearchPauseAction = 'pause' | 'resume';

export type SearchPauseRefusal =
  | 'mission_ended'
  | 'mission_not_active'
  | 'participation_ended'
  | 'not_assigned'
  | 'task_not_searching'
  | 'task_not_paused';

export interface SearchPauseState {
  missionStatus: MissionStatus;
  participationStatus: ParticipationStatus;
  taskStatus: TaskStatus | null;
}

/** The task status a personal Pause or Resume leads to (UC-F07): Searching and Paused swap, nothing else moves. */
export function searchPauseTarget(action: SearchPauseAction): TaskStatus {
  return action === 'pause' ? 'paused' : 'searching';
}

/**
 * Why the server refuses a personal Pause or Resume (UC-F07), or null when it accepts. Pause needs a task at
 * Searching, Resume a task at Paused. The mission must be active: a mission Pause outranks a personal one, so a
 * searcher cannot resume while the mission is paused, and an ended mission or activity accepts neither.
 */
export function searchPauseRefusal(action: SearchPauseAction, state: SearchPauseState): SearchPauseRefusal | null {
  if (isMissionEnded(state.missionStatus)) return 'mission_ended';
  if (state.missionStatus !== 'active') return 'mission_not_active';
  if (state.participationStatus === 'ended') return 'participation_ended';
  if (state.participationStatus !== 'assigned') return 'not_assigned';
  if (action === 'pause') return state.taskStatus === 'searching' ? null : 'task_not_searching';
  return state.taskStatus === 'paused' ? null : 'task_not_paused';
}
