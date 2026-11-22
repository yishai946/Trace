import { ReportList } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSavedReports } from '../../offline/savedPackage';
import { saveReports } from '../../offline/store';
import { withSaved } from '../../offline/withSaved';
import { useSession } from '../../state/session';

/**
 * The reports the server lets the searcher see: those of their polygon and their own (UC-F11, decision 80). Realtime
 * keeps the cached list current and every version of it is saved on the phone, so without a connection the list the
 * searcher last saw shows, marked as possibly out of date (decision 22). The screen filters it with the same rule.
 */
export function useMissionReports() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const query = useQuery({
    queryKey: missionKeys.reports(missionId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/reports`, { baseUrl: apiBaseUrl, token, schema: ReportList, signal }),
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
  const data = query.data;
  // Once the activity ended the phone was cleared: a later answer must not put the reports back.
  const ended = useSession((s) => s.participation?.status === 'ended');
  useEffect(() => {
    if (missionId && data && !ended) void saveReports(missionId, data);
  }, [missionId, data, ended]);
  const result = withSaved(query, useSavedReports());
  // The list in memory is out of date too when the refresh after it failed.
  return { ...result, notUpToDate: result.notUpToDate || (query.isError && data !== undefined) };
}
