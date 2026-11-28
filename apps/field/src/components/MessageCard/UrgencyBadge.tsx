import { radius, size, spacing, typography } from '@trace/design';
import type { MessageUrgency } from '@trace/schemas';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../Icon';

const labels: Record<MessageUrgency, string> = { normal: 'רגילה', important: 'חשובה', critical: 'קריטית' };
const icons: Record<MessageUrgency, IconName | null> = { normal: null, important: 'hazard', critical: 'alert' };

/** The urgency of a message (wireframe `.tcx-badge--ink` for critical, `--outline` for important). The word and the icon carry it. */
export function UrgencyBadge({ urgency }: { urgency: MessageUrgency }) {
  const { color } = useTheme().theme;
  const critical = urgency === 'critical';
  const ink = critical ? color.onPrimary : color.ink;
  const icon = icons[urgency];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: critical ? color.primary : urgency === 'normal' ? color.chip : 'transparent',
          borderColor: urgency === 'important' ? color.inkMuted : 'transparent',
        },
      ]}
    >
      {icon ? <Icon name={icon} color={ink} size={size.iconMd} /> : null}
      <Text style={[typography.caption, styles.label, { color: ink }]}>{labels[urgency]}</Text>
    </View>
  );
}

export const urgencyLabel = labels;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.space2,
    height: size.badgeH,
    paddingHorizontal: spacing.space3,
    borderRadius: radius.radiusSm,
    borderWidth: 1,
  },
  label: { fontWeight: typography.bodyStrong.fontWeight },
});
