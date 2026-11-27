import { isMissionEnded } from '@trace/domain';
import { MissionList, OwnActivity } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../api';
import { useSession } from '../state/session';

export const historyKeys = {
  missions: ['history', 'missions'] as const,
  activity: (missionId: string) => ['history', 'activity', missionId] as const,
};

/** The missions the searcher took part in that ended, newest first: their history (UC-F17). Read-only. */
export function useEndedMissions() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: historyKeys.missions,
    queryFn: ({ signal }) => apiRequest('/missions', { baseUrl: apiBaseUrl, token, schema: MissionList, signal }),
    select: (missions) => missions.filter((mission) => isMissionEnded(mission.status)),
    enabled: !!token && !!apiBaseUrl,
  });
}

/** What the searcher did in one ended mission: their own participation, reports and sightings (UC-F17). */
export function useOwnActivity(missionId: string) {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: historyKeys.activity(missionId),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/my-activity`, { baseUrl: apiBaseUrl, token, schema: OwnActivity, signal }),
    enabled: !!token && !!apiBaseUrl,
  });
}
