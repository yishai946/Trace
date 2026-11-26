import type { MissionView } from '../../mission/MissionNav';
import {
  useLkps,
  useMessages,
  useParticipants,
  usePolygons,
  useReports,
  useSightings,
  useSosList,
  useTimeline,
} from '../../mission/missionQueries';

/**
 * Everything the open mission's screens read. It is fetched here, once, so moving between the views does not fetch it
 * again. The messages load when their view first opens.
 */
export function useMissionData(missionId: string | undefined, view: MissionView) {
  return {
    polygons: usePolygons(missionId),
    participants: useParticipants(missionId),
    sightings: useSightings(missionId),
    lkps: useLkps(missionId),
    // Always loaded: the Timeline view and the details list it, and the out-of-polygon warning (UC-S04) reads it.
    timeline: useTimeline(missionId),
    messages: useMessages(view === 'messages' ? missionId : undefined),
    // Always loaded: the map draws them, the navigation counts the New ones and the alert needs the located one.
    reports: useReports(missionId),
    // Always loaded: the alert, the map marker and the navigation count read it from any view, and it survives a reload.
    sos: useSosList(missionId),
  };
}

export type MissionData = ReturnType<typeof useMissionData>;
