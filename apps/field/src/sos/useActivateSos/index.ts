import { Sos, type CreateSosBody } from '@trace/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';
import { upsertSos } from '../sosList';

/**
 * Sends an SOS (UC-F13). It needs the server: sending with no connection is UC-F13's alternative flow (#84), so a
 * failure is shown and nothing is queued. The API answers 200 with the active SOS when the searcher already has one,
 * so a second send is safe; either way the answer goes into the cached list.
 */
export function useActivateSos() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSosBody) =>
      apiRequest(`/missions/${missionId}/sos`, { baseUrl: apiBaseUrl, token, method: 'POST', body, schema: Sos }),
    onSuccess: (sos) => {
      if (!missionId) return;
      queryClient.setQueryData<Sos[]>(missionKeys.sos(missionId), (list) => upsertSos(list ?? [], sos));
    },
  });
}
