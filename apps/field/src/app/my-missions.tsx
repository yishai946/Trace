import { useRouter } from 'expo-router';
import { Button } from '../components/Button';
import { Placeholder } from '../components/Placeholder';
import { Screen } from '../components/Screen';
import { routes } from '../navigation/routes';

/** Fm15: my missions, the current one and the history of ended ones. */
export default function MyMissionsScreen() {
  const router = useRouter();
  return (
    <Screen
      title="המסעות שלי"
      footer={
        <>
          <Button label="חזור למסע" variant="primary" size="lg" block onPress={() => router.replace(routes.map)} />
          <Button label="הצטרף למסע" size="lg" block onPress={() => router.push(routes.join)} />
        </>
      }
    >
      <Placeholder useCase="UC-F17" />
    </Screen>
  );
}
