import { SosList } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';

/**
 * The SOS the searcher sees in their mission, newest first: their own and those sent to them (UC-F13, decision 98).
 * It tells the screen whether the searcher already has an active SOS, e.g. after reopening the app. Realtime keeps the
 * cached list current.
 */
export function useMissionSos() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  return useQuery({
    queryKey: missionKeys.sos(missionId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/sos`, { baseUrl: apiBaseUrl, token, schema: SosList, signal }),
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
}
