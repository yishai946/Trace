import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabButton } from '../../components/TabButton';
import { useMessagesInbox } from '../../messages/useMessagesInbox';
import { useOfflineDownload } from '../../offline/useOfflineDownload';
import { useLeaveWhenRemoved } from '../../navigation/useLeaveWhenRemoved';
import { tabs } from '../../navigation/routes';
import { useMissionLive } from '../../realtime';
import { useLocationTracking } from '../../tracking';
import { useGpsStatus } from '../../tracking/gpsStatus';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';

/** The mission screens share the bottom tab bar of the wireframes (`.tcx-tabbar`) and the live connection. */
export default function MissionLayout() {
  const { color } = useTheme().theme;
  const { bottom } = useSafeAreaInsets();
  useMissionLive();
  useOfflineDownload();
  useLocationTracking();
  useGpsStatus();
  useLeaveWhenRemoved();
  const { unread } = useMessagesInbox();

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
            <TabButton label={tab.label} icon={tab.icon} tone={tab.tone} count={tab.name === 'messages' ? unread : 0} />
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
