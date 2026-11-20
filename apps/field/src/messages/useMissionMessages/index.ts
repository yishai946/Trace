import { OwnMessageList } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';

/**
 * The operational messages sent to the searcher, newest first (UC-F12). Realtime adds new ones and every reconnect
 * reads the list again, so a message sent while the phone was offline arrives with the connection (decision 77).
 */
export function useMissionMessages() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  return useQuery({
    queryKey: missionKeys.messages(missionId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/participation/messages`, {
        baseUrl: apiBaseUrl,
        token,
        schema: OwnMessageList,
        signal,
      }),
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
}
