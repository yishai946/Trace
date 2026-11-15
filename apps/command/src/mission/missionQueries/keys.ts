import type { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '../../api';

export const missionKeys = {
  all: ['missions'] as const,
  polygons: (missionId: string) => ['missions', missionId, 'polygons'] as const,
  participants: (missionId: string) => ['missions', missionId, 'participants'] as const,
  sightings: (missionId: string) => ['missions', missionId, 'sightings'] as const,
  lkps: (missionId: string) => ['missions', missionId, 'lkps'] as const,
  timeline: (missionId: string) => ['missions', missionId, 'timeline'] as const,
  messages: (missionId: string) => ['missions', missionId, 'messages'] as const,
  reports: (missionId: string) => ['missions', missionId, 'reports'] as const,
};

/** The mission ended meanwhile: reload the missions, so the screen turns read-only. */
export const reloadIfMissionEnded = (queryClient: QueryClient) => (error: Error) =>
  error instanceof ApiRequestError && error.code === 'MISSION_ENDED'
    ? queryClient.invalidateQueries({ queryKey: missionKeys.all })
    : undefined;
