import { useCallback } from 'react';
import { ApiRequestError } from '../../api';
import { useSearchTransition } from '../searchTransition';
import { searchPauseError } from '../useSearchPause';

/** A Hebrew message for a refused or failed "סיימתי חיפוש" (UC-F08); the causes it shares with Pause read the same. */
export function searchFinishError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === 'TASK_NOT_ACTIVE') return 'אי אפשר לסיים חיפוש במצב הנוכחי. רעננו את המסך.';
    if (error.code === 'MISSION_NOT_ACTIVE') return 'המסע מושהה. אפשר לסיים חיפוש רק כשהמסע פעיל.';
  }
  return searchPauseError(error);
}

/**
 * "סיימתי חיפוש" (UC-F08): the server moves the task to Finished. The searcher stays assigned to the polygon and the
 * route and Coverage stay; the commander decides what comes next. The screen changes only when the server agrees.
 */
export function useSearchFinish() {
  const { run, pending, failure } = useSearchTransition();
  const finish = useCallback(() => run('finish'), [run]);
  return { finish, pending, error: failure ? searchFinishError(failure) : null };
}
