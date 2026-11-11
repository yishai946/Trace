import { useIsFocused, useRouter } from 'expo-router';
import { JoinForm } from '../components/JoinForm';
import { openScreen } from '../navigation/navigate';
import { routes } from '../navigation/routes';

/** Fm02: join a mission by QR, link or join code (UC-F02). */
export default function JoinScreen() {
  const router = useRouter();
  return (
    <JoinForm
      scanning={useIsFocused()}
      onJoined={() => router.replace(routes.map)}
      onOpenMyMissions={() => openScreen(router, routes.myMissions)}
    />
  );
}
