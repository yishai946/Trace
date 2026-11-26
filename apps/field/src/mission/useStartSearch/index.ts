import { OwnParticipation, type ErrorCode } from '@trace/schemas';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { ApiRequestError, apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';

const MESSAGES: Partial<Record<ErrorCode | 'NETWORK_ERROR', string>> = {
  NETWORK_ERROR: 'אין חיבור לשרת. החיפוש לא התחיל, נסו שוב.',
  MISSION_NOT_ACTIVE: 'המסע מושהה. אפשר להתחיל חיפוש רק כשהוא פעיל.',
  MISSION_ENDED: 'המסע הסתיים.',
  PARTICIPATION_ENDED: 'הפעילות שלך במסע הסתיימה.',
  NOT_ASSIGNED: 'המנהל עדיין לא שיבץ אותך לפוליגון.',
  TASK_NOT_READY: 'משימת החיפוש כבר התחילה. רעננו את המסך.',
};

/** A Hebrew message for a refused or failed Start Search (UC-F06). */
export function startSearchError(error: unknown): string {
  return (error instanceof ApiRequestError && MESSAGES[error.code]) || 'החיפוש לא התחיל. נסו שוב.';
}

function postStartSearch(): Promise<OwnParticipation> {
  const { token, missionId } = useSession.getState();
  return apiRequest(`/missions/${missionId}/participation/search/start`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'POST',
    schema: OwnParticipation,
  });
}

/**
 * "התחל חיפוש" (UC-F06): the server moves the task to Searching, and the session then turns background GPS and route
 * recording on (`useLocationTracking` follows `tracking`). Nothing changes on the phone until the server agrees. A
 * second tap while a request is on its way is dropped, also one that lands before the screen re-renders.
 */
export function useStartSearch() {
  const mutation = useMutation({
    mutationFn: postStartSearch,
    onSuccess: (participation) => useSession.getState().updateParticipation(participation),
  });
  const inFlight = useRef(false);
  const { mutate } = mutation;
  const start = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutate(undefined, {
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }, [mutate]);
  return { start, starting: mutation.isPending, error: mutation.isError ? startSearchError(mutation.error) : null };
}
