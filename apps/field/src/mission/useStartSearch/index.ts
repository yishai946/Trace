import type { ErrorCode } from '@trace/schemas';
import { useCallback } from 'react';
import { ApiRequestError } from '../../api';
import { useSearchTransition } from '../searchTransition';

const MESSAGES: Partial<Record<ErrorCode | 'NETWORK_ERROR', string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. החיפוש לא התחיל, נסו שוב.',
  MISSION_NOT_ACTIVE: 'המסע מושהה. אפשר להתחיל חיפוש רק כשהוא פעיל.',
  MISSION_ENDED: 'המסע הסתיים.',
  PARTICIPATION_ENDED: 'הפעילות שלך במסע הסתיימה.',
  NOT_ASSIGNED: 'המנהל עדיין לא שיבץ אותך לפוליגון.',
  TASK_NOT_READY: 'אי אפשר להתחיל חיפוש במצב הנוכחי. רעננו את המסך.',
};

/** A Hebrew message for a refused or failed Start Search (UC-F06). */
export function startSearchError(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'החיפוש לא התחיל. נסו שוב.';
}

/**
 * "התחל חיפוש" (UC-F06): the server moves the task to Searching, and the session then turns background GPS and route
 * recording on (`useLocationTracking` follows `tracking`).
 */
export function useStartSearch() {
  const { run, pending, failure } = useSearchTransition();
  const start = useCallback(() => run('start'), [run]);
  return { start, starting: pending, error: failure ? startSearchError(failure) : null };
}
