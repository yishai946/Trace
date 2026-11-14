import { radius, spacing, typography } from '@trace/design';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiBaseUrl } from '../../api';
import { mapStatus } from '../../mission/mapStatus';
import { mapWarning } from '../../mission/mapWarning';
import { openScreen } from '../../navigation/navigate';
import { routes } from '../../navigation/routes';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { Button } from '../Button';

interface MapBannerProps {
  /** The mission's polygons query, which the map cannot show without. */
  polygons: { isError: boolean; isFetching: boolean; data: unknown; refetch: () => unknown };
  /** A "הנעדר אותר" report is waiting to be sent. */
  locatedWaiting: boolean;
}

type Notice = { text: string; action: ReactNode };

/** What stops the map from showing (no server, signed out, loading, failed), or else a warning over it. */
export function MapBanner({ polygons, locatedWaiting }: MapBannerProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { color } = theme;
  const signedIn = useSession((s) => !!s.token);
  const missionId = useSession((s) => s.missionId);
  const gpsLost = useSession((s) => s.gpsAvailable === false);
  const kind = mapStatus({
    apiConfigured: !!apiBaseUrl,
    signedIn,
    missionId,
    isError: polygons.isError,
    isFetching: polygons.isFetching,
    hasData: !!polygons.data,
  });
  const actions: Record<NonNullable<typeof kind>, Notice> = {
    'no-api': { text: 'כתובת השרת לא מוגדרת: חסר EXPO_PUBLIC_API_URL', action: null },
    'signed-out': {
      text: 'לא נכנסת לחשבון',
      action: <Button label="כניסה" onPress={() => router.replace(routes.login)} />,
    },
    'no-mission': {
      text: 'לא הצטרפת למסע',
      action: <Button label="הצטרף למסע" onPress={() => openScreen(router, routes.join)} />,
    },
    loading: { text: 'טוען את אזור המסע…', action: null },
    error: {
      text: 'לא ניתן לטעון את אזור המסע',
      action: <Button label="נסה שוב" onPress={() => polygons.refetch()} />,
    },
  };
  const status = kind ? actions[kind] : null;
  // The warnings show when nothing more urgent does.
  const banner = status ?? mapWarning({ gpsLost, locatedWaiting });
  if (!banner) return null;
  return (
    <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
      <View
        accessibilityLiveRegion="polite"
        style={[
          styles.banner,
          {
            backgroundColor: color.surface,
            // A lost GPS (decision 42) and an unsent "הנעדר אותר" report are warnings; the other notices are neutral.
            borderColor: status ? color.border : color.warning,
            boxShadow: theme.shadow.shadowPanel,
          },
        ]}
      >
        <Text style={[typography.body, styles.bannerText, { color: color.ink }]}>{banner.text}</Text>
        {banner.action}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: spacing.space6 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space5,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space6,
    borderRadius: radius.radiusXl,
    borderWidth: 1,
  },
  bannerText: { flex: 1 },
});
