import { Report, ReportList, type UpdateReportBody } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, apiRequest } from '../../api';
import { removeById, replaceById } from '@trace/mission-cache';
import { missionKeys } from './keys';

/** The mission's reports, newest first (UC-C11). Realtime keeps the cached list current. */
export function useReports(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.reports(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/reports`, { schema: ReportList, signal }),
    enabled: !!missionId,
  });
}

/**
 * Mark Handled, edit and delete a report (UC-C11). The cached list takes each answer at once. An ended mission reloads
 * the missions, so the screen turns read-only; a report that is already gone reloads the list.
 */
export function useReportMutations(missionId: string) {
  const queryClient = useQueryClient();
  const key = missionKeys.reports(missionId);
  const base = `/missions/${missionId}/reports`;
  const replace = (report: Report) => queryClient.setQueryData<Report[]>(key, replaceById(report));
  const onError = (error: unknown) => {
    if (!(error instanceof ApiRequestError)) return undefined;
    if (error.code === 'MISSION_ENDED') return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    if (error.code === 'NOT_FOUND') return queryClient.invalidateQueries({ queryKey: key });
    return undefined;
  };

  return {
    handle: useMutation({
      mutationFn: (reportId: string) => apiRequest(`${base}/${reportId}/handle`, { method: 'POST', schema: Report }),
      onSuccess: replace,
      onError,
    }),
    update: useMutation({
      mutationFn: ({ reportId, ...body }: UpdateReportBody & { reportId: string }) =>
        apiRequest(`${base}/${reportId}`, { method: 'PATCH', body, schema: Report }),
      onSuccess: replace,
      onError,
    }),
    remove: useMutation({
      mutationFn: (reportId: string) => apiRequest(`${base}/${reportId}`, { method: 'DELETE' }),
      onSuccess: (_, reportId) => queryClient.setQueryData<Report[]>(key, removeById(reportId)),
      onError,
    }),
  };
}
