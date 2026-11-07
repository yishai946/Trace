import {
  Mission,
  MissionList,
  MissionPolygon,
  MissionPolygonList,
  ParticipantList,
  type CreateMissionBody,
  type CreatePolygonBody,
  type UpdatePolygonBody,
} from '@trace/schemas';
import type { LngLat } from '@trace/geo';
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

/**
 * Creates a mission (UC-C02), then uploads the missing person's photo when there is one. The mission exists even if
 * the photo fails; `photoFailed` tells the caller to say so.
 */
export function useCreateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, photo }: { body: CreateMissionBody; photo: File | null }) => {
      const created = await apiRequest('/missions', { method: 'POST', body, schema: Mission });
      if (!photo) return { mission: created, photoFailed: false };
      try {
        const withPhoto = await apiRequest(`/missions/${created.id}/photo`, {
          method: 'PUT',
          body: photo,
          schema: Mission,
        });
        return { mission: withPhoto, photoFailed: false };
      } catch {
        return { mission: created, photoFailed: true };
      }
    },
    onSuccess: ({ mission }) => {
      // The new mission opens at once, before the list is fetched again.
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) => [mission, ...(list ?? [])]);
      return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    },
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

/** Moves the mission's rally point (UC-C05). The saved mission replaces the cached one at once. */
export function useUpdateRallyPoint(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (coordinates: LngLat) =>
      apiRequest(`/missions/${missionId}/rally-point`, {
        method: 'PUT',
        body: { rallyPoint: { type: 'Point', coordinates } },
        schema: Mission,
      }),
    onSuccess: (mission) => {
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) =>
        list?.map((m) => (m.id === mission.id ? mission : m)),
      );
      return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}
