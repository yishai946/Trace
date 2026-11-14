import { spacing } from '@trace/design';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { toMissionArea } from '../../mission/missionArea';
import { toMapReports } from '../../reports/reportItems';
import { MissionMap } from '../MissionMap';
import { ReportCard } from '../ReportCard';
import type { useReportsScreen } from './useReportsScreen';

interface ReportsMapViewProps {
  screen: ReturnType<typeof useReportsScreen>;
  /** The list, shown in place of the map while the reports load or failed to. */
  list: ReactNode;
  onEdit: (id: string) => void;
}

/** The reports on the map, with the opened report's card under it. */
export function ReportsMapView({ screen, list, onEdit }: ReportsMapViewProps) {
  const { items, selected, state, assigned, polygons, mission } = screen;
  return (
    <>
      {state === 'ready' ? (
        <View style={styles.fill}>
          <MissionMap
            area={toMissionArea(polygons, mission, assigned?.polygonId, toMapReports(items))}
            onPressReport={screen.setSelectedId}
            selectedReportId={selected?.id ?? null}
            accessibilityLabel="מפת דיווחים בפוליגון"
          />
        </View>
      ) : (
        <View style={styles.padded}>{list}</View>
      )}
      {selected ? (
        <View style={styles.padded}>
          <ReportCard
            item={selected}
            selected
            onPress={() => screen.setSelectedId(null)}
            onEdit={() => onEdit(selected.id)}
          />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { padding: spacing.space6 },
});
