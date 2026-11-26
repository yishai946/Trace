import { OwnParticipation } from '@trace/schemas';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { ApiRequestError, apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';
import { syncOutbox } from '../../tracking';

/** A Hebrew message for a failed "סיימתי פעילות" (UC-F15). */
export function finishActivityError(error: unknown): string {
  if (error instanceof ApiRequestError && error.code === 'NETWORK_ERROR') {
    return 'אין חיבור לשרת. הפעילות לא הסתיימה, נסו שוב.';
  }
  return 'הפעולה לא הושלמה. נסו שוב.';
}

async function postFinishActivity() {
  // What the phone collected goes first: the server refuses points once the activity ended.
  await syncOutbox();
  const { token, missionId } = useSession.getState();
  const participation = await apiRequest(`/missions/${missionId}/participation/finish-activity`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'POST',
    schema: OwnParticipation,
  });
  return { missionId, participation };
}

/**
 * "סיימתי פעילות / יצאתי מהשטח" (UC-F15): the server ends the participation, and the session then stops the background
 * tracking and shows Fm13. Nothing changes on the phone until the server agrees. A second tap while the request is on
 * its way is dropped. The searcher ended it themselves, so the "removed by the commander" notice is cleared.
 */
export function useFinishActivity() {
  const mutation = useMutation({
    mutationFn: postFinishActivity,
    // The answer belongs to the mission it was asked in: after a move to another mission it must not reach that session.
    onSuccess: ({ missionId, participation }) => {
      const session = useSession.getState();
      if (session.missionId !== missionId) return;
      session.updateParticipation(participation);
      session.dismissAssignmentNotice();
    },
  });
  const inFlight = useRef(false);
  const { mutate } = mutation;
  const finish = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    mutate(undefined, {
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }, [mutate]);
  return { finish, pending: mutation.isPending, error: mutation.isError ? finishActivityError(mutation.error) : null };
}
