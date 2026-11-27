import { OwnParticipation } from '@trace/schemas';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { apiBaseUrl, apiRequest } from '../../api';
import { useSession } from '../../state/session';

export type SearchTransition = 'start' | 'pause' | 'resume' | 'finish';

/**
 * Pause and Finish take effect on the server somewhere between sending and the answer, so the phone counts the wait
 * as already paused or finished; Start and Resume count it as not yet started, so fixes taken in the wait never count
 * as search (decision 71).
 */
function changedAt(transition: SearchTransition, sentAt: number): number {
  return transition === 'pause' || transition === 'finish' ? sentAt : Date.now();
}

async function postTransition(transition: SearchTransition) {
  const sentAt = Date.now();
  const { token, missionId } = useSession.getState();
  const participation = await apiRequest(`/missions/${missionId}/participation/search/${transition}`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'POST',
    schema: OwnParticipation,
  });
  return { missionId, participation, changedAt: changedAt(transition, sentAt) };
}

/**
 * Asks the server to move the searcher's task (Start Search, Pause, Resume, Finish) and puts its answer in the session.
 * Nothing changes on the phone until the server agrees. A second tap while a request is on its way is dropped, also
 * one that lands before the screen re-renders.
 */
export function useSearchTransition() {
  const mutation = useMutation({
    mutationFn: postTransition,
    // The answer belongs to the mission it was asked in: after a move to another mission it must not reach that session.
    onSuccess: ({ missionId, participation, changedAt }) => {
      if (useSession.getState().missionId === missionId)
        useSession.getState().updateParticipation(participation, changedAt);
    },
  });
  const inFlight = useRef(false);
  const { mutate } = mutation;
  const run = useCallback(
    (transition: SearchTransition) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate(transition, {
        onSettled: () => {
          inFlight.current = false;
        },
      });
    },
    [mutate],
  );
  return { run, pending: mutation.isPending, failure: mutation.isError ? mutation.error : null };
}
