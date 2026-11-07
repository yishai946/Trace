import {
  LkpDecisionResult,
  LkpPointList,
  Mission,
  MissionList,
  MissionPolygon,
  MissionPolygonList,
  ParticipantList,
  Sighting,
  SightingList,
  type CreateMissionBody,
  type CreatePolygonBody,
  type CreateSightingBody,
  type LkpDecision,
  type UpdatePolygonBody,
} from '@trace/schemas';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutateOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useRef } from 'react';
import { apiRequest } from '../api';

export const missionKeys = {
  all: ['missions'] as const,
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
  participants: (missionId: string) => ['missions', missionId, 'participants'] as const,
  sightings: (missionId: string) => ['missions', missionId, 'sightings'] as const,
  lkps: (missionId: string) => ['missions', missionId, 'lkps'] as const,
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

export function useSightings(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.sightings(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/sightings`, { schema: SightingList, signal }),
    enabled: !!missionId,
  });
}

/** Every LKP the mission had, newest first; the first is the current one. */
export function useLkps(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.lkps(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/lkps`, { schema: LkpPointList, signal }),
    enabled: !!missionId,
  });
}

/** Add a sighting, and accept or reject making it the new LKP (UC-C04). */
export function useSightingMutations(missionId: string) {
  const queryClient = useQueryClient();
  const base = `/missions/${missionId}/sightings`;

  const create = useMutation({
    mutationFn: (body: CreateSightingBody) => apiRequest(base, { method: 'POST', body, schema: Sighting }),
    onSuccess: (sighting) => {
      // It shows on the map at once (decision 62), before the list is fetched again.
      queryClient.setQueryData<Sighting[]>(missionKeys.sightings(missionId), (list) =>
        list && !list.some((s) => s.id === sighting.id) ? [...list, sighting] : list,
      );
      return queryClient.invalidateQueries({ queryKey: missionKeys.sightings(missionId) });
    },
  });
  const decide = useMutation({
    mutationFn: ({ sightingId, decision }: { sightingId: string; decision: LkpDecision }) =>
      apiRequest(`${base}/${sightingId}/lkp-decision`, {
        method: 'PUT',
        body: { decision },
        schema: LkpDecisionResult,
      }),
    onSuccess: ({ lkp }) => {
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) =>
        list?.map((m) => (m.id === missionId ? { ...m, lkp } : m)),
      );
      // Other sightings may stop being candidates, so the server's answer replaces the cached list.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: missionKeys.lkps(missionId) }),
        queryClient.invalidateQueries({ queryKey: missionKeys.sightings(missionId) }),
      ]);
    },
  });

  // The mutations' own `isPending` lags a render behind a click, so a quick second click would send the request twice
  // (and the second one would fail). One request at a time runs; a start while another is running is dropped.
  const inFlight = useRef(false);
  const once =
    <D, V>(mutation: UseMutationResult<D, Error, V>) =>
    (variables: V, options?: MutateOptions<D, Error, V>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      mutation.mutate(variables, {
        ...options,
        onSettled: (...args) => {
          inFlight.current = false;
          options?.onSettled?.(...args);
        },
      });
    };

  return { create: once(create), decide: once(decide), isPending: create.isPending || decide.isPending };
}
