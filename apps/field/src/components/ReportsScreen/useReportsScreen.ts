import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCurrentFix } from '../../location/useCurrentFix';
import { missionKeys, useMission, useMissionPolygons } from '../../mission/queries';
import { filterItems, toReportItems, type ReportFilter } from '../../reports/reportItems';
import { useMissionReports } from '../../reports/useMissionReports';
import { usePendingReports } from '../../reports/usePendingReports';
import { useSession } from '../../state/session';
import type { ReportsView } from '../ViewToggle';

/** A report just sent leaves the outbox: read the list in case its live event was missed. */
function useRefetchWhenSent(missionId: string | null, waitingCount: number) {
  const queryClient = useQueryClient();
  const waiting = useRef(waitingCount);
  useEffect(() => {
    if (waitingCount < waiting.current && missionId) {
      void queryClient.invalidateQueries({ queryKey: missionKeys.reports(missionId) });
    }
    waiting.current = waitingCount;
  }, [waitingCount, missionId, queryClient]);
}

/**
 * The reports screen's data (UC-F11, decisions 80, 81): the reports of my polygon and my own, filtered, with the one
 * the searcher opened. What the server sends is already limited to them; the same rule applies again here, so a
 * report cached before a move to another polygon is never shown.
 */
export function useReportsScreen() {
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const reports = useMissionReports();
  const polygons = useMissionPolygons();
  const mission = useMission();
  const pending = usePendingReports(missionId);
  // Distances are a hint: the screen never asks for the location permission itself.
  const fix = useCurrentFix({ prompt: false });
  const [view, setView] = useState<ReportsView>('list');
  const [chosenFilter, setFilter] = useState<ReportFilter>('polygon');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const assigned = participation?.status === 'assigned' ? participation : null;
  // Without a polygon there is no "my polygon": only the searcher's own reports remain.
  const filter: ReportFilter = assigned ? chosenFilter : 'mine';
  const from = assigned && fix.state === 'ready' && fix.fix ? fix.fix.position : null;
  const polygonList = polygons.data;
  const items = useMemo(
    () =>
      filterItems(
        toReportItems({
          reports: reports.data ?? [],
          pending: pending.items,
          participation,
          polygons: polygonList ?? [],
          from,
        }),
        filter,
        assigned?.polygonId ?? null,
      ),
    [reports.data, pending.items, participation, polygonList, from, filter, assigned?.polygonId],
  );
  useRefetchWhenSent(missionId, pending.count);

  return {
    view,
    setView,
    filter,
    setFilter,
    assigned,
    items,
    setSelectedId,
    // The open report closes by itself once it is not in the list (a filter change, a move, a deletion).
    selected: items.find((item) => item.id === selectedId) ?? null,
    state:
      reports.isError && !reports.data
        ? ('error' as const)
        : reports.isLoading
          ? ('loading' as const)
          : ('ready' as const),
    retry: () => void reports.refetch(),
    polygons: polygonList ?? [],
    mission: mission.data,
    polygonName: polygonList?.find((p) => p.id === assigned?.polygonId)?.name,
  };
}
