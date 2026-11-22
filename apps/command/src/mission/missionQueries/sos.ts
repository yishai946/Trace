import { Sos, SosList } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { replaceById } from '@trace/mission-cache';
import { missionKeys } from './keys';

const SOS_RETRY_MS = 10_000;

/** The mission's SOS, newest first (UC-C14). Realtime keeps the cached list current. */
export function useSosList(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.sos(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/sos`, { schema: SosList, signal }),
    enabled: !!missionId,
    // The interval below asks again, so a failure shows at once instead of after the default retries.
    retry: false,
    // Whether an SOS is active must not stay unknown: after a failure keep asking until it is known.
    refetchInterval: (query) => (query.state.status === 'error' ? SOS_RETRY_MS : false),
  });
}

/** UC-C14: the commander closes an SOS. The cached list takes the closed SOS at once. */
export function useCloseSos(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sosId }: { missionId: string; sosId: string }) =>
      apiRequest(`/missions/${missionId}/sos/${sosId}/close`, { method: 'POST', schema: Sos }),
    onSuccess: (sos) => queryClient.setQueryData<Sos[]>(missionKeys.sos(missionId), replaceById(sos)),
  });
}
