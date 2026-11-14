import type { MissionView } from '../../mission/MissionNav';
import {
  useLkps,
  useMessages,
  useParticipants,
  usePolygons,
  useReports,
  useSightings,
  useTimeline,
} from '../../mission/missionQueries';

/**
 * Everything the open mission's screens read. It is fetched here, once, so moving between the views does not fetch it
 * again. The Timeline and the messages load when their view first opens.
 */
export function useMissionData(missionId: string | undefined, view: MissionView) {
  return {
    polygons: usePolygons(missionId),
    participants: useParticipants(missionId),
    sightings: useSightings(missionId),
    lkps: useLkps(missionId),
    timeline: useTimeline(view === 'timeline' ? missionId : undefined),
    messages: useMessages(view === 'messages' ? missionId : undefined),
    // Always loaded: the map draws them, the navigation counts the New ones and the alert needs the located one.
    reports: useReports(missionId),
  };
}

export type MissionData = ReturnType<typeof useMissionData>;
