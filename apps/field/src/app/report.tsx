import { useRouter } from 'expo-router';
import { Button } from '../components/Button';
import { ReportForm } from '../components/ReportForm';
import { Screen } from '../components/Screen';
import { Text } from 'react-native';
import { typography } from '@trace/design';
import { useMissionPolygons } from '../mission/queries';
import { goBackOr } from '../navigation/navigate';
import { routes } from '../navigation/routes';
import { useSession } from '../state/session';
import { useTheme } from '../theme';

/** Fm08: a new field report, opened over the mission screens (UC-F09). */
export default function ReportScreen() {
  const router = useRouter();
  const { color } = useTheme().theme;
  const missionId = useSession((s) => s.missionId);
  const participation = useSession((s) => s.participation);
  const polygons = useMissionPolygons();
  const back = () => goBackOr(router, routes.map);

  if (!missionId) {
    return (
      <Screen title="דיווח חדש" leading={<Button label="ביטול" icon="close" onPress={back} />}>
        <Text style={[typography.body, { color: color.inkSecondary }]}>לא הצטרפת למסע</Text>
      </Screen>
    );
  }
  const polygonName =
    participation?.status === 'assigned'
      ? (polygons.data?.find((polygon) => polygon.id === participation.polygonId)?.name ?? null)
      : null;
  return <ReportForm missionId={missionId} polygonName={polygonName} onCancel={back} onDone={back} />;
}
