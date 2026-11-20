import { Sos, SosList } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { replaceById } from './cache';
import { missionKeys } from './keys';

/** The mission's SOS, newest first (UC-C14). Realtime keeps the cached list current. */
export function useSosList(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.sos(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/sos`, { schema: SosList, signal }),
    enabled: !!missionId,
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
