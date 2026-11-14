import { spacing, typography } from '@trace/design';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistance, type ReportItem } from '../../reports/reportItems';
import { useTheme } from '../../theme';
import { CallsignChip } from '../CallsignChip';

interface CollapsedMetaProps {
  item: ReportItem;
  /** The badge for a report that is still waiting to be sent. */
  waiting: ReactNode;
}

/** The line under a closed card: who sent it and how far, or that it is mine and whether it was sent yet. */
export function CollapsedMeta({ item, waiting }: CollapsedMetaProps) {
  const { color } = useTheme().theme;
  return (
    <View style={styles.row}>
      {item.mine ? (
        <>
          <Text style={[typography.meta, { color: color.inkSecondary }]}>הדיווח שלי</Text>
          <View style={styles.spacer} />
          {item.pending ? waiting : null}
        </>
      ) : (
        <>
          {item.callsign !== null ? <CallsignChip callsign={item.callsign} /> : null}
          <Text style={[typography.meta, { color: color.inkSecondary }]}>{item.name}</Text>
          {item.distanceMeters !== null ? (
            <Text style={[typography.meta, styles.time, { color: color.inkSecondary }]}>
              {`· ${formatDistance(item.distanceMeters)}`}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  spacer: { flex: 1 },
  time: { fontVariant: ['tabular-nums'] },
});
