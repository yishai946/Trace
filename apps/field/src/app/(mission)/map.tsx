import { radius, spacing, typography } from '@trace/design';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { PendingReports } from '../../components/PendingReports';
import { MissionMap } from '../../components/MissionMap';
import { ActivityEnded } from '../../components/ActivityEnded';
import { AssignedTask } from '../../components/AssignedTask';
import { WaitingForAssignment } from '../../components/WaitingForAssignment';
import { mapWarning } from '../../mission/mapWarning';
import { toMissionArea } from '../../mission/missionArea';
import { apiBaseUrl } from '../../api';
import { mapStatus } from '../../mission/mapStatus';
import { useMission, useMissionPolygons } from '../../mission/queries';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import { filterItems, toMapReports, toReportItems } from '../../reports/reportItems';
import { useMissionReports } from '../../reports/useMissionReports';
import { usePendingReports } from '../../reports/usePendingReports';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/** Fm04 to Fm06: the mission on a full-screen map, with the searcher's actions in a sheet at the bottom. */
export default function MapScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { color } = theme;
  const signedIn = useSession((s) => !!s.token);
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const notice = useSession((s) => s.assignmentNotice);
  const gpsLost = useSession((s) => s.gpsAvailable === false);
  const dismissNotice = useSession((s) => s.dismissAssignmentNotice);
  const pendingReports = usePendingReports(missionId);
  const mission = useMission();
  const polygons = useMissionPolygons();
  const assigned = participation?.status === 'assigned' ? participation : null;
  const reports = useMissionReports();
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
  const polygonReports = reports.data ? area.data.reports.length : null;

  // Fm13: the participation ended (UC-C18); tracking already stopped with it.
  if (participation?.status === 'ended') {
    return (
      <ActivityEnded
        mission={mission.data}
        removed={notice?.kind === 'ended'}
        onJoinAgain={() => openScreen(router, routes.join)}
        onOpenMyMissions={() => openScreen(router, routes.myMissions)}
      />
    );
  }

  // Fm04: until the commander assigns a polygon, the searcher waits with the mission's basic information (UC-F02).
  if (mission.data && participation?.status === 'available') {
    return (
      <WaitingForAssignment
        mission={mission.data}
        participation={participation}
        onOpenDetails={() => openScreen(router, routes.missingPerson)}
      />
    );
  }

  const kind = mapStatus({
    apiConfigured: !!apiBaseUrl,
    signedIn,
    missionId,
    isError: polygons.isError,
    isFetching: polygons.isFetching,
    hasData: !!polygons.data,
  });
  const warning = mapWarning({ gpsLost, locatedWaiting: pendingReports.located });
  const status = kind
    ? {
        'no-api': { text: 'כתובת השרת לא מוגדרת: חסר EXPO_PUBLIC_API_URL', action: null },
        'signed-out': {
          text: 'לא נכנסת לחשבון',
          action: <Button label="כניסה" onPress={() => router.replace(routes.login)} />,
        },
        'no-mission': {
          text: 'לא הצטרפת למסע',
          action: <Button label="הצטרף למסע" onPress={() => openScreen(router, routes.join)} />,
        },
        loading: { text: 'טוען את אזור המסע…', action: null },
        error: {
          text: 'לא ניתן לטעון את אזור המסע',
          action: <Button label="נסה שוב" onPress={() => polygons.refetch()} />,
        },
      }[kind]
    : null;

  // The warnings show when nothing more urgent does.
  const banner = status ?? warning;

  return (
    <View style={styles.fill}>
      <MissionMap area={area} />
      {banner ? (
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.banner,
              {
                backgroundColor: color.surface,
                // A lost GPS (decision 42) and an unsent "הנעדר אותר" report are warnings; the other notices are neutral.
                borderColor: status ? color.border : color.warning,
                boxShadow: theme.shadow.shadowPanel,
              },
            ]}
          >
            <Text style={[typography.body, styles.bannerText, { color: color.ink }]}>{banner.text}</Text>
            {banner.action}
          </View>
        </SafeAreaView>
      ) : null}
      {assigned ? (
        <View style={styles.reportsButton} pointerEvents="box-none">
          <View style={[styles.reportsButtonBox, { backgroundColor: color.surface, borderRadius: radius.radiusMd }]}>
            <Button
              label="דיווחים בפוליגון"
              accessibilityLabel={polygonReports === null ? 'דיווחים בפוליגון' : `דיווחים בפוליגון, ${polygonReports}`}
              variant="ghost"
              size="lg"
              icon="reports"
              badge={polygonReports === null ? undefined : String(polygonReports)}
              onPress={() => openScreen(router, routes.reports)}
            />
          </View>
        </View>
      ) : null}
      <View
        style={[
          styles.sheet,
          { backgroundColor: color.surface, borderColor: color.border, boxShadow: theme.shadow.shadowPanel },
        ]}
      >
        {assigned ? (
          <AssignedTask
            participation={assigned}
            polygons={polygons.data ?? []}
            notice={notice}
            onDismissNotice={dismissNotice}
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
        {mission.data ? (
          <Button label="פרטי נעדר מלאים" variant="ghost" onPress={() => openScreen(router, routes.missingPerson)} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: spacing.space6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space5,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space6,
    borderRadius: radius.radiusXl,
    borderWidth: 1,
  },
  bannerText: { flex: 1 },
  // Fm06: over the map, at the start side, above the sheet.
  reportsButton: { position: 'absolute', start: spacing.space6, bottom: pendingTokens.reportsButtonBottom },
  reportsButtonBox: { alignSelf: 'flex-start' },
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
