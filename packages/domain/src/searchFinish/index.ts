import type { TaskStatus } from '../participation';
import { searchPauseRefusal, type SearchPauseRefusal, type SearchPauseState } from '../searchPause';

export type SearchFinishState = SearchPauseState;
export type SearchFinishRefusal =
  Exclude<SearchPauseRefusal, 'task_not_searching' | 'task_not_paused'> | 'task_not_active';

/** The task status "סיימתי חיפוש" leads to (UC-F08). The assignment and the polygon are not touched (decisions 9, 10, 100). */
export const searchFinishTarget: TaskStatus = 'finished';

/**
 * Why the server refuses "סיימתי חיפוש" (UC-F08), or null when it accepts: the task must be Searching or Paused.
 * Like a personal Pause it needs an active mission and an assigned searcher.
 */
export function searchFinishRefusal(state: SearchFinishState): SearchFinishRefusal | null {
  // Only the task status differs from Pause: judge the shared conditions as if the task were searching.
  const refusal = searchPauseRefusal('pause', { ...state, taskStatus: 'searching' });
  if (refusal === 'task_not_searching' || refusal === 'task_not_paused') return 'task_not_active';
  if (refusal) return refusal;
  return state.taskStatus === 'searching' || state.taskStatus === 'paused' ? null : 'task_not_active';
}
