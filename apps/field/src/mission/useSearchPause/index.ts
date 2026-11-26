import type { ErrorCode } from '@trace/schemas';
import { useCallback } from 'react';
import { ApiRequestError } from '../../api';
import { useSearchTransition } from '../searchTransition';

const MESSAGES: Partial<Record<ErrorCode | 'NETWORK_ERROR', string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. המצב לא השתנה, נסו שוב.',
  MISSION_NOT_ACTIVE: 'המסע מושהה. אפשר להמשיך חיפוש רק כשהמסע פעיל.',
  MISSION_ENDED: 'המסע הסתיים.',
  PARTICIPATION_ENDED: 'הפעילות שלך במסע הסתיימה.',
  NOT_ASSIGNED: 'המנהל עדיין לא שיבץ אותך לפוליגון.',
  TASK_NOT_SEARCHING: 'אי אפשר להשהות חיפוש במצב הנוכחי. רעננו את המסך.',
  TASK_NOT_PAUSED: 'אי אפשר להמשיך חיפוש במצב הנוכחי. רעננו את המסך.',
};

/** A Hebrew message for a refused or failed Pause or Resume (UC-F07). */
export function searchPauseError(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'הפעולה לא הושלמה. נסו שוב.';
}

/**
 * "השהה" and "המשך חיפוש" (UC-F07): the server swaps Searching and Paused; safety tracking goes on in both, and what
 * the phone records while paused is labelled safety so it stays out of Coverage (decision 71). The screen changes
 * only when the server agrees.
 */
export function useSearchPause() {
  const { run, pending, failure } = useSearchTransition();
  const pause = useCallback(() => run('pause'), [run]);
  const resume = useCallback(() => run('resume'), [run]);
  return { pause, resume, pending, error: failure ? searchPauseError(failure) : null };
}
