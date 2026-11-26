import { radius, spacing } from '@trace/design';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import type { ComponentProps } from 'react';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import { useSearchFinish } from '../../mission/useSearchFinish';
import { useSearchPause } from '../../mission/useSearchPause';
import { useStartSearch } from '../../mission/useStartSearch';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { AssignedTask } from '../AssignedTask';
import { Button } from '../Button';
import { OfflineDownload } from '../OfflineDownload';
import { PendingReports } from '../PendingReports';

type Task = ComponentProps<typeof AssignedTask>;

interface MapSheetProps {
  /** The searcher's participation while a polygon is assigned to them. */
  assigned: Task['participation'] | null;
  polygons: Task['polygons'];
  /** Without a mission loaded, the missing person's details have nowhere to open. */
  hasMission: boolean;
}

/** The sheet under the map (Fm04 to Fm06): the assigned task, reports waiting to send, and the searcher's actions. */
export function MapSheet({ assigned, polygons, hasMission }: MapSheetProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { color } = theme;
  const missionId = useSession((s) => s.missionId);
  const notice = useSession((s) => s.assignmentNotice);
  const dismissNotice = useSession((s) => s.dismissAssignmentNotice);
  const startSearch = useStartSearch();
  const searchPause = useSearchPause();
  const searchFinish = useSearchFinish();
  return (
    <View
      testID="map-sheet"
      style={[
        styles.sheet,
        { backgroundColor: color.surface, borderColor: color.border, boxShadow: theme.shadow.shadowPanel },
      ]}
    >
      <OfflineDownload />
      {assigned ? (
        <AssignedTask
          participation={assigned}
          polygons={polygons}
          notice={notice}
          onDismissNotice={dismissNotice}
          onStartSearch={startSearch.start}
          starting={startSearch.starting}
          startError={startSearch.error}
          onPause={searchPause.pause}
          onResume={searchPause.resume}
          pausing={searchPause.pending}
          pauseError={searchPause.error}
          onFinish={searchFinish.finish}
          finishing={searchFinish.pending}
          finishError={searchFinish.error}
        />
      ) : null}
      <PendingReports missionId={missionId} />
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button
            label="דיווח"
            // One primary action per area: Start Search while assigned.
            variant={assigned ? 'secondary' : 'primary'}
            size="lg"
            block
            icon="plus"
            onPress={() => openScreen(router, routes.report)}
          />
        </View>
        <View style={styles.action}>
          <Button label="תצפית" size="lg" block icon="sighting" onPress={() => openScreen(router, routes.sighting)} />
        </View>
      </View>
      {/* The missing person's details stay one tap away for the whole mission (UC-F04, decision 33). */}
      {hasMission ? (
        <Button label="פרטי נעדר מלאים" variant="ghost" onPress={() => openScreen(router, routes.missingPerson)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.space4 },
  action: { flex: 1 },
  sheet: {
    gap: spacing.space4,
    padding: spacing.space6,
    borderTopStartRadius: radius.radiusXl,
    borderTopEndRadius: radius.radiusXl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
});
