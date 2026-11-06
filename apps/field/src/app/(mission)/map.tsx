import { radius, spacing, typography } from '@trace/design';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { MissionMap } from '../../components/MissionMap';
import { toMissionArea } from '../../mission/missionArea';
import { useMissionPolygons } from '../../mission/queries';
import { routes } from '../../navigation/routes';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';

/** Fm04 to Fm06: the mission on a full-screen map, with the searcher's actions in a sheet at the bottom. */
export default function MapScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { color } = theme;
  const missionId = useSession((s) => s.missionId);
  const polygons = useMissionPolygons();
  const area = toMissionArea(polygons.data ?? []);

  const status = !missionId
    ? { text: 'לא הצטרפת למסע', action: <Button label="הצטרף למסע" onPress={() => router.push(routes.join)} /> }
    : polygons.isError
      ? { text: 'לא ניתן לטעון את אזור המסע', action: <Button label="נסה שוב" onPress={() => polygons.refetch()} /> }
      : polygons.isLoading
        ? { text: 'טוען את אזור המסע…', action: null }
        : null;

  return (
    <View style={styles.fill}>
      <MissionMap area={area} />
      {status ? (
        <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
          <View
            accessibilityLiveRegion="polite"
            style={[styles.banner, { backgroundColor: color.surface, borderColor: color.border, boxShadow: theme.shadow.shadowPanel }]}
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
          onPress={() => router.push(routes.report)}
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
