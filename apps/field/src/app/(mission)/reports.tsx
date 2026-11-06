import { useRouter } from 'expo-router';
import { Button } from '../../components/Button';
import { Placeholder } from '../../components/Placeholder';
import { Screen } from '../../components/Screen';
import { routes } from '../../navigation/routes';

/** Fm10: reports in my polygon. */
export default function ReportsScreen() {
  const router = useRouter();
  return (
    <Screen
      title="דיווחים"
      footer={
        <Button label="דיווח חדש" variant="primary" size="lg" block icon="plus" onPress={() => router.push(routes.report)} />
      }
    >
      <Placeholder useCase="UC-F11" />
    </Screen>
  );
}
