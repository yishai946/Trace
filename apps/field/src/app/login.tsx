import { useRouter } from 'expo-router';
import { Button } from '../components/Button';
import { Placeholder } from '../components/Placeholder';
import { Screen } from '../components/Screen';
import { routes } from '../navigation/routes';

/** Fm01: phone and OTP sign-in. */
export default function LoginScreen() {
  const router = useRouter();
  return (
    <Screen
      title="TRACE Field"
      footer={
        <Button label="אמת והמשך" variant="primary" size="lg" block onPress={() => router.replace(routes.join)} />
      }
    >
      <Placeholder useCase="UC-F01" />
    </Screen>
  );
}
