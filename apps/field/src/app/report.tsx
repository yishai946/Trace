import { useRouter } from 'expo-router';
import { Button } from '../components/Button';
import { Placeholder } from '../components/Placeholder';
import { Screen } from '../components/Screen';
import { goBackOr } from '../navigation/navigate';
import { routes } from '../navigation/routes';

/** Fm08: a new field report, opened over the mission screens. */
export default function ReportScreen() {
  const router = useRouter();
  return (
    <Screen
      title="דיווח חדש"
      leading={<Button label="ביטול" icon="close" onPress={() => goBackOr(router, routes.map)} />}
      footer={<Button label="שלח דיווח" variant="primary" size="lg" block disabled />}
    >
      <Placeholder useCase="UC-F09" />
    </Screen>
  );
}
