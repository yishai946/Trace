import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { dial, EMERGENCY_NUMBER } from '../../phone';
import type { SosSendFailure } from '../../sos/sendFailure';
import { useTheme } from '../../theme';
import { Button } from '../Button';

const REASON: Record<SosSendFailure, string> = {
  offline: 'אין חיבור לשרת, ולכן המנהל והמחפשים לא קיבלו אותו.',
  refused: 'השרת לא קיבל אותו, ולכן המנהל והמחפשים לא קיבלו אותו.',
};

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
        <Text style={[typography.body, { color: color.ink }]}>{REASON[failure]}</Text>
        <Text style={[typography.meta, { color: color.dangerInkSoft }]}>
          {`התקשר לשירותי החירום (${ltr(EMERGENCY_NUMBER)}). ההודעה נשמרה; לחיצה ארוכה נוספת תנסה לשלוח שוב.`}
        </Text>
      </View>
      <Button
        label={`חירום ${EMERGENCY_NUMBER}`}
        accessibilityLabel={`התקשר לחירום ${EMERGENCY_NUMBER}`}
        variant="primary"
        size="lg"
        block
        icon="phone"
        onPress={() => void dial(EMERGENCY_NUMBER)}
      />
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
