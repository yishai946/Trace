import { ReportList } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';

/**
 * The reports the server lets the searcher see: those of their polygon and their own (UC-F11, decision 80). Realtime
 * keeps the cached list current; the screen filters it again with the same rule.
 */
export function useMissionReports() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  return useQuery({
    queryKey: missionKeys.reports(missionId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/reports`, { baseUrl: apiBaseUrl, token, schema: ReportList, signal }),
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
}
