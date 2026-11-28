import type { QueryClient } from '@tanstack/react-query';
import { missionDataKeys } from '@trace/mission-cache';
import { ApiRequestError } from '../../api';

export const missionKeys = {
  all: ['missions'] as const,
  ...missionDataKeys,
  participants: (missionId: string) => ['missions', missionId, 'participants'] as const,
  track: (missionId: string, participantId: string) =>
    ['missions', missionId, 'participants', participantId, 'track'] as const,
  sightings: (missionId: string) => ['missions', missionId, 'sightings'] as const,
  lkps: (missionId: string) => ['missions', missionId, 'lkps'] as const,
  assignments: (missionId: string) => ['missions', missionId, 'assignments'] as const,
  timeline: (missionId: string) => ['missions', missionId, 'timeline'] as const,
};

/** The mission ended meanwhile: reload the missions, so the screen turns read-only. */
export const reloadIfMissionEnded = (queryClient: QueryClient) => (error: Error) =>
  error instanceof ApiRequestError && error.code === 'MISSION_ENDED'
    ? queryClient.invalidateQueries({ queryKey: missionKeys.all })
    : undefined;
