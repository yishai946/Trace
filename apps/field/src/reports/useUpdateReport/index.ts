import { Report, type UpdateReportBody } from '@trace/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';

/**
 * The author edits the category or the text of their report (UC-C11, decision 88). It needs the server: an edit is not
 * kept on the phone. The saved report replaces the cached one; the live event brings it to everyone else.
 */
export function useUpdateReport() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, body }: { reportId: string; body: UpdateReportBody }) =>
      apiRequest(`/missions/${missionId}/reports/${reportId}`, {
        baseUrl: apiBaseUrl,
        token,
        method: 'PATCH',
        body,
        schema: Report,
      }),
    onSuccess: (saved) => {
      if (!missionId) return;
      queryClient.setQueryData<Report[]>(missionKeys.reports(missionId), (list) =>
        list?.map((report) => (report.id === saved.id ? saved : report)),
      );
    },
  });
}
