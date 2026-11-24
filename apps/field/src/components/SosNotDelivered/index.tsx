import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { EMERGENCY_NUMBER } from '../../phone';
import type { SosSendFailure } from '../../sos/sendFailure';
import { canRetry, SEND_REASON } from '../../sos/sendFailure/sendFailureText';
import { useTheme } from '../../theme';

/**
 * UC-F13's Offline flow on Fm12: the SOS did not reach anyone, so the searcher is told so at once and can call
 * emergency services through the regular dialer (decision 24). The hold button above stays, for the next try.
 */
export function SosNotDelivered({ failure }: { failure: SosSendFailure }) {
  const { color } = useTheme().theme;
  return (
    <View style={styles.stack}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.card, { backgroundColor: color.dangerSurface, borderColor: color.dangerBorder }]}
      >
        <Text style={[typography.bodyStrong, { color: color.ink }]}>ה-SOS לא נמסר</Text>
        <Text style={[typography.body, { color: color.ink }]}>{SEND_REASON[failure]}</Text>
        <Text style={[typography.meta, { color: color.dangerInkSoft }]}>
          {`התקשר לשירותי החירום (${ltr(EMERGENCY_NUMBER)}).${canRetry(failure) ? ' ההודעה נשמרה; לחיצה ארוכה נוספת תנסה לשלוח שוב.' : ''}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.space5 },
  card: {
    gap: spacing.space4,
    padding: spacing.space6,
    borderWidth: 2,
    borderRadius: radius.radiusLg,
  },
});
