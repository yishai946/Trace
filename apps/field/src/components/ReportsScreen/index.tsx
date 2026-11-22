import { spacing } from '@trace/design';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import type { ReportFilter } from '../../reports/reportItems';
import { Button } from '../Button';
import { Notice } from '../Notice';
import { ReportsList } from '../ReportsList';
import { Screen } from '../Screen';
import { SegmentedChoice } from '../SegmentedChoice';
import { ViewToggle } from '../ViewToggle';
import { ReportsMapView } from './ReportsMapView';
import { useReportsScreen } from './useReportsScreen';

const filterOptions = [
  { value: 'polygon', label: 'בפוליגון שלי' },
  { value: 'mine', label: 'שלי' },
] as const;

/** Said when the list shows what the phone saved because the server cannot be reached (UC-F11, decision 22). */
const REPORTS_NOT_UP_TO_DATE = 'הדיווחים נשמרו במכשיר ואינם עדכניים. הרשימה תתעדכן כשהחיבור יחזור.';

const emptyText: Record<ReportFilter, string> = {
  polygon: 'אין עדיין דיווחים בפוליגון',
  mine: 'עדיין לא שלחת דיווחים',
};

/** Fm10: the reports of my polygon and my own, as a list or on the map, with their details (UC-F11, decisions 80, 81). */
export function ReportsScreen() {
  const router = useRouter();
  const screen = useReportsScreen();
  const { view, filter, assigned, items, selected, state } = screen;
  const edit = (id: string) => openScreen(router, { pathname: routes.reportEdit, params: { id } });

  const list: ReactNode = (
    <ReportsList
      items={items}
      state={state}
      empty={emptyText[filter]}
      selectedId={selected?.id ?? null}
      onSelect={screen.setSelectedId}
      onRetry={screen.retry}
      onEdit={edit}
    />
  );
  const filterChoice = assigned ? (
    <SegmentedChoice label="סינון דיווחים" options={filterOptions} value={filter} onChange={screen.setFilter} />
  ) : null;

  const staleNotice = screen.notUpToDate ? (
    <Notice icon="wifiOff" tone="warn" live>
      {REPORTS_NOT_UP_TO_DATE}
    </Notice>
  ) : null;

  return (
    <Screen
      title={screen.polygonName ? `דיווחים, פוליגון ${screen.polygonName}` : 'דיווחים'}
      tabbed
      scroll={view === 'list'}
      action={<ViewToggle value={view} onChange={screen.setView} />}
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
          {staleNotice}
          {filterChoice}
          {list}
        </>
      ) : (
        <View style={styles.fill}>
          {staleNotice ? <View style={styles.padded}>{staleNotice}</View> : null}
          {filterChoice ? <View style={styles.padded}>{filterChoice}</View> : null}
          <ReportsMapView screen={screen} list={list} onEdit={edit} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  padded: { padding: spacing.space6 },
});
