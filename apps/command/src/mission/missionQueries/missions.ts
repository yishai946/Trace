import type { LngLat } from '@trace/geo';
import { Mission, MissionList, type CreateMissionBody, type UpdateMissionDetailsBody } from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { replaceById } from './cache';
import { missionKeys, reloadIfMissionEnded } from './keys';

export function useMissions() {
  return useQuery({
    queryKey: missionKeys.all,
    queryFn: ({ signal }) => apiRequest('/missions', { schema: MissionList, signal }),
  });
}

/** Uploads the missing person's photo, when one was chosen. The saved mission stands even if the photo fails. */
async function withPhoto(saved: Mission, photo: File | null): Promise<{ mission: Mission; photoFailed: boolean }> {
  if (!photo) return { mission: saved, photoFailed: false };
  try {
    const mission = await apiRequest(`/missions/${saved.id}/photo`, { method: 'PUT', body: photo, schema: Mission });
    return { mission, photoFailed: false };
  } catch {
    return { mission: saved, photoFailed: true };
  }
}

/**
 * Creates a mission (UC-C02), then uploads the missing person's photo when there is one. The mission exists even if
 * the photo fails; `photoFailed` tells the caller to say so.
 */
export function useCreateMission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, photo }: { body: CreateMissionBody; photo: File | null }) =>
      withPhoto(await apiRequest('/missions', { method: 'POST', body, schema: Mission }), photo),
    onSuccess: ({ mission }) => {
      // The new mission opens at once, before the list is fetched again.
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) => [mission, ...(list ?? [])]);
      return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}

/**
 * Saves the mission and missing-person details (UC-C03), then uploads the new photo when one was chosen. The details
 * are saved even if the photo fails; `photoFailed` tells the caller to say so. The saved mission replaces the cached one.
 */
export function useUpdateMissionDetails(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, photo }: { body: UpdateMissionDetailsBody; photo: File | null }) =>
      withPhoto(await apiRequest(`/missions/${missionId}/details`, { method: 'PUT', body, schema: Mission }), photo),
    onSuccess: ({ mission }) => {
      queryClient.setQueryData<Mission[]>(missionKeys.all, replaceById(mission));
      return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    },
    onError: reloadIfMissionEnded(queryClient),
  });
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
      queryClient.setQueryData<Mission[]>(missionKeys.all, replaceById(mission));
      return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    },
  });
}
