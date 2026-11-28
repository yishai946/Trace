import {
  MissionPolygon,
  MissionPolygonList,
  type CreatePolygonBody,
  type SetPolygonStatusBody,
  type UpdatePolygonBody,
} from '@trace/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api';
import { missionKeys } from './keys';

export function usePolygons(missionId: string | undefined) {
  return useQuery({
    queryKey: missionKeys.polygons(missionId ?? ''),
    queryFn: ({ signal }) => apiRequest(`/missions/${missionId}/polygons`, { schema: MissionPolygonList, signal }),
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
    setStatus: useMutation({
      mutationFn: ({ polygonId, ...body }: SetPolygonStatusBody & { polygonId: string }) =>
        apiRequest(`${base}/${polygonId}/status`, { method: 'PUT', body, schema: MissionPolygon }),
      // Completing ends searchers' tasks, so their list refreshes too.
      onSuccess: () => {
        onSuccess();
        return queryClient.invalidateQueries({ queryKey: missionKeys.participants(missionId) });
      },
    }),
    remove: useMutation({
      mutationFn: (polygonId: string) => apiRequest(`${base}/${polygonId}`, { method: 'DELETE' }),
      onSuccess,
    }),
  };
}
