import { spacing } from '@trace/design';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAlerts } from '../../alerts';
import { openScreen } from '../../navigation/navigate';
import { Button } from '../Button';
import { Notice } from '../Notice';

/**
 * The alerts the app raised while it is open, over the top of the mission screens: low battery, an SOS sent to the
 * searcher and a change of the missing person's details. Each announces itself, opens its screen when it has one, and
 * can be closed.
 */
export function AlertBanners() {
  const router = useRouter();
  const alerts = useAlerts((s) => s.alerts);
  const dismiss = useAlerts((s) => s.dismiss);
  if (alerts.length === 0) return null;
  return (
    <SafeAreaView edges={['top']} style={styles.top} pointerEvents="box-none">
      {alerts.map(({ id, kind, title, text, href }) => (
        <View key={id} style={styles.alert}>
          <Notice tone="warn" live icon={kind === 'sos' ? 'sos' : 'alert'}>
            {`${title}: ${text}`}
          </Notice>
          <View style={styles.actions}>
            {href ? (
              <Button
                label="פתח"
                size="md"
                onPress={() => {
                  dismiss(id);
                  openScreen(router, href);
                }}
              />
            ) : null}
            <Button label="סגור" variant="ghost" onPress={() => dismiss(id)} />
          </View>
        </View>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 0, start: 0, end: 0, padding: spacing.space6, gap: spacing.space4 },
  alert: { gap: spacing.space3 },
  actions: { flexDirection: 'row', gap: spacing.space4 },
});
