import { radius, spacing, typography } from '@trace/design';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';
import { pendingTokens } from '../../theme/pending';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'accent';

/** A short state word on a chip (wireframe `.tcx-badge`). The word carries the meaning; the color only repeats it. */
export function Badge({
  label,
  tone = 'neutral',
  dot = false,
  icon,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
  /** A line icon before the word, e.g. the offline icon of a report that waits for sync (Fm10). */
  icon?: IconName;
}) {
  const { color } = useTheme().theme;
  const ink = { neutral: color.inkSecondary, ok: color.success, warn: color.warning, accent: color.accent }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: color.chip }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: ink }]} /> : null}
      {icon ? <Icon name={icon} color={ink} size={pendingTokens.dot * 2} /> : null}
      <Text style={[typography.caption, styles.label, { color: ink }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.space2,
    height: pendingTokens.badgeH,
    paddingHorizontal: spacing.space3,
    borderRadius: radius.radiusSm,
  },
  dot: { width: pendingTokens.dot, height: pendingTokens.dot, borderRadius: radius.radiusSm },
  label: { fontWeight: typography.bodyStrong.fontWeight },
});
