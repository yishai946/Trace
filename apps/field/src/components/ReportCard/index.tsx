import { radius, spacing, typography } from '@trace/design';
import { formatCallsign } from '@trace/domain';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ltr } from '../../i18n/rtl';
import { formatDistance, type ReportItem } from '../../reports/reportItems';
import { useTheme } from '../../theme';
import { pendingTokens } from '../../theme/pending';
import { Badge } from '../Badge';
import { CallsignChip } from '../CallsignChip';
import { ReportImage } from '../ReportImage';

const COORDINATE_DIGITS = 4;

export interface ReportCardProps {
  item: ReportItem;
  /** Open: the whole text, the photo and the place (wireframe Fm10, the selected `.tcx-report`). */
  selected: boolean;
  onPress: () => void;
}

/**
 * One report of the polygon (UC-F11, Fm10). Closed it is one line; pressing it opens the details, and pressing it again
 * closes them. Editing your own report is a separate screen.
 */
export function ReportCard({ item, selected, onPress }: ReportCardProps) {
  const { color } = useTheme().theme;
  const [lng, lat] = item.position;
  const place = [
    `${ltr(lat.toFixed(COORDINATE_DIGITS))}, ${ltr(lng.toFixed(COORDINATE_DIGITS))}`,
    item.polygonName ? `פוליגון ${item.polygonName}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const who = item.mine
    ? 'הדיווח שלי'
    : [item.callsign === null ? null : formatCallsign(item.callsign), item.name].filter(Boolean).join(' ');
  const label = [
    item.typeLabel,
    item.time,
    item.text,
    who,
    !item.mine && item.distanceMeters !== null ? formatDistance(item.distanceMeters) : null,
  ]
    .filter(Boolean)
    .join(', ');
  const waiting = <Badge tone="warn" icon="wifiOff" label="ממתין לסנכרון" />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ expanded: selected }}
      aria-expanded={selected}
      onPress={onPress}
      style={[
        styles.card,
        selected && styles.open,
        { backgroundColor: selected ? color.surfaceRaised : 'transparent' },
      ]}
    >
      <View style={styles.row}>
        <Badge label={item.typeLabel} />
        {item.mine ? <Badge tone="accent" label="שלי" /> : null}
        <View style={styles.spacer} />
        <Text style={[typography.meta, styles.time, { color: color.inkSecondary }]}>{item.time}</Text>
      </View>
      <Text
        numberOfLines={selected ? undefined : 1}
        style={[typography.body, selected && styles.fullText, { color: color.ink }]}
      >
        {item.text}
      </Text>
      {selected ? (
        <View style={styles.details}>
          <ReportImage url={item.photoUrl} />
          <View style={styles.detailText}>
            <Text style={[typography.meta, styles.time, { color: color.inkSecondary }]}>{place}</Text>
            {item.pending ? waiting : item.mine ? <Badge tone="ok" icon="check" label="נשלח" /> : null}
          </View>
        </View>
      ) : (
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
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: pendingTokens.reportCardMinH,
    justifyContent: 'center',
    gap: spacing.space3,
    paddingVertical: spacing.space5,
    paddingHorizontal: spacing.space6,
    borderRadius: radius.radiusLg,
  },
  open: { gap: spacing.space5, padding: spacing.space6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.space3 },
  spacer: { flex: 1 },
  time: { fontVariant: ['tabular-nums'] },
  fullText: { lineHeight: typography.body.lineHeight * pendingTokens.reportTextLeading },
  details: { flexDirection: 'row', gap: spacing.space5 },
  detailText: { flex: 1, gap: spacing.space3, alignItems: 'flex-start' },
});
