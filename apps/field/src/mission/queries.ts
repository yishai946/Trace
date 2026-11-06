import { MissionPolygonList } from '@trace/schemas';
import { useQuery } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../api';
import { useSession } from '../state/session';

export const missionKeys = {
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
};

/** The polygons of the searcher's mission. Waits until the searcher signed in and joined a mission. */
export function useMissionPolygons() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  return useQuery({
    queryKey: missionKeys.polygons(missionId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}/polygons`, {
        baseUrl: apiBaseUrl,
        token,
        schema: MissionPolygonList,
        signal,
      }),
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
}
