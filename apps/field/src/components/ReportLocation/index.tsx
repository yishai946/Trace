import { radius, spacing, typography } from '@trace/design';
import { formatLatLng } from '@trace/geo';
import { StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { formatTime } from '../../mission/missionArea';
import type { ReportFix } from '../../reports/useReportFix';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { Icon } from '../Icon';

/**
 * Where and when the report is sent from, taken by the phone (Fm08 `.tcx-card`, UC-F09 step 3). A report needs a
 * position, so while there is none the card says why.
 */
export function ReportLocation({
  state,
  fix,
  polygonName,
}: {
  state: 'locating' | 'ready' | 'unavailable';
  fix: ReportFix | null;
  polygonName: string | null;
}) {
  const { color } = useTheme().theme;
  const meta =
    state === 'ready' && fix
      ? `${ltr(formatLatLng(fix.position))}, ${ltr(formatTime(new Date(fix.at).toISOString()))}`
      : state === 'locating'
        ? 'מאתר מיקום…'
        : 'אין מיקום GPS. הפעל את שירותי המיקום בטלפון כדי לשלוח.';
  return (
    <View style={[styles.card, { backgroundColor: color.surfaceSunken, borderColor: color.border }]}>
      <Icon name="reports" large color={state === 'unavailable' ? color.warning : color.inkSecondary} />
      <View style={styles.text}>
        <Text style={[typography.title, { color: color.ink }]}>מיקום ושעה אוטומטיים</Text>
        <Text style={[typography.meta, { color: state === 'unavailable' ? color.warning : color.inkMuted }]}>
          {meta}
        </Text>
      </View>
      {polygonName ? <Badge label={polygonName} tone="accent" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space5,
    paddingVertical: spacing.space5,
    paddingHorizontal: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusLg,
  },
  text: { flex: 1 },
});
