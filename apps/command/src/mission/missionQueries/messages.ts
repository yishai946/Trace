import { Message, MessageList, TimelineEventList, type SendMessageBody } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { addOnce, prepend } from '@trace/mission-cache';
import { missionKeys, reloadIfMissionEnded } from './keys';

/** The mission's Timeline, oldest first (UC-C19). A successful realtime join invalidates it, so a reconnect refetches. */
export function useTimeline(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.timeline(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/timeline`, { schema: TimelineEventList, signal }),
    enabled: !!missionId,
  });
}

/** The mission's messages with their recipients, newest first (UC-C12). Realtime keeps the cached list current. */
export function useMessages(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.messages(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/messages`, { schema: MessageList, signal }),
    enabled: !!missionId,
  });
}

/** UC-C12: sends a message. The cached list takes it at once, unless realtime already added it. */
export function useSendMessage(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body }: { missionId: string; body: SendMessageBody }) =>
      apiRequest(`/missions/${missionId}/messages`, { method: 'POST', body, schema: Message }),
    onSuccess: (message) => {
      queryClient.setQueryData<Message[]>(missionKeys.messages(missionId), addOnce(message, prepend));
    },
    onError: reloadIfMissionEnded(queryClient),
  });
}
