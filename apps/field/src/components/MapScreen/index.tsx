import { radius, spacing } from '@trace/design';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { ActivityEnded } from '../ActivityEnded';
import { Button } from '../Button';
import { MissionMap } from '../MissionMap';
import { WaitingForAssignment } from '../WaitingForAssignment';
import { MapBanner } from './MapBanner';
import { MapSheet } from './MapSheet';
import { useMapArea } from './useMapArea';

/** Fm04 to Fm06: the mission on a full-screen map, with the searcher's actions in a sheet at the bottom. */
export function MapScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const participation = useSession((s) => s.participation);
  const notice = useSession((s) => s.assignmentNotice);
  const { mission, missionStopped, polygons, assigned, area, polygonReports, locatedWaiting } = useMapArea();

  const missionPaused = mission.data?.status === 'paused';

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
        notUpToDate={mission.notUpToDate}
        onOpenDetails={() => openScreen(router, routes.missingPerson)}
      />
    );
  }

  const countLabel = polygonReports === null ? 'דיווחים בפוליגון' : `דיווחים בפוליגון, ${polygonReports}`;
  return (
    <View style={styles.fill}>
      {/* The map and what floats over it end where the sheet begins, so the sheet never covers them. */}
      <View style={styles.fill} testID="map-area">
        <MissionMap area={area} />
        <MapBanner
          polygons={polygons}
          locatedWaiting={locatedWaiting}
          missionLocated={mission.data?.status === 'ended_located'}
          missionStopped={missionStopped}
          missionPaused={missionPaused}
        />
        {assigned ? (
          <View style={styles.reportsButton} pointerEvents="box-none">
            <View
              style={[styles.reportsButtonBox, { backgroundColor: theme.color.surface, borderRadius: radius.radiusMd }]}
            >
              <Button
                label="דיווחים בפוליגון"
                accessibilityLabel={countLabel}
                variant="ghost"
                size="lg"
                icon="reports"
                badge={polygonReports === null ? undefined : String(polygonReports)}
                onPress={() => openScreen(router, routes.reports)}
              />
            </View>
          </View>
        ) : null}
      </View>
      <MapSheet
        assigned={assigned}
        polygons={polygons.data ?? []}
        hasMission={!!mission.data}
        missionPaused={missionPaused}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Fm06: over the map, at the start side, just above the sheet whatever its height.
  reportsButton: { position: 'absolute', start: spacing.space6, bottom: spacing.space6 },
  reportsButtonBox: { alignSelf: 'flex-start' },
});
