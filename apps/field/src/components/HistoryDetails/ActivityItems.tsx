import { REPORT_TYPE_LABELS } from '@trace/domain';
import { spacing, typography } from '@trace/design';
import type { OwnActivity } from '@trace/schemas';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateTime } from '../../mission/missionArea';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';

/** The reports and sightings the searcher sent in the mission, as plain read-only rows (UC-F17). */
export function ActivityItems({ activity }: { activity: Pick<OwnActivity, 'reports' | 'sightings'> }) {
  const { color } = useTheme().theme;
  const rows = [
    ...activity.reports.map((report) => ({
      key: report.id,
      badge: REPORT_TYPE_LABELS[report.type],
      time: report.reportedAt,
      text: report.text,
    })),
    ...activity.sightings.map((sighting) => ({
      key: sighting.id,
      badge: `תצפית ${sighting.number}`,
      time: sighting.observedAt,
      text: sighting.description ?? '',
    })),
  ];
  if (rows.length === 0) {
    return <Text style={[typography.body, { color: color.inkSecondary }]}>לא שלחת דיווחים או תצפיות במסע הזה</Text>;
  }
  return (
    <View accessibilityLabel="הדיווחים והתצפיות שלי" style={styles.list}>
      {rows.map((row) => (
        <View key={row.key} style={[styles.row, { borderTopColor: color.borderSubtle }]}>
          <View style={styles.head}>
            <Badge label={row.badge} />
            <Text style={[typography.meta, { color: color.inkSecondary }]}>{formatDateTime(row.time)}</Text>
          </View>
          {row.text ? <Text style={[typography.body, { color: color.ink }]}>{row.text}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.space2 },
  row: { gap: spacing.space3, paddingVertical: spacing.space4, borderTopWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
});
