import { useRouter } from 'expo-router';
import { Button } from '../components/Button';
import { Placeholder } from '../components/Placeholder';
import { Screen } from '../components/Screen';
import { routes } from '../navigation/routes';

/** Fm02: join a mission by QR or join code. */
export default function JoinScreen() {
  const router = useRouter();
  return (
    <Screen
      title="הצטרפות למסע"
      action={<Button label="המסעות שלי" onPress={() => router.push(routes.myMissions)} />}
      footer={
        <Button label="אשר והצטרף" variant="primary" size="lg" block onPress={() => router.replace(routes.map)} />
      }
    >
      <Placeholder useCase="UC-F02" />
    </Screen>
  );
}
