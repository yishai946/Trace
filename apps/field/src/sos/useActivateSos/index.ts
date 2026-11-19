import { Sos, type CreateSosBody } from '@trace/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getNetworkStateAsync } from 'expo-network';
import { apiBaseUrl, apiRequest, ApiRequestError } from '../../api';
import { missionKeys } from '../../mission/queries';
import { useSession } from '../../state/session';
import { upsertSos } from '../sosList';

/**
 * Sends an SOS (UC-F13). It needs the server. With no connection it fails at once with `NETWORK_ERROR` instead of
 * waiting for a request that cannot work, and nothing is queued: UC-F13's Offline flow says the SOS was not delivered and
 * offers to dial instead (#84). An SOS sent late, after the connection is back, could mislead the commander. The API answers 200 with the active SOS when the searcher already has one,
 * so a second send is safe; either way the answer goes into the cached list.
 */
export function useActivateSos() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateSosBody) => {
      const network = await getNetworkStateAsync();
      if (!network.isConnected || network.isInternetReachable === false) {
        throw new ApiRequestError(0, 'NETWORK_ERROR', 'No connection');
      }
      return apiRequest(`/missions/${missionId}/sos`, {
        baseUrl: apiBaseUrl,
        token,
        method: 'POST',
        body,
        schema: Sos,
      });
    },
    onSuccess: (sos) => {
      if (!missionId) return;
      queryClient.setQueryData<Sos[]>(missionKeys.sos(missionId), (list) => upsertSos(list ?? [], sos));
    },
  });
}
