import { spacing } from '@trace/design';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { MissionMap } from '../../components/MissionMap';
import { ReportCard } from '../../components/ReportCard';
import { ReportsList } from '../../components/ReportsList';
import { Screen } from '../../components/Screen';
import { SegmentedChoice } from '../../components/SegmentedChoice';
import { ViewToggle, type ReportsView } from '../../components/ViewToggle';
import { useCurrentFix } from '../../location/useCurrentFix';
import { toMissionArea } from '../../mission/missionArea';
import { missionKeys, useMission, useMissionPolygons } from '../../mission/queries';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import { filterItems, toMapReports, toReportItems, type ReportFilter } from '../../reports/reportItems';
import { useMissionReports } from '../../reports/useMissionReports';
import { usePendingReports } from '../../reports/usePendingReports';
import { useSession } from '../../state/session';

const filterOptions = [
  { value: 'polygon', label: 'בפוליגון שלי' },
  { value: 'mine', label: 'שלי' },
] as const;

const emptyText: Record<ReportFilter, string> = {
  polygon: 'אין עדיין דיווחים בפוליגון',
  mine: 'עדיין לא שלחת דיווחים',
};

/**
 * Fm10: the reports of my polygon and my own, as a list or on the map, with their details (UC-F11, decisions 80, 81).
 * What the server sends is already limited to them; the screen applies the same rule again, so a report cached before a
 * move to another polygon is never shown.
 */
export default function ReportsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
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
  // The open report closes by itself once it is not in the list (a filter change, a move, a deletion).
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const state = reports.isError && !reports.data ? 'error' : reports.isLoading ? 'loading' : 'ready';
  const polygonName = polygonList?.find((p) => p.id === assigned?.polygonId)?.name;

  // A report just sent leaves the outbox: read the list in case its live event was missed.
  const waiting = useRef(pending.count);
  useEffect(() => {
    if (pending.count < waiting.current && missionId) {
      void queryClient.invalidateQueries({ queryKey: missionKeys.reports(missionId) });
    }
    waiting.current = pending.count;
  }, [pending.count, missionId, queryClient]);

  const list = (
    <ReportsList
      items={items}
      state={state}
      empty={emptyText[filter]}
      selectedId={selected?.id ?? null}
      onSelect={setSelectedId}
      onRetry={() => void reports.refetch()}
    />
  );
  const filterChoice = assigned ? (
    <SegmentedChoice label="סינון דיווחים" options={filterOptions} value={filter} onChange={setFilter} />
  ) : null;

  return (
    <Screen
      title={polygonName ? `דיווחים, פוליגון ${polygonName}` : 'דיווחים'}
      tabbed
      scroll={view === 'list'}
      action={<ViewToggle value={view} onChange={setView} />}
      footer={
        <Button
          label="דיווח חדש"
          variant="primary"
          size="lg"
          block
          icon="plus"
          onPress={() => openScreen(router, routes.report)}
        />
      }
    >
      {view === 'list' ? (
        <>
          {filterChoice}
          {list}
        </>
      ) : (
        <View style={styles.fill}>
          {filterChoice ? <View style={styles.padded}>{filterChoice}</View> : null}
          {state === 'ready' ? (
            <View style={styles.fill}>
              <MissionMap
                area={toMissionArea(polygonList ?? [], mission.data, assigned?.polygonId, toMapReports(items))}
                onPressReport={setSelectedId}
                selectedReportId={selected?.id ?? null}
                accessibilityLabel="מפת דיווחים בפוליגון"
              />
            </View>
          ) : (
            <View style={styles.padded}>{list}</View>
          )}
          {selected ? (
            <View style={styles.padded}>
              <ReportCard item={selected} selected onPress={() => setSelectedId(null)} />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { padding: spacing.space6 },
});
