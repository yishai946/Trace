import { JoinedMission, JoinPreview, Mission, MissionPolygonList } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBaseUrl, apiRequest } from '../api';
import { useSession } from '../state/session';

export const missionKeys = {
  mission: (missionId: string) => ['missions', missionId] as const,
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
  reports: (missionId: string) => ['missions', missionId, 'reports'] as const,
  joinPreview: (code: string) => ['join', code] as const,
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

/** The searcher's mission: missing person, LKP and rally point. Joining already put it in the cache. */
export function useMission() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  return useQuery({
    queryKey: missionKeys.mission(missionId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/missions/${missionId}`, { baseUrl: apiBaseUrl, token, schema: Mission, signal }),
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
}

/** GET /api/join/:code: the mission behind a join code, shown before the searcher confirms (UC-F02). */
export function useJoinPreview(code: string | null) {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: missionKeys.joinPreview(code ?? ''),
    queryFn: ({ signal }) => apiRequest(`/join/${code}`, { baseUrl: apiBaseUrl, token, schema: JoinPreview, signal }),
    enabled: !!code,
    retry: false,
  });
}

/** POST /api/join/:code: joins the mission, or returns to it when already in (UC-F02), and enters it. */
export function useJoinMission() {
  const token = useSession((s) => s.token);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiRequest(`/join/${code}`, { baseUrl: apiBaseUrl, token, method: 'POST', schema: JoinedMission }),
    onSuccess: ({ mission, participation }) => {
      queryClient.setQueryData(missionKeys.mission(mission.id), mission);
      useSession.getState().enterMission(mission.id, participation);
    },
  });
}
