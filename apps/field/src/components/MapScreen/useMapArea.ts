import { STOP_REASON_LABELS } from '@trace/domain';
import { toMissionArea } from '../../mission/missionArea';
import { useMission, useMissionPolygons } from '../../mission/queries';
import { filterItems, toMapReports, toReportItems } from '../../reports/reportItems';
import { useMissionReports } from '../../reports/useMissionReports';
import { usePendingReports } from '../../reports/usePendingReports';
import { useSession } from '../../state/session';

/** What the mission map shows for this searcher: the mission area, their polygon's reports and their number. */
export function useMapArea() {
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const pendingReports = usePendingReports(missionId);
  const mission = useMission();
  const polygons = useMissionPolygons();
  const reports = useMissionReports();
  const assigned = participation?.status === 'assigned' ? participation : null;
  // The reports of my polygon and my own, the same ones as on the reports screen (UC-F11, decision 80).
  const reportItems = toReportItems({
    reports: reports.data ?? [],
    pending: pendingReports.items,
    participation,
    polygons: polygons.data ?? [],
    from: null,
  });
  const area = toMissionArea(
    polygons.data ?? [],
    mission.data,
    assigned?.polygonId,
    toMapReports(filterItems(reportItems, 'polygon', assigned?.polygonId ?? null)),
  );
  // The stop reason the searcher is told when the commander ended the mission as stopped (UC-C17).
  const stopped = mission.data?.status === 'ended_stopped' ? mission.data.stopped : null;
  return {
    mission,
    missionStopped: stopped ? STOP_REASON_LABELS[stopped.reason] : null,
    polygons,
    assigned,
    area,
    /** Null while the reports load. */
    polygonReports: reports.data ? area.data.reports.length : null,
    locatedWaiting: pendingReports.located,
  };
}
