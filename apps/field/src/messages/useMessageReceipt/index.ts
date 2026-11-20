import { OwnMessage, type MessageReceipt } from '@trace/schemas';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';
import { upsertMessage } from '../messageList';

export interface ReceiptInput {
  messageId: string;
  receipt: MessageReceipt;
}

/** PUT the receipt of one message and put the server's answer in the cached list. Receipts only move forward. */
export function sendReceipt(queryClient: QueryClient, { messageId, receipt }: ReceiptInput): Promise<OwnMessage> {
  const { token, missionId } = useSession.getState();
  return apiRequest(`/missions/${missionId}/participation/messages/${messageId}/receipt`, {
    baseUrl: apiBaseUrl,
    token,
    method: 'PUT',
    body: { receipt },
    schema: OwnMessage,
  }).then((message) => {
    if (missionId) {
      queryClient.setQueryData<OwnMessage[]>(missionKeys.messages(missionId), (list) =>
        upsertMessage(list ?? [], message),
      );
    }
    return message;
  });
}

/**
 * The searcher opens a message (read) or confirms a critical one (acknowledged), UC-F12. `send` drops a tap while a
 * report is on its way, also a second tap that lands before the screen re-renders with `isPending`.
 */
export function useMessageReceipt() {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: (input: ReceiptInput) => sendReceipt(queryClient, input) });
  const inFlight = useRef(false);
  const { mutate } = mutation;
  const send = useCallback(
    (input: ReceiptInput) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutate(input, {
        onSettled: () => {
          inFlight.current = false;
        },
      });
    },
    [mutate],
  );
  return { ...mutation, send };
}
