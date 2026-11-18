import { Sos } from '@trace/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';
import { upsertSos } from '../sosList';

/** The searcher closes their own SOS (UC-F13, decision 99). The closed SOS replaces the active one in the cached list. */
export function useCloseSos() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sosId: string) =>
      apiRequest(`/missions/${missionId}/sos/${sosId}/close`, {
        baseUrl: apiBaseUrl,
        token,
        method: 'POST',
        schema: Sos,
      }),
    onSuccess: (sos) => {
      if (!missionId) return;
      queryClient.setQueryData<Sos[]>(missionKeys.sos(missionId), (list) => upsertSos(list ?? [], sos));
    },
  });
}
