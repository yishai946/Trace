import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabButton } from '../../components/TabButton';
import { tabs } from '../../navigation/routes';
import { useMissionLive } from '../../realtime';
import { useLocationTracking } from '../../tracking';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/** The mission screens share the bottom tab bar of the wireframes (`.tcx-tabbar`) and the live connection. */
export default function MissionLayout() {
  const { color } = useTheme().theme;
  const { bottom } = useSafeAreaInsets();
  useMissionLive();
  useLocationTracking();

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
