import type { MissionView } from '../../mission/MissionNav';
import type { ConsolePanel } from './useConsoleNav';
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
 * again. The Timeline loads when its view or the mission details first open (the details list its recent changes), and
 * the messages when their view first opens.
 */
export function useMissionData(missionId: string | undefined, view: MissionView, panel: ConsolePanel | null) {
  return {
    polygons: usePolygons(missionId),
    participants: useParticipants(missionId),
    sightings: useSightings(missionId),
    lkps: useLkps(missionId),
    timeline: useTimeline(view === 'timeline' || panel === 'details' ? missionId : undefined),
    messages: useMessages(view === 'messages' ? missionId : undefined),
    // Always loaded: the map draws them, the navigation counts the New ones and the alert needs the located one.
    reports: useReports(missionId),
    // Always loaded: the alert, the map marker and the navigation count read it from any view, and it survives a reload.
    sos: useSosList(missionId),
  };
}

export type MissionData = ReturnType<typeof useMissionData>;
