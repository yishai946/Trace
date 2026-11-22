import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useOfflinePackage } from '../../offline/useOfflinePackage';
import { useTheme } from '../../theme';
import { ltr } from '../../i18n/rtl';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Meter } from '../Meter';

/**
 * Fm03 "הורדת מידע ללא חיבור" and Fm05 "מידע Offline": the progress of the download that starts after joining, and
 * "מוכן ל-Offline" once the essential package is saved (UC-F03). A cut-off download says so and resumes by itself.
 */
export function OfflineDownload() {
  const { color } = useTheme().theme;
  const { status, progress, refused, retry } = useOfflinePackage();
  if (status === 'checking') return null;

  if (status === 'ready') {
    return (
      <View
        accessibilityLabel="מידע Offline"
        style={[styles.card, styles.ready, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}
      >
        <Text style={[typography.body, styles.grow, { color: color.ink }]}>מידע Offline</Text>
        <Badge label="מוכן ל-Offline" tone="ok" icon="check" />
      </View>
    );
  }

  const interrupted = status === 'interrupted';
  return (
    <View
      accessibilityLabel="הורדת מידע ללא חיבור"
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        { backgroundColor: color.surfaceSunken, borderColor: interrupted ? color.warning : color.border },
      ]}
    >
      <View style={styles.row}>
        <Text style={[typography.title, styles.grow, { color: color.ink }]}>הורדת מידע ללא חיבור</Text>
        <Text style={[typography.title, { color: color.ink }]}>{`${ltr(progress.percent)}%`}</Text>
      </View>
      <Meter percent={progress.percent} label="התקדמות ההורדה" />
      <Text style={[typography.meta, { color: color.inkMuted }]}>
        {interrupted && refused
          ? 'ההורדה נכשלה. אפשר להישאר במסע, אבל "התחל חיפוש" חסום עד שההורדה תושלם. נסה שוב.'
          : interrupted
            ? 'ההורדה נקטעה. היא תמשיך כשהחיבור יחזור. אפשר להישאר במסע, אבל "התחל חיפוש" חסום עד שההורדה תושלם.'
            : 'פרטי המסע והנעדר, תמונה, LKP, נקודת כינוס ופוליגונים. ההורדה התחילה אוטומטית.'}
      </Text>
      {interrupted ? <Button label="נסה שוב" onPress={retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.space4, padding: spacing.space6, borderWidth: 1, borderRadius: radius.radiusLg },
  ready: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.space4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  grow: { flex: 1 },
});
