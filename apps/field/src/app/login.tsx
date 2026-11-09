import { useRouter } from 'expo-router';
import { SignIn } from '../components/SignIn';
import { routes } from '../navigation/routes';

/** Fm01: phone and code sign-in (UC-F01). */
export default function LoginScreen() {
  const router = useRouter();
  return <SignIn onSignedIn={() => router.replace(routes.start)} />;
}
