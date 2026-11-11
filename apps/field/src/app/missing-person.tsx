import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Button } from '../components/Button';
import { MissingPersonDetails } from '../components/MissingPersonDetails';
import { Screen } from '../components/Screen';
import { useMission } from '../mission/queries';
import { goBackOr } from '../navigation/navigate';
import { routes } from '../navigation/routes';
import { useTheme } from '../theme';

/** Fm04 "פרטי נעדר מלאים": the missing person's details, read-only (UC-F04). Opened over the mission screens. */
export default function MissingPersonScreen() {
  const router = useRouter();
  const { color } = useTheme().theme;
  const mission = useMission();
  const close = <Button label="סגור" icon="close" onPress={() => goBackOr(router, routes.map)} />;

  if (mission.data) return <MissingPersonDetails mission={mission.data} closeAction={close} />;
  return (
    <Screen title="פרטי הנעדר" leading={close}>
      {mission.isError ? (
        <Button label="נסה שוב" onPress={() => void mission.refetch()} />
      ) : (
        <ActivityIndicator color={color.inkMuted} accessibilityLabel="טוען" />
      )}
    </Screen>
  );
}
