import { ParticipantTrack } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { missionKeys } from './keys';

/** A searcher's route, oldest point first (UC-C10). New points arrive as `participant.tracked`. */
export function useParticipantTrack(missionId: string, participantId: string | null) {
  return useQuery({
    queryKey: missionKeys.track(missionId, participantId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/participants/${participantId}/track`, { schema: ParticipantTrack, signal }),
    enabled: participantId !== null,
  });
}
