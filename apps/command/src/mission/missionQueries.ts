import {
  MissionList,
  MissionPolygon,
  MissionPolygonList,
  ParticipantList,
  type CreatePolygonBody,
  type UpdatePolygonBody,
} from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../api';

export const missionKeys = {
  all: ['missions'] as const,
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
  participants: (missionId: string) => ['missions', missionId, 'participants'] as const,
};

export function useMissions() {
  return useQuery({
    queryKey: missionKeys.all,
    queryFn: ({ signal }) => apiRequest('/missions', { schema: MissionList, signal }),
  });
}

export function usePolygons(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.polygons(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/polygons`, { schema: MissionPolygonList, signal }),
    enabled: !!missionId,
  });
}

export function useParticipants(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.participants(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/participants`, { schema: ParticipantList, signal }),
    enabled: !!missionId,
  });
}

/** Create, update and delete polygons. Each success refreshes the mission's polygon list. */
export function usePolygonMutations(missionId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: missionKeys.polygons(missionId) });
  const base = `/missions/${missionId}/polygons`;

  return {
    create: useMutation({
      mutationFn: (body: CreatePolygonBody) => apiRequest(base, { method: 'POST', body, schema: MissionPolygon }),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({ polygonId, ...body }: UpdatePolygonBody & { polygonId: string }) =>
        apiRequest(`${base}/${polygonId}`, { method: 'PATCH', body, schema: MissionPolygon }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (polygonId: string) => apiRequest(`${base}/${polygonId}`, { method: 'DELETE' }),
      onSuccess,
    }),
  };
}
