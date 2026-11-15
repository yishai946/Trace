import { Participant, ParticipantList } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { replaceById } from './cache';
import { missionKeys } from './keys';

export function useParticipants(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.participants(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/participants`, { schema: ParticipantList, signal }),
    enabled: !!missionId,
  });
}

/** The cached pool takes the changed searcher at once; the polygons, with their searcher counts, are fetched again. */
const saveParticipant = (queryClient: QueryClient, missionId: string) => (participant: Participant) => {
  queryClient.setQueryData<Participant[]>(missionKeys.participants(missionId), replaceById(participant));
  return queryClient.invalidateQueries({ queryKey: missionKeys.polygons(missionId) });
};

/** UC-C09: assigns a searcher to a polygon or moves them. */
export function useAssign(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, polygonId }: { missionId: string; participantId: string; polygonId: string }) =>
      apiRequest(`/missions/${missionId}/participants/${participantId}/assignment`, {
        method: 'PUT',
        body: { polygonId },
        schema: Participant,
      }),
    onSuccess: saveParticipant(queryClient, missionId),
  });
}

/** UC-C18: ends a searcher's participation. */
export function useEndParticipation(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId }: { missionId: string; participantId: string }) =>
      apiRequest(`/missions/${missionId}/participants/${participantId}/end`, { method: 'POST', schema: Participant }),
    onSuccess: saveParticipant(queryClient, missionId),
  });
}
