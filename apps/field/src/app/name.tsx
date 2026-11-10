import { useRouter } from 'expo-router';
import { NameForm } from '../components/NameForm';
import { routes } from '../navigation/routes';

/** UC-F01: the name, on first sign-in only. */
export default function NameScreen() {
  const router = useRouter();
  return <NameForm onSaved={() => router.replace(routes.join)} onSignedOut={() => router.replace(routes.login)} />;
}
