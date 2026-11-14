import {
  LkpDecisionResult,
  LkpPointList,
  Sighting,
  SightingList,
  type CreateSightingBody,
  type LkpDecision,
  type Mission,
} from '@trace/schemas';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type MutateOptions,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useRef } from 'react';
import { apiRequest } from '../../api';
import { addOnce, patchById } from './cache';
import { missionKeys } from './keys';

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
      queryClient.setQueryData<Sighting[]>(missionKeys.sightings(missionId), addOnce(sighting));
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
      queryClient.setQueryData<Mission[]>(
        missionKeys.all,
        patchById(missionId, (mission) => ({ ...mission, lkp })),
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
