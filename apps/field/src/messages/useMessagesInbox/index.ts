import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { countNeedingAttention } from '../messageList';
import { useMissionMessages } from '../useMissionMessages';
import { sendReceipt } from '../useMessageReceipt';

/**
 * The mission's messages for the tab layout: reports `delivered` once for every message the phone now holds (also
 * when the searcher is on another tab, UC-F12), and counts the ones that still need the searcher for the tab badge.
 * A failed report is tried again with the next list.
 */
export function useMessagesInbox() {
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt } = useMissionMessages();
  const reported = useRef(new Set<string>());

  useEffect(() => {
    for (const message of data ?? []) {
      if (message.deliveredAt || reported.current.has(message.id)) continue;
      reported.current.add(message.id);
      sendReceipt(queryClient, { messageId: message.id, receipt: 'delivered' }).catch(() => {
        reported.current.delete(message.id);
      });
    }
    // `dataUpdatedAt`: a read that finds the same list still counts as "the next list".
  }, [data, dataUpdatedAt, queryClient]);

  return { unread: countNeedingAttention(data ?? []) };
}
