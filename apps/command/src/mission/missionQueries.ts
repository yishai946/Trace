import {
  LkpDecisionResult,
  LkpPointList,
  Mission,
  MissionList,
  MissionPolygon,
  MissionPolygonList,
  Participant,
  ParticipantList,
  Sighting,
  SightingList,
  TimelineEventList,
  type CreateMissionBody,
  type CreatePolygonBody,
  type CreateSightingBody,
  type LkpDecision,
  type UpdateMissionDetailsBody,
  type UpdatePolygonBody,
} from '@trace/schemas';
import type { LngLat } from '@trace/geo';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutateOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useRef } from 'react';
import { ApiRequestError, apiRequest } from '../api';

export const missionKeys = {
  all: ['missions'] as const,
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
  participants: (missionId: string) => ['missions', missionId, 'participants'] as const,
  sightings: (missionId: string) => ['missions', missionId, 'sightings'] as const,
  lkps: (missionId: string) => ['missions', missionId, 'lkps'] as const,
  timeline: (missionId: string) => ['missions', missionId, 'timeline'] as const,
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

/**
 * Saves the mission and missing-person details (UC-C03), then uploads the new photo when one was chosen. The details
 * are saved even if the photo fails; `photoFailed` tells the caller to say so. The saved mission replaces the cached one.
 */
export function useUpdateMissionDetails(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, photo }: { body: UpdateMissionDetailsBody; photo: File | null }) => {
      const saved = await apiRequest(`/missions/${missionId}/details`, { method: 'PUT', body, schema: Mission });
      if (!photo) return { mission: saved, photoFailed: false };
      try {
        const withPhoto = await apiRequest(`/missions/${missionId}/photo`, {
          method: 'PUT',
          body: photo,
          schema: Mission,
        });
        return { mission: withPhoto, photoFailed: false };
      } catch {
        return { mission: saved, photoFailed: true };
      }
    },
    onSuccess: ({ mission }) => {
      queryClient.setQueryData<Mission[]>(missionKeys.all, (list) =>
        list?.map((m) => (m.id === mission.id ? mission : m)),
      );
      return queryClient.invalidateQueries({ queryKey: missionKeys.all });
    },
    // The mission ended meanwhile: reload it, so the screen turns read-only.
    onError: (error) =>
      error instanceof ApiRequestError && error.code === 'MISSION_ENDED'
        ? queryClient.invalidateQueries({ queryKey: missionKeys.all })
        : undefined,
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

/** UC-C09: assigns a searcher to a polygon or moves them. The cached pool takes the answer at once. */
export function useAssign(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId, polygonId }: { missionId: string; participantId: string; polygonId: string }) =>
      apiRequest(`/missions/${missionId}/participants/${participantId}/assignment`, {
        method: 'PUT',
        body: { polygonId },
        schema: Participant,
      }),
    onSuccess: (participant) => {
      queryClient.setQueryData<Participant[]>(missionKeys.participants(missionId), (list) =>
        list?.map((p) => (p.id === participant.id ? participant : p)),
      );
      return queryClient.invalidateQueries({ queryKey: missionKeys.polygons(missionId) });
    },
  });
}

/** UC-C18: ends a searcher's participation. The cached pool takes the answer at once. */
export function useEndParticipation(missionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ participantId }: { missionId: string; participantId: string }) =>
      apiRequest(`/missions/${missionId}/participants/${participantId}/end`, { method: 'POST', schema: Participant }),
    onSuccess: (participant) => {
      queryClient.setQueryData<Participant[]>(missionKeys.participants(missionId), (list) =>
        list?.map((p) => (p.id === participant.id ? participant : p)),
      );
      return queryClient.invalidateQueries({ queryKey: missionKeys.polygons(missionId) });
    },
  });
}

/** The mission's Timeline, oldest first (UC-C19). A successful realtime join invalidates it, so a reconnect refetches. */
export function useTimeline(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.timeline(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/timeline`, { schema: TimelineEventList, signal }),
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
