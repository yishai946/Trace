import { radius, size, spacing, typography } from '@trace/design';
import type { Mission } from '@trace/schemas';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { endedOutcome, formatDay, missionTitle } from '../../history/summary';
import { useTheme } from '../../theme';
import { Badge } from '../Badge';
import { HistoryDetails } from '../HistoryDetails';

/** One ended mission in the history (Fm15): its title and how it ended; pressing it opens it read-only below. */
export function HistoryRow({ mission, open, onPress }: { mission: Mission; open: boolean; onPress: () => void }) {
  const { color } = useTheme().theme;
  const outcome = endedOutcome(mission);
  const meta = [outcome.endedAt ? formatDay(outcome.endedAt) : null, outcome.word].filter((p) => p !== null).join(', ');
  return (
    <View style={styles.item}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${missionTitle(mission)}, ${meta}`}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={onPress}
        style={[
          styles.row,
          { backgroundColor: color.surface, borderColor: open ? color.inkMuted : color.borderStrong },
        ]}
      >
        <View style={styles.head}>
          <Text style={[typography.bodyStrong, styles.title, { color: color.ink }]}>{missionTitle(mission)}</Text>
          <Badge label="הסתיים" />
        </View>
        <Text style={[typography.meta, { color: color.inkSecondary }]}>{meta}</Text>
      </Pressable>
      {open ? <HistoryDetails mission={mission} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { gap: spacing.space4 },
  row: {
    minHeight: size.touchTarget,
    gap: spacing.space2,
    paddingVertical: spacing.space4,
    paddingHorizontal: spacing.space6,
    borderWidth: 1,
    borderRadius: radius.radiusLg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.space4 },
  title: { flex: 1 },
});
