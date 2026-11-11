import { radius, spacing, typography } from '@trace/design';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { MissionMap } from '../../components/MissionMap';
import { WaitingForAssignment } from '../../components/WaitingForAssignment';
import { toMissionArea } from '../../mission/missionArea';
import { apiBaseUrl } from '../../api';
import { mapStatus } from '../../mission/mapStatus';
import { useMission, useMissionPolygons } from '../../mission/queries';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';

/** Fm04 to Fm06: the mission on a full-screen map, with the searcher's actions in a sheet at the bottom. */
export default function MapScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { color } = theme;
  const signedIn = useSession((s) => !!s.token);
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const mission = useMission();
  const polygons = useMissionPolygons();
  const area = toMissionArea(polygons.data ?? [], mission.data);

  // Fm04: until the commander assigns a polygon, the searcher waits with the mission's basic information (UC-F02).
  if (mission.data && participation?.status === 'available') {
    return <WaitingForAssignment mission={mission.data} participation={participation} />;
  }

  const kind = mapStatus({
    apiConfigured: !!apiBaseUrl,
    signedIn,
    missionId,
    isError: polygons.isError,
    isFetching: polygons.isFetching,
    hasData: !!polygons.data,
  });
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

  return (
    <View style={styles.fill}>
      <MissionMap area={area} />
      {status ? (
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.banner,
              { backgroundColor: color.surface, borderColor: color.border, boxShadow: theme.shadow.shadowPanel },
            ]}
          >
            <Text style={[typography.body, styles.bannerText, { color: color.ink }]}>{status.text}</Text>
            {status.action}
          </View>
        </SafeAreaView>
      ) : null}
      <View
        style={[
          styles.sheet,
          { backgroundColor: color.surface, borderColor: color.border, boxShadow: theme.shadow.shadowPanel },
        ]}
      >
        <Button
          label="דיווח"
          variant="primary"
          size="lg"
          block
          icon="plus"
          onPress={() => openScreen(router, routes.report)}
        />
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
  sheet: {
    padding: spacing.space6,
    borderTopStartRadius: radius.radiusXl,
    borderTopEndRadius: radius.radiusXl,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
});
