import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Placeholder } from '../../components/Placeholder';
import { Screen } from '../../components/Screen';
import { ThemeChoice } from '../../components/ThemeChoice';
import { routes } from '../../navigation/routes';

/** Fm16: more. Also holds the theme choice, as Command's "עוד" screen does. */
export default function MoreScreen() {
  const router = useRouter();
  return (
    <Screen title="עוד">
      <Button label="המסעות שלי" size="lg" block onPress={() => router.push(routes.myMissions)} />
      <ThemeChoice />
      <Placeholder useCase="UC-F15" />
    </Screen>
  );
}
