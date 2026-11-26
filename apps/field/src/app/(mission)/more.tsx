import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { FinishActivity } from '../../components/FinishActivity';
import { Screen } from '../../components/Screen';
import { ThemeChoice } from '../../components/ThemeChoice';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';

/** Fm16: more: my missions, Finish Activity (UC-F15). Also holds the theme choice, as Command's "עוד" screen does. */
export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen title="עוד" tabbed>
      <Button label="המסעות שלי" size="lg" block onPress={() => openScreen(router, routes.myMissions)} />
      <ThemeChoice />
      <FinishActivity />
    </Screen>
  );
}
