import { typography } from '@trace/design';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { routes } from '../navigation/routes';
import { useTheme } from '../theme';

/** Any address the app does not know, e.g. an old or mistyped link. */
export default function NotFoundScreen() {
  const router = useRouter();
  const { color } = useTheme().theme;
  return (
    <Screen
      title="המסך לא נמצא"
      footer={
        <Button label="למסך הכניסה" variant="primary" size="lg" block onPress={() => router.replace(routes.login)} />
      }
    >
      <Text style={[typography.body, { color: color.inkSecondary }]}>הקישור שנפתח לא מוביל למסך באפליקציה.</Text>
    </Screen>
  );
}
