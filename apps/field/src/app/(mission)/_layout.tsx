import { useRouter } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabButton } from '../../components/TabButton';
import { routes, tabs } from '../../navigation/routes';
import { useMissionLive } from '../../realtime';
import { useSession } from '../../state/session';
import { useLocationTracking } from '../../tracking';
import { useGpsStatus } from '../../tracking/gpsStatus';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/** The mission screens share the bottom tab bar of the wireframes (`.tcx-tabbar`) and the live connection. */
export default function MissionLayout() {
  const { color } = useTheme().theme;
  const { bottom } = useSafeAreaInsets();
  useMissionLive();
  useLocationTracking();
  useGpsStatus();
  // The commander ended the participation (UC-C18): from any tab, the searcher is taken to the map, which says so.
  const router = useRouter();
  const removed = useSession((s) => s.assignmentNotice?.kind === 'ended');
  useEffect(() => {
    if (removed) router.navigate(routes.map);
  }, [removed, router]);

  return (
    <Tabs style={styles.fill}>
      <TabSlot />
      <TabList
        role="navigation"
        aria-label="ניווט ראשי"
        style={[
          styles.bar,
          {
            backgroundColor: color.surface,
            borderTopColor: color.border,
            height: pendingTokens.tabBarH + bottom,
            paddingBottom: bottom,
          },
        ]}
      >
        {tabs.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton label={tab.label} icon={tab.icon} tone={tab.tone} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: 1 },
});
