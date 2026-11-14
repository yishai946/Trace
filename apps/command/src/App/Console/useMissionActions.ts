import { canChangeReport, canSendMessage, isMissionEnded } from '@trace/domain';
import type { Mission, SendMessageBody, UpdateReportBody } from '@trace/schemas';
import { useRef } from 'react';
import {
  assignErrorMessage,
  endErrorMessage,
  messageErrorMessage,
  reportErrorMessage,
} from '../../mission/errorMessage';
import { useAssign, useEndParticipation, useReportMutations, useSendMessage } from '../../mission/missionQueries';

// The mutations here live with the console, not with a page: a failure stays on screen when the commander leaves the
// page and comes back. A handler is undefined when the action is not allowed now (offline, or an ended mission), and
// the page hides it.

/** What the Reports screens (desktop and phone) may do (UC-C11). */
export function useReportActions(mission: Mission | undefined, operational: boolean) {
  const { handle, update, remove } = useReportMutations(mission?.id ?? '');
  const mutations = [handle, update, remove];
  // A mutation's own `isPending` lags a render behind a click: one change at a time runs, a second press is dropped.
  const inFlight = useRef(false);
  const run = (start: (options: { onSettled: () => void }) => void) => {
    if (inFlight.current) return;
    inFlight.current = true;
    start({ onSettled: () => (inFlight.current = false) });
  };
  const changeable = !!mission && operational && canChangeReport(mission.status);
  const failed = mutations.find((m) => m.isError);

  return {
    onHandle: changeable
      ? (id: string) => {
          update.reset();
          remove.reset();
          run((options) => handle.mutate(id, options));
        }
      : undefined,
    onUpdate: changeable
      ? (id: string, body: UpdateReportBody) => {
          handle.reset();
          remove.reset();
          run((options) => update.mutate({ reportId: id, ...body }, options));
        }
      : undefined,
    onDelete: changeable
      ? (id: string) => {
          handle.reset();
          update.reset();
          run((options) => remove.mutate(id, options));
        }
      : undefined,
    busy: mutations.some((m) => m.isPending),
    error: failed ? reportErrorMessage(failed.error) : null,
    ended: !!mission && isMissionEnded(mission.status),
  };
}

/** Assigning a searcher to a polygon (UC-C09) and ending their participation (UC-C18), for the Searchers page. */
export function useSearcherActions(mission: Mission | undefined, operational: boolean) {
  const assign = useAssign(mission?.id ?? '');
  const end = useEndParticipation(mission?.id ?? '');
  // A mutation outlives a switch of mission: only this mission's failure shows.
  const failedHere = (mutation: typeof assign | typeof end) =>
    mutation.isError && mutation.variables?.missionId === mission?.id;

  return {
    onAssign:
      mission && operational && !isMissionEnded(mission.status)
        ? (participantId: string, polygonId: string) => {
            end.reset();
            assign.mutate({ missionId: mission.id, participantId, polygonId });
          }
        : undefined,
    // Tracking continues after the mission ended until Finish Activity, so ending stays possible then.
    onEnd:
      mission && operational
        ? (participantId: string) => {
            assign.reset();
            end.mutate({ missionId: mission.id, participantId });
          }
        : undefined,
    assigning: assign.isPending || end.isPending,
    assignError: failedHere(assign)
      ? assignErrorMessage(assign.error)
      : failedHere(end)
        ? endErrorMessage(end.error)
        : null,
  };
}

/** Sending a message (UC-C12), for the Messages page. */
export function useMessageSending(mission: Mission | undefined, operational: boolean) {
  const send = useSendMessage(mission?.id ?? '');
  return {
    ended: !!mission && isMissionEnded(mission.status),
    onSend:
      mission && operational && canSendMessage(mission.status)
        ? (body: SendMessageBody, onSent: () => void) =>
            send.mutate({ missionId: mission.id, body }, { onSuccess: onSent })
        : undefined,
    sending: send.isPending,
    // A mutation outlives a switch of mission: only this mission's failure shows.
    sendError: send.isError && send.variables?.missionId === mission?.id ? messageErrorMessage(send.error) : null,
  };
}

export type ReportActions = ReturnType<typeof useReportActions>;
export type SearcherActions = ReturnType<typeof useSearcherActions>;
export type MessageSending = ReturnType<typeof useMessageSending>;
