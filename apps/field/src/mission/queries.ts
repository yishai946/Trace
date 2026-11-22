import { JoinedMission, JoinPreview, Mission, MissionPolygonList, OwnParticipation } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { missionDataKeys } from '@trace/mission-cache';
import { apiBaseUrl, apiRequest } from '../api';
import { useSavedMission, useSavedPolygons } from '../offline/savedPackage';
import { refreshStep } from '../offline/store';
import { withSaved } from '../offline/withSaved';
import { useSession } from '../state/session';

export const missionKeys = { ...missionDataKeys, joinPreview: (code: string) => ['join', code] as const };

/** The polygons of the searcher's mission. Waits until the searcher signed in and joined a mission. */
/** The searcher's own participation in a mission (their assignment and status), read from the server. */
export function fetchOwnParticipation(missionId: string, token: string) {
  return apiRequest(`/missions/${missionId}/participation`, { baseUrl: apiBaseUrl, token, schema: OwnParticipation });
}

export function useMissionPolygons() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const query = useQuery({
    queryKey: missionKeys.polygons(missionId ?? ''),
    queryFn: async ({ signal }) => {
      const polygons = await apiRequest(`/missions/${missionId}/polygons`, {
        baseUrl: apiBaseUrl,
        token,
        schema: MissionPolygonList,
        signal,
      });
      // What the searcher saw last is what shows without a connection (UC-F04).
      if (missionId) void refreshStep(missionId, 'polygons', polygons);
      return polygons;
    },
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
  // Without a connection the copy saved by the offline package shows (UC-F04).
  return withSaved(query, useSavedPolygons());
}

/** The searcher's mission: missing person, LKP and rally point. Joining already put it in the cache. */
export function useMission() {
  const token = useSession((s) => s.token);
  const missionId = useSession((s) => s.missionId);
  const query = useQuery({
    queryKey: missionKeys.mission(missionId ?? ''),
    queryFn: async ({ signal }) => {
      const mission = await apiRequest(`/missions/${missionId}`, {
        baseUrl: apiBaseUrl,
        token,
        schema: Mission,
        signal,
      });
      if (missionId) void refreshStep(missionId, 'mission', mission);
      return mission;
    },
    enabled: !!token && !!missionId && !!apiBaseUrl,
  });
  return withSaved(query, useSavedMission());
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
